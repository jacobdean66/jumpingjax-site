-- Forward-only, not applied by this development change. The confirmed request
-- is hashed separately from its booking-row mapping so a later code revision
-- can reconcile an exact replay before re-pricing or reconstructing that row.
create table if not exists public.receptionist_facility_notifications (
  booking_id uuid not null,
  kind text not null check (kind in ('owner', 'customer')),
  state text not null default 'pending' check (state in ('pending', 'sending', 'sent', 'unknown')),
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (booking_id, kind)
);
alter table public.receptionist_facility_notifications enable row level security;
revoke all on public.receptionist_facility_notifications from public, anon, authenticated;
grant select on public.receptionist_facility_notifications to service_role;
grant update (state, attempts, updated_at) on public.receptionist_facility_notifications to service_role;

create or replace function public.lookup_receptionist_facility_booking_v2(
  p_request jsonb,
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
     or p_request is null or jsonb_typeof(p_request) <> 'object'
     or p_request->>'idempotencyKey' is distinct from p_request_key
     or octet_length(p_request::text) > 65536 then
    raise exception using errcode = '22023', message = 'invalid_receptionist_facility_input';
  end if;
  v_hash := encode(sha256(convert_to(p_request::text, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('receptionist-facility-key:' || p_request_key, 0));
  select * into v_receipt from public.receptionist_facility_receipts where request_key=p_request_key for update;
  if found then
    if v_receipt.request_hash is distinct from v_hash then
      raise exception using errcode = 'P0001', message = 'receptionist_facility_idempotency_mismatch';
    end if;
    if not exists (select 1 from public.facility_bookings where id=v_receipt.booking_id and idempotency_key=p_request_key) then
      raise exception using errcode = 'P0001', message = 'receptionist_facility_receipt_booking_missing';
    end if;
    -- The endpoint may only report a pending result. A later confirmed or
    -- canceled booking needs status reconciliation, not a stale claim.
    if not exists (select 1 from public.facility_bookings where id=v_receipt.booking_id and idempotency_key=p_request_key and status='pending') then
      raise exception using errcode = 'P0001', message = 'receptionist_facility_booking_status_changed';
    end if;
    return v_receipt.booking_id::text;
  end if;
  if exists (select 1 from public.facility_bookings where idempotency_key=p_request_key) then
    raise exception using errcode = 'P0001', message = 'receptionist_facility_idempotency_unverified';
  end if;
  return null;
end;
$$;
revoke all on function public.lookup_receptionist_facility_booking_v2(jsonb,text) from public, anon, authenticated;
grant execute on function public.lookup_receptionist_facility_booking_v2(jsonb,text) to service_role;

create or replace function public.create_receptionist_facility_booking_queued_v2(
  p_request jsonb,
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
  v_existing text;
  v_booking_id uuid;
  v_row_xid text;
begin
  -- The lookup holds this transaction's per-key lock until this RPC commits.
  v_existing := public.lookup_receptionist_facility_booking_v2(p_request,p_request_key);
  if v_existing is not null then
    return v_existing;
  end if;
  if p_booking is null or jsonb_typeof(p_booking) <> 'object'
     or octet_length(p_booking::text) > 65536 then
    raise exception using errcode = '22023', message = 'invalid_receptionist_facility_input';
  end if;
  v_hash := encode(sha256(convert_to(p_request::text, 'UTF8')), 'hex');
  v_booking_id := public.create_facility_booking_atomic(p_booking,p_request_key);
  -- Never bind a receipt to a row concurrently created by the public RPC.
  select xmin::text into v_row_xid from public.facility_bookings where id=v_booking_id and idempotency_key=p_request_key;
  if v_row_xid is null or v_row_xid <> pg_current_xact_id()::text then
    raise exception using errcode = 'P0001', message = 'receptionist_facility_idempotency_unverified';
  end if;
  insert into public.receptionist_facility_receipts(request_key,request_hash,booking_id)
  values(p_request_key,v_hash,v_booking_id);
  insert into public.receptionist_facility_notifications(booking_id,kind)
  values(v_booking_id,'owner'),(v_booking_id,'customer');
  return v_booking_id::text;
end;
$$;
revoke all on function public.create_receptionist_facility_booking_queued_v2(jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.create_receptionist_facility_booking_queued_v2(jsonb,jsonb,text) to service_role;
