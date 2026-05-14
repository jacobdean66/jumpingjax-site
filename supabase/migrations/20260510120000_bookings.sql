-- Rental booking requests (Jumping Jax). RLS enabled with no policies so only
-- the service role (used from Next.js server code) can read/write.

CREATE TYPE public.booking_status AS ENUM ('pending', 'approved', 'blocked');

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  rental_slug text NOT NULL,
  rental_name text NOT NULL,
  customer_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  event_date date NOT NULL,
  duration text NOT NULL,
  span_days integer NOT NULL CHECK (span_days >= 1 AND span_days <= 30),
  event_address text NOT NULL,
  subtotal numeric(12, 2) NOT NULL CHECK (subtotal >= 0),
  total numeric(12, 2) NOT NULL CHECK (total >= 0),
  status public.booking_status NOT NULL DEFAULT 'pending'
);

CREATE INDEX bookings_rental_slug_event_date_idx
  ON public.bookings (rental_slug, event_date);

CREATE INDEX bookings_status_idx
  ON public.bookings (status);

COMMENT ON TABLE public.bookings IS 'Customer rental requests and admin holds; overlap prevention for pending/approved/blocked.';

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
