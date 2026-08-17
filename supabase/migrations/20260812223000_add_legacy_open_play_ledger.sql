-- Add an auditable visit/payment ledger for Legacy Smartwaiver check-ins.
-- Native waiver evidence and Native Open Play rows are not changed.

create table if not exists public.smartwaiver_legacy_visits (
  id uuid primary key default gen_random_uuid(),
  visit_date date not null,
  business_day_ymd text not null check (business_day_ymd ~ '^\d{4}-\d{2}-\d{2}$'),
  created_by_staff_id text not null check (length(trim(created_by_staff_id)) > 0),
  status text not null default 'open' check (status in ('open', 'finalized', 'voided')),
  notes text null check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  constraint smartwaiver_legacy_visits_day_matches_date
    check (business_day_ymd = to_char(visit_date, 'YYYY-MM-DD'))
);

alter table public.smartwaiver_legacy_check_ins
  add column if not exists legacy_visit_id uuid null;

-- Backfill defensively if any check-ins appeared between rollout steps.
insert into public.smartwaiver_legacy_visits (
  id, visit_date, business_day_ymd, created_by_staff_id, notes, created_at
)
select id, business_day_ymd::date, business_day_ymd, staff_id, notes, created_at
from public.smartwaiver_legacy_check_ins
where legacy_visit_id is null
on conflict (id) do nothing;

update public.smartwaiver_legacy_check_ins
set legacy_visit_id = id
where legacy_visit_id is null;

alter table public.smartwaiver_legacy_check_ins
  alter column legacy_visit_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'smartwaiver_legacy_check_ins_visit_fk'
  ) then
    alter table public.smartwaiver_legacy_check_ins
      add constraint smartwaiver_legacy_check_ins_visit_fk
      foreign key (legacy_visit_id)
      references public.smartwaiver_legacy_visits(id)
      on delete restrict;
  end if;
end $$;

create index if not exists smartwaiver_legacy_check_ins_visit_idx
  on public.smartwaiver_legacy_check_ins (legacy_visit_id);
create index if not exists smartwaiver_legacy_visits_business_day_idx
  on public.smartwaiver_legacy_visits (business_day_ymd, created_at);

create table if not exists public.smartwaiver_legacy_payment_entries (
  id uuid primary key default gen_random_uuid(),
  legacy_visit_id uuid not null references public.smartwaiver_legacy_visits(id) on delete restrict,
  legacy_check_in_id uuid null references public.smartwaiver_legacy_check_ins(id) on delete restrict,
  entry_type text not null check (entry_type in ('charge', 'correction', 'void', 'refund')),
  method text not null check (method in ('cash', 'card')),
  amount_cents integer not null check (amount_cents <> 0),
  related_entry_id uuid null references public.smartwaiver_legacy_payment_entries(id) on delete restrict,
  reason text null check (reason is null or (length(trim(reason)) > 0 and length(reason) <= 500)),
  created_by_staff_id text not null check (length(trim(created_by_staff_id)) > 0),
  created_at timestamptz not null default now(),
  constraint smartwaiver_legacy_payment_entry_shape check (
    (entry_type = 'charge' and amount_cents > 0 and related_entry_id is null and reason is null)
    or (entry_type <> 'charge' and related_entry_id is not null and reason is not null)
  )
);

create index if not exists smartwaiver_legacy_payment_visit_idx
  on public.smartwaiver_legacy_payment_entries (legacy_visit_id, created_at, id);
create index if not exists smartwaiver_legacy_payment_related_idx
  on public.smartwaiver_legacy_payment_entries (related_entry_id);

alter table public.smartwaiver_legacy_visits enable row level security;
alter table public.smartwaiver_legacy_payment_entries enable row level security;

drop policy if exists "No public smartwaiver_legacy_visits access"
  on public.smartwaiver_legacy_visits;
create policy "No public smartwaiver_legacy_visits access"
  on public.smartwaiver_legacy_visits for all to anon, authenticated
  using (false) with check (false);

drop policy if exists "No public smartwaiver_legacy_payment_entries access"
  on public.smartwaiver_legacy_payment_entries;
create policy "No public smartwaiver_legacy_payment_entries access"
  on public.smartwaiver_legacy_payment_entries for all to anon, authenticated
  using (false) with check (false);

drop trigger if exists prevent_smartwaiver_legacy_payment_mutation_trg
  on public.smartwaiver_legacy_payment_entries;
create trigger prevent_smartwaiver_legacy_payment_mutation_trg
  before update or delete on public.smartwaiver_legacy_payment_entries
  for each row execute function public.prevent_append_only_mutation();

