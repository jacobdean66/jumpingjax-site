-- Lease-aware start and terminal reconciliation keep the conversation ledger
-- consistent with the existing queue even after the last worker attempt dies.
create function public.start_agent_network_task(p_task_id uuid,p_worker text)
returns public.agent_network_tasks language plpgsql security definer set search_path=public as $$
declare v_task public.agent_network_tasks;
begin
  perform 1 from public.agent_network_contexts where id=(select context_id from public.agent_network_tasks where id=p_task_id) for update;
  select * into v_task from public.agent_network_tasks where id=p_task_id for update;
  if not found then raise exception 'unknown task'; end if;
  if not exists(select 1 from public.agent_jobs where id=v_task.job_id and claimed_by=p_worker and lease_expires_at>now() and status in ('claimed','running')) then raise exception 'start lease lost'; end if;
  if v_task.status in ('queued','working') then
    update public.agent_network_tasks set status='working',updated_at=now() where id=p_task_id returning * into v_task;
  end if;
  return v_task;
end $$;

create function public.reconcile_agent_network_tasks()
returns integer language plpgsql security definer set search_path=public as $$
declare v_candidate record; v_task public.agent_network_tasks; v_parent uuid; v_status text; v_result jsonb; v_count integer:=0;
begin
  for v_candidate in
    select t.id,t.context_id,j.status from public.agent_network_tasks t join public.agent_jobs j on j.id=t.job_id
    where t.status in ('queued','working','waiting') and j.status in ('failed','cancelled')
    order by t.created_at limit 100
  loop
    perform 1 from public.agent_network_contexts where id=v_candidate.context_id for update;
    select * into v_task from public.agent_network_tasks where id=v_candidate.id for update;
    if v_task.status not in ('queued','working','waiting') then continue; end if;
    -- Recheck after obtaining the context lock.
    select status into v_status from public.agent_jobs where id=v_task.job_id;
    if v_status not in ('failed','cancelled') then continue; end if;
    v_result:=jsonb_build_object('status',v_status,'summary',case when v_status='failed' then 'Worker attempts were exhausted. Owner review is required.' else 'Request cancelled.' end,'data','{}'::jsonb);
    loop
      update public.agent_network_tasks set status=v_status,result=v_result,updated_at=now() where id=v_task.id;
      insert into public.agent_network_messages(context_id,task_id,sender_key,recipient_key,kind,summary) values(v_task.context_id,v_task.id,v_task.recipient_key,v_task.sender_key,'reply',v_result->>'summary') on conflict do nothing;
      v_parent:=v_task.parent_task_id;
      if v_parent is null then exit; end if;
      select * into v_task from public.agent_network_tasks where id=v_parent for update;
      if v_task.status not in ('working','waiting') then exit; end if;
    end loop;
    v_count:=v_count+1;
  end loop;
  update public.agents set current_job_id=null,status=case when paused then 'paused' else 'idle' end where current_job_id in (select j.id from public.agent_jobs j join public.agent_network_tasks t on t.job_id=j.id where j.status in ('failed','cancelled'));
  return v_count;
end $$;
revoke all on function public.start_agent_network_task(uuid,text),public.reconcile_agent_network_tasks() from public,anon,authenticated;
grant execute on function public.start_agent_network_task(uuid,text),public.reconcile_agent_network_tasks() to service_role;
