-- One ledger for cards, invoices, agreements and reconciliation. Keep all legacy
-- rows and signed snapshots; the source id makes this migration safe to replay.
begin;

alter table public.booking_payment_entries
  add column if not exists paid_at timestamptz,
  add column if not exists payer_name text,
  add column if not exists payer_email text,
  add column if not exists payment_purpose text not null default 'deposit',
  add column if not exists source text not null default 'staff',
  add column if not exists status text not null default 'posted',
  add column if not exists legacy_facility_payment_id uuid,
  add column if not exists provider_transaction_id text,
  add column if not exists request_id uuid,
  add column if not exists notes text;

update public.booking_payment_entries set payment_purpose='payment' where booking_kind='rental' and payment_purpose='deposit';
update public.booking_payment_entries set paid_at = created_at where paid_at is null;
alter table public.booking_payment_entries alter column paid_at set default now();
alter table public.booking_payment_entries alter column paid_at set not null;
alter table public.booking_payment_entries drop constraint if exists booking_payment_entries_entry_type_check;
alter table public.booking_payment_entries add constraint booking_payment_entries_entry_type_check
  check (entry_type in ('facility_deposit', 'facility_payment', 'rental_payment'));
alter table public.booking_payment_entries drop constraint if exists booking_payment_entries_status_check;
alter table public.booking_payment_entries add constraint booking_payment_entries_status_check
  check (status in ('posted', 'needs_review', 'voided'));
create unique index if not exists booking_payments_legacy_unique
  on public.booking_payment_entries (legacy_facility_payment_id) where legacy_facility_payment_id is not null;
create unique index if not exists booking_payments_provider_unique
  on public.booking_payment_entries (provider_transaction_id) where provider_transaction_id is not null;
create unique index if not exists booking_payments_request_unique
  on public.booking_payment_entries (request_id) where request_id is not null;
create index if not exists booking_payments_paid_at_idx on public.booking_payment_entries (paid_at desc, id);

create or replace function public.project_facility_payment_to_ledger()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_existing uuid;
begin
  -- A reference is evidence of identity; equal amounts alone are not.
  if nullif(trim(new.pos_receipt_number), '') is not null then
    select id into v_existing from public.booking_payment_entries
    where booking_kind = 'facility' and booking_id = new.booking_id::text
      and amount_cents = round(new.amount * 100)::integer
      and lower(trim(processor_reference)) = lower(trim(new.pos_receipt_number))
      and legacy_facility_payment_id is null
    order by created_at limit 1;
  end if;
  if v_existing is not null then
    update public.booking_payment_entries set legacy_facility_payment_id = new.id where id = v_existing;
    return new;
  end if;
  insert into public.booking_payment_entries (
    booking_kind, booking_id, entry_type, payment_method, amount_cents,
    processing_fee_cents, processor_reference, recorded_by, paid_at,
    payment_purpose, source, legacy_facility_payment_id, notes
  ) values (
    'facility', new.booking_id::text,
    case when new.payment_kind = 'deposit' then 'facility_deposit' else 'facility_payment' end,
    case when lower(new.payment_method) like '%cash app%' then 'other'
         when lower(new.payment_method) like '%apple pay%' then 'card'
         when lower(new.payment_method) like '%cash%' then 'cash'
         when lower(new.payment_method) like '%check%' then 'check'
         when lower(new.payment_method) like '%card%' or lower(new.payment_method) like '%pos%' then 'card' else 'other' end,
    round(new.amount * 100)::integer, 0, nullif(trim(new.pos_receipt_number), ''),
    new.recorded_by, new.paid_at, new.payment_kind, 'legacy_agreement', new.id, new.notes
  ) on conflict (legacy_facility_payment_id) where legacy_facility_payment_id is not null do nothing;
  return new;
end;
$$;
drop trigger if exists facility_payment_ledger_projection on public.facility_party_payments;
create trigger facility_payment_ledger_projection after insert on public.facility_party_payments
  for each row execute function public.project_facility_payment_to_ledger();

