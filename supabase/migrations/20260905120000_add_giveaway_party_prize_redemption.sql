alter table public.giveaway_nominee_status
  add column if not exists party_prize_redeemed boolean not null default false,
  add column if not exists party_prize_redeemed_at timestamptz;

create or replace function public.set_giveaway_party_prize_redeemed(
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
    party_prize_redeemed,
    party_prize_redeemed_at,
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
      party_prize_redeemed = excluded.party_prize_redeemed,
      party_prize_redeemed_at = excluded.party_prize_redeemed_at,
      updated_at = now(),
      updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.set_giveaway_party_prize_redeemed(text, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.set_giveaway_party_prize_redeemed(text, text, boolean, text)
  to service_role;
