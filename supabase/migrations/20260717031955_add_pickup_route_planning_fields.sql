-- Pickup / take-down operational fields for multi-day route planning.
-- Nullable for backward compatibility; effective pickup date falls back to
-- event_date + (span_days - 1) when pickup_date is null.

alter table public.booking_rental_items
  add column if not exists pickup_date date,
  add column if not exists pickup_time time,
  add column if not exists pickup_truck text,
  add column if not exists pickup_trailer_load integer,
  add column if not exists pickup_sequence integer,
  add column if not exists pickup_route_status text,
  add column if not exists pickup_route_notes text;

create index if not exists booking_rental_items_pickup_route_idx
  on public.booking_rental_items (pickup_date, pickup_truck, pickup_trailer_load, pickup_sequence);
