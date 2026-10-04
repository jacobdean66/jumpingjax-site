create table if not exists public.driver_location_sessions (
  id uuid primary key default gen_random_uuid(),
  driver_id text not null,
  driver_name text not null,
  session_token_hash text not null unique,
  device_id text,
  device_label text,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz,
  signed_out_at timestamptz,
  sign_out_reason text,
  created_at timestamptz not null default now()
);

create index if not exists driver_location_sessions_driver_active_idx
  on public.driver_location_sessions (driver_id, signed_out_at, last_seen_at desc);

create table if not exists public.driver_location_points (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.driver_location_sessions(id) on delete cascade,
  driver_id text not null,
  driver_name text not null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_meters double precision,
  altitude_meters double precision,
  heading_degrees double precision,
  speed_meters_per_second double precision,
  battery_level double precision,
  captured_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists driver_location_points_session_received_idx
  on public.driver_location_points (session_id, received_at desc);

create index if not exists driver_location_points_driver_received_idx
  on public.driver_location_points (driver_id, received_at desc);

alter table public.driver_location_sessions enable row level security;
alter table public.driver_location_points enable row level security;

revoke all on public.driver_location_sessions from anon, authenticated;
revoke all on public.driver_location_points from anon, authenticated;

drop policy if exists "No public driver location session access"
  on public.driver_location_sessions;
create policy "No public driver location session access"
  on public.driver_location_sessions
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No public driver location point access"
  on public.driver_location_points;
create policy "No public driver location point access"
  on public.driver_location_points
  for all
  to anon, authenticated
  using (false)
  with check (false);
