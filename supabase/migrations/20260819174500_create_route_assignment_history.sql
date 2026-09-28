create table if not exists public.route_assignment_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  operation text not null,
  booking_id bigint not null,
  item_id text not null,
  work_type text not null,
  work_date date,
  truck text,
  driver_name text,
  trailer_load integer,
  sequence integer,
  route_status text,
  route_notes text,
  customer_name text,
  rental_name text,
  event_address text,
  event_date date,
  search_document text not null default ''
);

create index if not exists route_assignment_history_created_at_idx
  on public.route_assignment_history (created_at desc);

create index if not exists route_assignment_history_item_id_idx
  on public.route_assignment_history (item_id);

create index if not exists route_assignment_history_booking_id_idx
  on public.route_assignment_history (booking_id);
