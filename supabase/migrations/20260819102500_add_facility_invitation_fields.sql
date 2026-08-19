alter table public.facility_bookings
  add column if not exists invitation_delivery_preference text not null default 'print'
    check (invitation_delivery_preference in ('print', 'email', 'office_pickup'));

alter table public.facility_bookings
  add column if not exists invitation_template_id text not null default 'spotlight'
    check (invitation_template_id in ('spotlight', 'ticket', 'poster'));

comment on column public.facility_bookings.invitation_delivery_preference is
  'How the customer wants facility birthday party invitations prepared: print, email, or office pickup.';

comment on column public.facility_bookings.invitation_template_id is
  'Which facility birthday party invitation design the customer selected.';
