-- Atomic facility party reschedule and cancel.
-- Prepared locally by the facility edit/cancel change; do not apply without approval.

create or replace function public.reschedule_facility_booking_atomic(
  p_booking_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_readable_date text,
  p_readable_time text,
  p_details jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.facility_bookings%rowtype;
  v_kind text;
  v_room text;
  v_lock_date date;
begin
  if p_start is null or p_end is null or p_start >= p_end
     or nullif(trim(p_readable_date), '') is null
     or nullif(trim(p_readable_time), '') is null then
    return jsonb_build_object('outcome', 'invalid_window');
  end if;

  select * into v_booking
  from public.facility_bookings
  where id = p_booking_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if lower(btrim(v_booking.status)) not in ('pending', 'confirmed') then
    return jsonb_build_object(
      'outcome', 'invalid_status',
      'status', v_booking.status
    );
  end if;

  v_kind := v_booking.party_kind;
  v_room := v_booking.room;

  for v_lock_date in
    select distinct lock_date
    from unnest(array[
      (v_booking.start_time at time zone 'America/New_York')::date,
      (v_booking.end_time at time zone 'America/New_York')::date,
      (p_start at time zone 'America/New_York')::date,
      (p_end at time zone 'America/New_York')::date
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
        (v_kind = 'private' and f.start_time < p_end + interval '30 minutes'
          and f.end_time > p_start - interval '30 minutes')
        or
        (v_kind = 'public' and f.party_kind = 'private'
          and f.start_time < p_end + interval '30 minutes'
          and f.end_time > p_start - interval '30 minutes')
        or
        (v_kind = 'public' and f.party_kind = 'public' and f.room = v_room
          and f.start_time < p_end and f.end_time > p_start)
      )
  ) then
    return jsonb_build_object('outcome', 'conflict');
  end if;

  update public.facility_bookings
  set
    start_time = p_start,
    end_time = p_end,
    readable_date = p_readable_date,
    readable_time = p_readable_time,
    customer_name = coalesce(p_details->>'customer_name', customer_name),
    email = case
      when p_details ? 'email' then nullif(p_details->>'email', '')
      else email
    end,
    phone = case
      when p_details ? 'phone' then nullif(p_details->>'phone', '')
      else phone
    end,
    parent_name = case
      when p_details ? 'parent_name' then nullif(p_details->>'parent_name', '')
      else parent_name
    end,
    child_name = case
      when p_details ? 'child_name' then nullif(p_details->>'child_name', '')
      else child_name
    end,
    child_age = case
      when p_details ? 'child_age' then nullif(p_details->>'child_age', '')
      else child_age
    end,
    child_gender = case
      when p_details ? 'child_gender' then nullif(p_details->>'child_gender', '')
      else child_gender
    end,
    party_theme = case
      when p_details ? 'party_theme' then nullif(p_details->>'party_theme', '')
      else party_theme
    end,
    balloon_colors = case
      when p_details ? 'balloon_colors' then nullif(p_details->>'balloon_colors', '')
      else balloon_colors
    end,
    table_cloth_colors = case
      when p_details ? 'table_cloth_colors' then nullif(p_details->>'table_cloth_colors', '')
      else table_cloth_colors
    end,
    drink_choice = case
      when p_details ? 'drink_choice' then nullif(p_details->>'drink_choice', '')
      else drink_choice
    end,
    notes = case
      when p_details ? 'notes' then nullif(p_details->>'notes', '')
      else notes
    end,
    payment_method = coalesce(p_details->>'payment_method', payment_method)
  where id = v_booking.id
    and status in ('pending', 'confirmed')
  returning * into v_booking;

  if not found then
    return jsonb_build_object('outcome', 'invalid_status');
  end if;

  return jsonb_build_object(
    'outcome', 'updated',
    'id', v_booking.id,
    'status', v_booking.status,
    'start_time', v_booking.start_time,
    'end_time', v_booking.end_time
  );
end;
$$;

create or replace function public.cancel_facility_booking_atomic(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.facility_bookings%rowtype;
begin
  select * into v_booking
  from public.facility_bookings
  where id = p_booking_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if lower(btrim(v_booking.status)) in ('cancelled', 'canceled') then
    return jsonb_build_object(
      'outcome', 'already_cancelled',
      'id', v_booking.id,
      'status', v_booking.status,
      'start_time', v_booking.start_time,
      'end_time', v_booking.end_time
    );
  end if;

  if lower(btrim(v_booking.status)) not in ('pending', 'confirmed') then
    return jsonb_build_object(
      'outcome', 'invalid_status',
      'status', v_booking.status
    );
  end if;

  update public.facility_bookings
  set status = 'cancelled'
  where id = v_booking.id
    and status in ('pending', 'confirmed')
  returning * into v_booking;

  if not found then
    return jsonb_build_object('outcome', 'invalid_status');
  end if;

  return jsonb_build_object(
    'outcome', 'cancelled',
    'id', v_booking.id,
    'status', v_booking.status,
    'start_time', v_booking.start_time,
    'end_time', v_booking.end_time
  );
end;
$$;

revoke all on function public.reschedule_facility_booking_atomic(uuid, timestamptz, timestamptz, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.cancel_facility_booking_atomic(uuid) from public, anon, authenticated;
grant execute on function public.reschedule_facility_booking_atomic(uuid, timestamptz, timestamptz, text, text, jsonb) to service_role;
grant execute on function public.cancel_facility_booking_atomic(uuid) to service_role;
