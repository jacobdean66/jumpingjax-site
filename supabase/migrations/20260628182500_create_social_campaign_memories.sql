create table if not exists public.social_campaign_memories (
  id uuid primary key default gen_random_uuid(),
  campaign_id text null,
  memory_key text not null,
  memory_type text not null
    check (memory_type in (
      'creative_pattern',
      'image_pattern',
      'video_pattern',
      'audience_pattern',
      'publishing_pattern',
      'analytics_pattern',
      'general_pattern'
    )),
  memory_text text not null,
  recommendation text null,
  confidence_score numeric not null default 0
    check (confidence_score >= 0 and confidence_score <= 1),
  support_count integer not null default 0
    check (support_count >= 0),
  contradiction_count integer not null default 0
    check (contradiction_count >= 0),
  status text not null default 'active'
    check (status in ('active', 'superseded', 'retracted')),
  version integer not null
    check (version > 0),
  supersedes_memory_id uuid null
    references public.social_campaign_memories(id) on delete set null,
  algorithm_version text not null,
  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  promoted_at timestamptz null,
  created_by text not null default 'system'
    check (created_by in (
      'human',
      'creative_director',
      'image_director',
      'video_director',
      'publisher',
      'analytics',
      'learning_agent',
      'system'
    ))
);

create unique index if not exists social_campaign_memories_campaign_key_version_idx
  on public.social_campaign_memories (campaign_id, memory_key, version)
  where campaign_id is not null;

create unique index if not exists social_campaign_memories_global_key_version_idx
  on public.social_campaign_memories (memory_key, version)
  where campaign_id is null;

create index if not exists social_campaign_memories_campaign_status_confidence_idx
  on public.social_campaign_memories (campaign_id, status, confidence_score desc);

create index if not exists social_campaign_memories_key_version_idx
  on public.social_campaign_memories (memory_key, version desc);

create index if not exists social_campaign_memories_status_promoted_idx
  on public.social_campaign_memories (status, promoted_at desc);

create index if not exists social_campaign_memories_supersedes_idx
  on public.social_campaign_memories (supersedes_memory_id)
  where supersedes_memory_id is not null;

create table if not exists public.social_campaign_memory_evidence (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null
    references public.social_campaign_memories(id) on delete cascade,
  decision_id uuid not null
    references public.social_post_decisions(id) on delete cascade,
  social_post_id uuid not null
    references public.social_posts(id) on delete cascade,
  asset_id uuid null
    references public.social_post_assets(id) on delete set null,
  asset_family_id uuid null,
  campaign_id text null,
  evidence_role text not null default 'supporting'
    check (evidence_role in ('supporting', 'contradicting', 'neutral')),
  weight numeric not null default 1
    check (weight >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists social_campaign_memory_evidence_memory_decision_idx
  on public.social_campaign_memory_evidence (memory_id, decision_id);

create index if not exists social_campaign_memory_evidence_memory_idx
  on public.social_campaign_memory_evidence (memory_id);

create index if not exists social_campaign_memory_evidence_decision_idx
  on public.social_campaign_memory_evidence (decision_id);

create index if not exists social_campaign_memory_evidence_post_idx
  on public.social_campaign_memory_evidence (social_post_id);

create index if not exists social_campaign_memory_evidence_asset_idx
  on public.social_campaign_memory_evidence (asset_id)
  where asset_id is not null;

create index if not exists social_campaign_memory_evidence_family_idx
  on public.social_campaign_memory_evidence (asset_family_id)
  where asset_family_id is not null;

create index if not exists social_campaign_memory_evidence_campaign_created_idx
  on public.social_campaign_memory_evidence (campaign_id, created_at desc)
  where campaign_id is not null;

alter table public.social_campaign_memories enable row level security;
alter table public.social_campaign_memory_evidence enable row level security;

drop policy if exists "No public social campaign memories access" on public.social_campaign_memories;
create policy "No public social campaign memories access"
  on public.social_campaign_memories
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No public social campaign memory evidence access" on public.social_campaign_memory_evidence;
create policy "No public social campaign memory evidence access"
  on public.social_campaign_memory_evidence
  for all
  to anon, authenticated
  using (false)
  with check (false);
