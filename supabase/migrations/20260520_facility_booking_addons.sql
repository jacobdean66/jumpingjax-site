ALTER TABLE public.facility_bookings
ADD COLUMN IF NOT EXISTS addon_selections jsonb NULL;

COMMENT ON COLUMN public.facility_bookings.addon_selections IS
  'Optional party add-ons: customer selections plus server-resolved line items and subtotal.';
