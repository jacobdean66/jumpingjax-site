alter table public.social_posts
add column if not exists generated_image_source_url text null,
add column if not exists media_source_url text null;
