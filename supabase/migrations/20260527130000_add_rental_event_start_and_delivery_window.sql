alter table public.bookings
  add column if not exists event_start_time time,
  add column if not exists requested_delivery_window text;
