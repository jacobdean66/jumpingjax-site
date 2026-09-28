do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.booking_payment_entries'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%entry_type%'
    and pg_get_constraintdef(oid) like '%facility_deposit%'
    and pg_get_constraintdef(oid) like '%rental_payment%'
  limit 1;

  if constraint_name is not null then
    execute format(
      'alter table public.booking_payment_entries drop constraint %I',
      constraint_name
    );
  end if;
end $$;

alter table public.booking_payment_entries
  add constraint booking_payment_entries_entry_type_check
  check (entry_type in ('facility_deposit', 'facility_balance', 'rental_payment'));
