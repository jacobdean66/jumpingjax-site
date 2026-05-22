-- Child rows for multiple rental items per booking request.
-- Parent public.bookings columns are unchanged; existing rows are backfilled below.

CREATE TABLE IF NOT EXISTS public.booking_rental_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id bigint NOT NULL REFERENCES public.bookings (id) ON DELETE CASCADE,
  rental_item text NOT NULL,
  rental_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_rental_items_booking_id_rental_item_key
    UNIQUE (booking_id, rental_item)
);

CREATE INDEX IF NOT EXISTS booking_rental_items_rental_item_idx
  ON public.booking_rental_items (rental_item);

INSERT INTO public.booking_rental_items (booking_id, rental_item, rental_name)
SELECT b.id, b.rental_item, b.rental_name
FROM public.bookings AS b
WHERE b.rental_item IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.booking_rental_items AS bri
    WHERE bri.booking_id = b.id
      AND bri.rental_item = b.rental_item
  );
