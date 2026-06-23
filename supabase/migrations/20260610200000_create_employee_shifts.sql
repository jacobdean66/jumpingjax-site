create table if not exists public.employee_shifts (
  id uuid primary key default gen_random_uuid(),
  employee_name text not null,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  role text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_shifts_shift_date_idx
on public.employee_shifts (shift_date);

alter table public.employee_shifts enable row level security;

drop policy if exists "No public employee shifts access" on public.employee_shifts;
create policy "No public employee shifts access"
on public.employee_shifts
for all
using (false)
with check (false);
