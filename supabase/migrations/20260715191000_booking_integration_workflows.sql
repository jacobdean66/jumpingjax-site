-- Durable, retry-oriented state for booking email and calendar projections.
create table if not exists public.booking_integration_workflows (
  id uuid primary key default gen_random_uuid(),
  booking_kind text not null check (booking_kind in ('rental', 'facility')),
  booking_id text not null,
  correlation_id uuid not null default gen_random_uuid(),
  initial_customer_email_status text not null default 'pending'
    check (initial_customer_email_status in ('pending', 'sent', 'failed', 'not_required')),
  owner_notification_status text not null default 'pending'
    check (owner_notification_status in ('pending', 'sent', 'failed', 'not_required')),
  decision_email_status text not null default 'not_required'
    check (decision_email_status in ('pending', 'sent', 'failed', 'not_required')),
  calendar_status text not null default 'not_required'
    check (calendar_status in ('pending', 'sent', 'failed', 'not_required')),
  attempt_count integer not null default 0,
  last_error_class text null,
  last_attempted_at timestamptz null,
  completed_at timestamptz null,
  calendar_event_id text null,
  operator_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_kind, booking_id)
);

alter table public.booking_integration_workflows enable row level security;
drop policy if exists "No public booking workflow access" on public.booking_integration_workflows;
create policy "No public booking workflow access"
  on public.booking_integration_workflows for all to anon, authenticated
  using (false) with check (false);

create index if not exists booking_workflows_operator_required_idx
  on public.booking_integration_workflows (operator_required, updated_at);

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
  set initial_customer_email_status = case when p_step = 'initial_customer_email' then p_outcome else initial_customer_email_status end,
      owner_notification_status = case when p_step = 'owner_notification' then p_outcome else owner_notification_status end,
      decision_email_status = case when p_step = 'decision_email' then p_outcome else decision_email_status end,
      calendar_status = case when p_step = 'calendar' then p_outcome else calendar_status end,
      attempt_count = attempt_count + 1,
      last_error_class = p_error_class,
      last_attempted_at = now(),
      completed_at = case when p_outcome = 'sent' then now() else completed_at end,
      calendar_event_id = coalesce(p_calendar_event_id, calendar_event_id),
      operator_required = p_outcome = 'failed',
      updated_at = now()
  where booking_kind = p_booking_kind and booking_id = p_booking_id;
end;
$$;

create or replace view public.booking_pending_review_health
with (security_invoker = true)
as
select
  workflow.booking_kind,
  workflow.booking_id,
  workflow.created_at,
  case
    when workflow.created_at <= now() - interval '48 hours' then 'escalated'
    when workflow.created_at <= now() - interval '24 hours' then 'flagged'
    else 'current'
  end as review_health
from public.booking_integration_workflows workflow
where (
  (workflow.booking_kind = 'rental' and exists (
    select 1 from public.bookings b
    where b.id::text = workflow.booking_id and b.status = 'pending'
  ))
  or
  (workflow.booking_kind = 'facility' and exists (
    select 1 from public.facility_bookings f
    where f.id::text = workflow.booking_id and f.status = 'pending'
  ))
);

revoke all on public.booking_integration_workflows from anon, authenticated;
revoke all on public.booking_pending_review_health from anon, authenticated;
revoke all on function public.record_booking_workflow_outcome(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_booking_workflow_outcome(text, text, text, text, text, text) to service_role;

create table if not exists public.booking_notification_outbox (
  message_key text primary key,
  booking_kind text not null check (booking_kind in ('rental', 'facility')),
  booking_id text not null,
  purpose text not null,
  recipient text not null,
  subject text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempt_count integer not null default 0,
  last_error_class text null,
  last_attempted_at timestamptz null,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.booking_notification_outbox enable row level security;
revoke all on public.booking_notification_outbox from anon, authenticated;
create index if not exists booking_notification_outbox_retry_idx
  on public.booking_notification_outbox (status, updated_at);
