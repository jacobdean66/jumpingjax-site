-- Durable agent conversations reuse the manager queue and its lease/concurrency policy.
create table public.agent_network_contexts (
  id uuid primary key, title text not null check (length(title) between 1 and 120),
  actor_id text not null, created_at timestamptz not null default now(), cancelled_at timestamptz
);
create table public.agent_network_tasks (
  id uuid primary key default gen_random_uuid(),
  context_id uuid not null references public.agent_network_contexts(id),
  sender_key text not null references public.agents(key), recipient_key text not null references public.agents(key),
  skill text not null, input jsonb not null default '{}' check (octet_length(input::text) <= 8000),
  fingerprint text not null check (length(fingerprint) = 64), request_id uuid not null,
  parent_task_id uuid references public.agent_network_tasks(id), hop integer not null check (hop between 0 and 4),
  actor_id text not null, job_id uuid not null unique references public.agent_jobs(id),
  status text not null default 'queued' check (status in ('queued','working','waiting','completed','input_required','blocked','failed','cancelled')),
  result jsonb check (octet_length(result::text) <= 32000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(context_id,sender_key,request_id)
);
create unique index agent_network_one_child on public.agent_network_tasks(parent_task_id) where parent_task_id is not null;
create index agent_network_context_tasks on public.agent_network_tasks(context_id,created_at);
create table public.agent_network_messages (
  id bigint generated always as identity primary key,
  context_id uuid not null references public.agent_network_contexts(id), task_id uuid not null references public.agent_network_tasks(id),
  sender_key text not null, recipient_key text not null,
  kind text not null check (kind in ('request','reply','handoff')), summary text not null check (length(summary) <= 2000),
  created_at timestamptz not null default now(), unique(task_id,kind)
);
create index agent_network_messages_context on public.agent_network_messages(context_id,id);
alter table public.agent_network_contexts enable row level security;
alter table public.agent_network_tasks enable row level security;
alter table public.agent_network_messages enable row level security;
revoke all on public.agent_network_contexts,public.agent_network_tasks,public.agent_network_messages from anon,authenticated;
grant all on public.agent_network_contexts,public.agent_network_tasks,public.agent_network_messages to service_role;
grant usage,select on sequence public.agent_network_messages_id_seq to service_role;

insert into public.agents(key,display_name,agent_type,status,capabilities) values
('availability','Schedule Review Agent','application','idle','["availability_review"]'),
('answering-machine','Answering Machine','application','idle','["call_readiness","booking_review"]'),
('receptionist','Receptionist Adapter','worker_adapter','idle','["call_readiness","booking_review"]'),
('campaign-strategist','Campaign Strategist Adapter','worker_adapter','idle','["social_handoff"]'),
('creative-director','Creative Director Adapter','worker_adapter','idle','["social_handoff"]'),
('independent-reviewer','Independent Reviewer Adapter','worker_adapter','idle','["social_handoff"]'),
('social-strategy-copy','Social Strategy Copy Adapter','worker_adapter','idle','["social_handoff"]'),
('image-director','Image Director Adapter','worker_adapter','idle','["social_handoff"]'),
('video-director','Video Director Adapter','worker_adapter','idle','["social_handoff"]')
on conflict(key) do nothing;

create function public.submit_agent_network_task(p_context_id uuid,p_request_id uuid,p_sender text,p_recipient text,p_skill text,p_input jsonb,p_fingerprint text,p_actor text,p_title text,p_parent uuid default null,p_worker text default null)
returns public.agent_network_tasks language plpgsql security definer set search_path=public as $$
declare v_task public.agent_network_tasks; v_parent public.agent_network_tasks; v_job public.agent_jobs; v_context public.agent_network_contexts; v_hop integer:=0; v_key text;
begin
  if p_actor is null or length(p_actor)<1 then raise exception 'actor required'; end if;
  -- All network mutations lock the conversation before its tasks and jobs.
  insert into public.agent_network_contexts(id,title,actor_id) values(p_context_id,left(coalesce(nullif(p_title,''),'Agent conversation'),120),p_actor) on conflict do nothing;
  select * into v_context from public.agent_network_contexts where id=p_context_id for update;
  if v_context.actor_id<>p_actor then raise exception 'context owner mismatch'; end if;
  select * into v_task from public.agent_network_tasks where context_id=p_context_id and sender_key=p_sender and request_id=p_request_id;
  if found then
    if v_task.fingerprint<>p_fingerprint or v_task.parent_task_id is distinct from p_parent then raise exception 'request id already used for different input'; end if;
    return v_task;
  end if;
  if v_context.cancelled_at is not null then raise exception 'conversation cancelled'; end if;
  if p_parent is not null then
    select * into v_parent from public.agent_network_tasks where id=p_parent for update;
    if not found or v_parent.context_id<>p_context_id or v_parent.actor_id<>p_actor or v_parent.recipient_key<>p_sender or v_parent.status not in ('working','waiting') then raise exception 'invalid handoff'; end if;
    if not exists(select 1 from public.agent_jobs where id=v_parent.job_id and claimed_by=p_worker and lease_expires_at>now() and status in ('claimed','running')) then raise exception 'handoff lease lost'; end if;
    v_hop:=v_parent.hop+1;
  end if;
  if v_hop>4 then raise exception 'handoff limit reached'; end if;
  if (select count(*) from public.agent_network_tasks where context_id=p_context_id)>=24 then raise exception 'conversation task limit reached'; end if;
  if (select emergency_stop from public.agent_manager_settings where singleton) then raise exception 'manager stopped'; end if;
  foreach v_key in array array[p_sender,p_recipient] loop
    if not exists(select 1 from public.agents where key=v_key and enabled and not paused) then raise exception 'agent paused or unavailable'; end if;
    v_key:=case when v_key='availability' then 'booking' when v_key='receptionist' then 'answering-machine' when v_key in ('campaign-strategist','creative-director','independent-reviewer','social-strategy-copy','image-director','video-director') then 'social' else v_key end;
    if not exists(select 1 from public.agents where key=v_key and enabled and not paused) then raise exception 'agent group paused or unavailable'; end if;
  end loop;
  v_job:=public.enqueue_agent_job(p_recipient,'agent.network.dispatch','agent.network','{}', 'network:'||p_context_id||':'||p_sender||':'||p_request_id,100,false);
  insert into public.agent_network_tasks(context_id,sender_key,recipient_key,skill,input,fingerprint,request_id,parent_task_id,hop,actor_id,job_id)
  values(p_context_id,p_sender,p_recipient,p_skill,p_input,p_fingerprint,p_request_id,p_parent,v_hop,p_actor,v_job.id) returning * into v_task;
  update public.agent_jobs set payload=jsonb_build_object('networkTaskId',v_task.id,'aiInvocations',0,'businessWritesAllowed',false) where id=v_job.id;
  insert into public.agent_network_messages(context_id,task_id,sender_key,recipient_key,kind,summary) values(p_context_id,v_task.id,p_sender,p_recipient,'request',p_skill);
  if p_parent is not null then
    update public.agent_network_tasks set status='waiting',updated_at=now() where id=p_parent;
    insert into public.agent_network_messages(context_id,task_id,sender_key,recipient_key,kind,summary) values(p_context_id,p_parent,p_sender,p_recipient,'handoff','Requested '||p_skill) on conflict do nothing;
  end if;
  return v_task;
end $$;

create function public.finish_agent_network_task(p_task_id uuid,p_worker text,p_result jsonb default null,p_retry boolean default false)
returns public.agent_jobs language plpgsql security definer set search_path=public as $$
declare v_task public.agent_network_tasks; v_job public.agent_jobs; v_status text; v_parent uuid;
begin
  perform 1 from public.agent_network_contexts where id=(select context_id from public.agent_network_tasks where id=p_task_id) for update;
  select * into v_task from public.agent_network_tasks where id=p_task_id for update;
  if not found then raise exception 'unknown task'; end if;
  select * into v_job from public.agent_jobs where id=v_task.job_id for update;
  if v_job.status='cancelled' then return v_job; end if;
  if v_job.claimed_by is distinct from p_worker or v_job.lease_expires_at is null or v_job.lease_expires_at<=now() or v_job.status not in ('claimed','running') then raise exception 'completion lease lost'; end if;
  if p_retry and v_job.attempt_count<v_job.max_attempts then
    update public.agent_network_tasks set status='queued',updated_at=now() where id=v_task.id and status in ('queued','working');
    update public.agent_jobs set status='queued',next_retry_at=now()+make_interval(secs=>least(300,5*(2^attempt_count)::integer)),claimed_by=null,lease_expires_at=null,error_summary='Agent adapter temporarily unavailable.',updated_at=now() where id=v_job.id returning * into v_job;
  else
    if p_result is not null then
      v_status:=p_result->>'status';
      if v_status not in ('completed','input_required','blocked','failed','cancelled') or length(p_result->>'summary')>2000 or p_result->>'summary' is null then raise exception 'invalid adapter result'; end if;
      update public.agent_network_tasks set status=v_status,result=p_result,updated_at=now() where id=v_task.id and status not in ('completed','input_required','blocked','failed','cancelled');
      insert into public.agent_network_messages(context_id,task_id,sender_key,recipient_key,kind,summary) values(v_task.context_id,v_task.id,v_task.recipient_key,v_task.sender_key,'reply',p_result->>'summary') on conflict do nothing;
      v_parent:=v_task.parent_task_id;
      while v_parent is not null loop
        select * into v_task from public.agent_network_tasks where id=v_parent for update;
        if v_task.status not in ('waiting','working') then exit; end if;
        update public.agent_network_tasks set status=v_status,result=p_result,updated_at=now() where id=v_parent;
        insert into public.agent_network_messages(context_id,task_id,sender_key,recipient_key,kind,summary) values(v_task.context_id,v_task.id,v_task.recipient_key,v_task.sender_key,'reply',p_result->>'summary') on conflict do nothing;
        v_parent:=v_task.parent_task_id;
      end loop;
    elsif not exists(select 1 from public.agent_network_tasks where parent_task_id=p_task_id) then raise exception 'waiting task requires durable child';
    end if;
    update public.agent_jobs set status=case when v_status='failed' then 'failed' else 'succeeded' end,result_summary=coalesce(p_result->>'summary','Delegated; waiting for the recorded reply.'),error_summary=case when v_status='failed' then p_result->>'summary' end,completed_at=now(),claimed_by=null,lease_expires_at=null,updated_at=now() where id=v_job.id returning * into v_job;
  end if;
  update public.agents set status=case when paused then 'paused' else 'idle' end,current_job_id=null,last_activity_at=now(),last_success_at=case when v_job.status='succeeded' then now() else last_success_at end,updated_at=now() where id=v_job.agent_id and (current_job_id=v_job.id or current_job_id is null);
  insert into public.agent_events(agent_id,job_id,event_type,summary,metadata) values(v_job.agent_id,v_job.id,'network.'||v_job.status,coalesce(v_job.result_summary,v_job.error_summary),jsonb_build_object('taskId',p_task_id,'aiInvocations',0,'businessWrites',0));
  return v_job;
end $$;

create function public.cancel_agent_network_context(p_context_id uuid,p_actor text)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform 1 from public.agent_network_contexts where id=p_context_id and actor_id=p_actor for update;
  if not found then raise exception 'context owner mismatch'; end if;
  update public.agent_network_contexts set cancelled_at=coalesce(cancelled_at,now()) where id=p_context_id;
  update public.agent_jobs set status='cancelled',completed_at=now(),claimed_by=null,lease_expires_at=null,updated_at=now() where id in (select job_id from public.agent_network_tasks where context_id=p_context_id and status in ('queued','working','waiting')) and status in ('queued','claimed','running');
  insert into public.agent_network_messages(context_id,task_id,sender_key,recipient_key,kind,summary) select context_id,id,recipient_key,sender_key,'reply','Conversation cancelled by owner.' from public.agent_network_tasks where context_id=p_context_id and status in ('queued','working','waiting') on conflict do nothing;
  update public.agent_network_tasks set status='cancelled',result=jsonb_build_object('status','cancelled','summary','Conversation cancelled by owner.','data','{}'::jsonb),updated_at=now() where context_id=p_context_id and status in ('queued','working','waiting');
  update public.agents set current_job_id=null,status=case when paused then 'paused' else 'idle' end where current_job_id in (select job_id from public.agent_network_tasks where context_id=p_context_id and status='cancelled');
end $$;
revoke all on function public.submit_agent_network_task(uuid,uuid,text,text,text,jsonb,text,text,text,uuid,text), public.finish_agent_network_task(uuid,text,jsonb,boolean),public.cancel_agent_network_context(uuid,text) from public,anon,authenticated;
grant execute on function public.submit_agent_network_task(uuid,uuid,text,text,text,jsonb,text,text,text,uuid,text),public.finish_agent_network_task(uuid,text,jsonb,boolean),public.cancel_agent_network_context(uuid,text) to service_role;
