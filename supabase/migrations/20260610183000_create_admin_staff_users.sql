create table if not exists public.admin_staff_users (
  id text primary key,
  username text not null unique,
  display_name text not null,
  role text not null check (role in ('owner', 'employee')),
  password_hash text not null,
  password_salt text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_staff_users enable row level security;

drop policy if exists "No public admin staff access" on public.admin_staff_users;
create policy "No public admin staff access"
on public.admin_staff_users
for all
using (false)
with check (false);