-- Replay existing rows through the same projection without changing their data.
do $$
declare r public.facility_party_payments%rowtype; v_existing uuid;
begin
  for r in select * from public.facility_party_payments order by created_at, id loop
    if exists (select 1 from public.booking_payment_entries where legacy_facility_payment_id = r.id) then continue; end if;
    v_existing := null;
    if nullif(trim(r.pos_receipt_number), '') is not null then
      select id into v_existing from public.booking_payment_entries
      where booking_kind = 'facility' and booking_id = r.booking_id::text
        and amount_cents = round(r.amount * 100)::integer
        and lower(trim(processor_reference)) = lower(trim(r.pos_receipt_number))
        and legacy_facility_payment_id is null order by created_at limit 1;
    end if;
    if v_existing is not null then
      update public.booking_payment_entries set legacy_facility_payment_id = r.id where id = v_existing;
    else
      insert into public.booking_payment_entries (
        booking_kind, booking_id, entry_type, payment_method, amount_cents,
        processor_reference, recorded_by, paid_at, payment_purpose, source,
        legacy_facility_payment_id, notes, created_at
      ) values (
        'facility', r.booking_id::text,
        case when r.payment_kind = 'deposit' then 'facility_deposit' else 'facility_payment' end,
        case when lower(r.payment_method) like '%cash app%' then 'other'
             when lower(r.payment_method) like '%apple pay%' then 'card'
             when lower(r.payment_method) like '%cash%' then 'cash'
             when lower(r.payment_method) like '%check%' then 'check'
             when lower(r.payment_method) like '%card%' or lower(r.payment_method) like '%pos%' then 'card' else 'other' end,
        round(r.amount * 100)::integer, nullif(trim(r.pos_receipt_number), ''),
        r.recorded_by, r.paid_at, r.payment_kind, 'legacy_agreement', r.id, r.notes, r.paid_at
      );
    end if;
  end loop;
end;
$$;

create table if not exists public.swipesimple_transaction_imports (
  transaction_id text primary key,
  transaction_number text not null,
  amount_cents integer not null check (amount_cents > 0),
  result text not null,
  transaction_type text not null,
  method text,
  payer_name text,
  payer_email text,
  payer_phone text,
  invoice_number text,
  reference text,
  paid_at timestamptz not null,
  payment_entry_id uuid unique references public.booking_payment_entries(id),
  imported_at timestamptz not null default now(),
  imported_by text not null,
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text
);
alter table public.swipesimple_transaction_imports enable row level security;
revoke all on public.swipesimple_transaction_imports from public, anon, authenticated;
grant all on public.swipesimple_transaction_imports to service_role;

