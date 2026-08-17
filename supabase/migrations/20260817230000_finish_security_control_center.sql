alter table public.security_scan_jobs
  add column if not exists issue_count integer,
  add column if not exists details_url text;

alter table public.security_scan_jobs
  drop constraint if exists security_scan_job_issue_count;
alter table public.security_scan_jobs
  add constraint security_scan_job_issue_count check (issue_count is null or issue_count >= 0);

drop function if exists public.complete_security_scan_job(bigint, uuid, text, text, boolean, text);

create or replace function public.complete_security_scan_job(
  p_scan_id bigint,
  p_correlation_id uuid,
  p_actor_id text,
  p_deployment_sha text,
  p_passed boolean,
  p_message text,
  p_issue_count integer,
  p_details_url text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  completed_id bigint;
begin
  if p_issue_count is not null and p_issue_count < 0 then
    return false;
  end if;
  if p_details_url is not null and p_details_url not like 'https://app.aikido.dev/%' then
    return false;
  end if;

  update public.security_scan_jobs
  set status = 'completed',
      result_state = case when p_passed then 'passed' else 'findings' end,
      issue_count = p_issue_count,
      details_url = left(p_details_url, 500),
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

revoke all on function public.complete_security_scan_job(bigint, uuid, text, text, boolean, text, integer, text) from public, anon, authenticated;
grant execute on function public.complete_security_scan_job(bigint, uuid, text, text, boolean, text, integer, text) to service_role;
