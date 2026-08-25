-- Restore a cancelled facility party without a read/check/write race.

create or replace function public.restore_cancelled_facility_booking_atomic(
  p_booking_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.facility_bookings%rowtype;
  v_lock_date date;
begin
  select *
    into v_booking
  from public.facility_bookings
  where id = p_booking_id::uuid
  for update;

  if not found then
    return jsonb_build_object(
      'outcome', 'not_found',
      'booking_id', p_booking_id
    );
  end if;

  if lower(btrim(v_booking.status::text)) = 'pending' then
    return jsonb_build_object(
      'outcome', 'already_restored',
      'booking_id', v_booking.id::text,
      'status', v_booking.status
    );
  end if;

  if lower(btrim(v_booking.status::text)) not in ('cancelled', 'canceled') then
    return jsonb_build_object(
      'outcome', 'invalid_status',
      'booking_id', v_booking.id::text,
      'status', v_booking.status
    );
  end if;

  for v_lock_date in
    select distinct lock_date
    from unnest(array[
      (v_booking.start_time at time zone 'America/New_York')::date,
      (v_booking.end_time at time zone 'America/New_York')::date
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
    where f.id <> v_booking.id
      and f.status in ('pending', 'confirmed')
      and (
        (v_booking.party_kind = 'private'
          and f.start_time < v_booking.end_time + interval '30 minutes'
          and f.end_time > v_booking.start_time - interval '30 minutes')
        or
        (v_booking.party_kind = 'public'
          and f.party_kind = 'private'
          and f.start_time < v_booking.end_time + interval '30 minutes'
          and f.end_time > v_booking.start_time - interval '30 minutes')
        or
        (v_booking.party_kind = 'public'
          and f.party_kind = 'public'
          and f.room = v_booking.room
          and f.start_time < v_booking.end_time
          and f.end_time > v_booking.start_time)
      )
  ) then
    return jsonb_build_object(
      'outcome', 'booking_conflict',
      'booking_id', v_booking.id::text
    );
  end if;

  update public.facility_bookings
  set status = 'pending'
  where id = v_booking.id;

  return jsonb_build_object(
    'outcome', 'restored',
    'booking_id', v_booking.id::text,
    'status', 'pending'
  );
end;
$$;

revoke all on function public.restore_cancelled_facility_booking_atomic(text)
  from public, anon, authenticated;
grant execute on function public.restore_cancelled_facility_booking_atomic(text)
  to service_role;
