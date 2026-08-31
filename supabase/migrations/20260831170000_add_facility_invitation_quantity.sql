alter table public.facility_bookings
  add column if not exists invitation_quantity integer not null default 4;

alter table public.facility_bookings
  drop constraint if exists facility_bookings_invitation_quantity_check;

alter table public.facility_bookings
  add constraint facility_bookings_invitation_quantity_check
  check (invitation_quantity in (4, 8, 12, 16, 20, 24, 28));

comment on column public.facility_bookings.invitation_quantity is
  'Requested printed invitation count, in complete four-up sheets.';
