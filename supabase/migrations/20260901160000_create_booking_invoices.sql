create table if not exists public.booking_invoices (
  id uuid primary key default gen_random_uuid(),
  booking_kind text not null check (booking_kind in ('rental', 'facility', 'standalone')),
  booking_id text not null,
  invoice_number text not null,
  customer_email text null,
  payload jsonb not null,
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  last_emailed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_kind, booking_id)
);

alter table public.booking_invoices enable row level security;

revoke all on public.booking_invoices from anon, authenticated;

create index if not exists booking_invoices_customer_email_idx
  on public.booking_invoices (customer_email);

comment on table public.booking_invoices is
  'Editable staff invoices attached to rental, foam, and facility booking cards.';
