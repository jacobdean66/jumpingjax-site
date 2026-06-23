alter table public.bookings
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists payment_confirmed_by text,
  add column if not exists payment_confirmation_notes text;
