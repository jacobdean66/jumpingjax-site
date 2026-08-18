-- Adult Open Play attendance: watching is free; playing is $7.
-- Keeps classification and the append-only payment ledger in one transaction.

create or replace function public.prevent_open_play_attendee_rewrite()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'open_play_visit_attendees cannot be deleted' using errcode = 'P0001';
  end if;
  if old.status = 'active' and new.status = 'removed' then
    if new.visit_id is distinct from old.visit_id
       or new.participant_id is distinct from old.participant_id
       or new.waiver_submission_id is distinct from old.waiver_submission_id
       or new.business_day_ymd is distinct from old.business_day_ymd
       or new.classification is distinct from old.classification
       or new.age_years_on_visit is distinct from old.age_years_on_visit
       or new.unit_price_cents is distinct from old.unit_price_cents
       or new.created_at is distinct from old.created_at then
      raise exception 'attendee historical fields are immutable' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if old.status = 'active' and new.status = 'active'
     and old.classification in ('playing_adult', 'watching_adult')
     and new.classification in ('playing_adult', 'watching_adult')
     and new.unit_price_cents = public.jj_open_play_unit_price(new.classification)
     and new.visit_id is not distinct from old.visit_id
     and new.participant_id is not distinct from old.participant_id
     and new.waiver_submission_id is not distinct from old.waiver_submission_id
     and new.business_day_ymd is not distinct from old.business_day_ymd
     and new.age_years_on_visit is not distinct from old.age_years_on_visit
     and new.created_at is not distinct from old.created_at then
    return new;
  end if;
  raise exception 'open_play_visit_attendees are immutable except approved attendance changes'
    using errcode = 'P0001';
end;
$$;

