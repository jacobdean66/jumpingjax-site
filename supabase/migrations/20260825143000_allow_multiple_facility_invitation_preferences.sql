do $$
declare
  constraint_name text;
begin
  select conname
    into constraint_name
  from pg_constraint
  where conrelid = 'public.facility_bookings'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%invitation_delivery_preference%';

  if constraint_name is not null then
    execute format(
      'alter table public.facility_bookings drop constraint %I',
      constraint_name
    );
  end if;
end $$;

alter table public.facility_bookings
  add constraint facility_bookings_invitation_delivery_preference_check
  check (
    invitation_delivery_preference ~
    '^(print|email|office_pickup)(,(print|email|office_pickup))*$'
  );

comment on column public.facility_bookings.invitation_delivery_preference is
  'Comma-separated invitation delivery choices: print, email, office_pickup.';
