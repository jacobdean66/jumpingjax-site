create extension if not exists pgcrypto;

create table if not exists public.air_hockey_players (
  id uuid primary key default gen_random_uuid(),
  source_signup_id uuid references public.campaign_event_signups(id) on delete set null,
  source_player_index integer,
  display_name text not null,
  original_name text,
  guardian_name text,
  email text,
  phone text,
  notes text,
  is_active boolean not null default true,
  name_manually_corrected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint air_hockey_source_player_unique unique (source_signup_id, source_player_index),
  constraint air_hockey_source_player_index_check check (
    source_signup_id is null or source_player_index is not null
  )
);

create table if not exists public.air_hockey_brackets (
  id text primary key default 'main',
  bracket jsonb not null default '{"version":1,"generatedAt":"1970-01-01T00:00:00.000Z","rounds":[],"championId":null}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists air_hockey_players_active_created_idx
  on public.air_hockey_players (is_active, created_at);

create index if not exists air_hockey_players_source_signup_idx
  on public.air_hockey_players (source_signup_id);

alter table public.air_hockey_players enable row level security;
alter table public.air_hockey_brackets enable row level security;

revoke all on public.air_hockey_players from anon, authenticated;
revoke all on public.air_hockey_brackets from anon, authenticated;

create or replace function public.touch_air_hockey_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists air_hockey_players_touch_updated_at on public.air_hockey_players;
create trigger air_hockey_players_touch_updated_at
before update on public.air_hockey_players
for each row
execute function public.touch_air_hockey_updated_at();

drop trigger if exists air_hockey_brackets_touch_updated_at on public.air_hockey_brackets;
create trigger air_hockey_brackets_touch_updated_at
before update on public.air_hockey_brackets
for each row
execute function public.touch_air_hockey_updated_at();

create or replace function public.air_hockey_signup_player_name(
  signup_child_name text,
  signup_parent_name text,
  player_index integer,
  total_players integer
)
returns text
language plpgsql
immutable
as $$
declare
  base_name text;
begin
  base_name := nullif(trim(coalesce(signup_child_name, '')), '');
  if base_name is null then
    base_name := nullif(trim(coalesce(signup_parent_name, '')), '');
  end if;
  if base_name is null then
    base_name := 'Player';
  end if;

  if total_players > 1 then
    return base_name || ' ' || player_index::text;
  end if;
  return base_name;
end;
$$;

create or replace function public.sync_air_hockey_players_from_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_count integer;
  player_index integer;
  generated_name text;
begin
  if tg_op = 'DELETE' then
    if old.event_id = 'air-hockey-tournament' then
      update public.air_hockey_players
      set is_active = false
      where source_signup_id = old.id;
    end if;
    return old;
  end if;

  if new.event_id <> 'air-hockey-tournament' then
    return new;
  end if;

  desired_count := greatest(1, coalesce(new.player_count, 1));

  for player_index in 1..desired_count loop
    generated_name := public.air_hockey_signup_player_name(
      new.child_name,
      new.parent_name,
      player_index,
      desired_count
    );

    insert into public.air_hockey_players (
      source_signup_id,
      source_player_index,
      display_name,
      original_name,
      guardian_name,
      email,
      phone,
      notes,
      is_active
    )
    values (
      new.id,
      player_index,
      generated_name,
      generated_name,
      nullif(trim(new.parent_name), ''),
      nullif(trim(new.email), ''),
      nullif(trim(new.phone), ''),
      nullif(trim(coalesce(new.notes, '')), ''),
      true
    )
    on conflict (source_signup_id, source_player_index) do update
    set
      display_name = case
        when public.air_hockey_players.name_manually_corrected then public.air_hockey_players.display_name
        else excluded.display_name
      end,
      original_name = excluded.original_name,
      guardian_name = excluded.guardian_name,
      email = excluded.email,
      phone = excluded.phone,
      notes = excluded.notes,
      is_active = true,
      updated_at = now();
  end loop;

  update public.air_hockey_players
  set is_active = false
  where source_signup_id = new.id
    and source_player_index > desired_count;

  return new;
end;
$$;

drop trigger if exists sync_air_hockey_players_from_signup on public.campaign_event_signups;
create trigger sync_air_hockey_players_from_signup
after insert or update or delete on public.campaign_event_signups
for each row
execute function public.sync_air_hockey_players_from_signup();

insert into public.air_hockey_players (
  source_signup_id,
  source_player_index,
  display_name,
  original_name,
  guardian_name,
  email,
  phone,
  notes,
  is_active
)
select
  signup.id,
  series.player_index,
  public.air_hockey_signup_player_name(
    signup.child_name,
    signup.parent_name,
    series.player_index,
    greatest(1, coalesce(signup.player_count, 1))
  ),
  public.air_hockey_signup_player_name(
    signup.child_name,
    signup.parent_name,
    series.player_index,
    greatest(1, coalesce(signup.player_count, 1))
  ),
  nullif(trim(signup.parent_name), ''),
  nullif(trim(signup.email), ''),
  nullif(trim(signup.phone), ''),
  nullif(trim(coalesce(signup.notes, '')), ''),
  true
from public.campaign_event_signups signup
cross join lateral generate_series(
  1,
  greatest(1, coalesce(signup.player_count, 1))
) as series(player_index)
where signup.event_id = 'air-hockey-tournament'
on conflict (source_signup_id, source_player_index) do update
set
  display_name = case
    when public.air_hockey_players.name_manually_corrected then public.air_hockey_players.display_name
    else excluded.display_name
  end,
  original_name = excluded.original_name,
  guardian_name = excluded.guardian_name,
  email = excluded.email,
  phone = excluded.phone,
  notes = excluded.notes,
  is_active = true,
  updated_at = now();

insert into public.air_hockey_brackets (id)
values ('main')
on conflict (id) do nothing;
