create table if not exists public.booking_payment_entries (
  id uuid primary key default gen_random_uuid(),
  booking_kind text not null check (booking_kind in ('rental', 'facility')),
  booking_id text not null,
  entry_type text not null check (entry_type in ('facility_deposit', 'rental_payment')),
  payment_method text not null check (payment_method in ('card', 'cash', 'check', 'other')),
  amount_cents integer not null check (amount_cents > 0),
  processing_fee_cents integer not null default 0 check (processing_fee_cents >= 0),
  processor_reference text,
  recorded_by text not null,
  receipt_email text,
  receipt_email_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists booking_payment_entries_booking_idx
  on public.booking_payment_entries (booking_kind, booking_id, created_at desc);

alter table public.booking_payment_entries enable row level security;
revoke all on public.booking_payment_entries from anon, authenticated;