create or replace function public.record_booking_payment_v2(p_payment jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_kind text := p_payment->>'booking_kind';
  v_booking text := p_payment->>'booking_id';
  v_amount integer := (p_payment->>'amount_cents')::integer;
  v_request uuid := (p_payment->>'request_id')::uuid;
  v_reference text := nullif(trim(p_payment->>'processor_reference'), '');
  v_row public.booking_payment_entries%rowtype;
  v_import public.swipesimple_transaction_imports%rowtype;
begin
  if v_kind is null or v_kind not in ('facility','rental') or v_booking is null or v_request is null
    or v_amount is null or v_amount <= 0 or v_amount > 10000000
    or coalesce(p_payment->>'payment_method','') not in ('card','cash','check','other')
    or nullif(trim(p_payment->>'recorded_by'),'') is null then
    return jsonb_build_object('outcome','invalid');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('payment-request:' || v_request::text,0));
  perform pg_advisory_xact_lock(hashtextextended('booking-payment:' || v_kind || ':' || v_booking,0));
  if v_reference is not null then
    perform pg_advisory_xact_lock(hashtextextended('payment-reference:' || lower(v_reference),0));
  end if;
  select * into v_row from public.booking_payment_entries where request_id = v_request;
  if found then
    if v_row.booking_kind <> v_kind or v_row.booking_id <> v_booking or v_row.amount_cents <> v_amount
      or v_row.payment_method <> p_payment->>'payment_method'
      or v_row.processor_reference is distinct from v_reference
      or v_row.payer_name is distinct from nullif(trim(p_payment->>'payer_name'),'')
      or v_row.paid_at is distinct from (p_payment->>'paid_at')::timestamptz
      or v_row.payment_purpose is distinct from p_payment->>'payment_purpose'
      or v_row.processing_fee_cents is distinct from coalesce((p_payment->>'processing_fee_cents')::integer,0) then
      return jsonb_build_object('outcome','conflict');
    end if;
    return jsonb_build_object('outcome','duplicate','id',v_row.id);
  end if;
  if v_reference is not null then
    select * into v_row from public.booking_payment_entries
      where lower(trim(processor_reference)) = lower(v_reference) and status <> 'voided' limit 1;
    if found then return jsonb_build_object('outcome','reference_exists','id',v_row.id); end if;
  end if;
  if v_kind = 'facility' then
    perform 1 from public.facility_bookings where id::text = v_booking and lower(status) not in ('cancelled','canceled','rejected') for update;
  else
    perform 1 from public.bookings where id::text = v_booking and lower(status) not in ('cancelled','canceled','rejected') for update;
  end if;
  if not found then return jsonb_build_object('outcome','inactive_booking'); end if;
  if v_kind='facility' and p_payment->>'payment_purpose'='deposit' and exists(select 1 from booking_payment_entries where booking_kind=v_kind and booking_id=v_booking and status='posted' and payment_purpose='deposit') then
    return jsonb_build_object('outcome','deposit_exists');
  end if;
  select * into v_import from swipesimple_transaction_imports where transaction_number=v_reference for update;
  if found and (v_import.payment_entry_id is not null or lower(v_import.result)<>'approved' or lower(v_import.transaction_type)<>'sale' or v_amount+coalesce((p_payment->>'processing_fee_cents')::integer,0)<>v_import.amount_cents) then
    return jsonb_build_object('outcome','conflict');
  end if;
  insert into public.booking_payment_entries (
    booking_kind, booking_id, entry_type, payment_method, amount_cents, processing_fee_cents,
    processor_reference, recorded_by, receipt_email, paid_at, payer_name, payer_email,
    request_id, payment_purpose, notes
  ) values (
    v_kind, v_booking,
    case when v_kind = 'rental' then 'rental_payment' when p_payment->>'payment_purpose' = 'deposit' then 'facility_deposit' else 'facility_payment' end,
    p_payment->>'payment_method', v_amount, coalesce((p_payment->>'processing_fee_cents')::integer,0),
    v_reference, p_payment->>'recorded_by', nullif(p_payment->>'receipt_email',''),
    coalesce((p_payment->>'paid_at')::timestamptz,now()), nullif(trim(p_payment->>'payer_name'),''),
    nullif(trim(p_payment->>'payer_email'),''), v_request, coalesce(p_payment->>'payment_purpose','deposit'), p_payment->>'notes'
  ) returning * into v_row;
  if v_import.transaction_id is not null then
    update booking_payment_entries set provider_transaction_id=v_import.transaction_id where id=v_row.id;
    update swipesimple_transaction_imports set payment_entry_id=v_row.id,reviewed_by=p_payment->>'recorded_by',reviewed_at=now(),review_note='Matched by staff from booking payment form using full processor receipt' where transaction_id=v_import.transaction_id;
  end if;
  return jsonb_build_object('outcome','created','id',v_row.id);
end;
$$;

