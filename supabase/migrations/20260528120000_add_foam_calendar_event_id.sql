alter table public.bookings
  add column if not exists google_foam_calendar_event_id text;
