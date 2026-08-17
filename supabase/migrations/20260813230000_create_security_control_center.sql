create table if not exists public.security_action_leases (
  action_key text primary key,
  locked_until timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.security_action_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null,
  action text not null,
  provider text not null,
  deployment_sha text,
  outcome text not null,
  safe_code text not null,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  constraint security_action_audit_action check (action in ('scan', 'health')),
  constraint security_action_audit_provider check (provider in ('aikido', 'aithura')),
  constraint security_action_audit_outcome check (outcome in ('requested', 'accepted', 'succeeded', 'failed', 'denied'))
);

create table if not exists public.security_service_observations (
  provider text primary key,
  state text not null,
  checked_at timestamptz not null,
  message text not null,
  actor_id text not null,
  deployment_sha text,
  updated_at timestamptz not null default now(),
  constraint security_service_observation_provider check (provider in ('aikido', 'aithura')),
  constraint security_service_observation_state check (state in ('healthy', 'degraded', 'failing', 'unavailable'))
);

create table if not exists public.security_scan_jobs (
  scan_id bigint primary key,
  correlation_id uuid not null unique,
  actor_id text not null,
  deployment_sha text not null,
  branch_name text not null,
  head_commit_id text not null,
  status text not null default 'pending',
  result_state text,
  message text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint security_scan_job_status check (status in ('pending', 'completed')),
  constraint security_scan_job_result check (result_state is null or result_state in ('passed', 'findings'))
);

create or replace function public.claim_security_action(
  p_action_key text,
  p_cooldown_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_key text;
begin
  if length(p_action_key) < 3 or length(p_action_key) > 160 then
    return false;
  end if;
  if p_cooldown_seconds < 10 or p_cooldown_seconds > 3600 then
    return false;
  end if;

  insert into public.security_action_leases (action_key, locked_until, updated_at)
  values (p_action_key, now() + make_interval(secs => p_cooldown_seconds), now())
  on conflict (action_key) do update
    set locked_until = excluded.locked_until,
        updated_at = now()
    where public.security_action_leases.locked_until <= now()
  returning action_key into claimed_key;

  return claimed_key is not null;
end;
$$;

create or replace function public.prevent_security_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'security audit events are append-only';
end;
$$;

create or replace function public.complete_security_scan_job(
  p_scan_id bigint,
  p_correlation_id uuid,
  p_actor_id text,
  p_deployment_sha text,
  p_passed boolean,
  p_message text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  completed_id bigint;
begin
  update public.security_scan_jobs
  set status = 'completed',
      result_state = case when p_passed then 'passed' else 'findings' end,
      message = left(p_message, 240),
      completed_at = now()
  where scan_id = p_scan_id
    and correlation_id = p_correlation_id
    and actor_id = p_actor_id
    and deployment_sha = p_deployment_sha
    and status = 'pending'
  returning scan_id into completed_id;

  if completed_id is null then
    return false;
  end if;

  insert into public.security_action_audit_events (
    actor_id, action, provider, deployment_sha, outcome, safe_code, correlation_id
  ) values (
    p_actor_id, 'scan', 'aikido', p_deployment_sha,
    case when p_passed then 'succeeded' else 'failed' end,
    case when p_passed then 'scan_passed' else 'scan_findings' end,
    p_correlation_id
  );
  return true;
end;
$$;

drop trigger if exists security_action_audit_append_only on public.security_action_audit_events;
create trigger security_action_audit_append_only
before update or delete on public.security_action_audit_events
for each row execute function public.prevent_security_audit_mutation();

alter table public.security_action_leases enable row level security;
alter table public.security_action_audit_events enable row level security;
alter table public.security_service_observations enable row level security;
alter table public.security_scan_jobs enable row level security;

revoke all on public.security_action_leases from anon, authenticated;
revoke all on public.security_action_audit_events from anon, authenticated;
revoke all on public.security_service_observations from anon, authenticated;
revoke all on public.security_scan_jobs from anon, authenticated;
revoke all on function public.claim_security_action(text, integer) from public, anon, authenticated;
revoke all on function public.complete_security_scan_job(bigint, uuid, text, text, boolean, text) from public, anon, authenticated;
grant select, insert on public.security_action_audit_events to service_role;
grant select, insert, update on public.security_service_observations to service_role;
grant select, insert, update on public.security_scan_jobs to service_role;
grant execute on function public.claim_security_action(text, integer) to service_role;
grant execute on function public.complete_security_scan_job(bigint, uuid, text, text, boolean, text) to service_role;
