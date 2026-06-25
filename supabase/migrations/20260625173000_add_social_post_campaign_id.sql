alter table public.social_posts
add column if not exists campaign_id text null;
