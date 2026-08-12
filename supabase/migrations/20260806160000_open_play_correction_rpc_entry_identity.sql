-- Forward-only: include ledger identity on Open Play correction RPC success entries.
-- Adds attendee_id + related_entry_id derived from inserted ledger-row context.
-- Does not edit 20260804010000_create_native_waiver_open_play.sql.

create or replace function public.apply_open_play_visit_correction_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_visit_id uuid := nullif(p_payload->>'visit_id', '')::uuid;
  v_staff text := nullif(trim(p_payload->>'staff_id'), '');
  v_type text := nullif(trim(p_payload->>'type'), '');
  v_reason text := nullif(trim(p_payload->>'reason'), '');
  v_visit public.open_play_visits%rowtype;
  v_related_id uuid;
  v_related public.open_play_payment_entries%rowtype;
  v_attendee_id uuid;
  v_entries jsonb := '[]'::jsonb;
  v_debit_id uuid;
  v_credit_id uuid;
  v_void_id uuid;
  v_refund_id uuid;
  v_amount integer;
  v_from text;
  v_to text;
  v_method text;
  v_effective text;
  v_corr record;
  v_void_count integer;
  v_refund_sum integer;
  v_updated integer;
begin
  if v_visit_id is null or v_staff is null or v_type is null or v_reason is null then
    return jsonb_build_object('outcome', 'invalid_input');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('open_play_visit:' || v_visit_id::text, 0));

  select * into v_visit from public.open_play_visits where id = v_visit_id for update;
  if not found then
    return jsonb_build_object('outcome', 'visit_not_found');
  end if;
  if v_visit.status = 'voided' then
    return jsonb_build_object('outcome', 'visit_voided');
  end if;

  if v_type = 'method_correction' then
    v_related_id := nullif(p_payload->>'related_entry_id', '')::uuid;
    v_from := p_payload->>'from_method';
    v_to := p_payload->>'to_method';
    v_amount := (p_payload->>'amount_cents')::integer;
    if v_from not in ('cash', 'card') or v_to not in ('cash', 'card') or v_from = v_to or v_amount is null then
      return jsonb_build_object('outcome', 'invalid_input');
    end if;
    select * into v_related from public.open_play_payment_entries where id = v_related_id for update;
    if not found or v_related.visit_id <> v_visit_id or v_related.entry_type <> 'charge' then
      return jsonb_build_object('outcome', 'related_entry_invalid');
    end if;
    if exists (select 1 from public.open_play_payment_entries where related_entry_id = v_related_id and entry_type = 'void') then
      return jsonb_build_object('outcome', 'charge_already_voided');
    end if;
    if exists (select 1 from public.open_play_payment_entries where related_entry_id = v_related_id and entry_type = 'refund') then
      return jsonb_build_object('outcome', 'correction_after_refund_rejected');
    end if;
    if exists (
      select 1 from public.open_play_payment_entries
      where related_entry_id = v_related_id and entry_type = 'correction' and amount_cents > 0
        and method is distinct from v_related.method
    ) then
      return jsonb_build_object('outcome', 'method_already_corrected');
    end if;
    if v_related.method is distinct from v_from or v_related.amount_cents is distinct from v_amount then
      return jsonb_build_object('outcome', 'correction_amount_or_method_mismatch');
    end if;
    v_debit_id := gen_random_uuid();
    v_credit_id := gen_random_uuid();
    insert into public.open_play_payment_entries (
      id, visit_id, attendee_id, entry_type, method, amount_cents, related_entry_id, reason, created_by_staff_id
    ) values
      (v_debit_id, v_visit_id, v_related.attendee_id, 'correction', v_from, -v_amount, v_related_id, v_reason, v_staff),
      (v_credit_id, v_visit_id, v_related.attendee_id, 'correction', v_to, v_amount, v_related_id, v_reason, v_staff);
    v_entries := jsonb_build_array(
      jsonb_build_object(
        'id', v_debit_id,
        'entry_type', 'correction',
        'method', v_from,
        'amount_cents', -v_amount,
        'attendee_id', v_related.attendee_id,
        'related_entry_id', v_related_id
      ),
      jsonb_build_object(
        'id', v_credit_id,
        'entry_type', 'correction',
        'method', v_to,
        'amount_cents', v_amount,
        'attendee_id', v_related.attendee_id,
        'related_entry_id', v_related_id
      )
    );

  elsif v_type = 'void' then
    v_related_id := nullif(p_payload->>'related_entry_id', '')::uuid;
    select * into v_related from public.open_play_payment_entries where id = v_related_id for update;
    if not found or v_related.visit_id <> v_visit_id or v_related.entry_type <> 'charge' then
      return jsonb_build_object('outcome', 'related_entry_invalid');
    end if;
    select count(*) into v_void_count from public.open_play_payment_entries where related_entry_id = v_related_id and entry_type = 'void';
    if v_void_count > 0 then
      return jsonb_build_object('outcome', 'charge_already_voided');
    end if;
    select coalesce(sum(-amount_cents),0) into v_refund_sum from public.open_play_payment_entries where related_entry_id = v_related_id and entry_type = 'refund';
    if v_refund_sum > 0 then
      return jsonb_build_object('outcome', 'void_after_refund_rejected');
    end if;
    v_effective := v_related.method;
    for v_corr in
      select method, amount_cents from public.open_play_payment_entries
      where related_entry_id = v_related_id and entry_type = 'correction'
      order by created_at, id
    loop
      if v_corr.amount_cents > 0 then v_effective := v_corr.method; end if;
    end loop;
    v_attendee_id := nullif(p_payload->>'remove_attendee_id', '')::uuid;
    -- Validate attendee removal target BEFORE writing the void.
    if v_attendee_id is not null then
      if not exists (
        select 1 from public.open_play_visit_attendees
        where id = v_attendee_id and visit_id = v_visit_id and status = 'active'
      ) then
        return jsonb_build_object('outcome', 'attendee_not_found_or_removed');
      end if;
    end if;
    v_void_id := gen_random_uuid();
    insert into public.open_play_payment_entries (
      id, visit_id, attendee_id, entry_type, method, amount_cents, related_entry_id, reason, created_by_staff_id
    ) values (
      v_void_id, v_visit_id, v_related.attendee_id, 'void', v_effective, -abs(v_related.amount_cents), v_related_id, v_reason, v_staff
    );
    v_entries := jsonb_build_array(jsonb_build_object(
      'id', v_void_id,
      'entry_type', 'void',
      'method', v_effective,
      'amount_cents', -abs(v_related.amount_cents),
      'attendee_id', v_related.attendee_id,
      'related_entry_id', v_related_id
    ));
    if v_attendee_id is not null then
      update public.open_play_visit_attendees
      set status = 'removed'
      where id = v_attendee_id and visit_id = v_visit_id and status = 'active';
      get diagnostics v_updated = row_count;
      if v_updated <> 1 then
        raise exception using errcode = 'P0001', message = 'attendee_not_found_or_removed';
      end if;
    end if;

  elsif v_type = 'refund' then
    v_related_id := nullif(p_payload->>'related_entry_id', '')::uuid;
    v_method := p_payload->>'method';
    v_amount := (p_payload->>'amount_cents')::integer;
    if v_method not in ('cash', 'card') or v_amount is null or v_amount <= 0 then
      return jsonb_build_object('outcome', 'invalid_input');
    end if;
    select * into v_related from public.open_play_payment_entries where id = v_related_id for update;
    if not found or v_related.visit_id <> v_visit_id or v_related.entry_type <> 'charge' then
      return jsonb_build_object('outcome', 'related_entry_invalid');
    end if;
    if exists (select 1 from public.open_play_payment_entries where related_entry_id = v_related_id and entry_type = 'void') then
      return jsonb_build_object('outcome', 'refund_after_void_rejected');
    end if;
    select coalesce(sum(-amount_cents),0) into v_refund_sum from public.open_play_payment_entries where related_entry_id = v_related_id and entry_type = 'refund';
    if v_amount > (v_related.amount_cents - v_refund_sum) then
      return jsonb_build_object('outcome', 'refund_exceeds_remaining');
    end if;
    v_effective := v_related.method;
    for v_corr in
      select method, amount_cents from public.open_play_payment_entries
      where related_entry_id = v_related_id and entry_type = 'correction'
      order by created_at, id
    loop
      if v_corr.amount_cents > 0 then v_effective := v_corr.method; end if;
    end loop;
    if v_method is distinct from v_effective then
      return jsonb_build_object('outcome', 'refund_method_mismatch');
    end if;
    v_refund_id := gen_random_uuid();
    insert into public.open_play_payment_entries (
      id, visit_id, attendee_id, entry_type, method, amount_cents, related_entry_id, reason, created_by_staff_id
    ) values (
      v_refund_id, v_visit_id, v_related.attendee_id, 'refund', v_method, -v_amount, v_related_id, v_reason, v_staff
    );
    v_entries := jsonb_build_array(jsonb_build_object(
      'id', v_refund_id,
      'entry_type', 'refund',
      'method', v_method,
      'amount_cents', -v_amount,
      'attendee_id', v_related.attendee_id,
      'related_entry_id', v_related_id
    ));

  elsif v_type = 'remove_attendee' then
    v_attendee_id := nullif(p_payload->>'attendee_id', '')::uuid;
    v_related_id := nullif(p_payload->>'related_entry_id', '')::uuid;
    if v_attendee_id is null then
      return jsonb_build_object('outcome', 'invalid_input');
    end if;
    if not exists (
      select 1 from public.open_play_visit_attendees
      where id = v_attendee_id and visit_id = v_visit_id and status = 'active'
    ) then
      return jsonb_build_object('outcome', 'attendee_not_found_or_removed');
    end if;
    -- Require financial reversal when an active charge remains.
    if v_related_id is null then
      select id into v_related_id
      from public.open_play_payment_entries e
      where e.visit_id = v_visit_id
        and e.attendee_id = v_attendee_id
        and e.entry_type = 'charge'
        and not exists (
          select 1 from public.open_play_payment_entries x
          where x.related_entry_id = e.id and x.entry_type = 'void'
        )
        and (
          e.amount_cents - coalesce((
            select sum(-r.amount_cents) from public.open_play_payment_entries r
            where r.related_entry_id = e.id and r.entry_type = 'refund'
          ), 0)
        ) > 0
      limit 1;
      if v_related_id is not null then
        return jsonb_build_object('outcome', 'financial_reversal_required', 'related_entry_id', v_related_id);
      end if;
    else
      select * into v_related from public.open_play_payment_entries where id = v_related_id for update;
      if not found or v_related.visit_id <> v_visit_id or v_related.attendee_id is distinct from v_attendee_id then
        return jsonb_build_object('outcome', 'related_entry_invalid');
      end if;
      if exists (select 1 from public.open_play_payment_entries where related_entry_id = v_related_id and entry_type = 'void') then
        return jsonb_build_object('outcome', 'charge_already_voided');
      end if;
      if exists (select 1 from public.open_play_payment_entries where related_entry_id = v_related_id and entry_type = 'refund') then
        return jsonb_build_object('outcome', 'void_after_refund_rejected');
      end if;
      v_effective := v_related.method;
      for v_corr in
        select method, amount_cents from public.open_play_payment_entries
        where related_entry_id = v_related_id and entry_type = 'correction'
        order by created_at, id
      loop
        if v_corr.amount_cents > 0 then v_effective := v_corr.method; end if;
      end loop;
      v_void_id := gen_random_uuid();
      insert into public.open_play_payment_entries (
        id, visit_id, attendee_id, entry_type, method, amount_cents, related_entry_id, reason, created_by_staff_id
      ) values (
        v_void_id, v_visit_id, v_attendee_id, 'void', v_effective, -abs(v_related.amount_cents), v_related_id, v_reason, v_staff
      );
      v_entries := jsonb_build_array(jsonb_build_object(
        'id', v_void_id,
        'entry_type', 'void',
        'method', v_effective,
        'amount_cents', -abs(v_related.amount_cents),
        'attendee_id', v_attendee_id,
        'related_entry_id', v_related_id
      ));
    end if;

    update public.open_play_visit_attendees
    set status = 'removed'
    where id = v_attendee_id and visit_id = v_visit_id and status = 'active';
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception using errcode = 'P0001', message = 'attendee_not_found_or_removed';
    end if;

  else
    return jsonb_build_object('outcome', 'unsupported_type');
  end if;

  insert into public.open_play_audit_events (
    actor_staff_id, action, entity_type, entity_id, detail
  ) values (
    v_staff,
    'visit_' || v_type,
    'open_play_visit',
    v_visit_id::text,
    jsonb_build_object('correctionType', v_type, 'entryCount', jsonb_array_length(v_entries))
  );

  return jsonb_build_object('outcome', 'applied', 'entries', v_entries);
exception
  when sqlstate 'P0001' then
    return jsonb_build_object('outcome', SQLERRM);
  when others then
    return jsonb_build_object('outcome', 'failed', 'error_code', SQLSTATE);
end;
$$;

revoke all on function public.apply_open_play_visit_correction_atomic(jsonb) from public, anon, authenticated;
grant execute on function public.apply_open_play_visit_correction_atomic(jsonb) to service_role;
