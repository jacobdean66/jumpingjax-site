-- Review-only send fence. Caller authority and exact payload construction must
-- be established by a trusted server before this service-role function runs.
create table public.receptionist_agreement_email_claims (
  operation_id uuid primary key,
  booking_kind text not null check (booking_kind in ('rental','facility')),
  booking_id text not null,
  agreement_id uuid not null,
  agreement_version integer not null check (agreement_version > 0),
  payload_mac text not null check (payload_mac ~ '^[a-f0-9]{64}$'),
  state text not null check (state in ('outcome_unknown','accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.receptionist_agreement_email_claims enable row level security;
revoke all on public.receptionist_agreement_email_claims from public, anon, authenticated;
grant select, insert, update on public.receptionist_agreement_email_claims to service_role;
create unique index receptionist_agreement_one_unknown_send
  on public.receptionist_agreement_email_claims(booking_kind,booking_id,agreement_id)
  where state='outcome_unknown';

create function public.claim_receptionist_agreement_email(
  p_operation_id uuid,p_kind text,p_booking_id text,p_agreement_id uuid,p_version integer,p_expected_email text,p_payload_mac text
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare prior public.receptionist_agreement_email_claims%rowtype;
  current_email text; booking_status text; current_id uuid; current_version integer; current_status text; current_signed_at timestamptz; active_count integer;
begin
  if p_operation_id is null or p_agreement_id is null or p_kind is null or p_kind not in ('rental','facility') or
     p_booking_id is null or p_version is null or p_version < 1 or p_expected_email is null or
     length(p_expected_email) > 254 or p_expected_email <> lower(btrim(p_expected_email)) or
     p_expected_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or
     p_payload_mac is null or p_payload_mac !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='22023',message='invalid_agreement_email_claim';
  end if;
  if p_kind='rental' and (p_booking_id !~ '^[1-9][0-9]{0,18}$' or
      (length(p_booking_id)=19 and p_booking_id > '9223372036854775807')) or
     p_kind='facility' and p_booking_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception using errcode='22023',message='invalid_agreement_booking';
  end if;
  -- Serialize all claims for this agreement, including different operation IDs.
  perform pg_advisory_xact_lock(hashtextextended('receptionist-agreement-email:'||p_kind||':'||p_booking_id||':'||p_agreement_id::text,0));
  select * into prior from public.receptionist_agreement_email_claims where operation_id=p_operation_id for update;
  if found then
    if prior.booking_kind<>p_kind or prior.booking_id<>p_booking_id or prior.agreement_id<>p_agreement_id or
       prior.agreement_version<>p_version or prior.payload_mac<>p_payload_mac then
      return jsonb_build_object('status','conflict','dispatch',false);
    end if;
    return jsonb_build_object('status',prior.state,'dispatch',false);
  end if;
  if exists (select 1 from public.receptionist_agreement_email_claims where booking_kind=p_kind and booking_id=p_booking_id
      and agreement_id=p_agreement_id and state='outcome_unknown') then
    return jsonb_build_object('status','outcome_unknown','dispatch',false);
  end if;
  if p_kind='rental' then
    select customer_email,status into current_email,booking_status from public.bookings where id=p_booking_id::bigint for update;
    select count(*) into active_count from public.rental_agreements where booking_id=p_booking_id::bigint and status is distinct from 'superseded';
    select id,version,status,signed_at into current_id,current_version,current_status,current_signed_at from public.rental_agreements
      where booking_id=p_booking_id::bigint and status is distinct from 'superseded' order by version desc limit 1 for update;
    if booking_status is null or current_status is null or booking_status not in ('pending','approved') or current_status<>'awaiting_signature' then
      return jsonb_build_object('status','unavailable','dispatch',false);
    end if;
  else
    select email,status into current_email,booking_status from public.facility_bookings where id=p_booking_id::uuid for update;
    select count(*) into active_count from public.facility_party_agreements where booking_id=p_booking_id::uuid and status is distinct from 'superseded';
    select id,version,status,signed_at into current_id,current_version,current_status,current_signed_at from public.facility_party_agreements
      where booking_id=p_booking_id::uuid and status is distinct from 'superseded' order by version desc limit 1 for update;
    if booking_status is null or current_status is null or booking_status not in ('pending','confirmed') or current_status<>'sent' then
      return jsonb_build_object('status','unavailable','dispatch',false);
    end if;
  end if;
  if current_signed_at is not null or current_email is null or lower(btrim(current_email))<>p_expected_email or active_count<>1 or
     current_id is distinct from p_agreement_id or current_version is distinct from p_version then
    return jsonb_build_object('status','unavailable','dispatch',false);
  end if;
  -- Commit unknown before the caller starts the external provider request.
  insert into public.receptionist_agreement_email_claims(operation_id,booking_kind,booking_id,agreement_id,agreement_version,payload_mac,state)
  values(p_operation_id,p_kind,p_booking_id,p_agreement_id,p_version,p_payload_mac,'outcome_unknown');
  return jsonb_build_object('status','outcome_unknown','dispatch',true);
end;
$$;
revoke all on function public.claim_receptionist_agreement_email(uuid,text,text,uuid,integer,text,text) from public, anon, authenticated;
grant execute on function public.claim_receptionist_agreement_email(uuid,text,text,uuid,integer,text,text) to service_role;
