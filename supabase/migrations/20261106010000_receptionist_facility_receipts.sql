-- Forward-only foundation for receptionist facility writes. Not applied here.
-- Keep a receipt even if the booking is later removed, so an uncertain retry
-- cannot silently create a second booking. The hash avoids duplicating PII.
create table if not exists public.receptionist_facility_receipts (
  request_key text primary key,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  booking_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.receptionist_facility_receipts enable row level security;
revoke all on public.receptionist_facility_receipts from public, anon, authenticated;

-- Reconcile a retry before checking a possibly changed quote or availability.
-- A null result means no receipt or legacy booking was found at this instant;
-- it is not permission to skip the atomic create boundary.
create or replace function public.lookup_receptionist_facility_booking_v1(
  p_booking jsonb,
  p_request_key text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_receipt public.receptionist_facility_receipts%rowtype;
begin
  if p_request_key is null or p_request_key !~ '^[A-Za-z0-9_-]{1,80}$'
     or p_booking is null or jsonb_typeof(p_booking) <> 'object'
     or octet_length(p_booking::text) > 65536 then
    raise exception using errcode = '22023', message = 'invalid_receptionist_facility_input';
  end if;
  v_hash := encode(sha256(convert_to(p_booking::text, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('receptionist-facility-key:' || p_request_key, 0));
  select * into v_receipt from public.receptionist_facility_receipts where request_key=p_request_key for update;
  if found then
    if v_receipt.request_hash is distinct from v_hash then
      raise exception using errcode = 'P0001', message = 'receptionist_facility_idempotency_mismatch';
    end if;
    if not exists (select 1 from public.facility_bookings where id=v_receipt.booking_id and idempotency_key=p_request_key) then
      raise exception using errcode = 'P0001', message = 'receptionist_facility_receipt_booking_missing';
    end if;
    return v_receipt.booking_id::text;
  end if;
  if exists (select 1 from public.facility_bookings where idempotency_key=p_request_key) then
    raise exception using errcode = 'P0001', message = 'receptionist_facility_idempotency_unverified';
  end if;
  return null;
end;
$$;
revoke all on function public.lookup_receptionist_facility_booking_v1(jsonb,text) from public, anon, authenticated;
grant execute on function public.lookup_receptionist_facility_booking_v1(jsonb,text) to service_role;

create or replace function public.create_receptionist_facility_booking_atomic_v1(
  p_booking jsonb,
  p_request_key text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_receipt public.receptionist_facility_receipts%rowtype;
  v_booking_id uuid;
  v_row_xid text;
begin
  if p_request_key is null or p_request_key !~ '^[A-Za-z0-9_-]{1,80}$'
     or p_booking is null or jsonb_typeof(p_booking) <> 'object'
     or octet_length(p_booking::text) > 65536 then
    raise exception using errcode = '22023', message = 'invalid_receptionist_facility_input';
  end if;
  v_hash := encode(sha256(convert_to(p_booking::text, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('receptionist-facility-key:' || p_request_key, 0));

  select * into v_receipt from public.receptionist_facility_receipts where request_key=p_request_key for update;
  if found then
    if v_receipt.request_hash is distinct from v_hash then
      raise exception using errcode = 'P0001', message = 'receptionist_facility_idempotency_mismatch';
    end if;
    if not exists (select 1 from public.facility_bookings where id=v_receipt.booking_id and idempotency_key=p_request_key) then
      raise exception using errcode = 'P0001', message = 'receptionist_facility_receipt_booking_missing';
    end if;
    return v_receipt.booking_id::text;
  end if;

  if exists (select 1 from public.facility_bookings where idempotency_key=p_request_key) then
    raise exception using errcode = 'P0001', message = 'receptionist_facility_idempotency_unverified';
  end if;
  v_booking_id := public.create_facility_booking_atomic(p_booking,p_request_key);
  -- The existing public RPC may return a concurrently created row for the
  -- same key. Only bind a receipt if this transaction actually inserted it.
  select xmin::text into v_row_xid from public.facility_bookings where id=v_booking_id and idempotency_key=p_request_key;
  if v_row_xid is null or v_row_xid <> pg_current_xact_id()::text then
    raise exception using errcode = 'P0001', message = 'receptionist_facility_idempotency_unverified';
  end if;
  insert into public.receptionist_facility_receipts(request_key,request_hash,booking_id)
  values(p_request_key,v_hash,v_booking_id);
  return v_booking_id::text;
end;
$$;
revoke all on function public.create_receptionist_facility_booking_atomic_v1(jsonb,text) from public, anon, authenticated;
grant execute on function public.create_receptionist_facility_booking_atomic_v1(jsonb,text) to service_role;
