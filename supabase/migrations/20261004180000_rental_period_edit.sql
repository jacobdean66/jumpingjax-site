-- One reservation guard shared by EVERY booking/item writer, including old
-- checkout RPCs, direct admin writes, cancellation and restoration. Updating a
-- real row also forces stale REPEATABLE READ transactions to fail safely.
create table public.rental_reservation_guard (id boolean primary key default true check(id), revision bigint not null default 0);
insert into public.rental_reservation_guard(id) values(true);
revoke all on public.rental_reservation_guard from public, anon, authenticated, service_role;
alter table public.rental_reservation_guard enable row level security;

create function public.lock_rental_reservations() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.rental_reservation_guard set revision = revision + 1 where id;
  return null;
end; $$;
create trigger rental_reservation_write_lock before insert or update of event_date, span_days, rental_item, status or delete on public.bookings
for each statement execute function public.lock_rental_reservations();
create trigger rental_item_reservation_write_lock before insert or update or delete on public.booking_rental_items
for each statement execute function public.lock_rental_reservations();

create function public.assert_rental_reservation(p_id text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_booking public.bookings%rowtype; v_item text; v_date date;
begin
  select * into v_booking from public.bookings where id::text = p_id;
  if not found or v_booking.status not in ('pending','approved','blocked') then return; end if;
  select mine.item, greatest(v_booking.event_date, other.event_date)
    into v_item, v_date
  from (select v_booking.rental_item as item union select rental_item from public.booking_rental_items where booking_id = v_booking.id) mine
  join public.bookings other on other.id <> v_booking.id
    and other.status in ('pending','approved','blocked')
    and other.event_date <= v_booking.event_date + (greatest(coalesce(v_booking.span_days,1),1)::integer - 1)
    and other.event_date + (greatest(coalesce(other.span_days,1),1)::integer - 1) >= v_booking.event_date
    and (other.rental_item = mine.item or exists(select 1 from public.booking_rental_items i where i.booking_id = other.id and i.rental_item = mine.item))
  order by greatest(v_booking.event_date, other.event_date), mine.item limit 1;
  if found then
    raise exception using errcode = 'P0001', message = 'booking_conflict',
      detail = format('%s is already reserved on %s.', v_item, v_date);
  end if;
end; $$;

create function public.check_rental_reservation() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_table_name = 'bookings' then
    if tg_op = 'UPDATE' and (old.event_date, old.span_days, old.rental_item, old.status) is not distinct from
      (new.event_date, new.span_days, new.rental_item, new.status) then return new; end if;
    perform public.assert_rental_reservation(new.id::text);
  else
    perform public.assert_rental_reservation(new.booking_id::text);
  end if;
  return new;
end; $$;
create trigger rental_reservation_check after insert or update of event_date, span_days, rental_item, status on public.bookings
for each row execute function public.check_rental_reservation();
create trigger rental_item_reservation_check after insert or update of booking_id, rental_item on public.booking_rental_items
for each row execute function public.check_rental_reservation();

-- NULL means historical pricing is unitemized: retain it, never reverse engineer
-- a customer's agreed price using today's catalog or legacy multipliers.
alter table public.bookings add column rental_day_charges jsonb;
alter table public.bookings add constraint rental_day_charges_array check(rental_day_charges is null or jsonb_typeof(rental_day_charges) = 'array');

create function public.edit_rental_booking_atomic(p_id text, p_update jsonb, p_period jsonb default null, p_expected jsonb default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_old public.bookings%rowtype; v_new public.bookings%rowtype;
  v_span integer; v_charges jsonb; v_day jsonb; v_amount numeric; v_old_extra numeric; v_extra numeric := 0;
  v_delta numeric := 0; v_lines jsonb; v_paid numeric; v_invoice public.booking_invoices%rowtype;
  v_date date := (p_update->>'event_date')::date;
begin
  update public.rental_reservation_guard set revision = revision + 1 where id;
  select * into v_old from public.bookings where id::text = p_id for update;
  if not found or v_old.status not in ('pending','approved') then raise exception 'rental_not_editable'; end if;
  v_span := greatest(coalesce(v_old.span_days,1),1)::integer;
  v_charges := v_old.rental_day_charges;
  if p_period is not null then
    if p_expected is distinct from jsonb_build_object('event_date',v_old.event_date,'span_days',v_span,
      'subtotal',v_old.subtotal,'total',v_old.total,'rental_day_charges',v_old.rental_day_charges) then
      raise exception 'rental_edit_stale';
    end if;
    v_span := (p_period->>'spanDays')::integer;
    v_charges := p_period->'dayCharges';
    if v_span is null or v_span not between 1 and 3 or jsonb_typeof(v_charges) is distinct from 'array'
      or jsonb_array_length(v_charges) <> v_span - 1 then raise exception 'invalid_rental_period'; end if;
    for i in 2..v_span loop
      v_day := v_charges->(i-2);
      v_amount := (v_day->>'amount')::numeric;
      if (v_day->>'day')::integer is distinct from i or coalesce(v_day->>'choice','') not in ('free','charge')
        or v_amount is null or v_amount < 0 or v_amount > 100000 or round(v_amount,2) <> v_amount
        or (v_day->>'choice' = 'free' and v_amount <> 0) or (v_day->>'choice' = 'charge' and v_amount <= 0) then
        raise exception 'invalid_rental_day_charge';
      end if;
      v_extra := v_extra + v_amount;
    end loop;
    select coalesce(sum((value->>'amount')::numeric),0) into v_old_extra from jsonb_array_elements(coalesce(v_old.rental_day_charges,'[]'));
    v_delta := v_extra - v_old_extra;
    if v_old.subtotal is null or v_old.total is null or v_old.subtotal + v_delta < 0 or v_old.total + v_delta < 0 then
      raise exception 'rental_price_needs_review';
    end if;
  end if;
  update public.bookings set
    customer_name = p_update->>'customer_name', customer_email = p_update->>'customer_email', customer_phone = p_update->>'customer_phone',
    event_date = v_date, event_start_time = nullif(p_update->>'event_start_time','')::time,
    requested_delivery_window = p_update->>'requested_delivery_window', event_address = p_update->>'event_address',
    setup_location = p_update->>'setup_location', setup_surface = p_update->>'setup_surface', setup_access = p_update->>'setup_access',
    setup_notes = p_update->>'setup_notes', payment_method = p_update->>'payment_method',
    span_days = v_span, rental_day_charges = v_charges,
    subtotal = subtotal + v_delta, total = total + v_delta
  where id = v_old.id returning * into v_new;
  perform public.assert_rental_reservation(p_id);

  if v_old.event_date is distinct from v_date or v_old.span_days is distinct from v_span then
    update public.booking_rental_items set pickup_date = null, pickup_truck = null, pickup_trailer_load = null,
      pickup_sequence = null, pickup_time = null, pickup_route_status = 'unplanned'
    where booking_id = v_old.id;
  end if;

  -- Preserve custom invoice lines and one-time fees; replace only managed extra
  -- day lines in the same transaction. Recorded payments are never mutated.
  select * into v_invoice from public.booking_invoices where booking_kind = 'rental' and booking_id = p_id for update;
  if found then
    v_lines := coalesce(v_invoice.payload->'lineItems','[]');
    if p_period is not null then
      select coalesce(jsonb_agg(value),'[]') into v_lines from jsonb_array_elements(v_lines)
        where coalesce(value->>'id','') not in ('rental-extra-day-2','rental-extra-day-3');
      for v_day in select value from jsonb_array_elements(v_charges) loop
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('id','rental-extra-day-' || (v_day->>'day'),
          'description',format('Day %s (%s) — %s',v_day->>'day',v_date + ((v_day->>'day')::integer-1),v_day->>'choice'),
          'quantity',1,'unitPrice',(v_day->>'amount')::numeric));
      end loop;
    end if;
    select coalesce(sum(amount_cents),0)/100.0 into v_paid from public.booking_payment_entries
      where booking_kind = 'rental' and booking_id = p_id and status = 'posted';
    update public.booking_invoices set
      payload = payload || jsonb_build_object('lineItems',v_lines,'eventDate',v_date,'dueDate',v_date,
        'paymentsReceived',v_paid),
      subtotal = subtotal + v_delta, total = total + v_delta,
      balance_due = greatest(0,total + v_delta - v_paid), updated_at = now()
    where booking_kind = 'rental' and booking_id = p_id;
  end if;
  return to_jsonb(v_new);
end; $$;
revoke all on function public.lock_rental_reservations(), public.assert_rental_reservation(text), public.check_rental_reservation(),
  public.edit_rental_booking_atomic(text,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.edit_rental_booking_atomic(text,jsonb,jsonb,jsonb) to service_role;
