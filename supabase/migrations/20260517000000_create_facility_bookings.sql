-- Facility party booking requests (public/private). RLS enabled; server role used from API routes.

CREATE TABLE IF NOT EXISTS public.facility_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  room text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  party_kind text NOT NULL,
  customer_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  notes text NULL,
  readable_date text NOT NULL,
  readable_time text NOT NULL,
  party_label text NOT NULL,
  addon_selections jsonb NULL,
  google_calendar_event_id text NULL
);

ALTER TABLE public.facility_bookings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS facility_bookings_status_idx
  ON public.facility_bookings (status);

CREATE INDEX IF NOT EXISTS facility_bookings_room_idx
  ON public.facility_bookings (room);

CREATE INDEX IF NOT EXISTS facility_bookings_start_time_idx
  ON public.facility_bookings (start_time);

CREATE INDEX IF NOT EXISTS facility_bookings_end_time_idx
  ON public.facility_bookings (end_time);

CREATE INDEX IF NOT EXISTS facility_bookings_google_calendar_event_id_idx
  ON public.facility_bookings (google_calendar_event_id);
