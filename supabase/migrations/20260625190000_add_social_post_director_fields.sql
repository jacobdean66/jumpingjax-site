alter table public.social_posts
add column if not exists motion_preset text null,
add column if not exists camera_preset text null,
add column if not exists creative_source text null
  check (creative_source is null or creative_source in ('openai', 'rule-fallback'));
