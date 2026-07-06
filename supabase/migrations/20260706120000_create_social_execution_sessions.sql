-- D16 Wave 13: Execution Session Orchestration (append-only, metadata-only)

create table if not exists public.social_execution_sessions (
  session_id text primary key,
  session_version text not null,
  correlation_id text not null,
  summary_status text not null,
  sanitized_summary text not null,
  transcript_ids jsonb not null,
  attempt_ids jsonb not null,
  created_at timestamptz not null,
  completed_at timestamptz not null
);

create index if not exists social_execution_sessions_correlation_idx
  on public.social_execution_sessions (correlation_id, created_at desc);

create index if not exists social_execution_sessions_summary_status_idx
  on public.social_execution_sessions (summary_status, created_at desc);

create table if not exists public.social_execution_session_audit_events (
  audit_event_id text primary key,
  session_id text not null
    references public.social_execution_sessions (session_id),
  correlation_id text,
  action text not null,
  outcome text not null,
  sanitized_detail text not null,
  created_at timestamptz not null
);

create index if not exists social_execution_session_audit_events_session_idx
  on public.social_execution_session_audit_events (session_id, created_at desc);

create index if not exists social_execution_session_audit_events_correlation_idx
  on public.social_execution_session_audit_events (correlation_id, created_at desc);

create or replace function public.prevent_social_execution_session_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_execution_session tables are append-only';
end;
$$;

drop trigger if exists social_execution_sessions_no_mutation
  on public.social_execution_sessions;
create trigger social_execution_sessions_no_mutation
before update or delete on public.social_execution_sessions
for each row execute function public.prevent_social_execution_session_mutation();

drop trigger if exists social_execution_session_audit_events_no_mutation
  on public.social_execution_session_audit_events;
create trigger social_execution_session_audit_events_no_mutation
before update or delete on public.social_execution_session_audit_events
for each row execute function public.prevent_social_execution_session_mutation();

alter table public.social_execution_sessions enable row level security;
alter table public.social_execution_session_audit_events enable row level security;
