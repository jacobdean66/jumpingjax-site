-- Keep customer booking data private.
-- Public forms write through Next.js server routes using the Supabase service role.

alter table public.booking_rental_items enable row level security;

drop policy if exists "bookings_anon_select" on public.bookings;
drop policy if exists "bookings_anon_insert" on public.bookings;
drop policy if exists "Enable insert for authenticated users only" on public.bookings;
