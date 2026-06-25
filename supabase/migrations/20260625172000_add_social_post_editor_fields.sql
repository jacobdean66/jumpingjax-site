alter table public.social_posts
add column if not exists goal text,
add column if not exists business_focus text not null default 'both'
  check (business_focus in ('rentals', 'facility-parties', 'both'));
