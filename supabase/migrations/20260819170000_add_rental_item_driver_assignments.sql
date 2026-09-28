alter table public.booking_rental_items
  add column if not exists delivery_driver text,
  add column if not exists pickup_driver text;
