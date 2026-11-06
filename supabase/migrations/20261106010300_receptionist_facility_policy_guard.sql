-- Forward-only and intentionally unseeded. A deployment must install the
-- reviewed build's policy digest before enabling the receptionist write API.
create table if not exists public.receptionist_facility_policy_revision (
  singleton boolean primary key default true check (singleton),
  policy_digest text not null check (policy_digest ~ '^[a-f0-9]{64}$'),
  updated_at timestamptz not null default now()
);
alter table public.receptionist_facility_policy_revision enable row level security;
revoke all on public.receptionist_facility_policy_revision from public, anon, authenticated, service_role;

-- Retain the exact confirmed terms and contact details for later notices. A
-- digest alone cannot reconstruct what the caller accepted. These rows contain
-- personal data and are accessible only to the service role/owner.
create table if not exists public.receptionist_facility_confirmation_snapshots (
  booking_id uuid primary key,
  confirmed_quote jsonb not null check (jsonb_typeof(confirmed_quote)='object'),
  confirmed_terms jsonb not null check (jsonb_typeof(confirmed_terms)='object'),
  selection jsonb not null check (jsonb_typeof(selection)='object'),
  confirmed_details jsonb not null check (jsonb_typeof(confirmed_details)='object'),
  created_at timestamptz not null default now()
);
alter table public.receptionist_facility_confirmation_snapshots enable row level security;
revoke all on public.receptionist_facility_confirmation_snapshots from public, anon, authenticated, service_role;
grant select on public.receptionist_facility_confirmation_snapshots to service_role;

create or replace function public.lookup_receptionist_facility_booking_v3(p_request jsonb,p_request_key text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing text;
begin
  v_existing := public.lookup_receptionist_facility_booking_v2(p_request,p_request_key);
  if v_existing is not null and not exists(select 1 from public.receptionist_facility_confirmation_snapshots where booking_id=v_existing::uuid) then
    raise exception using errcode = 'P0001', message = 'receptionist_facility_snapshot_missing';
  end if;
  return v_existing;
end;
$$;
revoke all on function public.lookup_receptionist_facility_booking_v3(jsonb,text) from public, anon, authenticated;
grant execute on function public.lookup_receptionist_facility_booking_v3(jsonb,text) to service_role;

create or replace function public.create_receptionist_facility_booking_guarded_v4(
  p_request jsonb,
  p_booking jsonb,
  p_request_key text,
  p_settings_version text,
  p_policy_digest text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing text;
  v_policy text;
  v_created text;
begin
  -- A previously committed exact request is reconciled under its old policy.
  v_existing := public.lookup_receptionist_facility_booking_v3(p_request,p_request_key);
  if v_existing is not null then return v_existing; end if;
  if p_policy_digest is null or p_policy_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_receptionist_facility_policy';
  end if;
  select policy_digest into v_policy from public.receptionist_facility_policy_revision where singleton=true for share;
  if v_policy is null or v_policy is distinct from p_policy_digest then
    raise exception using errcode = 'P0001', message = 'receptionist_facility_policy_changed';
  end if;
  -- Hold the policy row lock until the existing settings/slot/receipt/queue
  -- transaction commits, so a new policy cannot become active mid-write.
  if jsonb_typeof(p_request->'confirmedQuote') is distinct from 'object'
     or jsonb_typeof(p_request->'confirmedTerms') is distinct from 'object'
     or jsonb_typeof(p_request->'selection') is distinct from 'object'
     or jsonb_typeof(p_request->'details') is distinct from 'object' then
    raise exception using errcode = '22023', message = 'invalid_receptionist_facility_snapshot';
  end if;
  v_created := public.create_receptionist_facility_booking_guarded_v3(p_request,p_booking,p_request_key,p_settings_version);
  insert into public.receptionist_facility_confirmation_snapshots(booking_id,confirmed_quote,confirmed_terms,selection,confirmed_details)
  values(v_created::uuid,p_request->'confirmedQuote',p_request->'confirmedTerms',p_request->'selection',p_request->'details');
  return v_created;
end;
$$;
revoke all on function public.create_receptionist_facility_booking_guarded_v4(jsonb,jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.create_receptionist_facility_booking_guarded_v4(jsonb,jsonb,text,text,text) to service_role;

-- Older deployed receptionist instances must not bypass the new guard. These
-- SECURITY DEFINER functions remain callable internally by the function owner.
revoke execute on function public.create_receptionist_facility_booking_queued_v2(jsonb,jsonb,text) from service_role;
revoke execute on function public.create_receptionist_facility_booking_guarded_v3(jsonb,jsonb,text,text) from service_role;
