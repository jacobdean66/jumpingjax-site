-- A separate queue for the local Qwen pilot. It begins with a synthetic
-- connection check. No customer records or arbitrary commands enter this queue.
create table public.qwen_pilot_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null check (char_length(owner_id) between 1 and 200),
  request_id uuid not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'cancelling', 'cancelled', 'succeeded', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lease_id uuid,
  lease_expires_at timestamptz,
  model text check (model in ('qwen3:4b', 'qwen3:8b')),
  failure text check (failure in ('worker_lost', 'model_unavailable', 'unexpected_reply')),
  unique (owner_id, request_id),
  check (
    (status in ('running', 'cancelling') and lease_id is not null and lease_expires_at is not null)
    or (status not in ('running', 'cancelling') and lease_id is null and lease_expires_at is null)
  )
);

create index qwen_pilot_owner_history on public.qwen_pilot_jobs (owner_id, created_at desc);
create index qwen_pilot_waiting on public.qwen_pilot_jobs (created_at, id) where status = 'queued';
create unique index qwen_pilot_one_active on public.qwen_pilot_jobs ((true))
  where status in ('running', 'cancelling');

create table public.qwen_pilot_heartbeat (
  singleton boolean primary key default true check (singleton),
  seen_at timestamptz not null
);

alter table public.qwen_pilot_jobs enable row level security;
alter table public.qwen_pilot_heartbeat enable row level security;
revoke all on public.qwen_pilot_jobs, public.qwen_pilot_heartbeat from public, anon, authenticated;
grant select, insert, update on public.qwen_pilot_jobs, public.qwen_pilot_heartbeat to service_role;

create function public.cancel_qwen_pilot_job(p_owner_id text, p_job_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.qwen_pilot_jobs
    set status = case when status = 'running' then 'cancelling' else 'cancelled' end,
        lease_id = case when status = 'running' then lease_id else null end,
        lease_expires_at = case when status = 'running' then lease_expires_at else null end,
        updated_at = clock_timestamp()
    where owner_id = p_owner_id and id = p_job_id and status in ('queued', 'running');
  return found;
end;
$$;

create function public.claim_qwen_pilot_job()
returns table (job_id uuid, lease uuid)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Claiming and reclaiming are serialized across all laptop worker processes.
  perform pg_advisory_xact_lock(194836258, 1);

  insert into public.qwen_pilot_heartbeat (singleton, seen_at) values (true, clock_timestamp())
    on conflict (singleton) do update set seen_at = excluded.seen_at;

  update public.qwen_pilot_jobs
    set status = case when status = 'cancelling' then 'cancelled' else 'failed' end,
        failure = case when status = 'running' then 'worker_lost' else null end,
        lease_id = null, lease_expires_at = null, updated_at = clock_timestamp()
    where status in ('running', 'cancelling') and lease_expires_at <= clock_timestamp();

  if exists (select 1 from public.qwen_pilot_jobs where status in ('running', 'cancelling')) then
    return;
  end if;

  return query
    update public.qwen_pilot_jobs as job
      set status = 'running', lease_id = gen_random_uuid(),
          lease_expires_at = clock_timestamp() + interval '60 seconds', updated_at = clock_timestamp()
      where job.id = (
        select candidate.id from public.qwen_pilot_jobs as candidate
          where candidate.status = 'queued'
          order by candidate.created_at, candidate.id limit 1 for update skip locked
      )
      returning job.id, job.lease_id;
end;
$$;

create function public.renew_qwen_pilot_job(p_job_id uuid, p_lease uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.qwen_pilot_jobs
    set lease_expires_at = clock_timestamp() + interval '60 seconds', updated_at = clock_timestamp()
    where id = p_job_id and lease_id = p_lease and status = 'running'
      and lease_expires_at > clock_timestamp();
  if found then
    insert into public.qwen_pilot_heartbeat (singleton, seen_at) values (true, clock_timestamp())
      on conflict (singleton) do update set seen_at = excluded.seen_at;
    return true;
  end if;
  -- Leave the cancelling lease in place until the worker confirms its local
  -- request has stopped, or until the lease expires if the laptop disappears.
  return false;
end;
$$;

create function public.finish_qwen_pilot_job(p_job_id uuid, p_lease uuid, p_model text, p_failure text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_model is null or p_model not in ('qwen3:4b', 'qwen3:8b')
    or (p_failure is not null and p_failure not in ('model_unavailable', 'unexpected_reply')) then
    raise exception 'Invalid pilot result';
  end if;

  update public.qwen_pilot_jobs
    set status = case when status = 'cancelling' then 'cancelled'
                      when p_failure is not null then 'failed' else 'succeeded' end,
        failure = case when status = 'running' then p_failure else null end,
        model = case when status = 'running' then p_model else null end,
        lease_id = null, lease_expires_at = null, updated_at = clock_timestamp()
    where id = p_job_id and lease_id = p_lease and status in ('running', 'cancelling')
      and lease_expires_at > clock_timestamp();
  return found;
end;
$$;

revoke execute on function public.claim_qwen_pilot_job() from public, anon, authenticated;
revoke execute on function public.cancel_qwen_pilot_job(text, uuid) from public, anon, authenticated;
revoke execute on function public.renew_qwen_pilot_job(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.finish_qwen_pilot_job(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_qwen_pilot_job() to service_role;
grant execute on function public.cancel_qwen_pilot_job(text, uuid) to service_role;
grant execute on function public.renew_qwen_pilot_job(uuid, uuid) to service_role;
grant execute on function public.finish_qwen_pilot_job(uuid, uuid, text, text) to service_role;
