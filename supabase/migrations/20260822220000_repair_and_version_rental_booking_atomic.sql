-- Repair production drift in the rental booking RPC and move the application
-- to a versioned entry point. Older SQL snippets can still replace the legacy
-- function, but they cannot silently downgrade the function used by the site.

create or replace function public.create_rental_booking_atomic_v2(
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

  select id into v_existing_id
  from public.bookings
  where idempotency_key = p_idempotency_key;
  if v_existing_id is not null then
    return v_existing_id::text;
  end if;

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
      and b.event_date + ((greatest(coalesce(b.span_days, 1), 1) - 1)::integer) >= v_event_date
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

revoke all on function public.create_rental_booking_atomic_v2(jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.create_rental_booking_atomic_v2(jsonb, jsonb, text)
  to service_role;

comment on function public.create_rental_booking_atomic_v2(jsonb, jsonb, text) is
  'Versioned rental booking entry point. Includes bigint span-days cast and foam duration persistence.';

-- Keep the legacy entry point correct for older deployments while the site
-- rolls forward. Its implementation delegates to the protected v2 function.
create or replace function public.create_rental_booking_atomic(
  p_booking jsonb,
  p_items jsonb,
  p_idempotency_key text
)
returns text
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.create_rental_booking_atomic_v2(p_booking, p_items, p_idempotency_key);
$$;

revoke all on function public.create_rental_booking_atomic(jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.create_rental_booking_atomic(jsonb, jsonb, text)
  to service_role;

do $$
declare
  v_body text;
begin
  select p.prosrc into v_body
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_rental_booking_atomic_v2'
    and pg_get_function_identity_arguments(p.oid) = 'p_booking jsonb, p_items jsonb, p_idempotency_key text';

  if v_body is null
     or position('::integer' in v_body) = 0
     or position('foam_duration' in v_body) = 0 then
    raise exception 'rental_booking_atomic_v2 verification failed';
  end if;
end;
$$;
