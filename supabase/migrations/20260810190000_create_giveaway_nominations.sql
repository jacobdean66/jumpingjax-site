create table if not exists public.giveaway_nominations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  nominator_name text not null,
  nominator_email text not null,
  child_name text not null,
  child_birth_month smallint not null check (child_birth_month between 1 and 12),
  child_birth_day smallint not null check (child_birth_day between 1 and 31),
  party_choice text not null check (party_choice in ('september_birthday', 'back_to_school')),
  nomination_reason text not null,
  permission_acknowledged boolean not null default false,
  confirmation_email_sent boolean not null default false,
  owner_email_sent boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.giveaway_nominations enable row level security;
revoke all on public.giveaway_nominations from anon, authenticated;

create index if not exists giveaway_nominations_created_at_idx
  on public.giveaway_nominations (created_at desc);

