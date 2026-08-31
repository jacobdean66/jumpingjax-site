-- Durable, redacted staging for composite Booking Agent requests.
-- This does not create bookings, write calendars, contact customers, or process payments.

create table if not exists public.composite_booking_intents (
  id uuid primary key default gen_random_uuid(),
  transaction_key text not null unique,
  request_fingerprint text not null,
  conversation_ref_hash text not null,
  revision integer not null check (revision > 0),
  status text not null default 'pending_owner_approval'
    check (status in ('pending_owner_approval','approved','rejected','cancelled','projection_staged','projected','rolled_back','failed')),
  services jsonb not null,
  projections jsonb not null,
  quote jsonb not null,
  agent_job_id uuid not null unique references public.agent_jobs(id),
  approval_id uuid not null unique references public.agent_approvals(id),
  approved_at timestamptz,
  projected_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(services) = 'array'),
  check (jsonb_typeof(projections) = 'array'),
  check (jsonb_typeof(quote) = 'object'),
  check (length(request_fingerprint) = 64),
  check (length(conversation_ref_hash) = 64)
);

create index if not exists composite_booking_intents_status_idx
  on public.composite_booking_intents(status, created_at);

create table if not exists public.composite_booking_calendar_projections (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.composite_booking_intents(id),
  projection_key text not null unique,
  transaction_key text not null,
  calendar_name text not null check (calendar_name in ('rentals','facility','foam-operations')),
  service_kind text not null check (service_kind in ('rental','facility_party','foam_party')),
  resource_ref text not null,
  service_date date not null,
  start_minutes integer not null check (start_minutes between 0 and 1439),
  end_minutes integer not null check (end_minutes between 1 and 2880 and end_minutes > start_minutes),
  status text not null default 'staged' check (status in ('staged','projected','rolled_back','failed')),
  external_event_ref text,
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  last_error text,
  staged_at timestamptz not null default now(),
  projected_at timestamptz,
  rolled_back_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (intent_id, projection_key),
  check ((status = 'projected') = (external_event_ref is not null))
);

create index if not exists composite_booking_calendar_resource_idx
  on public.composite_booking_calendar_projections(resource_ref, service_date, start_minutes, end_minutes)
  where status in ('staged','projected');

create or replace function public.stage_composite_booking_intent(
  p_transaction_key text,
  p_request_fingerprint text,
  p_conversation_ref_hash text,
  p_revision integer,
  p_services jsonb,
  p_projections jsonb,
  p_quote jsonb,
  p_requested_by text
)
returns public.composite_booking_intents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent public.agents;
  v_job public.agent_jobs;
  v_approval public.agent_approvals;
  v_intent public.composite_booking_intents;
  v_payload jsonb;
  v_intent_created boolean := false;
