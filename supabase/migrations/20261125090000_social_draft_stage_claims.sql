create table public.social_draft_runs (
  id uuid primary key,
  owner_id text not null,
  status text not null default 'active' check (status in ('active','stopped','complete','blocked')),
  next_stage text not null default 'campaign_strategist',
  claim_id uuid,
  claim_stage text,
  claim_started_at timestamptz,
  checkpoint jsonb,
  initial_request jsonb,
  stage_responses jsonb not null default '{}',
  post_id uuid references public.social_posts(id) on delete set null,
  last_error text,
  updated_at timestamptz not null default now()
);
create index social_draft_runs_owner_idx on public.social_draft_runs(owner_id, updated_at desc);
alter table public.social_draft_runs enable row level security;
revoke all on public.social_draft_runs from public, anon, authenticated;
grant select on public.social_draft_runs to service_role;

create function public.claim_social_draft_stage(p_owner text,p_run uuid,p_stage text,p_claim uuid,p_initial jsonb default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.social_draft_runs;
begin
  if p_stage='campaign_strategist' then
    insert into public.social_draft_runs(id,owner_id,initial_request) values (p_run,p_owner,p_initial) on conflict do nothing;
  end if;
  select * into r from public.social_draft_runs where id=p_run and owner_id=p_owner for update;
  if not found then return jsonb_build_object('state','missing'); end if;
  if p_stage='campaign_strategist' and r.initial_request is distinct from p_initial then
    return jsonb_build_object('state','input_mismatch');
  end if;
  if r.status='stopped' then return jsonb_build_object('state','stopped','checkpoint',r.checkpoint); end if;
  if r.stage_responses ? p_stage then
    return jsonb_build_object('state','saved','response',r.stage_responses->p_stage);
  end if;
  if r.status<>'active' or r.next_stage<>p_stage then return jsonb_build_object('state','stale','checkpoint',r.checkpoint); end if;
  if r.claim_id is not null and not (p_stage='persist' and r.post_id is not null) then
    return jsonb_build_object('state',case when r.claim_started_at < now()-interval '3 minutes'
      then 'uncertain' else 'running' end);
  end if;
  update public.social_draft_runs set claim_id=p_claim,claim_stage=p_stage,claim_started_at=now(),last_error=null,updated_at=now()
    where id=p_run;
  return jsonb_build_object('state','claimed');
end $$;

create function public.finish_social_draft_stage(p_owner text,p_run uuid,p_claim uuid,p_result jsonb,p_error text,p_unconfirmed boolean default false)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.social_draft_runs; nxt text;
begin
  select * into r from public.social_draft_runs where id=p_run and owner_id=p_owner for update;
  if not found or r.status<>'active' or r.claim_id is distinct from p_claim then return false; end if;
  if p_unconfirmed then
    update public.social_draft_runs set last_error=left(p_error,300),updated_at=now() where id=p_run;
    return true;
  end if;
  if p_result is null then
    update public.social_draft_runs set claim_id=null,claim_stage=null,claim_started_at=null,
      last_error=left(p_error,300),updated_at=now() where id=p_run;
    return true;
  end if;
  nxt:=p_result #>> '{checkpoint,nextStage}';
  if nxt is null then raise exception 'missing stage checkpoint'; end if;
  update public.social_draft_runs set claim_id=null,claim_stage=null,claim_started_at=null,
    checkpoint=p_result->'checkpoint',next_stage=nxt,stage_responses=stage_responses||jsonb_build_object(r.claim_stage,p_result),
    status=case when nxt in ('complete','blocked') then nxt else 'active' end,updated_at=now()
    where id=p_run;
  return true;
end $$;

create function public.stop_social_draft_run(p_owner text,p_run uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.social_draft_runs; cancelled uuid;
begin
  select * into r from public.social_draft_runs where id=p_run and owner_id=p_owner for update;
  if not found then return jsonb_build_object('state','missing'); end if;
  if r.status='complete' or r.post_id is not null then
    return jsonb_build_object('state','complete','postId',r.post_id);
  end if;
  update public.agent_jobs set status='cancelled',completed_at=now(),updated_at=now()
    where idempotency_key='social:'||p_run::text||':'||r.claim_stage and source='admin.social-posts.checkpoint' and status='running' returning id into cancelled;
  if cancelled is not null then
    update public.agents set current_job_id=null,status='idle',updated_at=now() where current_job_id=cancelled and enabled and not paused;
  end if;
  update public.social_draft_runs set status='stopped',claim_id=null,claim_stage=null,claim_started_at=null,updated_at=now()
    where id=p_run;
  return jsonb_build_object('state','stopped','checkpoint',r.checkpoint);
end $$;

-- Hold the same run lock used by Stop. The insert and the link commit together.
create function public.persist_social_draft_once(p_owner text,p_run uuid,p_claim uuid,p_post jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.social_draft_runs; draft public.social_posts; saved uuid;
begin
  select * into r from public.social_draft_runs where id=p_run and owner_id=p_owner for update;
  if not found or r.status<>'active' or r.claim_stage<>'persist' or r.claim_id is distinct from p_claim then
    raise exception 'draft save claim is no longer active';
  end if;
  if r.post_id is not null then return r.post_id; end if;
  draft:=jsonb_populate_record(null::public.social_posts,p_post);
  insert into public.social_posts(title,campaign_id,goal,prompt,caption,media_type,business_focus,source_image_url,platforms,creative_source,status)
  values(draft.title,draft.campaign_id,draft.goal,draft.prompt,draft.caption,draft.media_type,draft.business_focus,
    draft.source_image_url,draft.platforms,draft.creative_source,'draft') returning id into saved;
  update public.social_draft_runs set post_id=saved,updated_at=now() where id=p_run;
  return saved;
end $$;

revoke all on function public.claim_social_draft_stage(text,uuid,text,uuid,jsonb),public.finish_social_draft_stage(text,uuid,uuid,jsonb,text,boolean),public.stop_social_draft_run(text,uuid),public.persist_social_draft_once(text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.claim_social_draft_stage(text,uuid,text,uuid,jsonb),public.finish_social_draft_stage(text,uuid,uuid,jsonb,text,boolean),public.stop_social_draft_run(text,uuid),public.persist_social_draft_once(text,uuid,uuid,jsonb) to service_role;

create function public.claim_social_agent_job(p_owner text,p_run uuid,p_stage text,p_claim uuid,p_payload jsonb)
returns public.agent_jobs language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.agents; j public.agent_jobs; idempotency text;
begin
  perform 1 from public.social_draft_runs where id=p_run and owner_id=p_owner
    and status='active' and claim_id=p_claim and claim_stage=p_stage for update;
  if not found then raise exception 'stage claim lost'; end if;
  select * into a from public.agents where key='social' and enabled and not paused for update;
  if not found then raise exception 'Social Agent is unavailable'; end if;
  perform 1 from public.agent_manager_settings where singleton and not emergency_stop for share;
  if not found then raise exception 'Agent Manager is stopped'; end if;
  idempotency:='social:'||p_run::text||':'||p_stage;
  select * into j from public.agent_jobs where agent_id=a.id and idempotency_key=idempotency for update;
  if found then
    if j.status='succeeded' and p_stage='persist' then return j; end if;
    if j.status<>'failed' then raise exception 'existing Agent Manager job requires reconciliation'; end if;
    update public.agent_jobs set status='running',attempt_count=attempt_count+1,started_at=now(),
      completed_at=null,error_summary=null,updated_at=now() where id=j.id returning * into j;
  else
    insert into public.agent_jobs(agent_id,job_type,source,payload,idempotency_key,status,attempt_count,started_at)
      values(a.id,'social.draft.'||p_stage,'admin.social-posts.checkpoint',
        coalesce(p_payload,'{}')||jsonb_build_object('runId',p_run,'stage',p_stage),idempotency,'running',1,now())
      returning * into j;
  end if;
  update public.agents set status='working',current_job_id=j.id,last_activity_at=now(),updated_at=now() where id=a.id;
  insert into public.agent_events(agent_id,job_id,event_type,actor_id,summary,metadata)
    values(a.id,j.id,'social.stage.started',p_owner,'Social Agent stage started',jsonb_build_object('runId',p_run,'stage',p_stage));
  return j;
end $$;
revoke all on function public.claim_social_agent_job(text,uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.claim_social_agent_job(text,uuid,text,uuid,jsonb) to service_role;
