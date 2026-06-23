create table if not exists public.inventory_damage_reports (
  id uuid primary key default gen_random_uuid(),
  reported_at timestamptz not null default now(),
  reported_by text,
  item_type text not null default 'Other',
  item_name text not null,
  issue_summary text not null,
  severity text not null default 'Needs review',
  status text not null default 'Open',
  related_booking_id text,
  action_needed text,
  notes text
);

create index if not exists inventory_damage_reports_reported_at_idx
  on public.inventory_damage_reports (reported_at desc);

create index if not exists inventory_damage_reports_status_idx
  on public.inventory_damage_reports (status);
