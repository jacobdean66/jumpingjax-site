-- public_visible controls website publishing only.
-- Operational restore availability should key off is_active.

create or replace function public.restore_cancelled_rental_atomic(
  p_booking_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
  v_items text[];
  v_item text;
  v_lock_date date;
  v_conflict_item text;
  v_conflict_date date;
  v_unavailable_item text;
begin
  select * into v_booking
  from public.bookings
  where id::text = p_booking_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  -- A successful retry is a no-op, so duplicate button presses are safe.
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

  select array_agg(distinct rental_item order by rental_item)
  into v_items
  from (
    select nullif(trim(v_booking.rental_item), '') as rental_item
    union all
    select nullif(trim(bri.rental_item), '')
    from public.booking_rental_items bri
    where bri.booking_id = v_booking.id
  ) items
  where rental_item is not null;

  if coalesce(array_length(v_items, 1), 0) = 0 then
    return jsonb_build_object('outcome', 'missing_items');
  end if;

  -- Uses the same item/date advisory-lock keys as atomic customer booking.
  foreach v_item in array v_items loop
    for v_lock_date in
      select day::date
      from generate_series(
        v_booking.event_date,
        v_booking.event_date + (greatest(coalesce(v_booking.span_days, 1), 1) - 1),
        interval '1 day'
      ) day
      order by day
    loop
      perform pg_advisory_xact_lock(
        hashtextextended(v_item || ':' || v_lock_date::text, 0)
      );
    end loop;
  end loop;

  -- Staff availability only. Website approval (public_visible) must not block restore.
  select rii.slug into v_unavailable_item
  from public.rental_inventory_items rii
  where rii.slug = any(v_items)
    and rii.is_active is false
  order by rii.slug
  limit 1;

  if v_unavailable_item is not null then
    return jsonb_build_object(
      'outcome', 'inventory_unavailable',
      'item', v_unavailable_item,
      'date', v_booking.event_date::text
    );
  end if;

  select proposed.item, greatest(other.event_date, v_booking.event_date)
  into v_conflict_item, v_conflict_date
  from unnest(v_items) proposed(item)
  join public.bookings other
    on other.id <> v_booking.id
   and lower(btrim(other.status::text)) in ('pending', 'approved', 'blocked')
   and other.event_date <=
       v_booking.event_date + (greatest(coalesce(v_booking.span_days, 1), 1) - 1)
   and other.event_date + (greatest(coalesce(other.span_days, 1), 1) - 1) >=
       v_booking.event_date
   and (
     other.rental_item = proposed.item
     or exists (
       select 1
       from public.booking_rental_items other_item
       where other_item.booking_id = other.id
         and other_item.rental_item = proposed.item
     )
   )
  order by proposed.item, greatest(other.event_date, v_booking.event_date)
  limit 1;

  if v_conflict_item is not null then
    return jsonb_build_object(
      'outcome', 'booking_conflict',
      'item', v_conflict_item,
      'date', v_conflict_date::text
    );
  end if;

  -- Previous active status is not stored reliably, so restoration is pending.
  -- Current route columns are cleared; customer, item, price, notes, and booking
  -- history remain on the original records.
  update public.bookings
  set status = 'pending',
      delivery_truck = null,
      delivery_sequence = null,
      planned_arrival_time = null,
      planned_setup_start = null,
      planned_setup_end = null,
      delivery_route_status = 'unplanned'
  where id = v_booking.id;

  update public.booking_rental_items
  set delivery_date = null,
      delivery_truck = null,
      trailer_load = null,
      delivery_sequence = null,
      planned_arrival_time = null,
      planned_setup_start = null,
      planned_setup_end = null,
      delivery_route_status = 'unplanned',
      pickup_date = null,
      pickup_time = null,
      pickup_truck = null,
      pickup_trailer_load = null,
      pickup_sequence = null,
      pickup_route_status = 'unplanned'
  where booking_id = v_booking.id;

  return jsonb_build_object(
    'outcome', 'restored',
    'booking_id', v_booking.id::text,
    'status', 'pending'
  );
end;
$$;

revoke all on function public.restore_cancelled_rental_atomic(text)
  from public, anon, authenticated;
grant execute on function public.restore_cancelled_rental_atomic(text)
  to service_role;
