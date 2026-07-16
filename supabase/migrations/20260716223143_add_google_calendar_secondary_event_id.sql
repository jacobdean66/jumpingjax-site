-- Separate Google Calendar event IDs for secondary calendar destinations
-- (e.g. a shared calendar identified by email). Idempotent sync stores one
-- event id per destination so edits do not create duplicates.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS google_calendar_secondary_event_id text;

ALTER TABLE public.facility_bookings
  ADD COLUMN IF NOT EXISTS google_calendar_secondary_event_id text;

COMMENT ON COLUMN public.bookings.google_calendar_secondary_event_id IS
  'Google Calendar event id on the secondary configured calendar destination';

COMMENT ON COLUMN public.facility_bookings.google_calendar_secondary_event_id IS
  'Google Calendar event id on the secondary configured calendar destination';
