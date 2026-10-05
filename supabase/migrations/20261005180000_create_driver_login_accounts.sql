begin;

create table if not exists public.driver_login_accounts (
  username text primary key check (username = lower(btrim(username)) and length(username) between 1 and 100),
  display_name text not null check (length(btrim(display_name)) between 1 and 100),
  password_hash text not null check (password_hash ~ '^[a-f0-9]{64}$'),
  password_salt text not null check (password_salt ~ '^[a-f0-9]{32}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.driver_login_accounts is
  'Individual driver-app logins. Does not grant staff admin access. Disable or delete temporary accounts after testing.';

alter table public.driver_login_accounts enable row level security;
revoke all on public.driver_login_accounts from anon, authenticated;
grant all on public.driver_login_accounts to service_role;

commit;
