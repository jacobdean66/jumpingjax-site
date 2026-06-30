create table if not exists public.social_publication_targets (
  publication_target_id uuid primary key default gen_random_uuid(),
  platform text not null
    check (platform in ('facebook', 'instagram')),
  target_type text not null
    check (target_type in ('facebook_page', 'instagram_business_account')),
  display_name text not null
    check (length(trim(display_name)) > 0),
  external_target_id text not null
    check (length(trim(external_target_id)) > 0),
  owner_managed boolean not null default true,
  enabled boolean not null default true,
  capabilities jsonb not null default '[]'::jsonb
    check (jsonb_typeof(capabilities) = 'array'),
  media_constraints jsonb not null default '{}'::jsonb
    check (jsonb_typeof(media_constraints) = 'object'),
  copy_constraints jsonb not null default '{}'::jsonb
    check (jsonb_typeof(copy_constraints) = 'object'),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint social_publication_targets_type_platform_match
    check (
      (platform = 'facebook' and target_type = 'facebook_page')
      or
      (platform = 'instagram' and target_type = 'instagram_business_account')
    ),
  constraint social_publication_targets_external_unique
    unique (platform, target_type, external_target_id)
);

create index if not exists social_publication_targets_enabled_idx
  on public.social_publication_targets (enabled, platform, target_type);

create index if not exists social_publication_targets_platform_display_idx
  on public.social_publication_targets (platform, display_name);

alter table public.social_publication_targets enable row level security;

drop policy if exists "No public social publication targets access"
  on public.social_publication_targets;
create policy "No public social publication targets access"
  on public.social_publication_targets
  for all
  to anon, authenticated
  using (false)
  with check (false);