create or replace function public.update_open_play_adult_attendance_atomic(
  p_attendee_id uuid,
  p_visit_id uuid,
  p_mode text,
  p_payment_method text,
  p_staff_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attendee public.open_play_visit_attendees%rowtype;
  v_original public.open_play_payment_entries%rowtype;
  v_current_amount integer := 0;
  v_current_method text := 'cash';
  v_target_class text;
  v_target_amount integer;
  v_delta integer;
begin
  if p_mode not in ('playing', 'watching') or p_staff_id is null or length(trim(p_staff_id)) = 0 then
    return jsonb_build_object('outcome', 'invalid_input');
  end if;
  if p_mode = 'playing' and p_payment_method not in ('cash', 'card') then
    return jsonb_build_object('outcome', 'invalid_input');
  end if;

  select * into v_attendee
  from public.open_play_visit_attendees
  where id = p_attendee_id and visit_id = p_visit_id
  for update;
  if not found or v_attendee.status <> 'active' then
    return jsonb_build_object('outcome', 'not_found');
  end if;
  if v_attendee.classification not in ('playing_adult', 'watching_adult') then
    return jsonb_build_object('outcome', 'not_adult');
  end if;

  select * into v_original
  from public.open_play_payment_entries
  where visit_id = p_visit_id and attendee_id = p_attendee_id and entry_type = 'charge'
  order by created_at, id limit 1;

  select coalesce(sum(amount_cents), 0) into v_current_amount
  from public.open_play_payment_entries
  where visit_id = p_visit_id and attendee_id = p_attendee_id;

  select method into v_current_method
  from public.open_play_payment_entries
  where visit_id = p_visit_id and attendee_id = p_attendee_id and amount_cents > 0
  order by created_at desc, id desc limit 1;
  v_current_method := coalesce(v_current_method, v_original.method, 'cash');

  v_target_class := case when p_mode = 'playing' then 'playing_adult' else 'watching_adult' end;
  v_target_amount := case when p_mode = 'playing' then 700 else 0 end;

  if v_original.id is null and v_target_amount > 0 then
    insert into public.open_play_payment_entries (
      visit_id, attendee_id, entry_type, method, amount_cents, created_by_staff_id
    ) values (
      p_visit_id, p_attendee_id, 'charge', p_payment_method, v_target_amount, p_staff_id
    );
  elsif v_original.id is not null then
    if v_current_amount > 0 and v_target_amount > 0 and v_current_method <> p_payment_method then
      insert into public.open_play_payment_entries (
        visit_id, attendee_id, entry_type, method, amount_cents,
        related_entry_id, reason, created_by_staff_id
      ) values
        (p_visit_id, p_attendee_id, 'correction', v_current_method, -v_current_amount,
         v_original.id, 'Adult attendance or payment method changed', p_staff_id),
        (p_visit_id, p_attendee_id, 'correction', p_payment_method, v_target_amount,
         v_original.id, 'Adult attendance or payment method changed', p_staff_id);
    else
      v_delta := v_target_amount - v_current_amount;
      if v_delta <> 0 then
        insert into public.open_play_payment_entries (
          visit_id, attendee_id, entry_type, method, amount_cents,
          related_entry_id, reason, created_by_staff_id
        ) values (
          p_visit_id, p_attendee_id, 'correction',
          case when v_delta > 0 then p_payment_method else v_current_method end,
          v_delta, v_original.id, 'Adult attendance changed', p_staff_id
        );
      end if;
    end if;
  end if;

  update public.open_play_visit_attendees
  set classification = v_target_class,
      unit_price_cents = v_target_amount
  where id = p_attendee_id;

  insert into public.open_play_audit_events (
    actor_staff_id, action, entity_type, entity_id, detail
  ) values (
    p_staff_id, 'adult_attendance_edit', 'open_play_visit_attendee', p_attendee_id::text,
    jsonb_build_object(
      'visitId', p_visit_id, 'previousClassification', v_attendee.classification,
      'classification', v_target_class, 'amountCents', v_target_amount,
      'paymentMethod', case when v_target_amount > 0 then p_payment_method else null end
    )
  );

  return jsonb_build_object('outcome', 'updated', 'classification', v_target_class);
exception when unique_violation then
  return jsonb_build_object('outcome', 'conflict');
end;
$$;

create or replace function public.update_legacy_open_play_adult_attendance_atomic(
  p_attendee_id uuid,
  p_visit_id uuid,
  p_mode text,
  p_payment_method text,
  p_staff_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attendee public.smartwaiver_legacy_check_ins%rowtype;
  v_original public.smartwaiver_legacy_payment_entries%rowtype;
  v_current_amount integer := 0;
  v_current_method text := 'cash';
  v_target_class text;
  v_target_amount integer;
  v_delta integer;
begin
  if p_mode not in ('playing', 'watching') or p_staff_id is null or length(trim(p_staff_id)) = 0 then
    return jsonb_build_object('outcome', 'invalid_input');
  end if;
  if p_mode = 'playing' and p_payment_method not in ('cash', 'card') then
    return jsonb_build_object('outcome', 'invalid_input');
  end if;

  select * into v_attendee
  from public.smartwaiver_legacy_check_ins
  where id = p_attendee_id and legacy_visit_id = p_visit_id
  for update;
  if not found or v_attendee.status <> 'active' then
    return jsonb_build_object('outcome', 'not_found');
  end if;
  if v_attendee.classification not in ('playing_adult', 'watching_adult') then
    return jsonb_build_object('outcome', 'not_adult');
  end if;

  select * into v_original
  from public.smartwaiver_legacy_payment_entries
  where legacy_visit_id = p_visit_id and legacy_check_in_id = p_attendee_id and entry_type = 'charge'
  order by created_at, id limit 1;

  select coalesce(sum(amount_cents), 0) into v_current_amount
  from public.smartwaiver_legacy_payment_entries
  where legacy_visit_id = p_visit_id and legacy_check_in_id = p_attendee_id;

  select method into v_current_method
  from public.smartwaiver_legacy_payment_entries
  where legacy_visit_id = p_visit_id and legacy_check_in_id = p_attendee_id and amount_cents > 0
  order by created_at desc, id desc limit 1;
  v_current_method := coalesce(v_current_method, v_original.method, 'cash');

  v_target_class := case when p_mode = 'playing' then 'playing_adult' else 'watching_adult' end;
  v_target_amount := case when p_mode = 'playing' then 700 else 0 end;

  if v_original.id is null and v_target_amount > 0 then
    insert into public.smartwaiver_legacy_payment_entries (
      legacy_visit_id, legacy_check_in_id, entry_type, method, amount_cents, created_by_staff_id
    ) values (
      p_visit_id, p_attendee_id, 'charge', p_payment_method, v_target_amount, p_staff_id
    );
  elsif v_original.id is not null then
    if v_current_amount > 0 and v_target_amount > 0 and v_current_method <> p_payment_method then
      insert into public.smartwaiver_legacy_payment_entries (
        legacy_visit_id, legacy_check_in_id, entry_type, method, amount_cents,
        related_entry_id, reason, created_by_staff_id
      ) values
        (p_visit_id, p_attendee_id, 'correction', v_current_method, -v_current_amount,
         v_original.id, 'Adult attendance or payment method changed', p_staff_id),
        (p_visit_id, p_attendee_id, 'correction', p_payment_method, v_target_amount,
         v_original.id, 'Adult attendance or payment method changed', p_staff_id);
    else
      v_delta := v_target_amount - v_current_amount;
      if v_delta <> 0 then
        insert into public.smartwaiver_legacy_payment_entries (
          legacy_visit_id, legacy_check_in_id, entry_type, method, amount_cents,
          related_entry_id, reason, created_by_staff_id
        ) values (
          p_visit_id, p_attendee_id, 'correction',
          case when v_delta > 0 then p_payment_method else v_current_method end,
          v_delta, v_original.id, 'Adult attendance changed', p_staff_id
        );
      end if;
    end if;
  end if;

  update public.smartwaiver_legacy_check_ins
  set classification = v_target_class,
      unit_price_cents = v_target_amount,
      payment_method = case when v_target_amount > 0 then p_payment_method else null end
  where id = p_attendee_id;

  insert into public.open_play_audit_events (
    actor_staff_id, action, entity_type, entity_id, detail
  ) values (
    p_staff_id, 'legacy_adult_attendance_edit', 'smartwaiver_legacy_check_in', p_attendee_id::text,
    jsonb_build_object(
      'visitId', p_visit_id, 'previousClassification', v_attendee.classification,
      'classification', v_target_class, 'amountCents', v_target_amount,
      'paymentMethod', case when v_target_amount > 0 then p_payment_method else null end
    )
  );

  return jsonb_build_object('outcome', 'updated', 'classification', v_target_class);
exception when unique_violation then
  return jsonb_build_object('outcome', 'conflict');
end;
$$;

revoke all on function public.update_open_play_adult_attendance_atomic(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.update_open_play_adult_attendance_atomic(uuid, uuid, text, text, text)
  to service_role;
revoke all on function public.update_legacy_open_play_adult_attendance_atomic(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.update_legacy_open_play_adult_attendance_atomic(uuid, uuid, text, text, text)
  to service_role;

-- Preserve imported parent signers as selectable adult participants.
alter table public.smartwaiver_legacy_participants
  drop constraint if exists smartwaiver_legacy_participants_participant_slot_check;
alter table public.smartwaiver_legacy_participants
  add constraint smartwaiver_legacy_participants_participant_slot_check
  check (participant_slot in ('primary', 'signer', 'additional_minor'));
alter table public.smartwaiver_legacy_participants
  drop constraint if exists smartwaiver_legacy_participants_slot_chk;
alter table public.smartwaiver_legacy_participants
  add constraint smartwaiver_legacy_participants_slot_chk check (
    (participant_slot in ('primary', 'signer') and minor_index is null)
    or (participant_slot = 'additional_minor' and minor_index is not null)
  );

insert into public.smartwaiver_legacy_participants (
  legacy_waiver_id, waiver_id, participant_slot, minor_index,
  first_name, last_name, dob, role
)
select
  w.id, w.waiver_id, 'signer', null,
  w.signer_first_name, w.signer_last_name, w.signer_dob, 'adult_signer'
from public.smartwaiver_legacy_waivers w
where w.primary_role = 'child'
  and nullif(trim(w.signer_first_name), '') is not null
  and nullif(trim(w.signer_last_name), '') is not null
  and w.signer_dob is not null
  and not exists (
    select 1 from public.smartwaiver_legacy_participants p
    where p.legacy_waiver_id = w.id and p.participant_slot = 'signer'
  )
on conflict do nothing;

-- Publish a new immutable legal version with the adult admission disclosure.
do $$
declare
  v_template public.waiver_templates%rowtype;
  v_current public.waiver_template_versions%rowtype;
  v_body text;
  v_new_id uuid;
begin
  for v_template in
    select * from public.waiver_templates
    where status = 'active' and current_version_id is not null
    for update
  loop
    select * into v_current
    from public.waiver_template_versions
    where id = v_template.current_version_id;

    if v_current.body_html not ilike '%Watching adults are free; playing adults are $7.%' then
      v_body := v_current.body_html ||
        '<section><h2>Open Play Adult Admission</h2><p>Watching adults are free; playing adults are $7. If an adult changes from watching to playing during the same visit, the $7 playing-adult admission must be recorded and paid by cash or card.</p></section>';
      v_new_id := gen_random_uuid();
      insert into public.waiver_template_versions (
        id, template_id, version_number, body_html, body_sha256,
        published_at, published_by_staff_id
      ) values (
        v_new_id, v_template.id, v_current.version_number + 1, v_body,
        encode(extensions.digest(convert_to(v_body, 'UTF8'), 'sha256'), 'hex'),
        now(), 'system:adult-admission-disclosure'
      );
      update public.waiver_templates
      set current_version_id = v_new_id, updated_at = now()
      where id = v_template.id;
    end if;
  end loop;
end;
$$;