begin
  if length(p_transaction_key) < 8 or length(p_transaction_key) > 200 then
    raise exception 'invalid transaction key';
  end if;
  if length(p_request_fingerprint) <> 64 or length(p_conversation_ref_hash) <> 64 then
    raise exception 'invalid booking intent fingerprint';
  end if;
  if p_revision <= 0 or jsonb_typeof(p_services) <> 'array'
     or jsonb_array_length(p_services) = 0 or jsonb_typeof(p_projections) <> 'array'
     or jsonb_array_length(p_projections) = 0 or jsonb_typeof(p_quote) <> 'object' then
    raise exception 'invalid booking intent snapshot';
  end if;
  if nullif(btrim(p_requested_by), '') is null then
    raise exception 'requesting owner is required';
  end if;

  select * into v_agent from public.agents where key = 'booking' for update;
  if not found or not v_agent.enabled or v_agent.paused then
    raise exception 'Booking Agent is paused or disabled';
  end if;
  if exists (select 1 from public.agent_manager_settings where singleton and emergency_stop) then
    raise exception 'Agent Manager emergency stop is active';
  end if;

  v_payload := jsonb_build_object(
    'transactionKey', p_transaction_key,
    'requestFingerprint', p_request_fingerprint,
    'revision', p_revision,
    'services', p_services,
    'bookingWritesAllowed', false,
    'calendarWritesAllowed', false,
    'customerMessagesAllowed', false,
    'paymentWritesAllowed', false
  );

  insert into public.agent_jobs (
    agent_id, job_type, source, payload, idempotency_key,
    approval_required, approval_status, status
  ) values (
    v_agent.id, 'booking.composite.intent.stage', 'admin.composite_booking', v_payload,
    'booking-intent:' || p_request_fingerprint,
    true, 'pending', 'approval_required'
  )
  on conflict (agent_id, idempotency_key) do update
    set idempotency_key = excluded.idempotency_key
  returning * into v_job;

  if v_job.job_type <> 'booking.composite.intent.stage'
     or v_job.payload->>'requestFingerprint' <> p_request_fingerprint then
    raise exception 'booking intent idempotency collision';
  end if;

  insert into public.agent_approvals(job_id, action_type, requested_by)
  values (v_job.id, 'booking.composite.intent.stage', left(p_requested_by, 200))
  on conflict (job_id) do update set job_id = excluded.job_id
  returning * into v_approval;

  insert into public.composite_booking_intents (
    transaction_key, request_fingerprint, conversation_ref_hash, revision,
    services, projections, quote, agent_job_id, approval_id
  ) values (
    p_transaction_key, p_request_fingerprint, p_conversation_ref_hash, p_revision,
    p_services, p_projections, p_quote, v_job.id, v_approval.id
  )
  on conflict (transaction_key) do nothing
  returning * into v_intent;

  if found then
    v_intent_created := true;
  else
    select * into v_intent
    from public.composite_booking_intents
    where transaction_key = p_transaction_key;
  end if;

  if v_intent.request_fingerprint <> p_request_fingerprint then
    raise exception 'booking transaction key collision';
  end if;

  if v_intent_created then
    insert into public.agent_events(agent_id, job_id, event_type, actor_id, summary, metadata)
    values (
      v_agent.id, v_job.id, 'booking.intent.staged', left(p_requested_by, 200),
      'Composite booking intent staged for owner approval; no booking or calendar was written.',
      jsonb_build_object('intentId', v_intent.id, 'aiInvocations', 0, 'productionBookingWrites', 0, 'productionCalendarWrites', 0)
    );
  end if;

  return v_intent;
end
$$;

create or replace function public.decide_composite_booking_intent(
  p_approval_id uuid,
  p_decision text,
  p_actor_id text
)
returns public.composite_booking_intents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.composite_booking_intents;
  v_job public.agent_jobs;
  v_projection jsonb;
  v_projection_key text;
begin
  if p_decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
  if nullif(btrim(p_actor_id), '') is null then raise exception 'owner actor is required'; end if;

  select i.* into v_intent
  from public.composite_booking_intents i
  join public.agent_approvals a on a.id = i.approval_id
  where a.id = p_approval_id
  for update of i;
  if not found then raise exception 'booking intent approval not found'; end if;
  if v_intent.status <> 'pending_owner_approval' then return v_intent; end if;

  select * into v_job from public.agent_jobs where id = v_intent.agent_job_id for update;
  if p_decision = 'approved'
     and exists (select 1 from public.agent_manager_settings where singleton and emergency_stop) then
    raise exception 'Agent Manager emergency stop is active';
  end if;

  if p_decision = 'approved' and exists (
    select 1
    from jsonb_array_elements(v_intent.projections) proposed
    join public.composite_booking_calendar_projections active
      on active.resource_ref = proposed->>'resourceRef'
     and active.service_date = (proposed->>'date')::date
     and active.start_minutes < (proposed->>'endMinutes')::integer
     and (proposed->>'startMinutes')::integer < active.end_minutes
     and active.status in ('staged','projected')
     and active.intent_id <> v_intent.id
  ) then
    raise exception 'calendar resource conflict';
  end if;

  update public.agent_approvals
  set status = p_decision, decided_by = left(p_actor_id, 200), decided_at = now()
  where id = p_approval_id and status = 'pending';

  if p_decision = 'rejected' then
    update public.agent_jobs
    set approval_status = 'rejected', status = 'cancelled', completed_at = now(), updated_at = now()
    where id = v_intent.agent_job_id;
    update public.composite_booking_intents
    set status = 'rejected', updated_at = now()
    where id = v_intent.id returning * into v_intent;
  else
    for v_projection in select value from jsonb_array_elements(v_intent.projections)
    loop
      v_projection_key := md5(
        v_intent.transaction_key || ':' || (v_projection->>'resourceRef') || ':'
        || (v_projection->>'date') || ':' || (v_projection->>'startMinutes') || ':'
        || (v_projection->>'endMinutes')
      );
      insert into public.composite_booking_calendar_projections (
        intent_id, projection_key, transaction_key, calendar_name, service_kind,
        resource_ref, service_date, start_minutes, end_minutes
      ) values (
        v_intent.id, v_projection_key, v_intent.transaction_key,
        v_projection->>'calendar', v_projection->>'service', v_projection->>'resourceRef',
        (v_projection->>'date')::date, (v_projection->>'startMinutes')::integer,
        (v_projection->>'endMinutes')::integer
      ) on conflict (projection_key) do nothing;
    end loop;
    update public.agent_jobs
    set approval_status = 'approved', status = 'succeeded',
        result_summary = 'Owner approved redacted intent; calendar projections staged only.',
        completed_at = now(), updated_at = now()
    where id = v_intent.agent_job_id;
    update public.composite_booking_intents
    set status = 'projection_staged', approved_at = now(), updated_at = now()
    where id = v_intent.id returning * into v_intent;
  end if;

  insert into public.agent_events(agent_id, job_id, event_type, actor_id, summary, metadata)
  values (
    v_job.agent_id, v_job.id, 'booking.intent.' || p_decision, left(p_actor_id, 200),
    case when p_decision = 'approved'
      then 'Owner approved intent; calendar projections staged with no external calendar write.'
      else 'Owner rejected composite booking intent; no booking or calendar was written.' end,
    jsonb_build_object('intentId', v_intent.id, 'aiInvocations', 0, 'externalCalendarWrites', 0)
  );
  return v_intent;
