-- Allow foam party package duration to be stored independently of the
-- booking-level rental duration (One Day) when foam is mixed with inflatables.

alter table public.bookings
  add column if not exists foam_duration text null;

create or replace function public.create_rental_booking_atomic(
  p_booking jsonb,
  p_items jsonb,
  p_idempotency_key text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing_id public.bookings.id%type;
  v_booking_id public.bookings.id%type;
  v_event_date date := (p_booking->>'event_date')::date;
  v_span_days integer := greatest(coalesce((p_booking->>'span_days')::integer, 1), 1);
  v_item jsonb;
begin
  if nullif(trim(p_idempotency_key), '') is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = 'invalid_booking_input';
  end if;

  -- Identical retries return the original row without sending a second write.
  select id into v_existing_id
  from public.bookings
  where idempotency_key = p_idempotency_key;
  if v_existing_id is not null then
    return v_existing_id::text;
  end if;

  -- Every request touching the same item/date pair takes the same locks in order.
  for v_item in
    select jsonb_build_object(
      'rental_item', item.value->>'rental_item',
      'lock_date', lock_date::text
    )
    from jsonb_array_elements(p_items) item
    cross join generate_series(
      v_event_date,
      v_event_date + (v_span_days - 1),
      interval '1 day'
    ) lock_date
    order by item.value->>'rental_item', lock_date
  loop
    perform pg_advisory_xact_lock(
      hashtextextended((v_item->>'rental_item') || ':' || (v_item->>'lock_date'), 0)
    );
  end loop;

  if exists (
    select 1
    from public.bookings b
    where b.status in ('pending', 'approved', 'blocked')
      and b.event_date <= v_event_date + (v_span_days - 1)
      and b.event_date + (greatest(coalesce(b.span_days, 1), 1) - 1) >= v_event_date
      and (
        b.rental_item in (select value->>'rental_item' from jsonb_array_elements(p_items))
        or exists (
          select 1
          from public.booking_rental_items bri
          where bri.booking_id = b.id
            and bri.rental_item in (
              select value->>'rental_item' from jsonb_array_elements(p_items)
            )
        )
      )
  ) then
    raise exception using errcode = 'P0001', message = 'booking_conflict';
  end if;

  insert into public.bookings (
    rental_item, rental_name, customer_name, customer_email, customer_phone,
    event_date, duration, foam_duration, span_days, event_address, delivery_time,
    event_start_time, requested_delivery_window, distance_miles, delivery_fee,
    mileage_fee, setup_location, setup_surface, setup_access, setup_notes,
    payment_method, subtotal, total, status, idempotency_key
  ) values (
    p_booking->>'rental_item', p_booking->>'rental_name',
    p_booking->>'customer_name', p_booking->>'customer_email',
    p_booking->>'customer_phone', v_event_date, p_booking->>'duration',
    nullif(trim(coalesce(p_booking->>'foam_duration', '')), ''),
    v_span_days,
    p_booking->>'event_address', nullif(p_booking->>'delivery_time', '')::time,
    nullif(p_booking->>'event_start_time', '')::time,
    p_booking->>'requested_delivery_window',
    nullif(p_booking->>'distance_miles', '')::numeric,
    coalesce((p_booking->>'delivery_fee')::numeric, 0),
    coalesce((p_booking->>'mileage_fee')::numeric, 0),
    p_booking->>'setup_location', p_booking->>'setup_surface',
    p_booking->>'setup_access', p_booking->>'setup_notes',
    p_booking->>'payment_method', (p_booking->>'subtotal')::numeric,
    (p_booking->>'total')::numeric, 'pending', p_idempotency_key
  ) returning id into v_booking_id;

  insert into public.booking_rental_items (booking_id, rental_item, rental_name)
  select v_booking_id, value->>'rental_item', value->>'rental_name'
  from jsonb_array_elements(p_items);

  return v_booking_id::text;
end;
$$;

revoke all on function public.create_rental_booking_atomic(jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_rental_booking_atomic(jsonb, jsonb, text) to service_role;
