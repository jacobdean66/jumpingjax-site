alter table public.booking_payment_entries
  add column if not exists idempotency_key text,
  add column if not exists receipt_requested_at timestamptz,
  add column if not exists receipt_error_class text;

create unique index if not exists booking_payment_entries_idempotency_uidx
  on public.booking_payment_entries (idempotency_key)
  where idempotency_key is not null;

alter table public.booking_payment_entries enable row level security;
revoke all on public.booking_payment_entries from anon, authenticated;
