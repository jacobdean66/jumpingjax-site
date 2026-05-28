alter table public.bookings
  add column if not exists delivery_truck text,
  add column if not exists delivery_sequence integer,
  add column if not exists planned_arrival_time time,
  add column if not exists planned_setup_start time,
  add column if not exists planned_setup_end time,
  add column if not exists estimated_setup_minutes integer default 45,
  add column if not exists delivery_route_status text default 'unplanned',
  add column if not exists delivery_route_notes text;
