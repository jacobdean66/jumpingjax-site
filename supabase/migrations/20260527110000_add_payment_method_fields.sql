alter table public.bookings
  add column if not exists payment_method text;

alter table public.facility_bookings
  add column if not exists payment_method text,
  add column if not exists deposit_acknowledged boolean not null default false;
