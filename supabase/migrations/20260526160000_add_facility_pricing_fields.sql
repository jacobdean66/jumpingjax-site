ALTER TABLE public.facility_bookings
ADD COLUMN IF NOT EXISTS facility_package_price numeric(12, 2) NULL,
ADD COLUMN IF NOT EXISTS addon_subtotal numeric(12, 2) NULL,
ADD COLUMN IF NOT EXISTS subtotal numeric(12, 2) NULL,
ADD COLUMN IF NOT EXISTS tax numeric(12, 2) NULL,
ADD COLUMN IF NOT EXISTS total numeric(12, 2) NULL,
ADD COLUMN IF NOT EXISTS pricing_details jsonb NULL;

COMMENT ON COLUMN public.facility_bookings.facility_package_price IS
  'Base facility party package price before add-ons and tax.';

COMMENT ON COLUMN public.facility_bookings.addon_subtotal IS
  'Facility party add-ons subtotal before tax.';

COMMENT ON COLUMN public.facility_bookings.subtotal IS
  'Facility party package plus add-ons before tax.';

COMMENT ON COLUMN public.facility_bookings.tax IS
  'Facility party sales tax estimate.';

COMMENT ON COLUMN public.facility_bookings.total IS
  'Facility party estimated total including tax.';

COMMENT ON COLUMN public.facility_bookings.pricing_details IS
  'Facility party pricing metadata such as tax rate and pricing source.';
