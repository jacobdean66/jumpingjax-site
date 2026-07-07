alter table public.social_posts
  add column if not exists post_placement text not null default 'feed'
    check (post_placement in ('feed', 'story', 'reel', 'carousel', 'search'));
