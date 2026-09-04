create table if not exists public.giveaway_nominee_status (
  group_key text primary key check (char_length(group_key) between 1 and 300),
  child_name text not null check (char_length(child_name) between 1 and 200),
  is_winner boolean not null default false,
  free_pass_redeemed boolean not null default false,
  free_pass_redeemed_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text
);

create unique index if not exists giveaway_nominee_status_single_winner_idx
  on public.giveaway_nominee_status (is_winner)
  where is_winner = true;

alter table public.giveaway_nominee_status enable row level security;

create or replace function public.set_giveaway_winner(
  p_group_key text,
  p_child_name text,
  p_updated_by text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(trim(p_group_key)) < 1 or char_length(p_group_key) > 300 then
    raise exception 'Invalid giveaway group key';
  end if;
  if char_length(trim(p_child_name)) < 1 or char_length(p_child_name) > 200 then
    raise exception 'Invalid giveaway child name';
  end if;

  update public.giveaway_nominee_status
  set is_winner = false,
      updated_at = now(),
      updated_by = p_updated_by
  where is_winner = true and group_key <> p_group_key;

  insert into public.giveaway_nominee_status (
    group_key,
    child_name,
    is_winner,
    free_pass_redeemed,
    free_pass_redeemed_at,
    updated_at,
    updated_by
  ) values (
    p_group_key,
    p_child_name,
    true,
    false,
    null,
    now(),
    p_updated_by
  )
  on conflict (group_key) do update
  set child_name = excluded.child_name,
      is_winner = true,
      free_pass_redeemed = false,
      free_pass_redeemed_at = null,
      updated_at = now(),
      updated_by = excluded.updated_by;
end;
$$;

create or replace function public.set_giveaway_free_pass_redeemed(
  p_group_key text,
  p_child_name text,
  p_redeemed boolean,
  p_updated_by text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(trim(p_group_key)) < 1 or char_length(p_group_key) > 300 then
    raise exception 'Invalid giveaway group key';
  end if;
  if char_length(trim(p_child_name)) < 1 or char_length(p_child_name) > 200 then
    raise exception 'Invalid giveaway child name';
  end if;

  insert into public.giveaway_nominee_status (
    group_key,
    child_name,
    free_pass_redeemed,
    free_pass_redeemed_at,
    updated_at,
    updated_by
  ) values (
    p_group_key,
    p_child_name,
    p_redeemed,
    case when p_redeemed then now() else null end,
    now(),
    p_updated_by
  )
  on conflict (group_key) do update
  set child_name = excluded.child_name,
      free_pass_redeemed = excluded.free_pass_redeemed,
      free_pass_redeemed_at = excluded.free_pass_redeemed_at,
      updated_at = now(),
      updated_by = excluded.updated_by;
end;
$$;

revoke all on table public.giveaway_nominee_status from anon, authenticated;
revoke all on function public.set_giveaway_winner(text, text, text) from public, anon, authenticated;
revoke all on function public.set_giveaway_free_pass_redeemed(text, text, boolean, text) from public, anon, authenticated;
grant all on table public.giveaway_nominee_status to service_role;
grant execute on function public.set_giveaway_winner(text, text, text) to service_role;
grant execute on function public.set_giveaway_free_pass_redeemed(text, text, boolean, text) to service_role;
