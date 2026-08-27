-- Permanent Agent Manager durable core. Additive; service-role server access only.

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  display_name text not null,
  agent_type text not null,
  enabled boolean not null default true,
  paused boolean not null default false,
  status text not null default 'not_configured' check (status in ('online','idle','working','paused','error','not_configured')),
  capabilities jsonb not null default '[]'::jsonb,
  configuration_reference text,
  current_job_id uuid,
  last_activity_at timestamptz,
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_jobs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id),
  job_type text not null,
  source text not null,
  priority smallint not null default 100 check (priority between 0 and 1000),
  status text not null default 'queued' check (status in ('queued','claimed','running','approval_required','succeeded','failed','cancelled')),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  worker_invocation_count integer not null default 0 check (worker_invocation_count >= 0),
  max_worker_invocations integer not null default 0 check (max_worker_invocations between 0 and 10),
  timeout_seconds integer not null default 60 check (timeout_seconds between 1 and 3600),
  approval_required boolean not null default false,
  approval_status text not null default 'not_required' check (approval_status in ('not_required','pending','approved','rejected')),
  claimed_by text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  next_retry_at timestamptz,
  result_summary text,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, idempotency_key)
);

alter table public.agents drop constraint if exists agents_current_job_id_fkey;
alter table public.agents add constraint agents_current_job_id_fkey foreign key (current_job_id) references public.agent_jobs(id) on delete set null;

create table if not exists public.agent_events (
  id bigint generated always as identity primary key,
  agent_id uuid references public.agents(id),
  job_id uuid references public.agent_jobs(id),
  event_type text not null,
  actor_id text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_approvals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.agent_jobs(id),
  action_type text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by text not null,
  decided_by text,
  reason text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists public.agent_manager_settings (
  singleton boolean primary key default true check (singleton),
  emergency_stop boolean not null default false,
  max_concurrency integer not null default 1 check (max_concurrency between 1 and 10),
  updated_by text,
  updated_at timestamptz not null default now()
);
insert into public.agent_manager_settings (singleton) values (true) on conflict do nothing;

create index if not exists agent_jobs_claim_idx on public.agent_jobs (priority, created_at) where status = 'queued';
create index if not exists agent_jobs_retry_idx on public.agent_jobs (next_retry_at) where status = 'queued';
create index if not exists agent_events_recent_idx on public.agent_events (created_at desc);

insert into public.agents (key, display_name, agent_type, status, capabilities) values
  ('supervisor','Agent Manager','deterministic','idle','["system.health_check"]'),
  ('nomination','Nomination Agent','application','not_configured','[]'),
  ('booking','Booking Agent','application','not_configured','[]'),
  ('waiver','Waiver Agent','application','not_configured','[]'),
  ('party-invitation','Party / Invitation Agent','application','not_configured','[]'),
  ('social','Social Agent','worker_adapter','not_configured','[]'),
  ('coding','Coding Agent','worker_adapter','not_configured','[]'),
  ('health-security','Health / Security Agent','application','not_configured','[]')
on conflict (key) do nothing;

create or replace function public.enqueue_agent_job(p_agent_key text, p_job_type text, p_source text, p_payload jsonb, p_idempotency_key text, p_priority integer default 100, p_approval_required boolean default false)
returns public.agent_jobs language plpgsql security definer set search_path = public as $$
declare v_agent public.agents; v_job public.agent_jobs;
begin
  if length(trim(p_idempotency_key)) < 8 or length(p_idempotency_key) > 200 then raise exception 'invalid idempotency key'; end if;
  select * into v_agent from public.agents where key = p_agent_key;
  if not found then raise exception 'unknown agent'; end if;
  insert into public.agent_jobs (agent_id, job_type, source, payload, idempotency_key, priority, approval_required, approval_status, status)
  values (v_agent.id, p_job_type, left(p_source,80), coalesce(p_payload,'{}'), p_idempotency_key, p_priority,
    p_approval_required, case when p_approval_required then 'pending' else 'not_required' end,
    case when p_approval_required then 'approval_required' else 'queued' end)
  on conflict (agent_id, idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning * into v_job;
  if v_job.created_at = v_job.updated_at then
    insert into public.agent_events(agent_id,job_id,event_type,summary) values(v_agent.id,v_job.id,'job.enqueued','Job accepted');
  end if;
  return v_job;
end $$;

create or replace function public.claim_agent_job(p_worker_id text, p_lease_seconds integer default 60)
returns public.agent_jobs language plpgsql security definer set search_path = public as $$
declare v_job public.agent_jobs; v_running integer; v_limit integer;
begin
  select max_concurrency into v_limit from public.agent_manager_settings where singleton and not emergency_stop;
  if v_limit is null then return null; end if;
  select count(*) into v_running from public.agent_jobs where status in ('claimed','running') and lease_expires_at > now();
  if v_running >= v_limit then return null; end if;
  select j.* into v_job from public.agent_jobs j join public.agents a on a.id=j.agent_id
   where j.status='queued' and (j.next_retry_at is null or j.next_retry_at <= now()) and a.enabled and not a.paused
     and (j.approval_status in ('not_required','approved'))
   order by j.priority asc, j.created_at asc for update of j skip locked limit 1;
  if not found then return null; end if;
  update public.agent_jobs set status='claimed', claimed_by=left(p_worker_id,120), claimed_at=now(), lease_expires_at=now()+make_interval(secs=>least(greatest(p_lease_seconds,10),3600)), attempt_count=attempt_count+1, updated_at=now() where id=v_job.id returning * into v_job;
  update public.agents set status='working', current_job_id=v_job.id, last_activity_at=now(), updated_at=now() where id=v_job.agent_id;
  insert into public.agent_events(agent_id,job_id,event_type,summary) values(v_job.agent_id,v_job.id,'job.claimed','Worker claimed job');
  return v_job;
end $$;

create or replace function public.recover_expired_agent_jobs()
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  update public.agent_jobs set status=case when attempt_count>=max_attempts then 'failed' else 'queued' end,
    error_summary='Worker lease expired', next_retry_at=case when attempt_count>=max_attempts then null else now()+make_interval(secs=>least(300,power(2,attempt_count)::integer*5)) end,
    claimed_by=null, lease_expires_at=null, updated_at=now(), completed_at=case when attempt_count>=max_attempts then now() else null end
  where status in ('claimed','running') and lease_expires_at < now();
  get diagnostics v_count=row_count; return v_count;
end $$;

alter table public.agents enable row level security;
alter table public.agent_jobs enable row level security;
alter table public.agent_events enable row level security;
alter table public.agent_approvals enable row level security;
alter table public.agent_manager_settings enable row level security;
revoke all on public.agents,public.agent_jobs,public.agent_events,public.agent_approvals,public.agent_manager_settings from anon,authenticated;
grant select,insert,update,delete on public.agents,public.agent_jobs,public.agent_events,public.agent_approvals,public.agent_manager_settings to service_role;
grant usage,select on sequence public.agent_events_id_seq to service_role;
revoke all on function public.enqueue_agent_job(text,text,text,jsonb,text,integer,boolean) from public,anon,authenticated;
revoke all on function public.claim_agent_job(text,integer) from public,anon,authenticated;
revoke all on function public.recover_expired_agent_jobs() from public,anon,authenticated;
grant execute on function public.enqueue_agent_job(text,text,text,jsonb,text,integer,boolean), public.claim_agent_job(text,integer), public.recover_expired_agent_jobs() to service_role;
