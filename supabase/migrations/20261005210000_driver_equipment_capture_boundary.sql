begin;
alter table public.driver_location_sessions
  add column if not exists equipment_selected_at timestamptz;
comment on column public.driver_location_sessions.equipment_selected_at is
  'Capture-time boundary for legacy app samples: never label earlier buffered locations with a later vehicle selection.';
commit;
