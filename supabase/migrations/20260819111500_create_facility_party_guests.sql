create table if not exists public.facility_party_guests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null
    references public.facility_bookings (id)
    on delete cascade,
  waiver_submission_id uuid not null
    references public.waiver_submissions (id)
    on delete restrict,
  waiver_participant_id uuid not null
    references public.waiver_participants (id)
    on delete restrict,
  guest_first_name text not null
    check (length(trim(guest_first_name)) > 0 and length(guest_first_name) <= 80),
  guest_last_name text not null
    check (length(trim(guest_last_name)) > 0 and length(guest_last_name) <= 80),
  guest_dob date not null,
  signer_first_name text not null
    check (length(trim(signer_first_name)) > 0 and length(signer_first_name) <= 80),
  signer_last_name text not null
    check (length(trim(signer_last_name)) > 0 and length(signer_last_name) <= 80),
  waiver_expires_on date not null,
  participant_role text not null
    check (participant_role in ('child', 'adult_signer', 'adult_covered')),
  checked_in_at timestamptz null,
  checked_in_by text null
    check (checked_in_by is null or length(trim(checked_in_by)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, waiver_participant_id)
);

alter table public.facility_party_guests enable row level security;

create index if not exists facility_party_guests_booking_idx
  on public.facility_party_guests (booking_id, created_at);

create index if not exists facility_party_guests_checked_in_idx
  on public.facility_party_guests (booking_id, checked_in_at);

