begin;
alter table public.driver_location_sessions
  add column if not exists vehicle text check (vehicle in ('dodge', 'ford')),
  add column if not exists trailer text check (trailer in ('truck-1', 'truck-2'));
alter table public.driver_location_points
  add column if not exists vehicle text check (vehicle in ('dodge', 'ford')),
  add column if not exists trailer text check (trailer in ('truck-1', 'truck-2'));
alter table public.driver_location_snapshots
  add column if not exists vehicle text check (vehicle in ('dodge', 'ford'));
create index if not exists driver_location_points_history_idx
  on public.driver_location_points (captured_at, id);
create index if not exists driver_location_points_driver_history_idx
  on public.driver_location_points (driver_id, captured_at, id);
create index if not exists driver_location_points_session_captured_idx
  on public.driver_location_points (session_id, captured_at desc);
create index if not exists driver_location_snapshots_history_idx
  on public.driver_location_snapshots (captured_at, id);
comment on column public.driver_location_snapshots.truck is 'Legacy field: selected trailer, truck-1 = Short Trailer, truck-2 = Long Trailer. Vehicle is recorded separately.';
commit;
