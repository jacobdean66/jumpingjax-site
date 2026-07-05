-- D16 Wave 5: Execution Authorization & Runtime Session (append-only, metadata-only)

create table if not exists public.social_execution_authorizations (
  authorization_id text primary key,
  authorization_identity text not null,
  authorization_version text not null,
  scope_kind text not null,
  execution_intent_id text not null,
  publication_target_id text not null,
  owner_approval_id text not null,
  approval_id text,
  social_post_id text,
  authorization_state text not null default 'authorized',
  correlation_id text not null,
  authorized_at timestamptz not null,
  expires_at timestamptz not null,
  admin_actor_id text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists social_execution_authorizations_identity_idx
  on public.social_execution_authorizations (authorization_identity);

create index if not exists social_execution_authorizations_intent_target_idx
  on public.social_execution_authorizations (execution_intent_id, publication_target_id, created_at desc);

create index if not exists social_execution_authorizations_correlation_idx
  on public.social_execution_authorizations (correlation_id, created_at desc);

create table if not exists public.social_execution_authorization_cancellations (
  cancellation_id text primary key,
  authorization_id text not null
    references public.social_execution_authorizations (authorization_id),
  authorization_identity text not null,
  correlation_id text not null,
  cancelled_at timestamptz not null,
  sanitized_detail text not null,
  admin_actor_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists social_execution_authorization_cancellations_auth_idx
  on public.social_execution_authorization_cancellations (authorization_id, created_at desc);

create table if not exists public.social_execution_authorization_intents (
  intent_record_id text primary key,
  intent_version text not null,
  execution_intent_id text not null,
  authorization_id text,
  correlation_id text not null,
  intent_state text not null,
  publication_target_id text not null,
  owner_approval_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists social_execution_authorization_intents_intent_idx
  on public.social_execution_authorization_intents (execution_intent_id, publication_target_id, created_at desc);

create table if not exists public.social_execution_runtime_sessions (
  session_id text primary key,
  session_version text not null,
  authorization_id text not null
    references public.social_execution_authorizations (authorization_id),
  correlation_id text not null,
  runtime_status text not null default 'active',
  publication_target_id text not null,
  execution_intent_id text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists social_execution_runtime_sessions_auth_idx
  on public.social_execution_runtime_sessions (authorization_id, created_at desc);

create index if not exists social_execution_runtime_sessions_correlation_idx
  on public.social_execution_runtime_sessions (correlation_id, created_at desc);

create table if not exists public.social_execution_authorization_audit_events (
  audit_event_id text primary key,
  authorization_id text,
  authorization_identity text,
  correlation_id text,
  action text not null,
  outcome text not null,
  sanitized_detail text not null,
  admin_actor_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists social_execution_authorization_audit_events_auth_idx
  on public.social_execution_authorization_audit_events (authorization_id, created_at desc);

create or replace function public.prevent_social_execution_authorization_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_execution_authorization tables are append-only';
end;
$$;

drop trigger if exists social_execution_authorizations_no_mutation
  on public.social_execution_authorizations;
create trigger social_execution_authorizations_no_mutation
before update or delete on public.social_execution_authorizations
for each row execute function public.prevent_social_execution_authorization_mutation();

drop trigger if exists social_execution_authorization_cancellations_no_mutation
  on public.social_execution_authorization_cancellations;
create trigger social_execution_authorization_cancellations_no_mutation
before update or delete on public.social_execution_authorization_cancellations
for each row execute function public.prevent_social_execution_authorization_mutation();

drop trigger if exists social_execution_authorization_intents_no_mutation
  on public.social_execution_authorization_intents;
create trigger social_execution_authorization_intents_no_mutation
before update or delete on public.social_execution_authorization_intents
for each row execute function public.prevent_social_execution_authorization_mutation();

drop trigger if exists social_execution_runtime_sessions_no_mutation
  on public.social_execution_runtime_sessions;
create trigger social_execution_runtime_sessions_no_mutation
before update or delete on public.social_execution_runtime_sessions
for each row execute function public.prevent_social_execution_authorization_mutation();

drop trigger if exists social_execution_authorization_audit_events_no_mutation
  on public.social_execution_authorization_audit_events;
create trigger social_execution_authorization_audit_events_no_mutation
before update or delete on public.social_execution_authorization_audit_events
for each row execute function public.prevent_social_execution_authorization_mutation();

alter table public.social_execution_authorizations enable row level security;
alter table public.social_execution_authorization_cancellations enable row level security;
alter table public.social_execution_authorization_intents enable row level security;
alter table public.social_execution_runtime_sessions enable row level security;
alter table public.social_execution_authorization_audit_events enable row level security;
