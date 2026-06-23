alter table public.booking_rental_items
  add column if not exists delivery_date date,
  add column if not exists trailer_load integer;
