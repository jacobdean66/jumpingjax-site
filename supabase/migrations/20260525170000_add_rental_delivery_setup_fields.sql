ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS distance_miles numeric NULL,
ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 25,
ADD COLUMN IF NOT EXISTS mileage_fee numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS setup_surface text NULL,
ADD COLUMN IF NOT EXISTS setup_access text NULL,
ADD COLUMN IF NOT EXISTS setup_notes text NULL;

COMMENT ON COLUMN public.bookings.distance_miles IS
  'Estimated one-way delivery miles from 559 Beaudrot Rd, Greenwood, SC.';

COMMENT ON COLUMN public.bookings.delivery_fee IS
  'Estimated delivery fee for the order. Base fee is $25 plus mileage over 25 one-way miles.';

COMMENT ON COLUMN public.bookings.mileage_fee IS
  'Estimated mileage fee for one-way miles over 25 from the facility.';

COMMENT ON COLUMN public.bookings.setup_surface IS
  'Customer-selected setup surface for inflatable rentals.';

COMMENT ON COLUMN public.bookings.setup_access IS
  'Customer-selected delivery/setup access notes such as vehicle access or hand trucks required.';

COMMENT ON COLUMN public.bookings.setup_notes IS
  'Optional customer setup notes such as gate width, slope, stairs, or power location.';
