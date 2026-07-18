-- Owner-managed reusable creative preferences for Social Posts AI generation.

create table if not exists public.social_creative_preferences (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  natural_language_note text not null,
  subject_scale text not null default '',
  age_range text not null default '',
  composition text not null default '',
  camera_angle text not null default '',
  product_visibility text not null default '',
  realism text not null default '',
  brand_style text not null default '',
  prohibited_elements text not null default '',
  preferred_elements text not null default '',
  applies_to text not null default 'all'
    check (applies_to in ('all', 'image', 'video', 'caption')),
  is_active boolean not null default true,
  created_by text not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_creative_preferences_active_idx
  on public.social_creative_preferences (is_active, updated_at desc);

drop trigger if exists social_creative_preferences_set_updated_at
  on public.social_creative_preferences;

create trigger social_creative_preferences_set_updated_at
before update on public.social_creative_preferences
for each row execute function public.set_updated_at();

alter table public.social_creative_preferences enable row level security;
