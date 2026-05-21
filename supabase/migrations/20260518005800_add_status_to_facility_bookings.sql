ALTER TABLE public.facility_bookings
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
