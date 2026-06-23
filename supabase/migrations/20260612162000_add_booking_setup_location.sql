alter table public.bookings
add column if not exists setup_location text null;

comment on column public.bookings.setup_location is
  'Customer-selected inflatable setup location such as front yard or back yard.';
