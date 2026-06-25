create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text,
  prompt text,
  caption text,
  media_type text not null check (media_type in ('image', 'video')),
  media_url text,
  platforms text[] not null default array['facebook', 'instagram']::text[],
  status text not null default 'draft' check (status in ('draft', 'approved', 'scheduled', 'posted', 'rejected', 'failed')),
  scheduled_for timestamptz null,
  posted_at timestamptz null,
  error_message text null
);

create index if not exists social_posts_status_created_at_idx
  on public.social_posts (status, created_at desc);

create index if not exists social_posts_scheduled_for_idx
  on public.social_posts (scheduled_for)
  where scheduled_for is not null;

create or replace function public.set_social_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_social_posts_updated_at on public.social_posts;
create trigger set_social_posts_updated_at
  before update on public.social_posts
  for each row
  execute function public.set_social_posts_updated_at();

alter table public.social_posts enable row level security;

drop policy if exists "No public social posts access" on public.social_posts;
create policy "No public social posts access"
  on public.social_posts
  for all
  to anon, authenticated
  using (false)
  with check (false);
