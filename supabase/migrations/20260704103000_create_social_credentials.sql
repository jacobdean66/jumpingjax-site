create table if not exists public.social_credential_provider_accounts (
  provider_account_id text primary key
    check (length(trim(provider_account_id)) > 0),
  provider text not null
    check (provider in ('meta', 'tiktok', 'linkedin')),
  publication_target_id text not null
    check (length(trim(publication_target_id)) > 0),
  external_account_id_redacted text not null
    check (length(trim(external_account_id_redacted)) > 0),
  display_name_redacted text not null
    check (length(trim(display_name_redacted)) > 0),
  status text not null
    check (status in ('registered', 'disabled')),
  account_ref_id text not null
    check (length(trim(account_ref_id)) > 0),
  created_at timestamptz not null default now(),
  references_only boolean not null default true
    check (references_only = true),
  contains_credentials boolean not null default false
    check (contains_credentials = false),
  grants_execution_permission boolean not null default false
    check (grants_execution_permission = false),
  executes_nothing boolean not null default true
    check (executes_nothing = true),
  publishes_nothing boolean not null default true
    check (publishes_nothing = true),

  constraint social_credential_provider_accounts_identity_separated
    check (
      provider_account_id <> publication_target_id
      and provider_account_id <> account_ref_id
      and publication_target_id <> account_ref_id
    )
);

create table if not exists public.social_credential_vault_records (
  vault_record_id text primary key
    check (length(trim(vault_record_id)) > 0),
  credential_ref_id text not null
    check (length(trim(credential_ref_id)) > 0),
  provider text not null
    check (provider in ('meta', 'tiktok', 'linkedin')),
  credential_kind text not null
    check (credential_kind in (
      'oauth_token_ref',
      'oauth_refresh_ref',
      'app_secret_ref',
      'page_access_ref',
      'business_account_ref'
    )),
  account_ref_id text not null
    check (length(trim(account_ref_id)) > 0),
  provider_account_id text not null
    check (length(trim(provider_account_id)) > 0),
  publication_target_id text not null
    check (length(trim(publication_target_id)) > 0),
  encrypted_payload_ref text not null
    check (length(trim(encrypted_payload_ref)) > 0),
  key_version text not null
    check (length(trim(key_version)) > 0),
  lifecycle_phase text not null
    check (lifecycle_phase in ('pending', 'active', 'expired', 'revoked', 'superseded')),
  superseded_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  metadata_only boolean not null default true
    check (metadata_only = true),
  contains_plaintext boolean not null default false
    check (contains_plaintext = false),
  contains_ciphertext boolean not null default false
    check (contains_ciphertext = false),
  grants_execution_permission boolean not null default false
    check (grants_execution_permission = false),
  executes_nothing boolean not null default true
    check (executes_nothing = true),
  publishes_nothing boolean not null default true
    check (publishes_nothing = true),

  constraint social_credential_vault_records_identity_separated
    check (
      vault_record_id <> credential_ref_id
      and vault_record_id <> provider_account_id
      and vault_record_id <> publication_target_id
      and vault_record_id <> account_ref_id
      and credential_ref_id <> provider_account_id
      and credential_ref_id <> publication_target_id
      and credential_ref_id <> account_ref_id
    )
);

create table if not exists public.social_credential_lifecycle_states (
  lifecycle_state_id text primary key
    check (length(trim(lifecycle_state_id)) > 0),
  credential_ref_id text not null
    check (length(trim(credential_ref_id)) > 0),
  account_ref_id text not null
    check (length(trim(account_ref_id)) > 0),
  provider text not null
    check (provider in ('meta', 'tiktok', 'linkedin')),
  authorization_state text not null
    check (authorization_state in (
      'not_authorized',
      'authorized_reference',
      'expired_reference',
      'revoked_reference',
      'scope_insufficient'
    )),
  lifecycle_phase text not null
    check (lifecycle_phase in ('pending', 'active', 'expired', 'revoked', 'superseded')),
  issued_at timestamptz null,
  expires_at timestamptz null,
  last_rotated_at timestamptz null,
  revoked_at timestamptz null,
  scope_fingerprint_redacted text null
    check (scope_fingerprint_redacted is null or length(trim(scope_fingerprint_redacted)) > 0),
  created_at timestamptz not null default now(),
  modeled_only boolean not null default true
    check (modeled_only = true),
  references_only boolean not null default true
    check (references_only = true),
  contains_credentials boolean not null default false
    check (contains_credentials = false),
  grants_execution_permission boolean not null default false
    check (grants_execution_permission = false),
  executes_nothing boolean not null default true
    check (executes_nothing = true),
  publishes_nothing boolean not null default true
    check (publishes_nothing = true),

  constraint social_credential_lifecycle_states_identity_separated
    check (
      lifecycle_state_id <> credential_ref_id
      and lifecycle_state_id <> account_ref_id
      and credential_ref_id <> account_ref_id
    )
);

