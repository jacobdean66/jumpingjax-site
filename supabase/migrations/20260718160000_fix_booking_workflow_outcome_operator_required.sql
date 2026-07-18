-- Keep operator_required and last_error_class accurate across multi-step
-- booking workflows. A later successful step (e.g. decision_email) must not
-- clear an earlier unresolved calendar failure.

create or replace function public.record_booking_workflow_outcome(
  p_booking_kind text,
  p_booking_id text,
  p_step text,
  p_outcome text,
  p_error_class text default null,
  p_calendar_event_id text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_step not in ('initial_customer_email', 'owner_notification', 'decision_email', 'calendar')
     or p_outcome not in ('pending', 'sent', 'failed', 'not_required') then
    raise exception using errcode = '22023', message = 'invalid_workflow_outcome';
  end if;

  update public.booking_integration_workflows
  set initial_customer_email_status = case
        when p_step = 'initial_customer_email' then p_outcome
        else initial_customer_email_status
      end,
      owner_notification_status = case
        when p_step = 'owner_notification' then p_outcome
        else owner_notification_status
      end,
      decision_email_status = case
        when p_step = 'decision_email' then p_outcome
        else decision_email_status
      end,
      calendar_status = case
        when p_step = 'calendar' then p_outcome
        else calendar_status
      end,
      attempt_count = attempt_count + 1,
      last_error_class = case
        when p_error_class is not null then p_error_class
        else last_error_class
      end,
      last_attempted_at = now(),
      calendar_event_id = coalesce(p_calendar_event_id, calendar_event_id),
      updated_at = now()
  where booking_kind = p_booking_kind and booking_id = p_booking_id;

  update public.booking_integration_workflows
  set operator_required = (
        initial_customer_email_status = 'failed'
        or owner_notification_status = 'failed'
        or decision_email_status = 'failed'
        or calendar_status = 'failed'
      ),
      completed_at = case
        when initial_customer_email_status in ('sent', 'not_required')
         and owner_notification_status in ('sent', 'not_required')
         and decision_email_status in ('sent', 'not_required')
         and calendar_status in ('sent', 'not_required')
          then coalesce(completed_at, now())
        else null
      end,
      updated_at = now()
  where booking_kind = p_booking_kind and booking_id = p_booking_id;
end;
$$;

revoke all on function public.record_booking_workflow_outcome(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_booking_workflow_outcome(text, text, text, text, text, text)
  to service_role;
