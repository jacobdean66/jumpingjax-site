-- D16 Wave 1: Meta live OAuth connect (authorization intents + callback audit + sessions)

create table if not exists public.social_oauth_authorization_intents (
  intent_id text primary key
    check (length(trim(intent_id)) > 0),
  oauth_state text not null unique
    check (length(trim(oauth_state)) > 0),
  state_ref_id text not null
    check (length(trim(state_ref_id)) > 0),
  provider text not null
    check (provider in ('meta')),
  publication_target_id text not null
    check (length(trim(publication_target_id)) > 0),
  redirect_uri text not null
    check (length(trim(redirect_uri)) > 0),
  scopes text[] not null,
  pkce_challenge text not null
    check (length(trim(pkce_challenge)) > 0),
  encrypted_verifier_ref text not null
    check (length(trim(encrypted_verifier_ref)) > 0),
  admin_actor_id text not null
    check (length(trim(admin_actor_id)) > 0),
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now(),
  grants_execution_permission boolean not null default false
    check (grants_execution_permission = false),
  executes_nothing boolean not null default true
    check (executes_nothing = true),
  publishes_nothing boolean not null default true
    check (publishes_nothing = true)
);

create index if not exists social_oauth_authorization_intents_provider_target_idx
  on public.social_oauth_authorization_intents (provider, publication_target_id, created_at desc);

create table if not exists public.social_oauth_callback_events (
  callback_event_id text primary key
    check (length(trim(callback_event_id)) > 0),
  intent_id text not null
    references public.social_oauth_authorization_intents (intent_id),
  outcome text not null
    check (outcome in (
      'success',
      'denied',
      'canceled',
      'provider_error',
      'state_mismatch',
      'expired',
      'exchange_failed',
      'vault_write_failed',
      'disabled'
    )),
  error_code_redacted text null,
  provider_account_id_redacted text null,
  access_credential_ref_id text null,
  refresh_credential_ref_id text null,
  lifecycle_state_id text null,
  created_at timestamptz not null default now(),
  grants_execution_permission boolean not null default false
    check (grants_execution_permission = false),
  executes_nothing boolean not null default true
    check (executes_nothing = true),
  publishes_nothing boolean not null default true
    check (publishes_nothing = true)
);

create index if not exists social_oauth_callback_events_intent_idx
  on public.social_oauth_callback_events (intent_id, created_at desc);

create table if not exists public.social_oauth_sessions (
  session_id text primary key
    check (length(trim(session_id)) > 0),
  intent_id text not null
    references public.social_oauth_authorization_intents (intent_id),
  provider text not null
    check (provider in ('meta')),
  publication_target_id text not null
    check (length(trim(publication_target_id)) > 0),
  lifecycle_state text not null
    check (lifecycle_state in (
      'awaiting_callback',
      'connected',
      'denied',
      'canceled',
      'provider_error',
      'state_mismatch',
      'expired',
      'failed'
    )),
  access_credential_ref_id text null,
  refresh_credential_ref_id text null,
  provider_account_id text null,
  callback_event_id text null
    references public.social_oauth_callback_events (callback_event_id),
  admin_actor_id text not null,
  connected_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  grants_execution_permission boolean not null default false
    check (grants_execution_permission = false),
  executes_nothing boolean not null default true
    check (executes_nothing = true),
  publishes_nothing boolean not null default true
    check (publishes_nothing = true)
);

create index if not exists social_oauth_sessions_provider_target_idx
  on public.social_oauth_sessions (provider, publication_target_id, updated_at desc);

create or replace function public.prevent_social_oauth_callback_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_oauth_callback_events is append-only';
end;
$$;

drop trigger if exists social_oauth_callback_events_no_mutation
  on public.social_oauth_callback_events;

create trigger social_oauth_callback_events_no_mutation
before update or delete on public.social_oauth_callback_events
for each row execute function public.prevent_social_oauth_callback_event_mutation();

alter table public.social_oauth_authorization_intents enable row level security;
alter table public.social_oauth_callback_events enable row level security;
alter table public.social_oauth_sessions enable row level security;
