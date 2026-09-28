create table if not exists public.driver_location_snapshots (
  id uuid primary key default gen_random_uuid(),
  driver_id text not null,
  driver_name text not null,
  truck text null check (truck in ('truck-1', 'truck-2')),
  work_date date null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision null check (accuracy_meters is null or accuracy_meters >= 0),
  speed_meters_per_second double precision null check (speed_meters_per_second is null or speed_meters_per_second >= 0),
  heading_degrees double precision null check (
    heading_degrees is null or (heading_degrees >= 0 and heading_degrees <= 360)
  ),
  captured_at timestamptz not null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create index if not exists driver_location_snapshots_driver_created_idx
  on public.driver_location_snapshots (driver_id, created_at desc);

create index if not exists driver_location_snapshots_work_date_truck_idx
  on public.driver_location_snapshots (work_date, truck, created_at desc);

alter table public.driver_location_snapshots enable row level security;

drop policy if exists "driver location snapshots are service-role only" on public.driver_location_snapshots;
create policy "driver location snapshots are service-role only"
  on public.driver_location_snapshots
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

comment on table public.driver_location_snapshots is
  'Opt-in driver browser location snapshots for owner-only delivery operations. Service-role access only.';
