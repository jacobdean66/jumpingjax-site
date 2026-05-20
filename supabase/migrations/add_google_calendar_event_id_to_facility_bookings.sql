alter table public.facility_bookings
add column if not exists google_calendar_event_id text;