-- Attach a verified processor sale to an existing recorded payment, or add the
-- missing credit. Lock both records; never infer a booking from amount/name.
create or replace function public.attach_swipesimple_payment(
  p_transaction_id text, p_booking_kind text, p_booking_id text,
  p_existing_payment_id uuid, p_applied_cents integer, p_recorded_by text, p_reason text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.swipesimple_transaction_imports%rowtype; e public.booking_payment_entries%rowtype; v_id uuid;
begin
  select * into t from public.swipesimple_transaction_imports where transaction_id = p_transaction_id for update;
  if not found or lower(t.result) <> 'approved' or lower(t.transaction_type) <> 'sale' then
    return jsonb_build_object('outcome','not_approved_sale');
  end if;
  if p_booking_kind is null or p_booking_id is null or p_booking_kind not in ('facility','rental') or p_applied_cents is null or p_applied_cents <= 0
    or p_applied_cents > t.amount_cents or nullif(trim(p_recorded_by),'') is null or length(trim(coalesce(p_reason,''))) < 10 then
    return jsonb_build_object('outcome','invalid');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('booking-payment:' || p_booking_kind || ':' || p_booking_id,0));
  perform pg_advisory_xact_lock(hashtextextended('payment-reference:' || lower(t.transaction_number),0));
  if t.payment_entry_id is not null then
    select * into e from public.booking_payment_entries where id = t.payment_entry_id;
    return jsonb_build_object('outcome',case when e.booking_kind=p_booking_kind and e.booking_id=p_booking_id and e.amount_cents=p_applied_cents then 'already_attached' else 'conflict' end,'id',e.id);
  end if;
  if p_booking_kind='facility' then
    perform 1 from public.facility_bookings where id::text=p_booking_id for update;
  else
    perform 1 from public.bookings where id::text=p_booking_id for update;
  end if;
  if not found then return jsonb_build_object('outcome','booking_not_found'); end if;
  -- Find a payment already bearing this receipt before creating any credit.
  if p_existing_payment_id is null then
    select id into p_existing_payment_id from public.booking_payment_entries
    where provider_transaction_id=t.transaction_id or processor_reference=t.transaction_number limit 1;
  end if;
  if p_existing_payment_id is not null then
    select * into e from public.booking_payment_entries where id=p_existing_payment_id for update;
    if not found or e.booking_kind<>p_booking_kind or e.booking_id<>p_booking_id or e.amount_cents<>p_applied_cents
      or e.status<>'posted' or e.payment_method<>'card'
      or (e.provider_transaction_id is not null and e.provider_transaction_id<>t.transaction_id) then
      return jsonb_build_object('outcome','conflict');
    end if;
    update public.booking_payment_entries set provider_transaction_id=t.transaction_id,
      processor_reference=t.transaction_number, payer_name=nullif(t.payer_name,''), payer_email=t.payer_email,
      paid_at=t.paid_at, processing_fee_cents=t.amount_cents-p_applied_cents,
      notes=concat_ws(E'\n',notes,'Processor verified: ' || p_reason) where id=e.id returning id into v_id;
  else
    -- An unlinked payment may already be this deposit; require explicit review.
    if exists(select 1 from public.booking_payment_entries where booking_kind=p_booking_kind and booking_id=p_booking_id
      and status='posted' and amount_cents=p_applied_cents and provider_transaction_id is null) then
      return jsonb_build_object('outcome','existing_payment_requires_review');
    end if;
    insert into public.booking_payment_entries (
      booking_kind,booking_id,entry_type,payment_method,amount_cents,processing_fee_cents,
      processor_reference,provider_transaction_id,recorded_by,paid_at,payer_name,payer_email,source,payment_purpose,notes
    ) values (
      p_booking_kind,p_booking_id,case when p_booking_kind='facility' then 'facility_deposit' else 'rental_payment' end,
      'card',p_applied_cents,t.amount_cents-p_applied_cents,t.transaction_number,t.transaction_id,
      p_recorded_by,t.paid_at,nullif(t.payer_name,''),t.payer_email,'swipesimple',
      case when p_booking_kind='facility' then 'deposit' else 'payment' end,p_reason
    ) returning id into v_id;
  end if;
  update public.swipesimple_transaction_imports set payment_entry_id=v_id,reviewed_at=now(),
    reviewed_by=p_recorded_by,review_note=p_reason where transaction_id=t.transaction_id;
  return jsonb_build_object('outcome','attached','id',v_id);
end;
$$;
revoke all on function public.project_facility_payment_to_ledger() from public, anon, authenticated;
revoke all on function public.record_booking_payment_v2(jsonb) from public, anon, authenticated;
revoke all on function public.attach_swipesimple_payment(text,text,text,uuid,integer,text,text) from public, anon, authenticated;
grant execute on function public.record_booking_payment_v2(jsonb) to service_role;
grant execute on function public.attach_swipesimple_payment(text,text,text,uuid,integer,text,text) to service_role;
commit;
