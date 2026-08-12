-- AI receptionist Phase 1: sessions, audit, booking attempts, payment stubs,
-- marketing consent CRM, and birthday offer ledgers.
-- Additive only. Does not mutate waiver_* tables.

create extension if not exists pgcrypto;

create or replace function public.ai_receptionist_prevent_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------------
-- Call sessions + audit
-- ---------------------------------------------------------------------------

create table if not exists public.ai_receptionist_call_sessions (
  id uuid primary key default gen_random_uuid(),
  caller_e164 text null,
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  disposition text null
    check (
      disposition is null
      or disposition in ('completed', 'escalated', 'abandoned', 'failed')
    ),
  escalation_reason text null,
  disclosure_version text not null default 'v1-2026-08-11',
  created_at timestamptz not null default now()
);

create table if not exists public.ai_receptionist_audit_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid null
    references public.ai_receptionist_call_sessions (id)
    on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_receptionist_audit_events_session_id_idx
  on public.ai_receptionist_audit_events (session_id, created_at);

drop trigger if exists ai_receptionist_audit_events_no_update on public.ai_receptionist_audit_events;
create trigger ai_receptionist_audit_events_no_update
  before update or delete on public.ai_receptionist_audit_events
  for each row
  execute function public.ai_receptionist_prevent_mutation();

create table if not exists public.ai_receptionist_booking_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid null
    references public.ai_receptionist_call_sessions (id)
    on delete set null,
  idempotency_key text not null unique,
  booking_id uuid null,
  status text not null
    check (status in ('pending', 'succeeded', 'failed', 'conflict')),
  error_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_receptionist_payment_link_stubs (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  session_id uuid null
    references public.ai_receptionist_call_sessions (id)
    on delete set null,
  booking_id uuid null,
  amount_cents integer null check (amount_cents is null or amount_cents >= 0),
  simulated_url text not null,
  expires_at timestamptz not null,
  charged boolean not null default false check (charged = false),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Marketing consent CRM (separate from immutable waiver consent)
-- ---------------------------------------------------------------------------

create table if not exists public.marketing_contacts (
  id uuid primary key default gen_random_uuid(),
  email_normalized text null,
  phone_e164 text null,
  display_name text null,
  sms_marketing_opt_in boolean not null default false,
  email_marketing_opt_in boolean not null default false,
  sms_opt_in_at timestamptz null,
  email_opt_in_at timestamptz null,
  sms_opted_out_at timestamptz null,
  email_opted_out_at timestamptz null,
  opt_out_reason text null,
  consent_source text null,
  latest_waiver_submission_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_contacts_has_identity
    check (email_normalized is not null or phone_e164 is not null)
);

create unique index if not exists marketing_contacts_email_normalized_uidx
  on public.marketing_contacts (email_normalized)
  where email_normalized is not null;

create unique index if not exists marketing_contacts_phone_e164_uidx
  on public.marketing_contacts (phone_e164)
  where phone_e164 is not null;

create table if not exists public.marketing_consent_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null
    references public.marketing_contacts (id)
    on delete cascade,
  channel text not null check (channel in ('sms', 'email')),
  action text not null check (action in ('opt_in', 'opt_out')),
  evidence jsonb not null default '{}'::jsonb,
  actor text null,
  created_at timestamptz not null default now()
);

drop trigger if exists marketing_consent_events_no_update on public.marketing_consent_events;
create trigger marketing_consent_events_no_update
  before update or delete on public.marketing_consent_events
  for each row
  execute function public.ai_receptionist_prevent_mutation();

-- ---------------------------------------------------------------------------
-- Birthday offers
-- ---------------------------------------------------------------------------

create table if not exists public.birthday_offer_exclusions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid null
    references public.marketing_contacts (id)
    on delete cascade,
  child_fingerprint text null,
  reason text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint birthday_offer_exclusions_target
    check (contact_id is not null or child_fingerprint is not null)
);

create table if not exists public.birthday_offer_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  discount_percent integer not null check (discount_percent > 0 and discount_percent <= 100),
  weeks_before integer not null default 6 check (weeks_before > 0),
  expires_after_days integer not null default 14 check (expires_after_days > 0),
  channel_preference text not null default 'sms_then_email'
    check (channel_preference in ('sms_then_email', 'email_then_sms', 'sms', 'email')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.birthday_offer_campaigns (
  name, discount_percent, weeks_before, expires_after_days, channel_preference, active
)
select
  'Default 20% rental birthday offer',
  20,
  6,
  14,
  'sms_then_email',
  true
where not exists (
  select 1 from public.birthday_offer_campaigns where name = 'Default 20% rental birthday offer'
);

create table if not exists public.birthday_offer_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid null
    references public.birthday_offer_campaigns (id)
    on delete set null,
  contact_id uuid not null
    references public.marketing_contacts (id)
    on delete cascade,
  child_fingerprint text not null,
  child_first_name text not null,
  child_dob date not null,
  offer_year integer not null,
  scheduled_for date not null,
  sent_at timestamptz null,
  channel text not null check (channel in ('sms', 'email')),
  provider_message_id text null,
  status text not null
    check (status in ('pending', 'simulated', 'sent', 'failed', 'suppressed')),
  offer_code text not null,
  expires_on date not null,
  source_submission_id uuid null,
  suppress_reason text null,
  created_at timestamptz not null default now(),
  unique (contact_id, child_fingerprint, offer_year)
);

