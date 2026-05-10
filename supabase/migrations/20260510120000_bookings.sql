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

-- Atomic insert with overlap check (avoids double-booking races).
CREATE OR REPLACE FUNCTION public.create_rental_booking(
  p_rental_slug text,
  p_rental_name text,
  p_customer_name text,
  p_email text,
  p_phone text,
  p_event_date date,
  p_duration text,
  p_span_days integer,
  p_event_address text,
  p_subtotal numeric,
  p_total numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_end date;
BEGIN
  IF p_span_days IS NULL OR p_span_days < 1 THEN
    RAISE EXCEPTION 'invalid_span_days';
  END IF;

  v_end := p_event_date + (p_span_days - 1);

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.rental_slug = p_rental_slug
      AND b.status IN ('pending', 'approved', 'blocked')
      AND b.event_date <= v_end
      AND (b.event_date + (b.span_days - 1)) >= p_event_date
  ) THEN
    RAISE EXCEPTION 'date_conflict';
  END IF;

  INSERT INTO public.bookings (
    rental_slug,
    rental_name,
    customer_name,
    email,
    phone,
    event_date,
    duration,
    span_days,
    event_address,
    subtotal,
    total,
    status
  )
  VALUES (
    p_rental_slug,
    p_rental_name,
    p_customer_name,
    p_email,
    p_phone,
    p_event_date,
    p_duration,
    p_span_days,
    p_event_address,
    p_subtotal,
    p_total,
    'pending'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_rental_booking(
  text, text, text, text, text, date, text, integer, text, numeric, numeric
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_rental_booking(
  text, text, text, text, text, date, text, integer, text, numeric, numeric
) TO service_role;
