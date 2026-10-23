-- A separate queue: the website's short-lived generic workers must never claim coding work.
create table public.agent_code_repairs (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null,
  request_id uuid not null,
  description text not null check (length(description) between 3 and 800),
  page_path text not null check (length(page_path) between 1 and 200),
  expected_text text not null check (length(expected_text) between 3 and 180),
  status text not null default 'queued' check (status in ('queued','running','review_ready','failed','cancelled')),
  lease_token uuid,
  lease_expires_at timestamptz,
  run_url text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(actor_id, request_id)
);
create index agent_code_repairs_queue on public.agent_code_repairs(status,created_at);
alter table public.agent_code_repairs enable row level security;
revoke all on public.agent_code_repairs from public,anon,authenticated;
grant select,insert,update on public.agent_code_repairs to service_role;

create table public.agent_code_repair_runner (
  singleton boolean primary key default true check(singleton),
  last_seen_at timestamptz not null,
  run_url text not null
);
alter table public.agent_code_repair_runner enable row level security;
revoke all on public.agent_code_repair_runner from public,anon,authenticated;
grant select,insert,update on public.agent_code_repair_runner to service_role;

create function public.code_repair_controls_allow() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.agent_manager_settings where singleton and not emergency_stop)
    and (select count(*)=2 from public.agents where key in ('supervisor','coding') and enabled and not paused);
$$;

create function public.enqueue_code_repair(p_actor_id text,p_request_id uuid,p_description text,p_page_path text,p_expected_text text)
returns public.agent_code_repairs language plpgsql security definer set search_path=public as $$
declare v_job public.agent_code_repairs;
begin
  perform pg_advisory_xact_lock(22102601);
  select * into v_job from public.agent_code_repairs where actor_id=p_actor_id and request_id=p_request_id;
  if found then
    if v_job.description<>p_description or v_job.page_path<>p_page_path or v_job.expected_text<>p_expected_text then raise exception 'request identity changed'; end if;
    return v_job;
  end if;
  if not public.code_repair_controls_allow() then raise exception 'repair controls stopped'; end if;
  if (select count(*) from public.agent_code_repairs where status in ('queued','running'))>=3 then raise exception 'active repair budget reached'; end if;
  if (select count(*) from public.agent_code_repairs where created_at>now()-interval '24 hours')>=10 then raise exception 'daily repair budget reached'; end if;
  insert into public.agent_code_repairs(actor_id,request_id,description,page_path,expected_text)
    values(p_actor_id,p_request_id,p_description,p_page_path,p_expected_text) returning * into v_job;
  return v_job;
end $$;

create function public.claim_code_repair(p_run_url text) returns public.agent_code_repairs
language plpgsql security definer set search_path=public as $$
declare v_job public.agent_code_repairs;
begin
  perform pg_advisory_xact_lock(22102601);
  -- Expired workers fail visibly; they never trigger another paid run automatically.
  update public.agent_code_repairs set status='failed',lease_token=null,lease_expires_at=null,updated_at=now(),
    result=jsonb_build_object('summary','The coding worker stopped before returning verified evidence.')
    where status='running' and lease_expires_at<now();
  if p_run_url !~ '^https://github[.]com/jacobdean66/jumpingjax-site/actions/runs/[1-9][0-9]*$' then raise exception 'invalid worker run'; end if;
  insert into public.agent_code_repair_runner(singleton,last_seen_at,run_url) values(true,now(),p_run_url)
    on conflict(singleton) do update set last_seen_at=excluded.last_seen_at,run_url=excluded.run_url;
  if not public.code_repair_controls_allow() then return null; end if;
  -- The isolated publisher in the same GitHub run recovers its existing lease.
  select * into v_job from public.agent_code_repairs where status='running' and run_url=p_run_url;
  if found then return v_job; end if;
  if exists(select 1 from public.agent_code_repairs where status='running') then return null; end if;
  select * into v_job from public.agent_code_repairs where status='queued' order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.agent_code_repairs set status='running',lease_token=gen_random_uuid(),lease_expires_at=now()+interval '70 minutes',
    run_url=p_run_url,updated_at=now() where id=v_job.id returning * into v_job;
  return v_job;
end $$;

create function public.code_repair_lease_active(p_id uuid,p_lease_token uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select public.code_repair_controls_allow() and exists(select 1 from public.agent_code_repairs
    where id=p_id and lease_token=p_lease_token and status='running' and lease_expires_at>now());
$$;

create function public.recover_code_repair_lease(p_id uuid,p_run_url text) returns public.agent_code_repairs
language sql stable security definer set search_path=public as $$
  select r from public.agent_code_repairs r where id=p_id and run_url=p_run_url and status='running'
    and lease_expires_at>now() and public.code_repair_controls_allow();
$$;

create function public.finish_code_repair(p_id uuid,p_lease_token uuid,p_result jsonb) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  if not public.code_repair_lease_active(p_id,p_lease_token) then return false; end if;
  if p_result->>'outcome' not in ('review_ready','failed') then raise exception 'invalid outcome'; end if;
  update public.agent_code_repairs set status=p_result->>'outcome',result=p_result,lease_token=null,lease_expires_at=null,updated_at=now()
    where id=p_id and lease_token=p_lease_token and status='running';
  return found;
end $$;

revoke all on function public.code_repair_controls_allow(), public.enqueue_code_repair(text,uuid,text,text,text),
  public.claim_code_repair(text), public.code_repair_lease_active(uuid,uuid), public.finish_code_repair(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.code_repair_controls_allow(), public.enqueue_code_repair(text,uuid,text,text,text),
  public.claim_code_repair(text), public.code_repair_lease_active(uuid,uuid), public.finish_code_repair(uuid,uuid,jsonb) to service_role;
revoke all on function public.recover_code_repair_lease(uuid,text) from public,anon,authenticated;
grant execute on function public.recover_code_repair_lease(uuid,text) to service_role;
