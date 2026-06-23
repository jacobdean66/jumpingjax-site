alter table public.bookings enable row level security;
alter table public.booking_rental_items enable row level security;
alter table public.facility_bookings enable row level security;

drop policy if exists "No public bookings access" on public.bookings;
create policy "No public bookings access"
  on public.bookings
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No public booking rental items access" on public.booking_rental_items;
create policy "No public booking rental items access"
  on public.booking_rental_items
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No public facility bookings access" on public.facility_bookings;
create policy "No public facility bookings access"
  on public.facility_bookings
  for all
  to anon, authenticated
  using (false)
  with check (false);

alter table public.driver_closeout_reports enable row level security;
drop policy if exists "No public driver closeout access" on public.driver_closeout_reports;
create policy "No public driver closeout access"
  on public.driver_closeout_reports
  for all
  to anon, authenticated
  using (false)
  with check (false);

alter table public.inventory_damage_reports enable row level security;
drop policy if exists "No public damage report access" on public.inventory_damage_reports;
create policy "No public damage report access"
  on public.inventory_damage_reports
  for all
  to anon, authenticated
  using (false)
  with check (false);

create index if not exists bookings_event_status_time_idx
  on public.bookings (event_date, status, event_start_time);

create index if not exists bookings_status_event_date_idx
  on public.bookings (status, event_date);

create index if not exists bookings_google_calendar_event_id_idx
  on public.bookings (google_calendar_event_id);

create index if not exists bookings_google_foam_calendar_event_id_idx
  on public.bookings (google_foam_calendar_event_id);

create index if not exists booking_rental_items_booking_id_idx
  on public.booking_rental_items (booking_id);

create index if not exists booking_rental_items_delivery_route_idx
  on public.booking_rental_items (delivery_date, delivery_truck, trailer_load, delivery_sequence);

create index if not exists facility_bookings_readable_date_status_idx
  on public.facility_bookings (readable_date, status);

create index if not exists facility_bookings_room_status_window_idx
  on public.facility_bookings (room, status, start_time, end_time);
