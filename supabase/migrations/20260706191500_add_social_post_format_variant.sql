alter table public.social_posts
  add column if not exists format_variant_id text null;
