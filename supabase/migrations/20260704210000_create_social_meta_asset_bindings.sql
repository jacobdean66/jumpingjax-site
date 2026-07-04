-- D16 Wave 2: Meta asset discovery and publication target binding (identity mapping only)

create table if not exists public.social_meta_asset_discovery_runs (
  discovery_run_id text primary key
    check (length(trim(discovery_run_id)) > 0),
  oauth_session_id text not null
    references public.social_oauth_sessions (session_id),
  publication_target_id text not null
    check (length(trim(publication_target_id)) > 0),
  admin_actor_id text not null
    check (length(trim(admin_actor_id)) > 0),
  outcome text not null
    check (outcome in ('success', 'token_unavailable', 'provider_error', 'storage_error')),
  page_count integer not null default 0
    check (page_count >= 0),
  instagram_count integer not null default 0
    check (instagram_count >= 0),
  error_code_redacted text null,
  created_at timestamptz not null default now(),
  grants_execution_permission boolean not null default false
    check (grants_execution_permission = false),
  executes_nothing boolean not null default true
    check (executes_nothing = true),
  publishes_nothing boolean not null default true
    check (publishes_nothing = true)
);

create index if not exists social_meta_asset_discovery_runs_session_idx
  on public.social_meta_asset_discovery_runs (oauth_session_id, created_at desc);

create index if not exists social_meta_asset_discovery_runs_target_idx
  on public.social_meta_asset_discovery_runs (publication_target_id, created_at desc);

create table if not exists public.social_meta_discovered_assets (
  discovered_asset_id text primary key
    check (length(trim(discovered_asset_id)) > 0),
  discovery_run_id text not null
    references public.social_meta_asset_discovery_runs (discovery_run_id),
  oauth_session_id text not null
    references public.social_oauth_sessions (session_id),
  provider text not null
    check (provider in ('meta')),
  asset_kind text not null
    check (asset_kind in ('facebook_page', 'instagram_business_account')),
  external_asset_id text not null
    check (length(trim(external_asset_id)) > 0),
  display_name text not null
    check (length(trim(display_name)) > 0),
  parent_external_asset_id text null,
  external_asset_id_redacted text not null
    check (length(trim(external_asset_id_redacted)) > 0),
  display_name_redacted text not null
    check (length(trim(display_name_redacted)) > 0),
  parent_external_asset_id_redacted text null,
  publication_target_platform text not null
    check (publication_target_platform in ('facebook', 'instagram')),
  publication_target_type text not null
    check (publication_target_type in ('facebook_page', 'instagram_business_account')),
  created_at timestamptz not null default now(),
  grants_execution_permission boolean not null default false
    check (grants_execution_permission = false),
  executes_nothing boolean not null default true
    check (executes_nothing = true),
  publishes_nothing boolean not null default true
    check (publishes_nothing = true)
);

create index if not exists social_meta_discovered_assets_run_idx
  on public.social_meta_discovered_assets (discovery_run_id, asset_kind, created_at desc);

create index if not exists social_meta_discovered_assets_session_idx
  on public.social_meta_discovered_assets (oauth_session_id, asset_kind, created_at desc);

create table if not exists public.social_meta_publication_target_bindings (
  binding_id text primary key
    check (length(trim(binding_id)) > 0),
  publication_target_id text not null
    check (length(trim(publication_target_id)) > 0),
  oauth_session_id text not null
    references public.social_oauth_sessions (session_id),
  discovered_asset_id text not null
    references public.social_meta_discovered_assets (discovered_asset_id),
  asset_kind text not null
    check (asset_kind in ('facebook_page', 'instagram_business_account')),
  external_asset_id_redacted text not null
    check (length(trim(external_asset_id_redacted)) > 0),
  binding_state text not null
    check (binding_state in ('active', 'superseded')),
  superseded_at timestamptz null,
  admin_actor_id text not null
    check (length(trim(admin_actor_id)) > 0),
  created_at timestamptz not null default now(),
  grants_execution_permission boolean not null default false
    check (grants_execution_permission = false),
  executes_nothing boolean not null default true
    check (executes_nothing = true),
  publishes_nothing boolean not null default true
    check (publishes_nothing = true)
);

create index if not exists social_meta_publication_target_bindings_target_idx
  on public.social_meta_publication_target_bindings (publication_target_id, binding_state, created_at desc);

create table if not exists public.social_meta_binding_audit_events (
  audit_event_id text primary key
    check (length(trim(audit_event_id)) > 0),
  binding_id text not null
    references public.social_meta_publication_target_bindings (binding_id),
  publication_target_id text not null
    check (length(trim(publication_target_id)) > 0),
  action text not null
    check (action in ('create', 'supersede', 'rebind')),
  outcome text not null
    check (outcome in ('success', 'validation_failed', 'storage_error')),
  sanitized_detail text not null
    check (length(trim(sanitized_detail)) > 0),
  admin_actor_id text not null
    check (length(trim(admin_actor_id)) > 0),
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
    check (publishes_nothing = true)
);

create index if not exists social_meta_binding_audit_events_binding_idx
  on public.social_meta_binding_audit_events (binding_id, created_at desc);

create or replace function public.prevent_social_meta_binding_audit_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_meta_binding_audit_events is append-only';
end;
$$;

drop trigger if exists social_meta_binding_audit_events_no_mutation
  on public.social_meta_binding_audit_events;

create trigger social_meta_binding_audit_events_no_mutation
before update or delete on public.social_meta_binding_audit_events
for each row execute function public.prevent_social_meta_binding_audit_event_mutation();

alter table public.social_meta_asset_discovery_runs enable row level security;
alter table public.social_meta_discovered_assets enable row level security;
alter table public.social_meta_publication_target_bindings enable row level security;
alter table public.social_meta_binding_audit_events enable row level security;