create or replace function public.create_smartwaiver_legacy_check_ins_atomic(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_visit_id uuid := nullif(p_payload->>'legacy_visit_id', '')::uuid;
  v_day text := p_payload->>'business_day_ymd';
  v_staff text := p_payload->>'staff_id';
  v_notes text := nullif(trim(p_payload->>'notes'), '');
  v_item jsonb;
  v_check_in_id uuid;
  v_payment_id uuid;
  v_attendees jsonb := '[]'::jsonb;
  v_payments jsonb := '[]'::jsonb;
  v_ids jsonb := '[]'::jsonb;
begin
  if v_visit_id is null or v_day is null or v_day !~ '^\d{4}-\d{2}-\d{2}$'
     or v_staff is null or length(trim(v_staff)) = 0
     or jsonb_typeof(p_payload->'attendees') <> 'array'
     or jsonb_array_length(p_payload->'attendees') = 0 then
    return jsonb_build_object('outcome', 'invalid_input');
  end if;

  insert into public.smartwaiver_legacy_visits (
    id, visit_date, business_day_ymd, created_by_staff_id, notes
  ) values (v_visit_id, v_day::date, v_day, v_staff, v_notes);

  for v_item in select value from jsonb_array_elements(p_payload->'attendees')
  loop
    v_check_in_id := (v_item->>'check_in_id')::uuid;
    v_payment_id := nullif(v_item->>'payment_id', '')::uuid;

    insert into public.smartwaiver_legacy_check_ins (
      id, legacy_visit_id, legacy_participant_id, business_day_ymd,
      classification, age_years_on_visit, unit_price_cents, payment_method,
      staff_id, source_kind, status, notes
    ) values (
      v_check_in_id, v_visit_id, (v_item->>'legacy_participant_id')::uuid,
      v_day, v_item->>'classification',
      (v_item->>'age_years_on_visit')::integer,
      (v_item->>'unit_price_cents')::integer,
      nullif(v_item->>'payment_method', ''), v_staff,
      'legacy_smartwaiver', 'active', v_notes
    );

    if (v_item->>'unit_price_cents')::integer > 0 then
      insert into public.smartwaiver_legacy_payment_entries (
        id, legacy_visit_id, legacy_check_in_id, entry_type, method,
        amount_cents, created_by_staff_id
      ) values (
        v_payment_id, v_visit_id, v_check_in_id, 'charge',
        v_item->>'payment_method', (v_item->>'unit_price_cents')::integer, v_staff
      );
      v_payments := v_payments || jsonb_build_array(jsonb_build_object(
        'id', v_payment_id::text, 'attendee_id', v_check_in_id::text,
        'method', v_item->>'payment_method',
        'amount_cents', (v_item->>'unit_price_cents')::integer
      ));
    end if;

    insert into public.open_play_audit_events (
      id, actor_staff_id, action, entity_type, entity_id, detail
    ) values (
      (v_item->>'audit_id')::uuid, v_staff,
      'legacy_smartwaiver_check_in', 'smartwaiver_legacy_check_in',
      v_check_in_id::text,
      jsonb_build_object(
        'source', 'legacy_smartwaiver', 'legacy_visit_id', v_visit_id,
        'legacy_participant_id', v_item->>'legacy_participant_id',
        'waiver_id', v_item->>'waiver_id', 'business_day_ymd', v_day,
        'classification', v_item->>'classification',
        'unit_price_cents', (v_item->>'unit_price_cents')::integer
      )
    );

    v_ids := v_ids || jsonb_build_array(v_check_in_id::text);
    v_attendees := v_attendees || jsonb_build_array(jsonb_build_object(
      'attendee_id', v_check_in_id::text,
      'participant_id', 'legacy:' || (v_item->>'legacy_participant_id'),
      'classification', v_item->>'classification',
      'unit_price_cents', (v_item->>'unit_price_cents')::integer
    ));
  end loop;

  return jsonb_build_object(
    'outcome', 'created', 'legacy_visit_id', v_visit_id,
    'check_in_ids', v_ids, 'attendees', v_attendees, 'payments', v_payments
  );
exception
  when unique_violation then
    return jsonb_build_object('outcome', 'duplicate_same_day_attendee');
  when others then
    return jsonb_build_object('outcome', 'failed', 'error_code', SQLSTATE);
end;
$$;

revoke all on function public.create_smartwaiver_legacy_check_ins_atomic(jsonb)
  from public, anon, authenticated;
grant execute on function public.create_smartwaiver_legacy_check_ins_atomic(jsonb)
  to service_role;

create or replace function public.apply_smartwaiver_legacy_visit_correction_atomic(
  p_payload jsonb
)
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
  v_related_id uuid;
  v_related public.smartwaiver_legacy_payment_entries%rowtype;
  v_attendee_id uuid;
  v_entries jsonb := '[]'::jsonb;
  v_debit_id uuid;
  v_credit_id uuid;
  v_entry_id uuid;
  v_amount integer;
  v_from text;
  v_to text;
  v_method text;
  v_effective text;
  v_corr record;
  v_refund_sum integer;
  v_updated integer;
begin
  if v_visit_id is null or v_staff is null or v_type is null or v_reason is null then
    return jsonb_build_object('outcome', 'invalid_input');
  end if;
  if not exists (select 1 from public.smartwaiver_legacy_visits where id=v_visit_id) then
    return jsonb_build_object('outcome', 'visit_not_found');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('legacy_visit:' || v_visit_id::text, 0));

  if v_type = 'method_correction' then
    v_related_id := nullif(p_payload->>'related_entry_id', '')::uuid;
    v_from := p_payload->>'from_method'; v_to := p_payload->>'to_method';
    v_amount := (p_payload->>'amount_cents')::integer;
    if v_from not in ('cash','card') or v_to not in ('cash','card') or v_from=v_to or v_amount is null then
      return jsonb_build_object('outcome','invalid_input');
    end if;
    select * into v_related from public.smartwaiver_legacy_payment_entries where id=v_related_id for update;
    if not found or v_related.legacy_visit_id<>v_visit_id or v_related.entry_type<>'charge' then
      return jsonb_build_object('outcome','related_entry_invalid');
    end if;
    if exists (select 1 from public.smartwaiver_legacy_payment_entries where related_entry_id=v_related_id and entry_type='void') then
      return jsonb_build_object('outcome','charge_already_voided');
    end if;
    if exists (select 1 from public.smartwaiver_legacy_payment_entries where related_entry_id=v_related_id and entry_type='refund') then
      return jsonb_build_object('outcome','correction_after_refund_rejected');
    end if;
    if exists (select 1 from public.smartwaiver_legacy_payment_entries where related_entry_id=v_related_id and entry_type='correction' and amount_cents>0) then
      return jsonb_build_object('outcome','method_already_corrected');
    end if;
    if v_related.method is distinct from v_from or v_related.amount_cents is distinct from v_amount then
      return jsonb_build_object('outcome','correction_amount_or_method_mismatch');
    end if;
    v_debit_id:=gen_random_uuid(); v_credit_id:=gen_random_uuid();
    insert into public.smartwaiver_legacy_payment_entries
      (id,legacy_visit_id,legacy_check_in_id,entry_type,method,amount_cents,related_entry_id,reason,created_by_staff_id)
    values
      (v_debit_id,v_visit_id,v_related.legacy_check_in_id,'correction',v_from,-v_amount,v_related_id,v_reason,v_staff),
      (v_credit_id,v_visit_id,v_related.legacy_check_in_id,'correction',v_to,v_amount,v_related_id,v_reason,v_staff);
    v_entries:=jsonb_build_array(
      jsonb_build_object('id',v_debit_id,'entry_type','correction','method',v_from,'amount_cents',-v_amount,'attendee_id',v_related.legacy_check_in_id,'related_entry_id',v_related_id),
      jsonb_build_object('id',v_credit_id,'entry_type','correction','method',v_to,'amount_cents',v_amount,'attendee_id',v_related.legacy_check_in_id,'related_entry_id',v_related_id));

  elsif v_type in ('void','refund') then
    v_related_id:=nullif(p_payload->>'related_entry_id','')::uuid;
    select * into v_related from public.smartwaiver_legacy_payment_entries where id=v_related_id for update;
    if not found or v_related.legacy_visit_id<>v_visit_id or v_related.entry_type<>'charge' then
      return jsonb_build_object('outcome','related_entry_invalid');
    end if;
    if exists (select 1 from public.smartwaiver_legacy_payment_entries where related_entry_id=v_related_id and entry_type='void') then
      return jsonb_build_object('outcome',case when v_type='void' then 'charge_already_voided' else 'refund_after_void_rejected' end);
    end if;
    select coalesce(sum(-amount_cents),0) into v_refund_sum
      from public.smartwaiver_legacy_payment_entries where related_entry_id=v_related_id and entry_type='refund';
    if v_type='void' and v_refund_sum>0 then return jsonb_build_object('outcome','void_after_refund_rejected'); end if;
    v_effective:=v_related.method;
    for v_corr in select method,amount_cents from public.smartwaiver_legacy_payment_entries
      where related_entry_id=v_related_id and entry_type='correction' order by created_at,id
    loop if v_corr.amount_cents>0 then v_effective:=v_corr.method; end if; end loop;
    if v_type='refund' then
      v_method:=p_payload->>'method'; v_amount:=(p_payload->>'amount_cents')::integer;
      if v_method not in ('cash','card') or v_amount is null or v_amount<=0 then return jsonb_build_object('outcome','invalid_input'); end if;
      if v_amount>(v_related.amount_cents-v_refund_sum) then return jsonb_build_object('outcome','refund_exceeds_remaining'); end if;
      if v_method is distinct from v_effective then return jsonb_build_object('outcome','refund_method_mismatch'); end if;
      v_entry_id:=gen_random_uuid();
      insert into public.smartwaiver_legacy_payment_entries
        (id,legacy_visit_id,legacy_check_in_id,entry_type,method,amount_cents,related_entry_id,reason,created_by_staff_id)
      values (v_entry_id,v_visit_id,v_related.legacy_check_in_id,'refund',v_method,-v_amount,v_related_id,v_reason,v_staff);
      v_entries:=jsonb_build_array(jsonb_build_object('id',v_entry_id,'entry_type','refund','method',v_method,'amount_cents',-v_amount,'attendee_id',v_related.legacy_check_in_id,'related_entry_id',v_related_id));
    else
      v_attendee_id:=nullif(p_payload->>'remove_attendee_id','')::uuid;
      if v_attendee_id is not null then
        if v_attendee_id is distinct from v_related.legacy_check_in_id then
          return jsonb_build_object('outcome','related_entry_invalid');
        end if;
        if not exists (select 1 from public.smartwaiver_legacy_check_ins where id=v_attendee_id and legacy_visit_id=v_visit_id and status='active') then
          return jsonb_build_object('outcome','attendee_not_found_or_removed');
        end if;
      end if;
      v_entry_id:=gen_random_uuid();
      insert into public.smartwaiver_legacy_payment_entries
        (id,legacy_visit_id,legacy_check_in_id,entry_type,method,amount_cents,related_entry_id,reason,created_by_staff_id)
      values (v_entry_id,v_visit_id,v_related.legacy_check_in_id,'void',v_effective,-abs(v_related.amount_cents),v_related_id,v_reason,v_staff);
      v_entries:=jsonb_build_array(jsonb_build_object('id',v_entry_id,'entry_type','void','method',v_effective,'amount_cents',-abs(v_related.amount_cents),'attendee_id',v_related.legacy_check_in_id,'related_entry_id',v_related_id));
      if v_attendee_id is not null then update public.smartwaiver_legacy_check_ins set status='removed' where id=v_attendee_id and legacy_visit_id=v_visit_id and status='active'; end if;
    end if;

  elsif v_type='remove_attendee' then
    v_attendee_id:=nullif(p_payload->>'attendee_id','')::uuid;
    if v_attendee_id is null or not exists (select 1 from public.smartwaiver_legacy_check_ins where id=v_attendee_id and legacy_visit_id=v_visit_id and status='active') then
      return jsonb_build_object('outcome','attendee_not_found_or_removed');
    end if;
    select id into v_related_id from public.smartwaiver_legacy_payment_entries e
      where e.legacy_visit_id=v_visit_id and e.legacy_check_in_id=v_attendee_id and e.entry_type='charge'
      and not exists (select 1 from public.smartwaiver_legacy_payment_entries x where x.related_entry_id=e.id and x.entry_type='void')
      and e.amount_cents-coalesce((select sum(-r.amount_cents) from public.smartwaiver_legacy_payment_entries r where r.related_entry_id=e.id and r.entry_type='refund'),0)>0 limit 1;
    if v_related_id is not null then return jsonb_build_object('outcome','financial_reversal_required','related_entry_id',v_related_id); end if;
    update public.smartwaiver_legacy_check_ins set status='removed' where id=v_attendee_id and legacy_visit_id=v_visit_id and status='active';
    get diagnostics v_updated=row_count;
    if v_updated<>1 then raise exception using errcode='P0001',message='attendee_not_found_or_removed'; end if;
  else
    return jsonb_build_object('outcome','unsupported_type');
  end if;

  insert into public.open_play_audit_events(actor_staff_id,action,entity_type,entity_id,detail)
  values(v_staff,'legacy_visit_'||v_type,'smartwaiver_legacy_visit',v_visit_id::text,
    jsonb_build_object('correctionType',v_type,'entryCount',jsonb_array_length(v_entries)));
  return jsonb_build_object('outcome','applied','entries',v_entries);
exception
  when sqlstate 'P0001' then return jsonb_build_object('outcome',SQLERRM);
  when others then return jsonb_build_object('outcome','failed','error_code',SQLSTATE);
end;
$$;

revoke all on function public.apply_smartwaiver_legacy_visit_correction_atomic(jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_smartwaiver_legacy_visit_correction_atomic(jsonb)
  to service_role;
