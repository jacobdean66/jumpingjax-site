-- App now inserts directly into public.bookings via service role; RPC is unused.
DROP FUNCTION IF EXISTS public.create_rental_booking(
  text, text, text, text, text, date, text, integer, text, numeric, numeric
);
