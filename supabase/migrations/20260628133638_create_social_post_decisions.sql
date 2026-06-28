create table if not exists public.social_post_decisions (
  id uuid primary key default gen_random_uuid(),
  social_post_id uuid not null
    references public.social_posts(id) on delete cascade,
  asset_id uuid null
    references public.social_post_assets(id) on delete set null,
  asset_family_id uuid null,
  campaign_id text null,
  created_at timestamptz not null default now(),

  decision_stage text not null
    check (decision_stage in (
      'creative_director',
      'image_director',
      'image_review',
      'video_director',
      'video_review',
      'publisher',
      'analytics'
    )),
  decision_type text not null
    check (decision_type in (
      'generated',
      'previewed',
      'accepted',
      'rejected',
      'discarded',
      'selected',
      'published',
      'metric_observed',
      'memory_promoted'
    )),
  decision text not null,
  rationale text null,
  input_snapshot jsonb not null default '{}'::jsonb,
  output_snapshot jsonb not null default '{}'::jsonb,
  model text null,
  provider text null,
  created_by text not null
    check (created_by in (
      'human',
      'creative_director',
      'image_director',
      'video_director',
      'publisher',
      'analytics',
      'system'
    ))
);

create index if not exists social_post_decisions_post_created_idx
  on public.social_post_decisions (social_post_id, created_at desc);

create index if not exists social_post_decisions_asset_created_idx
  on public.social_post_decisions (asset_id, created_at desc)
  where asset_id is not null;

create index if not exists social_post_decisions_campaign_created_idx
  on public.social_post_decisions (campaign_id, created_at desc)
  where campaign_id is not null;

create index if not exists social_post_decisions_family_created_idx
  on public.social_post_decisions (asset_family_id, created_at desc)
  where asset_family_id is not null;

alter table public.social_post_decisions enable row level security;

drop policy if exists "No public social post decisions access" on public.social_post_decisions;
create policy "No public social post decisions access"
  on public.social_post_decisions
  for all
  to anon, authenticated
  using (false)
  with check (false);
