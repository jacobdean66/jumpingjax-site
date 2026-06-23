create table if not exists public.driver_closeout_reports (
  id uuid primary key default gen_random_uuid(),
  booking_id text not null,
  event_date date not null,
  truck text not null,
  driver_name text,
  damage_issue boolean not null default false,
  missing_item_issue boolean not null default false,
  customer_issue boolean not null default false,
  site_access_issue boolean not null default false,
  late_pickup_issue boolean not null default false,
  office_followup_needed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists driver_closeout_reports_booking_truck_idx
  on public.driver_closeout_reports (booking_id, truck);

create index if not exists driver_closeout_reports_event_date_idx
  on public.driver_closeout_reports (event_date);

create index if not exists driver_closeout_reports_truck_idx
  on public.driver_closeout_reports (truck);
