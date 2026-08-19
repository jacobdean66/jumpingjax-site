-- Persist resolved invitation theme snapshots for facility birthday parties.
alter table public.facility_bookings
  add column if not exists invitation jsonb null;

comment on column public.facility_bookings.invitation is
  'Resolved invitation snapshot: theme id, style family, artwork slot, and match metadata. Source theme text remains in party_theme.';

create or replace function public.create_facility_booking_atomic(
  p_booking jsonb,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing_id uuid;
  v_booking_id uuid;
  v_start timestamptz := (p_booking->>'start_time')::timestamptz;
  v_end timestamptz := (p_booking->>'end_time')::timestamptz;
  v_kind text := p_booking->>'party_kind';
  v_room text := p_booking->>'room';
  v_lock_date date;
begin
  if nullif(trim(p_idempotency_key), '') is null
     or v_kind not in ('public', 'private')
     or v_start >= v_end then
    raise exception using errcode = '22023', message = 'invalid_booking_input';
  end if;

  select id into v_existing_id
  from public.facility_bookings
  where idempotency_key = p_idempotency_key;
  if v_existing_id is not null then
    return v_existing_id;
  end if;

  for v_lock_date in
    select distinct lock_date
    from unnest(array[
      (v_start at time zone 'America/New_York')::date,
      (v_end at time zone 'America/New_York')::date
    ]) as dates(lock_date)
    order by lock_date
  loop
    perform pg_advisory_xact_lock(
      hashtextextended('facility:' || v_lock_date::text, 0)
    );
  end loop;

  if exists (
    select 1
    from public.facility_bookings f
    where f.status in ('pending', 'confirmed')
      and (
        (v_kind = 'private' and f.start_time < v_end + interval '30 minutes'
          and f.end_time > v_start - interval '30 minutes')
        or
        (v_kind = 'public' and f.party_kind = 'private'
          and f.start_time < v_end + interval '30 minutes'
          and f.end_time > v_start - interval '30 minutes')
        or
        (v_kind = 'public' and f.party_kind = 'public' and f.room = v_room
          and f.start_time < v_end and f.end_time > v_start)
      )
  ) then
    raise exception using errcode = 'P0001', message = 'booking_conflict';
  end if;

  insert into public.facility_bookings (
    party_kind, room, start_time, end_time, customer_name, email, phone,
    parent_name, child_name, child_gender, child_age, party_theme,
    balloon_colors, table_cloth_colors, drink_choice, payment_method,
    deposit_acknowledged, notes, readable_date, readable_time, party_label,
    addon_selections, facility_package_price, addon_subtotal, subtotal, tax,
    total, pricing_details, invitation, status, idempotency_key
  ) values (
    v_kind, v_room, v_start, v_end, p_booking->>'customer_name',
    p_booking->>'email', p_booking->>'phone', p_booking->>'parent_name',
    p_booking->>'child_name', p_booking->>'child_gender', p_booking->>'child_age',
    p_booking->>'party_theme', p_booking->>'balloon_colors',
    p_booking->>'table_cloth_colors', p_booking->>'drink_choice',
    p_booking->>'payment_method', coalesce((p_booking->>'deposit_acknowledged')::boolean, false),
    p_booking->>'notes', p_booking->>'readable_date', p_booking->>'readable_time',
    p_booking->>'party_label', p_booking->'addon_selections',
    (p_booking->>'facility_package_price')::numeric,
    (p_booking->>'addon_subtotal')::numeric, (p_booking->>'subtotal')::numeric,
    (p_booking->>'tax')::numeric, (p_booking->>'total')::numeric,
    p_booking->'pricing_details', p_booking->'invitation', 'pending', p_idempotency_key
  ) returning id into v_booking_id;

  return v_booking_id;
end;
$$;

revoke all on function public.create_facility_booking_atomic(jsonb, text) from public, anon, authenticated;
grant execute on function public.create_facility_booking_atomic(jsonb, text) to service_role;