create table if not exists public.birthday_offer_redemptions (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null
    references public.birthday_offer_deliveries (id)
    on delete cascade,
  redeemed_at timestamptz not null default now(),
  staff_id text null,
  booking_id uuid null,
  notes text null
);

-- ---------------------------------------------------------------------------
-- Read-only birthday candidate helper (service_role only)
-- ---------------------------------------------------------------------------

create or replace function public.ai_receptionist_list_birthday_candidates(
  p_on date,
  p_weeks integer default 6
)
returns table (
  participant_id uuid,
  submission_id uuid,
  child_first_name text,
  child_last_name text,
  child_dob date,
  next_birthday date,
  offer_date date,
  signer_email text,
  signer_phone text,
  signer_first_name text,
  signer_last_name text,
  waiver_expires_on date
)
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select
      p.id as participant_id,
      s.id as submission_id,
      p.first_name as child_first_name,
      p.last_name as child_last_name,
      p.dob as child_dob,
      (
        make_date(
          extract(year from p_on)::int
            + case
                when to_char(p.dob, 'MM-DD') < to_char(p_on, 'MM-DD') then 1
                else 0
              end,
          extract(month from p.dob)::int,
          least(
            extract(day from p.dob)::int,
            extract(
              day from (
                date_trunc('month', make_date(
                  extract(year from p_on)::int
                    + case
                        when to_char(p.dob, 'MM-DD') < to_char(p_on, 'MM-DD') then 1
                        else 0
                      end,
                  extract(month from p.dob)::int,
                  1
                )) + interval '1 month - 1 day'
              )
            )::int
          )
        )
      ) as next_birthday,
      s.signer_email,
      s.signer_phone,
      s.signer_first_name,
      s.signer_last_name,
      s.expires_on as waiver_expires_on
    from public.waiver_participants p
    join public.waiver_submissions s on s.id = p.submission_id
    where p.role = 'child'
      and s.status = 'completed'
      and s.expires_on > p_on
  )
  select
    c.participant_id,
    c.submission_id,
    c.child_first_name,
    c.child_last_name,
    c.child_dob,
    c.next_birthday,
    (c.next_birthday - (p_weeks * 7)) as offer_date,
    c.signer_email,
    c.signer_phone,
    c.signer_first_name,
    c.signer_last_name,
    c.waiver_expires_on
  from candidates c
  where (c.next_birthday - (p_weeks * 7)) = p_on;
$$;

revoke all on function public.ai_receptionist_list_birthday_candidates(date, integer) from public;
revoke all on function public.ai_receptionist_list_birthday_candidates(date, integer) from anon, authenticated;
grant execute on function public.ai_receptionist_list_birthday_candidates(date, integer) to service_role;

-- ---------------------------------------------------------------------------
-- RLS deny-all for anon/authenticated; service_role bypasses RLS
-- ---------------------------------------------------------------------------

alter table public.ai_receptionist_call_sessions enable row level security;
alter table public.ai_receptionist_audit_events enable row level security;
alter table public.ai_receptionist_booking_attempts enable row level security;
alter table public.ai_receptionist_payment_link_stubs enable row level security;
alter table public.marketing_contacts enable row level security;
alter table public.marketing_consent_events enable row level security;
alter table public.birthday_offer_exclusions enable row level security;
alter table public.birthday_offer_campaigns enable row level security;
alter table public.birthday_offer_deliveries enable row level security;
alter table public.birthday_offer_redemptions enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'ai_receptionist_call_sessions',
    'ai_receptionist_audit_events',
    'ai_receptionist_booking_attempts',
    'ai_receptionist_payment_link_stubs',
    'marketing_contacts',
    'marketing_consent_events',
    'birthday_offer_exclusions',
    'birthday_offer_campaigns',
    'birthday_offer_deliveries',
    'birthday_offer_redemptions'
  ]
  loop
    execute format(
      'drop policy if exists "No public %1$s access" on public.%1$I',
      t
    );
    execute format(
      'create policy "No public %1$s access" on public.%1$I for all to anon, authenticated using (false) with check (false)',
      t
    );
  end loop;
end $$;
