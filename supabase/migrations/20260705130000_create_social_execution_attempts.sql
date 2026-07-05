-- D16 Wave 6: Execution Attempt Modeling (append-only, metadata-only)

create table if not exists public.social_execution_attempts (
  attempt_id text primary key,
  attempt_identity text not null,
  attempt_version text not null,
  authorization_id text not null
    references public.social_execution_authorizations (authorization_id),
  session_id text not null
    references public.social_execution_runtime_sessions (session_id),
  publication_target_id text not null,
  execution_intent_id text not null,
  correlation_id text not null,
  idempotency_key text not null,
  replay_key text not null,
  attempt_fingerprint text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists social_execution_attempts_identity_idx
  on public.social_execution_attempts (attempt_identity);

create unique index if not exists social_execution_attempts_idempotency_key_idx
  on public.social_execution_attempts (idempotency_key);

create unique index if not exists social_execution_attempts_replay_key_idx
  on public.social_execution_attempts (replay_key);

create index if not exists social_execution_attempts_intent_target_idx
  on public.social_execution_attempts (execution_intent_id, publication_target_id, created_at desc);

create index if not exists social_execution_attempts_authorization_idx
  on public.social_execution_attempts (authorization_id, created_at desc);

create index if not exists social_execution_attempts_correlation_idx
  on public.social_execution_attempts (correlation_id, created_at desc);

create index if not exists social_execution_attempts_fingerprint_idx
  on public.social_execution_attempts (attempt_fingerprint, created_at desc);

create table if not exists public.social_execution_attempt_lifecycle_events (
  lifecycle_event_id text primary key,
  lifecycle_version text not null,
  attempt_id text not null
    references public.social_execution_attempts (attempt_id),
  correlation_id text not null,
  lifecycle_state text not null,
  created_at timestamptz not null default now()
);

create index if not exists social_execution_attempt_lifecycle_events_attempt_idx
  on public.social_execution_attempt_lifecycle_events (attempt_id, created_at desc);

create index if not exists social_execution_attempt_lifecycle_events_correlation_idx
  on public.social_execution_attempt_lifecycle_events (correlation_id, created_at desc);

create table if not exists public.social_execution_attempt_audit_events (
  audit_event_id text primary key,
  attempt_id text,
  attempt_identity text,
  correlation_id text,
  action text not null,
  outcome text not null,
  sanitized_detail text not null,
  created_at timestamptz not null default now()
);

create index if not exists social_execution_attempt_audit_events_attempt_idx
  on public.social_execution_attempt_audit_events (attempt_id, created_at desc);

create index if not exists social_execution_attempt_audit_events_correlation_idx
  on public.social_execution_attempt_audit_events (correlation_id, created_at desc);

create or replace function public.prevent_social_execution_attempt_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_execution_attempt tables are append-only';
end;
$$;

drop trigger if exists social_execution_attempts_no_mutation
  on public.social_execution_attempts;
create trigger social_execution_attempts_no_mutation
before update or delete on public.social_execution_attempts
for each row execute function public.prevent_social_execution_attempt_mutation();

drop trigger if exists social_execution_attempt_lifecycle_events_no_mutation
  on public.social_execution_attempt_lifecycle_events;
create trigger social_execution_attempt_lifecycle_events_no_mutation
before update or delete on public.social_execution_attempt_lifecycle_events
for each row execute function public.prevent_social_execution_attempt_mutation();

drop trigger if exists social_execution_attempt_audit_events_no_mutation
  on public.social_execution_attempt_audit_events;
create trigger social_execution_attempt_audit_events_no_mutation
before update or delete on public.social_execution_attempt_audit_events
for each row execute function public.prevent_social_execution_attempt_mutation();

alter table public.social_execution_attempts enable row level security;
alter table public.social_execution_attempt_lifecycle_events enable row level security;
alter table public.social_execution_attempt_audit_events enable row level security;