create table if not exists public.social_credential_audit_events (
  audit_event_id text primary key
    check (length(trim(audit_event_id)) > 0),
  credential_ref_id text not null
    check (length(trim(credential_ref_id)) > 0),
  actor_admin_id text null
    check (actor_admin_id is null or length(trim(actor_admin_id)) > 0),
  action text not null
    check (action in ('create', 'rotate', 'revoke', 'decrypt_attempt', 'read_metadata')),
  outcome text not null
    check (outcome in ('success', 'denied', 'failed')),
  sanitized_detail text not null
    check (length(trim(sanitized_detail)) > 0),
  created_at timestamptz not null default now(),
  append_only boolean not null default true
    check (append_only = true),
  contains_secrets boolean not null default false
    check (contains_secrets = false),
  grants_execution_permission boolean not null default false
    check (grants_execution_permission = false),
  executes_nothing boolean not null default true
    check (executes_nothing = true),
  publishes_nothing boolean not null default true
    check (publishes_nothing = true),

  constraint social_credential_audit_events_identity_separated
    check (audit_event_id <> credential_ref_id)
);

create table if not exists public.social_credential_key_versions (
  key_version text primary key
    check (length(trim(key_version)) > 0),
  status text not null
    check (status in ('active', 'retired')),
  activated_at timestamptz not null default now(),
  retired_at timestamptz null,
  metadata_only boolean not null default true
    check (metadata_only = true),
  contains_key_material boolean not null default false
    check (contains_key_material = false),
  grants_execution_permission boolean not null default false
    check (grants_execution_permission = false),
  executes_nothing boolean not null default true
    check (executes_nothing = true),
  publishes_nothing boolean not null default true
    check (publishes_nothing = true)
);

create index if not exists social_credential_provider_accounts_provider_created_idx
  on public.social_credential_provider_accounts (provider, created_at desc);

create index if not exists social_credential_provider_accounts_target_created_idx
  on public.social_credential_provider_accounts (publication_target_id, created_at desc);

create index if not exists social_credential_vault_records_provider_created_idx
  on public.social_credential_vault_records (provider, created_at desc);

create index if not exists social_credential_vault_records_credential_ref_idx
  on public.social_credential_vault_records (credential_ref_id, created_at desc);

create index if not exists social_credential_vault_records_target_idx
  on public.social_credential_vault_records (publication_target_id, created_at desc);

create index if not exists social_credential_lifecycle_states_provider_created_idx
  on public.social_credential_lifecycle_states (provider, created_at desc);

create index if not exists social_credential_lifecycle_states_credential_ref_idx
  on public.social_credential_lifecycle_states (credential_ref_id, created_at desc);

create index if not exists social_credential_audit_events_credential_created_idx
  on public.social_credential_audit_events (credential_ref_id, created_at desc);

create index if not exists social_credential_audit_events_action_created_idx
  on public.social_credential_audit_events (action, created_at desc);

create index if not exists social_credential_key_versions_status_activated_idx
  on public.social_credential_key_versions (status, activated_at desc);

create or replace function public.prevent_social_credential_audit_event_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_credential_audit_events are append-only';
end;
$$;

drop trigger if exists prevent_social_credential_audit_event_updates
  on public.social_credential_audit_events;
create trigger prevent_social_credential_audit_event_updates
  before update on public.social_credential_audit_events
  for each row
  execute function public.prevent_social_credential_audit_event_changes();

drop trigger if exists prevent_social_credential_audit_event_deletes
  on public.social_credential_audit_events;
create trigger prevent_social_credential_audit_event_deletes
  before delete on public.social_credential_audit_events
  for each row
  execute function public.prevent_social_credential_audit_event_changes();

alter table public.social_credential_provider_accounts enable row level security;
alter table public.social_credential_vault_records enable row level security;
alter table public.social_credential_lifecycle_states enable row level security;
alter table public.social_credential_audit_events enable row level security;
alter table public.social_credential_key_versions enable row level security;

drop policy if exists "No public social credential provider accounts access"
  on public.social_credential_provider_accounts;
create policy "No public social credential provider accounts access"
  on public.social_credential_provider_accounts
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No public social credential vault records access"
  on public.social_credential_vault_records;
create policy "No public social credential vault records access"
  on public.social_credential_vault_records
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No public social credential lifecycle states access"
  on public.social_credential_lifecycle_states;
create policy "No public social credential lifecycle states access"
  on public.social_credential_lifecycle_states
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No public social credential audit events access"
  on public.social_credential_audit_events;
create policy "No public social credential audit events access"
  on public.social_credential_audit_events
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No public social credential key versions access"
  on public.social_credential_key_versions;
create policy "No public social credential key versions access"
  on public.social_credential_key_versions
  for all
  to anon, authenticated
  using (false)
  with check (false);
