create table if not exists public.giveaway_nominations (
  id uuid primary key,
  nominator_name text not null check (char_length(nominator_name) between 1 and 100),
  nominator_email text not null check (char_length(nominator_email) between 3 and 200),
  child_name text not null check (char_length(child_name) between 1 and 80),
  birthday text not null check (birthday ~ '^(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])$'),
  party_choice text not null check (
    party_choice in ('September birthday party', 'Back-to-school party')
  ),
  why_nominated text not null check (char_length(why_nominated) between 20 and 2000),
  source text not null default 'Nomination form',
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists giveaway_nominations_created_at_idx
  on public.giveaway_nominations (created_at desc);

alter table public.giveaway_nominations enable row level security;

revoke all on table public.giveaway_nominations from anon, authenticated;
grant select, insert, update, delete on table public.giveaway_nominations to service_role;

comment on table public.giveaway_nominations is
  'Durable owner-only storage for Free Party Giveaway nomination responses.';



