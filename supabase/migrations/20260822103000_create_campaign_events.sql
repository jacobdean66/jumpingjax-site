create extension if not exists pgcrypto;

create table if not exists public.campaign_events (
  id text primary key,
  name text not null,
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft', 'published', 'paused', 'closed')),
  event_date date,
  start_time time,
  end_time time,
  signup_price text,
  signup_capacity integer check (signup_capacity is null or signup_capacity >= 0),
  short_description text,
  offer_text text,
  rules_text text,
  meta_campaign_id text,
  meta_campaign_name text,
  destination_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_event_signups (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.campaign_events(id) on delete cascade,
  parent_name text not null,
  child_name text,
  email text not null,
  phone text not null,
  player_count integer not null default 1 check (player_count > 0),
  notes text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  landing_url text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists campaign_event_signups_event_created_idx on public.campaign_event_signups(event_id, created_at desc);
create index if not exists campaign_event_signups_email_idx on public.campaign_event_signups(lower(email));

alter table public.campaign_events enable row level security;
alter table public.campaign_event_signups enable row level security;

revoke all on public.campaign_events from anon, authenticated;
revoke all on public.campaign_event_signups from anon, authenticated;

insert into public.campaign_events (id, name, slug, status, short_description, offer_text, rules_text, destination_url)
values (
  'air-hockey-tournament',
  'Air Hockey Tournament',
  'air-hockey-tournament',
  'draft',
  'A family-friendly air hockey tournament at Jumping Jax with inflatables available while players wait.',
  'Play the tournament, then play on the inflatables while you wait for your next match.',
  'Tournament details, date, price, age group, and prizes are draft placeholders until the event is finalized.',
  '/campaigns/air-hockey-tournament?utm_source=meta&utm_medium=paid_social&utm_campaign=air_hockey_tournament&utm_content={{ad.id}}'
)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  short_description = excluded.short_description,
  offer_text = excluded.offer_text,
  rules_text = excluded.rules_text,
  destination_url = excluded.destination_url,
  updated_at = now();