end
$$;

create or replace function public.rollback_composite_booking_projection_staging(
  p_intent_id uuid,
  p_actor_id text
)
returns public.composite_booking_intents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.composite_booking_intents;
  v_job public.agent_jobs;
begin
  select * into v_intent from public.composite_booking_intents where id = p_intent_id for update;
  if not found then raise exception 'booking intent not found'; end if;
  if v_intent.status <> 'projection_staged' then raise exception 'intent is not staged for rollback'; end if;
  if exists (
    select 1 from public.composite_booking_calendar_projections
    where intent_id = p_intent_id and (status = 'projected' or external_event_ref is not null)
  ) then raise exception 'external projection requires separate rollback'; end if;

  update public.composite_booking_calendar_projections
  set status = 'rolled_back', rolled_back_at = now(), updated_at = now()
  where intent_id = p_intent_id and status = 'staged';
  update public.composite_booking_intents
  set status = 'rolled_back', rolled_back_at = now(), updated_at = now()
  where id = p_intent_id returning * into v_intent;
  select * into v_job from public.agent_jobs where id = v_intent.agent_job_id;
  insert into public.agent_events(agent_id, job_id, event_type, actor_id, summary, metadata)
  values (
    v_job.agent_id, v_job.id, 'booking.projection_staging.rolled_back', left(p_actor_id, 200),
    'Calendar projection staging rolled back without deletion or external calendar writes.',
    jsonb_build_object('intentId', v_intent.id, 'externalCalendarWrites', 0)
  );
  return v_intent;
end
$$;

alter table public.composite_booking_intents enable row level security;
alter table public.composite_booking_calendar_projections enable row level security;
revoke all on public.composite_booking_intents from anon, authenticated;
revoke all on public.composite_booking_calendar_projections from anon, authenticated;
grant select, insert, update, delete on public.composite_booking_intents to service_role;
grant select, insert, update, delete on public.composite_booking_calendar_projections to service_role;
revoke all on function public.stage_composite_booking_intent(text,text,text,integer,jsonb,jsonb,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.stage_composite_booking_intent(text,text,text,integer,jsonb,jsonb,jsonb,text)
  to service_role;
revoke all on function public.decide_composite_booking_intent(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.decide_composite_booking_intent(uuid,text,text)
  to service_role;
revoke all on function public.rollback_composite_booking_projection_staging(uuid,text)
  from public, anon, authenticated;
grant execute on function public.rollback_composite_booking_projection_staging(uuid,text)
  to service_role;
