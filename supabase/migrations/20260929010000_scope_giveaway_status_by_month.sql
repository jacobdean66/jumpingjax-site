-- Existing status records are from the original September 2026 giveaway.
-- Keep those records intact while allowing a separate winner and prizes each month.
begin;
alter table public.giveaway_nominee_status
  add column if not exists draw_month text not null default '2026-09'
  check (draw_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

alter table public.giveaway_nominee_status
  drop constraint giveaway_nominee_status_pkey;
alter table public.giveaway_nominee_status
  add constraint giveaway_nominee_status_pkey primary key (draw_month, group_key);

drop index if exists public.giveaway_nominee_status_single_winner_idx;
create unique index if not exists giveaway_nominee_status_month_winner_idx
  on public.giveaway_nominee_status (draw_month) where is_winner = true;

-- Replace the old signatures; the final default preserves compatibility during rollout.
drop function if exists public.set_giveaway_winner(text, text, text);
drop function if exists public.set_giveaway_free_pass_redeemed(text, text, boolean, text);
drop function if exists public.set_giveaway_party_prize_redeemed(text, text, boolean, text);

create or replace function public.set_giveaway_winner(
  p_group_key text,
  p_child_name text,
  p_updated_by text default null,
  p_draw_month text default '2026-09'
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_draw_month is null or p_draw_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Invalid giveaway draw month';
  end if;
  if char_length(trim(p_group_key)) < 1 or char_length(p_group_key) > 300 then
    raise exception 'Invalid giveaway group key';
  end if;
  if char_length(trim(p_child_name)) < 1 or char_length(p_child_name) > 200 then
    raise exception 'Invalid giveaway child name';
  end if;

  -- Serialize winner replacements within this month, including first-time draws.
  perform pg_advisory_xact_lock(hashtext('giveaway-winner'), hashtext(p_draw_month));

  update public.giveaway_nominee_status
  set is_winner = false,
      updated_at = now(),
      updated_by = p_updated_by
  where draw_month = p_draw_month and is_winner = true and group_key <> p_group_key;

  insert into public.giveaway_nominee_status (
    draw_month,
    group_key,
    child_name,
    is_winner,
    free_pass_redeemed,
    free_pass_redeemed_at,
    updated_at,
    updated_by
  ) values (
    p_draw_month,
    p_group_key,
    p_child_name,
    true,
    false,
    null,
    now(),
    p_updated_by
  )
  on conflict (draw_month, group_key) do update
  set child_name = excluded.child_name,
      is_winner = true,
      free_pass_redeemed = false,
      free_pass_redeemed_at = null,
      updated_at = now(),
      updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.set_giveaway_winner(text, text, text, text) from public, anon, authenticated;
grant execute on function public.set_giveaway_winner(text, text, text, text) to service_role;

create or replace function public.set_giveaway_free_pass_redeemed(
  p_group_key text,
  p_child_name text,
  p_redeemed boolean,
  p_updated_by text default null,
  p_draw_month text default '2026-09'
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_draw_month is null or p_draw_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Invalid giveaway draw month';
  end if;
  if char_length(trim(p_group_key)) < 1 or char_length(p_group_key) > 300 then
    raise exception 'Invalid giveaway group key';
  end if;
  if char_length(trim(p_child_name)) < 1 or char_length(p_child_name) > 200 then
    raise exception 'Invalid giveaway child name';
  end if;

  insert into public.giveaway_nominee_status (
    draw_month,
    group_key,
    child_name,
    free_pass_redeemed,
    free_pass_redeemed_at,
    updated_at,
    updated_by
  ) values (
    p_draw_month,
    p_group_key,
    p_child_name,
    p_redeemed,
    case when p_redeemed then now() else null end,
    now(),
    p_updated_by
  )
  on conflict (draw_month, group_key) do update
  set child_name = excluded.child_name,
      free_pass_redeemed = excluded.free_pass_redeemed,
      free_pass_redeemed_at = excluded.free_pass_redeemed_at,
      updated_at = now(),
      updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.set_giveaway_free_pass_redeemed(text, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.set_giveaway_free_pass_redeemed(text, text, boolean, text, text) to service_role;

create or replace function public.set_giveaway_party_prize_redeemed(
  p_group_key text,
  p_child_name text,
  p_redeemed boolean,
  p_updated_by text default null,
  p_draw_month text default '2026-09'
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_draw_month is null or p_draw_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Invalid giveaway draw month';
  end if;
  if char_length(trim(p_group_key)) < 1 or char_length(p_group_key) > 300 then
    raise exception 'Invalid giveaway group key';
  end if;
  if char_length(trim(p_child_name)) < 1 or char_length(p_child_name) > 200 then
    raise exception 'Invalid giveaway child name';
  end if;

  insert into public.giveaway_nominee_status (
    draw_month,
    group_key,
    child_name,
    party_prize_redeemed,
    party_prize_redeemed_at,
    updated_at,
    updated_by
  ) values (
    p_draw_month,
    p_group_key,
    p_child_name,
    p_redeemed,
    case when p_redeemed then now() else null end,
    now(),
    p_updated_by
  )
  on conflict (draw_month, group_key) do update
  set child_name = excluded.child_name,
      party_prize_redeemed = excluded.party_prize_redeemed,
      party_prize_redeemed_at = excluded.party_prize_redeemed_at,
      updated_at = now(),
      updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.set_giveaway_party_prize_redeemed(text, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.set_giveaway_party_prize_redeemed(text, text, boolean, text, text) to service_role;

commit;
