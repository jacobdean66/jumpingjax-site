-- Mobile receipts are a view of money already collected in SwipeSimple.
-- Booking credit is recorded only in booking_payment_entries, never summed twice.
begin;

create table public.mobile_payment_receipts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  processor_reference text not null check (processor_reference ~ '^[a-zA-Z0-9-]{1,120}$'),
  payer_name text not null check (length(trim(payer_name)) between 1 and 160),
  paid_at timestamptz not null,
  amount_cents integer not null check (amount_cents between 1 and 10000000),
  processing_fee_cents integer not null check (processing_fee_cents between 0 and amount_cents),
  payment_entry_id uuid unique references public.booking_payment_entries(id),
  recorded_by text not null,
  created_at timestamptz not null default now()
);
create unique index mobile_payment_receipt_reference on public.mobile_payment_receipts (lower(processor_reference));
create index mobile_payment_receipt_date on public.mobile_payment_receipts (paid_at desc, id);
alter table public.mobile_payment_receipts enable row level security;
revoke all on public.mobile_payment_receipts from public, anon, authenticated;
grant all on public.mobile_payment_receipts to service_role;

create or replace function public.record_mobile_payment(p_payment jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_request uuid := (p_payment->>'request_id')::uuid;
  v_reference text := trim(p_payment->>'processor_reference');
  v_payer text := trim(p_payment->>'payer_name');
  v_paid_at timestamptz := (p_payment->>'paid_at')::timestamptz;
  v_amount integer := (p_payment->>'amount_cents')::integer;
  v_fee integer := (p_payment->>'processing_fee_cents')::integer;
  v_kind text := nullif(p_payment->>'booking_kind','');
  v_booking text := nullif(p_payment->>'booking_id','');
  v_receipt public.mobile_payment_receipts%rowtype;
  v_entry public.booking_payment_entries%rowtype;
  v_result jsonb;
  v_count integer;
  v_import public.swipesimple_transaction_imports%rowtype;
  v_existed boolean := false;
begin
  if v_request is null or coalesce(v_reference,'') !~ '^[a-zA-Z0-9-]{1,120}$'
    or coalesce(length(v_payer),0) not between 1 and 160
    or v_paid_at is null or not isfinite(v_paid_at) or v_paid_at > now() + interval '5 minutes'
    or v_amount is null or v_amount not between 1 and 10000000 or v_fee is null or v_fee not between 0 and v_amount
    or (v_kind is null) <> (v_booking is null) or (v_kind is not null and v_kind not in ('facility','rental'))
    or coalesce(p_payment->>'payment_purpose','') not in ('deposit','payment','balance')
    or (v_kind='facility' and p_payment->>'payment_purpose'='deposit' and v_amount<>5000)
    or nullif(trim(p_payment->>'recorded_by'),'') is null then
    return jsonb_build_object('outcome','invalid');
  end if;
  -- Same lock order as record_booking_payment_v2, including for retries.
  perform pg_advisory_xact_lock(hashtextextended('payment-request:' || v_request::text,0));
  if v_kind is not null then
    perform pg_advisory_xact_lock(hashtextextended('booking-payment:' || v_kind || ':' || v_booking,0));
  end if;
  perform pg_advisory_xact_lock(hashtextextended('payment-reference:' || lower(v_reference),0));
  select * into v_receipt from mobile_payment_receipts where request_id=v_request;
  if found and lower(v_receipt.processor_reference) <> lower(v_reference) then
    return jsonb_build_object('outcome','conflict');
  end if;
  select * into v_receipt from mobile_payment_receipts where lower(processor_reference)=lower(v_reference) for update;
  v_existed := found;
  if v_existed and (v_receipt.amount_cents <> v_amount or v_receipt.processing_fee_cents <> v_fee
    or v_receipt.payer_name <> v_payer or v_receipt.paid_at <> v_paid_at) then
    return jsonb_build_object('outcome','conflict');
  end if;

  select * into v_import from swipesimple_transaction_imports where lower(transaction_number)=lower(v_reference);
  if found and (lower(v_import.result)<>'approved' or lower(v_import.transaction_type)<>'sale'
    or v_import.amount_cents<>v_amount+v_fee) then
    return jsonb_build_object('outcome','conflict');
  end if;

  -- A full transaction number is required; names and amounts are never used to guess a booking.
  select count(*) into v_count from booking_payment_entries where lower(trim(processor_reference))=lower(v_reference);
  if v_count > 1 then return jsonb_build_object('outcome','ambiguous_reference'); end if;
  select * into v_entry from booking_payment_entries where lower(trim(processor_reference))=lower(v_reference) for update;
  if found then
    if v_entry.status <> 'posted' or v_entry.payment_method <> 'card' or v_entry.amount_cents <> v_amount
      or v_entry.processing_fee_cents <> v_fee
      or (v_kind is not null and (v_entry.booking_kind <> v_kind or v_entry.booking_id <> v_booking
        or v_entry.payment_purpose <> p_payment->>'payment_purpose'))
      or (v_receipt.payment_entry_id is not null and v_receipt.payment_entry_id <> v_entry.id) then
      return jsonb_build_object('outcome','reference_exists');
    end if;
  elsif v_receipt.payment_entry_id is not null then
    return jsonb_build_object('outcome','conflict');
  elsif v_kind is not null then
    -- This existing writer protects against repeat credits and duplicate deposits.
    v_result := record_booking_payment_v2(p_payment || jsonb_build_object('payment_method','card'));
    if coalesce(v_result->>'outcome','') not in ('created','duplicate') then return v_result; end if;
    select * into v_entry from booking_payment_entries where id=(v_result->>'id')::uuid;
  end if;

  if v_existed then
    update mobile_payment_receipts set payment_entry_id=v_entry.id where id=v_receipt.id;
    return jsonb_build_object('outcome',case when v_receipt.payment_entry_id is null and v_entry.id is not null then 'linked' else 'duplicate' end,
      'id',v_receipt.id,'payment_entry_id',v_entry.id);
  end if;
  insert into mobile_payment_receipts (request_id,processor_reference,payer_name,paid_at,amount_cents,processing_fee_cents,payment_entry_id,recorded_by)
  values (v_request,v_reference,v_payer,v_paid_at,v_amount,v_fee,v_entry.id,p_payment->>'recorded_by') returning * into v_receipt;
  return jsonb_build_object('outcome','created','id',v_receipt.id,'payment_entry_id',v_entry.id);
end;
$$;

-- A walk-in receipt can later be linked through the existing booking payment form.
-- Reject conflicting receipt details so the two screens cannot show different credits.
create or replace function public.link_mobile_payment_receipt()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.mobile_payment_receipts%rowtype;
begin
  if nullif(trim(new.processor_reference),'') is null then return new; end if;
  select * into r from mobile_payment_receipts where lower(processor_reference)=lower(trim(new.processor_reference)) for update;
  if not found then return new; end if;
  if new.payment_method <> 'card' or new.amount_cents <> r.amount_cents or new.processing_fee_cents <> r.processing_fee_cents
    or (r.payment_entry_id is not null and r.payment_entry_id <> new.id) then
    raise exception 'Mobile receipt conflicts with booking payment' using errcode='23514';
  end if;
  update mobile_payment_receipts set payment_entry_id=new.id where id=r.id;
  return new;
end;
$$;
create trigger booking_payment_mobile_receipt after insert or update of processor_reference,amount_cents,processing_fee_cents,payment_method
  on public.booking_payment_entries for each row execute function public.link_mobile_payment_receipt();
revoke all on function public.record_mobile_payment(jsonb) from public, anon, authenticated;
revoke all on function public.link_mobile_payment_receipt() from public, anon, authenticated;
grant execute on function public.record_mobile_payment(jsonb) to service_role;
commit;
