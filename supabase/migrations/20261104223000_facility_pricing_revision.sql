-- Seed the row from verified saved pricing before enabling the website cutover.
-- An empty table is deliberate. There is no fallback for a fresh preview booking.
create function public.is_normalized_facility_pricing(p_pricing jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select case when jsonb_typeof(p_pricing) = 'object' then
    p_pricing ?& array[
      'publicRoom10', 'publicRoom20Weekday', 'publicRoom20Weekend',
      'privateWeekday90', 'privateWeekday120', 'privateWeekend90',
      'privateWeekend120', 'privateAny180', 'taxRate'
    ]
    and (select count(*) = 9 and bool_and(
      case when jsonb_typeof(value) = 'number' then
        (value::numeric >= 0)
        and (key <> 'taxRate' or value::numeric <= 1)
        and value::numeric = round(value::numeric, case when key = 'taxRate' then 4 else 2 end)
      else false end
    ) from jsonb_each(p_pricing))
  else false end
$$;
revoke all on function public.is_normalized_facility_pricing(jsonb)
  from public, anon, authenticated;

create table public.facility_pricing_settings (
  singleton boolean primary key default true check (singleton),
  pricing jsonb not null check (public.is_normalized_facility_pricing(pricing)),
  revision bigint not null default 1 check (revision between 1 and 9007199254740991)
);
alter table public.facility_pricing_settings enable row level security;
revoke all on public.facility_pricing_settings from public, anon, authenticated, service_role;
grant select on public.facility_pricing_settings to service_role;

-- The application cannot overwrite the row or reset its revision directly.
create function public.update_facility_pricing_settings(p_pricing jsonb, p_expected_revision bigint)
returns boolean language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin
  update public.facility_pricing_settings
    set pricing = p_pricing, revision = revision + 1
    where singleton and revision = p_expected_revision;
  return found;
end;
$$;
revoke all on function public.update_facility_pricing_settings(jsonb,bigint)
  from public, anon, authenticated;
grant execute on function public.update_facility_pricing_settings(jsonb,bigint) to service_role;

-- A share lock conflicts with the writer's row lock and lasts through the
-- outer booking transaction. Definer privileges allow the locking read while
-- direct updates to pricing remain restricted to the update function.
create function public.require_facility_pricing_revision(p_expected_revision bigint)
returns void language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare
  actual_revision bigint;
begin
  select revision into actual_revision
    from public.facility_pricing_settings where singleton for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'pricing_unavailable';
  end if;
  if actual_revision is distinct from p_expected_revision then
    raise exception using errcode = 'P0001', message = 'approved_price_changed';
  end if;
end;
$$;
revoke all on function public.require_facility_pricing_revision(bigint)
  from public, anon, authenticated;
grant execute on function public.require_facility_pricing_revision(bigint) to service_role;
