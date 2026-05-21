CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  rental_item text NOT NULL,
  rental_name text,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  event_date date NOT NULL,
  duration text,
  span_days integer NOT NULL DEFAULT 1,
  event_address text,
  subtotal numeric,
  total numeric,
  status text NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS bookings_status_idx
  ON public.bookings (status);

CREATE INDEX IF NOT EXISTS bookings_event_date_idx
  ON public.bookings (event_date);

CREATE INDEX IF NOT EXISTS bookings_rental_item_idx
  ON public.bookings (rental_item);
