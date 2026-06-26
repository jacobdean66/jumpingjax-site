create table if not exists public.social_post_assets (
  id uuid primary key default gen_random_uuid(),
  social_post_id uuid not null
    references public.social_posts(id) on delete cascade,
  parent_asset_id uuid null
    references public.social_post_assets(id) on delete set null,
  asset_family_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  asset_type text not null
    check (asset_type in ('image', 'video', 'thumbnail', 'audio', 'caption', 'document')),
  asset_stage text not null
    check (asset_stage in ('source', 'concept', 'generated', 'edited', 'approved', 'published', 'archived')),

  url text null,
  source_url text null,
  storage_path text null,
  provider text null,
  generation_engine text null,
  model text null,
  prediction_id text null,
  generation_status text null
    check (generation_status is null or generation_status in (
      'starting', 'processing', 'succeeded', 'failed', 'canceled'
    )),
  generation_prompt text null,
  concept_id text null,
  generation_cost numeric null,
  generation_duration_ms integer null
    check (generation_duration_ms is null or generation_duration_ms >= 0),
  created_by text null
    check (created_by is null or created_by in (
      'human', 'creative_director', 'image_director',
      'video_director', 'publisher', 'analytics'
    )),
  is_selected boolean not null default false,
  is_rejected boolean not null default false,
  is_favorite boolean not null default false,
  rating integer null check (rating between 1 and 5),
  notes text null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists social_post_assets_post_created_idx
  on public.social_post_assets (social_post_id, created_at desc);

create index if not exists social_post_assets_family_created_idx
  on public.social_post_assets (asset_family_id, created_at asc);

create index if not exists social_post_assets_prediction_idx
  on public.social_post_assets (social_post_id, prediction_id)
  where prediction_id is not null;

create index if not exists social_post_assets_parent_idx
  on public.social_post_assets (parent_asset_id)
  where parent_asset_id is not null;

create index if not exists social_post_assets_type_stage_idx
  on public.social_post_assets (asset_type, asset_stage);

create unique index if not exists social_post_assets_selected_approved_image_idx
  on public.social_post_assets (social_post_id)
  where asset_type = 'image'
    and asset_stage = 'approved'
    and is_selected
    and not is_rejected;

create unique index if not exists social_post_assets_selected_video_idx
  on public.social_post_assets (social_post_id)
  where asset_type = 'video'
    and is_selected
    and not is_rejected;

create or replace function public.set_social_post_assets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_social_post_assets_updated_at on public.social_post_assets;
create trigger set_social_post_assets_updated_at
  before update on public.social_post_assets
  for each row
  execute function public.set_social_post_assets_updated_at();

alter table public.social_post_assets enable row level security;

drop policy if exists "No public social post assets access" on public.social_post_assets;
create policy "No public social post assets access"
  on public.social_post_assets
  for all
  to anon, authenticated
  using (false)
  with check (false);
