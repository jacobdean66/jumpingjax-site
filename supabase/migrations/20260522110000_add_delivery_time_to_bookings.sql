ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS delivery_time time;
