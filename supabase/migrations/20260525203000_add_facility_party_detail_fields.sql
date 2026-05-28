ALTER TABLE public.facility_bookings
ADD COLUMN IF NOT EXISTS parent_name text NULL,
ADD COLUMN IF NOT EXISTS child_name text NULL,
ADD COLUMN IF NOT EXISTS child_gender text NULL,
ADD COLUMN IF NOT EXISTS child_age text NULL,
ADD COLUMN IF NOT EXISTS party_theme text NULL,
ADD COLUMN IF NOT EXISTS balloon_colors text NULL,
ADD COLUMN IF NOT EXISTS table_cloth_colors text NULL,
ADD COLUMN IF NOT EXISTS drink_choice text NULL;

COMMENT ON COLUMN public.facility_bookings.parent_name IS
  'Parent or guardian name for the facility party booking.';

COMMENT ON COLUMN public.facility_bookings.child_name IS
  'Birthday child name for the facility party.';

COMMENT ON COLUMN public.facility_bookings.child_gender IS
  'Birthday child gender as provided by the customer.';

COMMENT ON COLUMN public.facility_bookings.child_age IS
  'Birthday child age as provided by the customer.';

COMMENT ON COLUMN public.facility_bookings.party_theme IS
  'Typed party theme choice.';

COMMENT ON COLUMN public.facility_bookings.balloon_colors IS
  'Requested balloon color choices.';

COMMENT ON COLUMN public.facility_bookings.table_cloth_colors IS
  'Requested table cloth color choices.';

COMMENT ON COLUMN public.facility_bookings.drink_choice IS
  'Selected party drink choice.';
