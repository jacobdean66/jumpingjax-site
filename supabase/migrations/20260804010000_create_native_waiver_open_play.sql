-- Native waiver + Open Play foundation (additive only).
-- Created locally; NOT applied by agents. Owner/ops apply separately.
-- Corrected for transactional RPCs, immutability, ledger integrity, and token hashing.
-- Legal note: three-year calendar expiration requires attorney/insurer confirmation.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.prevent_append_only_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only and cannot be updated or deleted', tg_table_name
    using errcode = 'P0001';
end;
$$;

create or replace function public.prevent_published_waiver_version_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'waiver_template_versions cannot be deleted after publish'
      using errcode = 'P0001';
  end if;
  if new.body_html is distinct from old.body_html
     or new.body_sha256 is distinct from old.body_sha256
     or new.version_number is distinct from old.version_number
     or new.template_id is distinct from old.template_id
     or new.published_at is distinct from old.published_at
     or new.published_by_staff_id is distinct from old.published_by_staff_id then
    raise exception 'published waiver_template_versions body/version metadata are immutable'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.jj_expires_on_from_signed_at(p_signed_at timestamptz)
returns date
language plpgsql
immutable
as $$
declare
  v_local_date date;
  y integer;
  m integer;
  d integer;
  v_last integer;
begin
  v_local_date := (p_signed_at at time zone 'America/New_York')::date;
  y := extract(year from v_local_date)::integer + 3;
  m := extract(month from v_local_date)::integer;
  d := extract(day from v_local_date)::integer;
  v_last := extract(day from (make_date(y, m, 1) + interval '1 month - 1 day'))::integer;
  if d > v_last then
    d := v_last;
  end if;
  return make_date(y, m, d);
end;
$$;

create or replace function public.jj_age_years_on_date(p_dob date, p_on date)
returns integer
language plpgsql
immutable
as $$
begin
  if p_on < p_dob then
    raise exception 'visit_date_before_dob' using errcode = '22023';
  end if;
  return extract(year from age(p_on, p_dob))::integer;
end;
$$;

create or replace function public.jj_open_play_unit_price(p_classification text)
returns integer
language sql
immutable
as $$
  select case p_classification
    when 'child_2_or_under' then 700
    when 'child_3_plus' then 1000
    when 'playing_adult' then 700
    when 'watching_adult' then 0
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- Waiver templates / versions
-- ---------------------------------------------------------------------------
create table if not exists public.waiver_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (length(trim(slug)) > 0 and length(slug) <= 80),
  title text not null
    check (length(trim(title)) > 0 and length(title) <= 200),
  status text not null default 'active'
    check (status in ('active', 'archived')),
  current_version_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.waiver_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null
    references public.waiver_templates (id)
    on delete restrict,
  version_number integer not null
    check (version_number >= 1),
  body_html text not null
    check (length(trim(body_html)) > 0),
  body_sha256 text not null
    check (body_sha256 ~ '^[a-f0-9]{64}$'),
  published_at timestamptz not null default now(),
  published_by_staff_id text null
    check (published_by_staff_id is null or length(trim(published_by_staff_id)) > 0),
  created_at timestamptz not null default now(),
  unique (template_id, version_number)
);

alter table public.waiver_templates
  drop constraint if exists waiver_templates_current_version_fk;
alter table public.waiver_templates
  add constraint waiver_templates_current_version_fk
  foreign key (current_version_id)
  references public.waiver_template_versions (id)
  on delete set null;

create or replace function public.enforce_waiver_template_current_version()
returns trigger
language plpgsql
as $$
declare
  v_template_id uuid;
begin
  if new.current_version_id is null then
    return new;
  end if;
  select template_id into v_template_id
  from public.waiver_template_versions
  where id = new.current_version_id;
  if v_template_id is null or v_template_id is distinct from new.id then
    raise exception 'current_version_id must belong to the same template'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_waiver_template_current_version_trg on public.waiver_templates;
create trigger enforce_waiver_template_current_version_trg
  before insert or update of current_version_id on public.waiver_templates
  for each row
  execute function public.enforce_waiver_template_current_version();

drop trigger if exists prevent_waiver_template_version_mutation
  on public.waiver_template_versions;
create trigger prevent_waiver_template_version_mutation
  before update or delete on public.waiver_template_versions
  for each row
  execute function public.prevent_published_waiver_version_mutation();

-- ---------------------------------------------------------------------------
-- Submissions / participants / signatures / documents
-- ---------------------------------------------------------------------------
create table if not exists public.waiver_submissions (
  id uuid primary key default gen_random_uuid(),
  public_token_hash text not null unique
    check (public_token_hash ~ '^[a-f0-9]{64}$'),
  idempotency_key text not null unique
    check (length(trim(idempotency_key)) >= 16 and length(idempotency_key) <= 128),
  request_hash text not null
    check (request_hash ~ '^[a-f0-9]{64}$'),
  template_id uuid not null
    references public.waiver_templates (id)
    on delete restrict,
  template_version_id uuid not null
    references public.waiver_template_versions (id)
    on delete restrict,
  signer_first_name text not null
    check (length(trim(signer_first_name)) > 0 and length(signer_first_name) <= 80),
  signer_last_name text not null
    check (length(trim(signer_last_name)) > 0 and length(signer_last_name) <= 80),
  signer_email text not null
    check (length(trim(signer_email)) > 0 and length(signer_email) <= 254),
  signer_phone text not null
    check (length(trim(signer_phone)) > 0 and length(signer_phone) <= 40),
  signed_at timestamptz not null,
  expires_on date not null,
  token_expires_at timestamptz not null,
  source text not null
    check (source in ('web', 'kiosk', 'import')),
  status text not null default 'completed'
    check (status in ('completed', 'voided')),
  smartwaiver_external_id text null
    check (smartwaiver_external_id is null or length(trim(smartwaiver_external_id)) > 0),
  created_at timestamptz not null default now(),
  constraint waiver_submissions_expires_matches_signed_at
    check (expires_on = public.jj_expires_on_from_signed_at(signed_at))
);

create unique index if not exists waiver_submissions_smartwaiver_external_id_uidx
  on public.waiver_submissions (smartwaiver_external_id)
  where smartwaiver_external_id is not null;

create or replace function public.enforce_waiver_submission_version_binding()
returns trigger
language plpgsql
as $$
declare
  v_template_id uuid;
  v_status text;
  v_current uuid;
begin
  select v.template_id, t.status, t.current_version_id
    into v_template_id, v_status, v_current
  from public.waiver_template_versions v
  join public.waiver_templates t on t.id = v.template_id
  where v.id = new.template_version_id;

  if v_template_id is null then
    raise exception 'template_version_not_found' using errcode = '23503';
  end if;
  if v_template_id is distinct from new.template_id then
    raise exception 'template_version_template_mismatch' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and new.status = 'completed' then
    if v_status is distinct from 'active' then
      raise exception 'template_inactive' using errcode = 'P0001';
    end if;
    if v_current is distinct from new.template_version_id then
      raise exception 'template_version_not_current' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_waiver_submission_version_binding_trg on public.waiver_submissions;
create trigger enforce_waiver_submission_version_binding_trg
  before insert or update on public.waiver_submissions
  for each row
  execute function public.enforce_waiver_submission_version_binding();

create or replace function public.prevent_completed_waiver_submission_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'waiver_submissions cannot be deleted' using errcode = 'P0001';
  end if;
  if old.status = 'completed' and new.status = 'voided' then
    if new.public_token_hash is distinct from old.public_token_hash
       or new.idempotency_key is distinct from old.idempotency_key
       or new.request_hash is distinct from old.request_hash
       or new.template_id is distinct from old.template_id
       or new.template_version_id is distinct from old.template_version_id
       or new.signer_first_name is distinct from old.signer_first_name
       or new.signer_last_name is distinct from old.signer_last_name
       or new.signer_email is distinct from old.signer_email
       or new.signer_phone is distinct from old.signer_phone
       or new.signed_at is distinct from old.signed_at
       or new.expires_on is distinct from old.expires_on
       or new.token_expires_at is distinct from old.token_expires_at
       or new.source is distinct from old.source
       or new.smartwaiver_external_id is distinct from old.smartwaiver_external_id
       or new.created_at is distinct from old.created_at then
      raise exception 'completed waiver submissions are immutable except status void'
        using errcode = 'P0001';
    end if;
    return new;
  end if;
  if old.status = 'voided' then
    raise exception 'voided waiver submissions are immutable' using errcode = 'P0001';
  end if;
  raise exception 'completed waiver submissions are immutable' using errcode = 'P0001';
end;
$$;

drop trigger if exists prevent_completed_waiver_submission_mutation_trg on public.waiver_submissions;
create trigger prevent_completed_waiver_submission_mutation_trg
  before update or delete on public.waiver_submissions
  for each row
  execute function public.prevent_completed_waiver_submission_mutation();

create table if not exists public.waiver_participants (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null
    references public.waiver_submissions (id)
    on delete restrict,
  first_name text not null
    check (length(trim(first_name)) > 0 and length(first_name) <= 80),
  last_name text not null
    check (length(trim(last_name)) > 0 and length(last_name) <= 80),
  dob date not null,
  role text not null
    check (role in ('child', 'adult_signer', 'adult_covered')),
  guardian_participant_id uuid null
    references public.waiver_participants (id)
    on delete restrict,
  search_first_name text generated always as (lower(trim(first_name))) stored,
  search_last_name text generated always as (lower(trim(last_name))) stored,
  search_full_name text generated always as (lower(trim(first_name) || ' ' || trim(last_name))) stored,
  created_at timestamptz not null default now(),
  constraint waiver_participants_child_requires_guardian
    check (
      (role = 'child' and guardian_participant_id is not null)
      or (role <> 'child' and guardian_participant_id is null)
    ),
  constraint waiver_participants_not_self_guardian
    check (guardian_participant_id is null or guardian_participant_id <> id)
);

create or replace function public.enforce_waiver_participant_guardian()
returns trigger
language plpgsql
as $$
declare
  v_role text;
  v_submission uuid;
begin
  if new.role = 'child' then
    if new.guardian_participant_id is null then
      raise exception 'child_requires_guardian' using errcode = '23514';
    end if;
    select role, submission_id into v_role, v_submission
    from public.waiver_participants
    where id = new.guardian_participant_id;
    if v_submission is null then
      raise exception 'guardian_not_found' using errcode = '23503';
    end if;
    if v_submission is distinct from new.submission_id then
      raise exception 'guardian_cross_submission' using errcode = '23514';
    end if;
    if v_role not in ('adult_signer', 'adult_covered') then
      raise exception 'guardian_must_be_adult' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_waiver_participant_guardian_trg on public.waiver_participants;
create trigger enforce_waiver_participant_guardian_trg
  before insert or update on public.waiver_participants
  for each row
  execute function public.enforce_waiver_participant_guardian();

create or replace function public.prevent_waiver_participant_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'waiver_participants are immutable after insert' using errcode = 'P0001';
end;
$$;

drop trigger if exists prevent_waiver_participant_mutation_trg on public.waiver_participants;
create trigger prevent_waiver_participant_mutation_trg
  before update or delete on public.waiver_participants
  for each row
  execute function public.prevent_waiver_participant_mutation();

create table if not exists public.waiver_signatures (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique
    references public.waiver_submissions (id)
    on delete restrict,
  storage_path text not null
    check (
      length(trim(storage_path)) > 0
      and length(storage_path) <= 512
      and storage_path ~ '^signatures/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'
    ),
  content_type text not null
    check (content_type in ('image/png', 'image/jpeg', 'image/webp')),
  ip_hmac text null
    check (ip_hmac is null or ip_hmac ~ '^[a-f0-9]{64}$'),
  user_agent text null
    check (user_agent is null or length(user_agent) <= 512),
  consent_payload jsonb not null default '{}'::jsonb,
  signed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create or replace function public.prevent_waiver_signature_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'waiver_signatures are immutable after insert' using errcode = 'P0001';
end;
$$;

drop trigger if exists prevent_waiver_signature_mutation_trg on public.waiver_signatures;
create trigger prevent_waiver_signature_mutation_trg
  before update or delete on public.waiver_signatures
  for each row
  execute function public.prevent_waiver_signature_mutation();

create table if not exists public.waiver_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique
    references public.waiver_submissions (id)
    on delete restrict,
  storage_path text not null
    check (
      length(trim(storage_path)) > 0
      and length(storage_path) <= 512
      and storage_path ~ '^documents/[0-9a-f-]{36}/'
    ),
  sha256 text null
    check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  generated_at timestamptz null,
  source text not null default 'pending'
    check (source in ('pending', 'generated', 'imported')),
  status text not null default 'pending_upload'
    check (status in (
      'pending_upload',
      'uploaded',
      'generation_pending',
      'complete',
      'failed'
    )),
  created_at timestamptz not null default now()
);

create or replace function public.prevent_waiver_document_destructive_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'waiver_documents cannot be deleted' using errcode = 'P0001';
  end if;
  if new.submission_id is distinct from old.submission_id
     or new.created_at is distinct from old.created_at then
    raise exception 'waiver_documents binding is immutable' using errcode = 'P0001';
  end if;
  if old.status = 'complete' then
    if new.status is distinct from 'complete'
       or new.storage_path is distinct from old.storage_path
       or new.sha256 is distinct from old.sha256
       or new.generated_at is distinct from old.generated_at
       or new.source is distinct from old.source then
      raise exception 'completed waiver document metadata is immutable' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_waiver_document_destructive_mutation_trg on public.waiver_documents;
create trigger prevent_waiver_document_destructive_mutation_trg
  before update or delete on public.waiver_documents
  for each row
  execute function public.prevent_waiver_document_destructive_mutation();

-- ---------------------------------------------------------------------------
-- Open Play visits / attendees / ledger / audit
-- ---------------------------------------------------------------------------
create table if not exists public.open_play_visits (
  id uuid primary key default gen_random_uuid(),
  visit_date date not null,
  business_day_ymd text not null
    check (business_day_ymd ~ '^\d{4}-\d{2}-\d{2}$'),
  created_by_staff_id text not null
    check (length(trim(created_by_staff_id)) > 0),
  status text not null default 'open'
    check (status in ('open', 'finalized', 'voided')),
  notes text null
    check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  constraint open_play_visits_business_day_matches_visit_date
    check (business_day_ymd = to_char(visit_date, 'YYYY-MM-DD'))
);

create table if not exists public.open_play_visit_attendees (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null
    references public.open_play_visits (id)
    on delete restrict,
  participant_id uuid not null
    references public.waiver_participants (id)
    on delete restrict,
  waiver_submission_id uuid not null
    references public.waiver_submissions (id)
    on delete restrict,
  business_day_ymd text not null
    check (business_day_ymd ~ '^\d{4}-\d{2}-\d{2}$'),
  classification text not null
    check (classification in (
      'child_2_or_under',
      'child_3_plus',
      'playing_adult',
      'watching_adult'
    )),
  age_years_on_visit integer not null
    check (age_years_on_visit >= 0 and age_years_on_visit <= 130),
  unit_price_cents integer not null
    check (unit_price_cents >= 0),
  status text not null default 'active'
    check (status in ('active', 'removed')),
  created_at timestamptz not null default now(),
  unique (visit_id, participant_id),
  constraint open_play_visit_attendees_price_matches_classification
    check (unit_price_cents = public.jj_open_play_unit_price(classification))
);

-- One active check-in per participant per business day (across visits).
create unique index if not exists open_play_visit_attendees_active_same_day_uidx
  on public.open_play_visit_attendees (participant_id, business_day_ymd)
  where status = 'active';

create or replace function public.enforce_open_play_attendee_integrity()
returns trigger
language plpgsql
as $$
declare
  v_visit_date date;
  v_business text;
  v_visit_status text;
  v_role text;
  v_dob date;
  v_submission uuid;
  v_expires date;
  v_sub_status text;
  v_age integer;
  v_expected_class text;
begin
  select visit_date, business_day_ymd, status
    into v_visit_date, v_business, v_visit_status
  from public.open_play_visits
  where id = new.visit_id;

  if v_visit_date is null then
    raise exception 'visit_not_found' using errcode = '23503';
  end if;
  if new.business_day_ymd is distinct from v_business then
    raise exception 'attendee_business_day_mismatch' using errcode = '23514';
  end if;

  select p.role, p.dob, p.submission_id, s.expires_on, s.status
    into v_role, v_dob, v_submission, v_expires, v_sub_status
  from public.waiver_participants p
  join public.waiver_submissions s on s.id = p.submission_id
  where p.id = new.participant_id;

  if v_role is null then
    raise exception 'participant_not_found' using errcode = '23503';
  end if;
  if new.waiver_submission_id is distinct from v_submission then
    raise exception 'attendee_submission_mismatch' using errcode = '23514';
  end if;
  if v_sub_status is distinct from 'completed' then
    raise exception 'waiver_not_completed' using errcode = 'P0001';
  end if;
  if v_expires <= v_visit_date then
    raise exception 'waiver_expired' using errcode = 'P0001';
  end if;

  v_age := public.jj_age_years_on_date(v_dob, v_visit_date);
  if new.age_years_on_visit is distinct from v_age then
    raise exception 'attendee_age_mismatch' using errcode = '23514';
  end if;

  if v_role = 'child' then
    v_expected_class := case when v_age <= 2 then 'child_2_or_under' else 'child_3_plus' end;
    if new.classification is distinct from v_expected_class then
      raise exception 'attendee_classification_mismatch' using errcode = '23514';
    end if;
  else
    if new.classification not in ('playing_adult', 'watching_adult') then
      raise exception 'attendee_classification_mismatch' using errcode = '23514';
    end if;
  end if;

  if new.unit_price_cents is distinct from public.jj_open_play_unit_price(new.classification) then
    raise exception 'attendee_price_mismatch' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_open_play_attendee_integrity_trg on public.open_play_visit_attendees;
create trigger enforce_open_play_attendee_integrity_trg
  before insert on public.open_play_visit_attendees
  for each row
  execute function public.enforce_open_play_attendee_integrity();

create or replace function public.prevent_open_play_attendee_rewrite()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'open_play_visit_attendees cannot be deleted' using errcode = 'P0001';
  end if;
  -- Allow only active -> removed.
  if old.status = 'active' and new.status = 'removed' then
    if new.visit_id is distinct from old.visit_id
       or new.participant_id is distinct from old.participant_id
       or new.waiver_submission_id is distinct from old.waiver_submission_id
       or new.business_day_ymd is distinct from old.business_day_ymd
       or new.classification is distinct from old.classification
       or new.age_years_on_visit is distinct from old.age_years_on_visit
       or new.unit_price_cents is distinct from old.unit_price_cents
       or new.created_at is distinct from old.created_at then
      raise exception 'attendee historical fields are immutable' using errcode = 'P0001';
    end if;
    return new;
  end if;
  raise exception 'open_play_visit_attendees are immutable except active to removed'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists prevent_open_play_attendee_rewrite_trg on public.open_play_visit_attendees;
create trigger prevent_open_play_attendee_rewrite_trg
  before update or delete on public.open_play_visit_attendees
  for each row
  execute function public.prevent_open_play_attendee_rewrite();

create table if not exists public.open_play_payment_entries (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null
    references public.open_play_visits (id)
    on delete restrict,
  attendee_id uuid null
    references public.open_play_visit_attendees (id)
    on delete restrict,
  entry_type text not null
    check (entry_type in ('charge', 'correction', 'void', 'refund')),
  method text not null
    check (method in ('cash', 'card')),
  amount_cents integer not null,
  related_entry_id uuid null
    references public.open_play_payment_entries (id)
    on delete restrict,
  reason text null
    check (reason is null or (length(trim(reason)) > 0 and length(reason) <= 500)),
  created_by_staff_id text not null
    check (length(trim(created_by_staff_id)) > 0),
  created_at timestamptz not null default now(),
  constraint open_play_payment_entries_corrective_reason
    check (
      (entry_type = 'charge' and reason is null and related_entry_id is null and amount_cents > 0 and attendee_id is not null)
      or (entry_type = 'correction' and reason is not null and related_entry_id is not null and amount_cents <> 0)
      or (entry_type in ('void', 'refund') and reason is not null and related_entry_id is not null and amount_cents < 0)
    )
);

drop trigger if exists prevent_open_play_payment_entry_mutation
  on public.open_play_payment_entries;
create trigger prevent_open_play_payment_entry_mutation
  before update or delete on public.open_play_payment_entries
  for each row
  execute function public.prevent_append_only_mutation();

create or replace function public.enforce_open_play_payment_entry_insert()
returns trigger
language plpgsql
as $$
declare
  v_related public.open_play_payment_entries%rowtype;
  v_attendee_visit uuid;
  v_void_count integer;
  v_refund_sum integer;
  v_remaining integer;
  v_effective_method text;
  v_corr record;
begin
  if new.attendee_id is not null then
    select visit_id into v_attendee_visit
    from public.open_play_visit_attendees
    where id = new.attendee_id;
    if v_attendee_visit is distinct from new.visit_id then
      raise exception 'payment_attendee_visit_mismatch' using errcode = '23514';
    end if;
  end if;

  if new.entry_type = 'charge' then
    if new.attendee_id is null then
      raise exception 'charge_requires_attendee' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.open_play_visit_attendees a
      where a.id = new.attendee_id
        and a.unit_price_cents = new.amount_cents
        and a.unit_price_cents > 0
    ) then
      raise exception 'charge_amount_mismatch' using errcode = '23514';
    end if;
    return new;
  end if;

  select * into v_related
  from public.open_play_payment_entries
  where id = new.related_entry_id
  for update;

  if not found then
    raise exception 'related_entry_not_found' using errcode = '23503';
  end if;
  if v_related.visit_id is distinct from new.visit_id then
    raise exception 'related_entry_visit_mismatch' using errcode = '23514';
  end if;
  if v_related.entry_type is distinct from 'charge' then
    raise exception 'related_entry_must_be_charge' using errcode = '23514';
  end if;

  select count(*) into v_void_count
  from public.open_play_payment_entries
  where related_entry_id = v_related.id and entry_type = 'void';

  select coalesce(sum(-amount_cents), 0) into v_refund_sum
  from public.open_play_payment_entries
  where related_entry_id = v_related.id and entry_type = 'refund';

  v_effective_method := v_related.method;
  for v_corr in
    select method, amount_cents
    from public.open_play_payment_entries
    where related_entry_id = v_related.id and entry_type = 'correction'
    order by created_at, id
  loop
    if v_corr.amount_cents < 0 and v_corr.method = v_effective_method then
      null;
    elsif v_corr.amount_cents > 0 then
      v_effective_method := v_corr.method;
    end if;
  end loop;

  if new.entry_type = 'void' then
    if v_void_count > 0 then
      raise exception 'charge_already_voided' using errcode = 'P0001';
    end if;
    if v_refund_sum > 0 then
      raise exception 'void_after_refund_rejected' using errcode = 'P0001';
    end if;
    if new.amount_cents is distinct from -abs(v_related.amount_cents) then
      raise exception 'void_amount_invalid' using errcode = '23514';
    end if;
    if new.method is distinct from v_effective_method then
      raise exception 'void_method_mismatch' using errcode = '23514';
    end if;
  elsif new.entry_type = 'refund' then
    if v_void_count > 0 then
      raise exception 'refund_after_void_rejected' using errcode = 'P0001';
    end if;
    v_remaining := v_related.amount_cents - v_refund_sum;
    if (-new.amount_cents) > v_remaining then
      raise exception 'refund_exceeds_remaining' using errcode = 'P0001';
    end if;
    if new.method is distinct from v_effective_method then
      raise exception 'refund_method_mismatch' using errcode = '23514';
    end if;
  elsif new.entry_type = 'correction' then
    if v_void_count > 0 then
      raise exception 'correction_after_void_rejected' using errcode = 'P0001';
    end if;
    if v_refund_sum > 0 then
      raise exception 'correction_after_refund_rejected' using errcode = 'P0001';
    end if;
    -- Detect already-corrected method: if a prior positive correction exists to a different method
    if exists (
      select 1 from public.open_play_payment_entries
      where related_entry_id = v_related.id
        and entry_type = 'correction'
        and amount_cents > 0
        and method is distinct from v_related.method
    ) and new.amount_cents < 0 and new.method = v_related.method then
      raise exception 'method_already_corrected' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_open_play_payment_entry_insert_trg on public.open_play_payment_entries;
create trigger enforce_open_play_payment_entry_insert_trg
  before insert on public.open_play_payment_entries
  for each row
  execute function public.enforce_open_play_payment_entry_insert();

create table if not exists public.open_play_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_staff_id text null
    check (actor_staff_id is null or length(trim(actor_staff_id)) > 0),
  action text not null
    check (length(trim(action)) > 0 and length(action) <= 80),
  entity_type text not null
    check (length(trim(entity_type)) > 0 and length(entity_type) <= 80),
  entity_id text not null
    check (length(trim(entity_id)) > 0 and length(entity_id) <= 80),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  append_only boolean not null default true
    check (append_only = true)
);

drop trigger if exists prevent_open_play_audit_event_mutation
  on public.open_play_audit_events;
create trigger prevent_open_play_audit_event_mutation
  before update or delete on public.open_play_audit_events
  for each row
  execute function public.prevent_append_only_mutation();

-- ---------------------------------------------------------------------------
-- Smartwaiver import staging
-- ---------------------------------------------------------------------------
create table if not exists public.smartwaiver_import_batches (
  id uuid primary key default gen_random_uuid(),
  label text not null
    check (length(trim(label)) > 0 and length(label) <= 200),
  source_kind text not null default 'csv'
    check (source_kind in ('csv', 'pdf', 'manual')),
  status text not null default 'pending'
    check (status in ('pending', 'imported', 'duplicate', 'needs_review', 'failed')),
  row_count integer not null default 0
    check (row_count >= 0),
  notes text null
    check (notes is null or length(notes) <= 2000),
  created_by_staff_id text null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

create table if not exists public.smartwaiver_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null
    references public.smartwaiver_import_batches (id)
    on delete restrict,
  external_id text null
    check (external_id is null or length(trim(external_id)) > 0),
  normalized_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'imported', 'duplicate', 'needs_review', 'failed')),
  matched_submission_id uuid null
    references public.waiver_submissions (id)
    on delete set null,
  error_message text null
    check (error_message is null or length(error_message) <= 1000),
  created_at timestamptz not null default now()
);

create unique index if not exists smartwaiver_import_rows_external_id_uidx
  on public.smartwaiver_import_rows (external_id)
  where external_id is not null;

create table if not exists public.smartwaiver_document_imports (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null
    references public.smartwaiver_import_batches (id)
    on delete restrict,
  import_row_id uuid null
    references public.smartwaiver_import_rows (id)
    on delete set null,
  external_id text null
    check (external_id is null or length(trim(external_id)) > 0),
  storage_path text null
    check (storage_path is null or length(trim(storage_path)) > 0),
  sha256 text null
    check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending'
    check (status in ('pending', 'imported', 'duplicate', 'needs_review', 'failed')),
  matched_document_id uuid null
    references public.waiver_documents (id)
    on delete set null,
  error_message text null
    check (error_message is null or length(error_message) <= 1000),
  created_at timestamptz not null default now()
);


create or replace function public.prevent_open_play_visit_rewrite()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'open_play_visits cannot be deleted' using errcode = 'P0001';
  end if;
  if new.visit_date is distinct from old.visit_date
     or new.business_day_ymd is distinct from old.business_day_ymd
     or new.created_by_staff_id is distinct from old.created_by_staff_id
     or new.created_at is distinct from old.created_at then
    raise exception 'open_play_visit identity fields are immutable' using errcode = 'P0001';
  end if;
  if old.status = new.status then
    return new;
  end if;
  if old.status = 'open' and new.status in ('finalized', 'voided') then
    return new;
  end if;
  if old.status = 'finalized' and new.status = 'voided' then
    return new;
  end if;
  raise exception 'unsupported open_play_visit status transition' using errcode = 'P0001';
end;
$$;

drop trigger if exists prevent_open_play_visit_rewrite_trg on public.open_play_visits;
create trigger prevent_open_play_visit_rewrite_trg
  before update or delete on public.open_play_visits
  for each row
  execute function public.prevent_open_play_visit_rewrite();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists waiver_participants_search_first_name_idx
  on public.waiver_participants (search_first_name);
create index if not exists waiver_participants_search_last_name_idx
  on public.waiver_participants (search_last_name);
create index if not exists waiver_participants_search_full_name_idx
  on public.waiver_participants (search_full_name);
create index if not exists waiver_participants_submission_id_idx
  on public.waiver_participants (submission_id);
create index if not exists waiver_submissions_expires_on_idx
  on public.waiver_submissions (expires_on);
create index if not exists waiver_submissions_template_version_id_idx
  on public.waiver_submissions (template_version_id);
create index if not exists waiver_submissions_public_token_hash_idx
  on public.waiver_submissions (public_token_hash);
create index if not exists open_play_visits_business_day_ymd_idx
  on public.open_play_visits (business_day_ymd);
create index if not exists open_play_visit_attendees_visit_id_idx
  on public.open_play_visit_attendees (visit_id);
create index if not exists open_play_payment_entries_visit_id_idx
  on public.open_play_payment_entries (visit_id);
create index if not exists open_play_payment_entries_related_entry_id_idx
  on public.open_play_payment_entries (related_entry_id);
create index if not exists open_play_audit_events_entity_idx
  on public.open_play_audit_events (entity_type, entity_id);
create index if not exists open_play_audit_events_created_at_idx
  on public.open_play_audit_events (created_at desc);

-- ---------------------------------------------------------------------------
-- RLS deny-all
-- ---------------------------------------------------------------------------
alter table public.waiver_templates enable row level security;
alter table public.waiver_template_versions enable row level security;
alter table public.waiver_submissions enable row level security;
alter table public.waiver_participants enable row level security;
alter table public.waiver_signatures enable row level security;
alter table public.waiver_documents enable row level security;
alter table public.open_play_visits enable row level security;
alter table public.open_play_visit_attendees enable row level security;
alter table public.open_play_payment_entries enable row level security;
alter table public.open_play_audit_events enable row level security;
alter table public.smartwaiver_import_batches enable row level security;
alter table public.smartwaiver_import_rows enable row level security;
alter table public.smartwaiver_document_imports enable row level security;

drop policy if exists "No public waiver_templates access" on public.waiver_templates;
create policy "No public waiver_templates access"
  on public.waiver_templates for all to anon, authenticated
  using (false) with check (false);
drop policy if exists "No public waiver_template_versions access" on public.waiver_template_versions;
create policy "No public waiver_template_versions access"
  on public.waiver_template_versions for all to anon, authenticated
  using (false) with check (false);
drop policy if exists "No public waiver_submissions access" on public.waiver_submissions;
create policy "No public waiver_submissions access"
  on public.waiver_submissions for all to anon, authenticated
  using (false) with check (false);
drop policy if exists "No public waiver_participants access" on public.waiver_participants;
create policy "No public waiver_participants access"
  on public.waiver_participants for all to anon, authenticated
  using (false) with check (false);
drop policy if exists "No public waiver_signatures access" on public.waiver_signatures;
create policy "No public waiver_signatures access"
  on public.waiver_signatures for all to anon, authenticated
  using (false) with check (false);
drop policy if exists "No public waiver_documents access" on public.waiver_documents;
create policy "No public waiver_documents access"
  on public.waiver_documents for all to anon, authenticated
  using (false) with check (false);
drop policy if exists "No public open_play_visits access" on public.open_play_visits;
create policy "No public open_play_visits access"
  on public.open_play_visits for all to anon, authenticated
  using (false) with check (false);
drop policy if exists "No public open_play_visit_attendees access" on public.open_play_visit_attendees;
create policy "No public open_play_visit_attendees access"
  on public.open_play_visit_attendees for all to anon, authenticated
  using (false) with check (false);
drop policy if exists "No public open_play_payment_entries access" on public.open_play_payment_entries;
create policy "No public open_play_payment_entries access"
  on public.open_play_payment_entries for all to anon, authenticated
  using (false) with check (false);
drop policy if exists "No public open_play_audit_events access" on public.open_play_audit_events;
create policy "No public open_play_audit_events access"
  on public.open_play_audit_events for all to anon, authenticated
  using (false) with check (false);
drop policy if exists "No public smartwaiver_import_batches access" on public.smartwaiver_import_batches;
create policy "No public smartwaiver_import_batches access"
  on public.smartwaiver_import_batches for all to anon, authenticated
  using (false) with check (false);
drop policy if exists "No public smartwaiver_import_rows access" on public.smartwaiver_import_rows;
create policy "No public smartwaiver_import_rows access"
  on public.smartwaiver_import_rows for all to anon, authenticated
  using (false) with check (false);
drop policy if exists "No public smartwaiver_document_imports access" on public.smartwaiver_document_imports;
create policy "No public smartwaiver_document_imports access"
  on public.smartwaiver_document_imports for all to anon, authenticated
  using (false) with check (false);

-- ---------------------------------------------------------------------------
-- Transactional RPCs (service_role only)
-- ---------------------------------------------------------------------------

create or replace function public.submit_native_waiver_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idempotency text := nullif(trim(p_payload->>'idempotency_key'), '');
  v_request_hash text := lower(nullif(trim(p_payload->>'request_hash'), ''));
  v_token_hash text := lower(nullif(trim(p_payload->>'public_token_hash'), ''));
  v_template_version_id uuid := nullif(p_payload->>'template_version_id', '')::uuid;
  v_template_id uuid;
  v_signed_at timestamptz := coalesce((p_payload->>'signed_at')::timestamptz, now());
  v_expires date;
  v_token_expires timestamptz;
  v_source text := nullif(trim(p_payload->>'source'), '');
  v_submission_id uuid;
  v_existing public.waiver_submissions%rowtype;
  v_participant jsonb;
  v_adult_map jsonb := '{}'::jsonb;
  v_temp text;
  v_pid uuid;
  v_guardian_temp text;
  v_guardian_id uuid;
  v_sig_path text;
  v_doc_path text;
  v_content_type text;
  v_signer_first text;
  v_signer_last text;
  v_signer_match boolean := false;
  v_adult_count integer := 0;
  v_child_count integer := 0;
begin
  if v_idempotency is null or length(v_idempotency) < 16
     or v_request_hash is null or v_request_hash !~ '^[a-f0-9]{64}$'
     or v_token_hash is null or v_token_hash !~ '^[a-f0-9]{64}$'
     or v_template_version_id is null
     or v_source is null or v_source not in ('web', 'kiosk', 'import')
     or jsonb_typeof(p_payload->'participants') <> 'array'
     or jsonb_array_length(p_payload->'participants') < 1
     or jsonb_array_length(p_payload->'participants') > 20 then
    return jsonb_build_object('outcome', 'invalid_input');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('waiver_submit:' || v_idempotency, 0));

  select * into v_existing
  from public.waiver_submissions
  where idempotency_key = v_idempotency;

  if found then
    if v_existing.request_hash is distinct from v_request_hash then
      return jsonb_build_object('outcome', 'idempotency_conflict');
    end if;
    if not exists (
      select 1 from public.waiver_participants where submission_id = v_existing.id
    ) or not exists (
      select 1 from public.waiver_signatures where submission_id = v_existing.id
    ) or not exists (
      select 1 from public.waiver_documents where submission_id = v_existing.id
    ) or not exists (
      select 1 from public.open_play_audit_events
      where entity_type = 'waiver_submission' and entity_id = v_existing.id::text
        and action = 'waiver_submitted'
    ) then
      return jsonb_build_object('outcome', 'incomplete_prior_state');
    end if;
    return jsonb_build_object(
      'outcome', 'reused',
      'submission_id', v_existing.id,
      'expires_on', v_existing.expires_on,
      'token_expires_at', v_existing.token_expires_at
    );
  end if;

  select template_id into v_template_id
  from public.waiver_template_versions
  where id = v_template_version_id;
  if v_template_id is null then
    return jsonb_build_object('outcome', 'template_version_not_found');
  end if;

  v_expires := public.jj_expires_on_from_signed_at(v_signed_at);
  v_token_expires := v_signed_at + interval '7 days';
  v_signer_first := trim(p_payload#>>'{signer,first_name}');
  v_signer_last := trim(p_payload#>>'{signer,last_name}');
  v_content_type := coalesce(nullif(trim(p_payload->>'signature_content_type'), ''), 'image/png');
  if v_content_type not in ('image/png', 'image/jpeg', 'image/webp') then
    return jsonb_build_object('outcome', 'invalid_signature_content_type');
  end if;

  -- SQL-side consent verification (independent of TypeScript).
  if coalesce((p_payload#>>'{consent,acknowledgedRisk}')::boolean, false) is not true
     or coalesce((p_payload#>>'{consent,acknowledgedTerms}')::boolean, false) is not true
     or coalesce((p_payload#>>'{consent,isLegalGuardian}')::boolean, false) is not true then
    return jsonb_build_object('outcome', 'consent_required');
  end if;

  -- Pre-validate every DOB before any DML.
  for v_participant in select value from jsonb_array_elements(p_payload->'participants')
  loop
    if coalesce(v_participant->>'role', '') not in ('child', 'adult_signer', 'adult_covered') then
      return jsonb_build_object('outcome', 'invalid_input');
    end if;
    begin
      if to_char((trim(v_participant->>'dob'))::date, 'YYYY-MM-DD')
           is distinct from trim(v_participant->>'dob') then
        return jsonb_build_object('outcome', 'invalid_dob');
      end if;
      if (trim(v_participant->>'dob'))::date
           > (v_signed_at at time zone 'America/New_York')::date then
        return jsonb_build_object('outcome', 'future_dob');
      end if;
    exception
      when others then
        return jsonb_build_object('outcome', 'invalid_dob');
    end;
  end loop;

  insert into public.waiver_submissions (
    public_token_hash, idempotency_key, request_hash, template_id, template_version_id,
    signer_first_name, signer_last_name, signer_email, signer_phone,
    signed_at, expires_on, token_expires_at, source, status
  ) values (
    v_token_hash, v_idempotency, v_request_hash, v_template_id, v_template_version_id,
    v_signer_first, v_signer_last,
    trim(p_payload#>>'{signer,email}'),
    trim(p_payload#>>'{signer,phone}'),
    v_signed_at, v_expires, v_token_expires, v_source, 'completed'
  ) returning id into v_submission_id;

  -- Adults first
  for v_participant in
    select value from jsonb_array_elements(p_payload->'participants')
    where value->>'role' in ('adult_signer', 'adult_covered')
  loop
    v_adult_count := v_adult_count + 1;
    if v_adult_count > 8 then
      raise exception 'too_many_adults' using errcode = 'P0001';
    end if;
    v_temp := trim(v_participant->>'temp_id');
    insert into public.waiver_participants (
      submission_id, first_name, last_name, dob, role, guardian_participant_id
    ) values (
      v_submission_id,
      trim(v_participant->>'first_name'),
      trim(v_participant->>'last_name'),
      (v_participant->>'dob')::date,
      v_participant->>'role',
      null
    ) returning id into v_pid;
    v_adult_map := v_adult_map || jsonb_build_object(v_temp, v_pid::text);
    if v_participant->>'role' = 'adult_signer'
       and lower(trim(v_participant->>'first_name')) = lower(v_signer_first)
       and lower(trim(v_participant->>'last_name')) = lower(v_signer_last) then
      v_signer_match := true;
    end if;
  end loop;

  if not v_signer_match then
    raise exception 'signer_participant_mismatch' using errcode = 'P0001';
  end if;

  for v_participant in
    select value from jsonb_array_elements(p_payload->'participants')
    where value->>'role' = 'child'
  loop
    v_child_count := v_child_count + 1;
    if v_child_count > 12 then
      raise exception 'too_many_children' using errcode = 'P0001';
    end if;
    v_guardian_temp := trim(v_participant->>'guardian_temp_id');
    v_guardian_id := nullif(v_adult_map->>v_guardian_temp, '')::uuid;
    if v_guardian_id is null then
      raise exception 'child_guardian_missing' using errcode = 'P0001';
    end if;
    insert into public.waiver_participants (
      submission_id, first_name, last_name, dob, role, guardian_participant_id
    ) values (
      v_submission_id,
      trim(v_participant->>'first_name'),
      trim(v_participant->>'last_name'),
      (v_participant->>'dob')::date,
      'child',
      v_guardian_id
    );
  end loop;

  v_sig_path := format(
    'signatures/%s/%s.%s',
    v_submission_id,
    gen_random_uuid(),
    case v_content_type
      when 'image/jpeg' then 'jpg'
      when 'image/webp' then 'webp'
      else 'png'
    end
  );
  v_doc_path := format('documents/%s/pending.txt', v_submission_id);

  insert into public.waiver_signatures (
    submission_id, storage_path, content_type, ip_hmac, user_agent, consent_payload, signed_at
  ) values (
    v_submission_id,
    v_sig_path,
    v_content_type,
    nullif(lower(trim(p_payload->>'ip_hmac')), ''),
    left(nullif(p_payload->>'user_agent', ''), 512),
    coalesce(p_payload->'consent', '{}'::jsonb),
    v_signed_at
  );

  insert into public.waiver_documents (
    submission_id, storage_path, sha256, generated_at, source, status
  ) values (
    v_submission_id, v_doc_path, null, null, 'pending', 'pending_upload'
  );

  insert into public.open_play_audit_events (
    actor_staff_id, action, entity_type, entity_id, detail
  ) values (
    null,
    'waiver_submitted',
    'waiver_submission',
    v_submission_id::text,
    jsonb_build_object(
      'source', v_source,
      'participantCount', jsonb_array_length(p_payload->'participants'),
      'templateVersionId', v_template_version_id
    )
  );

  return jsonb_build_object(
    'outcome', 'created',
    'submission_id', v_submission_id,
    'expires_on', v_expires,
    'token_expires_at', v_token_expires,
    'signature_storage_path', v_sig_path,
    'document_storage_path', v_doc_path
  );
exception
  when unique_violation then
    select * into v_existing from public.waiver_submissions where idempotency_key = v_idempotency;
    if found and v_existing.request_hash = v_request_hash then
      return jsonb_build_object(
        'outcome', 'reused',
        'submission_id', v_existing.id,
        'expires_on', v_existing.expires_on,
        'token_expires_at', v_existing.token_expires_at
      );
    end if;
    return jsonb_build_object('outcome', 'idempotency_conflict');
  when sqlstate 'P0001' then
    -- Rolls back all writes; SQLERRM carries our stable outcome code.
    return jsonb_build_object('outcome', SQLERRM);
  when others then
    return jsonb_build_object('outcome', 'failed', 'error_code', SQLSTATE);
end;
$$;

create or replace function public.create_open_play_visit_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_visit_date date := nullif(p_payload->>'visit_date', '')::date;
  v_business text;
  v_staff text := nullif(trim(p_payload->>'staff_id'), '');
  v_notes text := nullif(trim(p_payload->>'notes'), '');
  v_visit_id uuid;
  v_attendee jsonb;
  v_attendee_id uuid;
  v_payment_id uuid;
  v_participant_id uuid;
  v_created_attendees jsonb := '[]'::jsonb;
  v_created_payments jsonb := '[]'::jsonb;
  v_price integer;
  v_method text;
  v_seen uuid[] := array[]::uuid[];
begin
  if v_visit_date is null or v_staff is null
     or jsonb_typeof(p_payload->'attendees') <> 'array'
     or jsonb_array_length(p_payload->'attendees') < 1
     or jsonb_array_length(p_payload->'attendees') > 40 then
    return jsonb_build_object('outcome', 'invalid_input');
  end if;

  v_business := to_char(v_visit_date, 'YYYY-MM-DD');

  -- Pre-validate every attendee BEFORE any DML so soft failures cannot leave state.
  for v_attendee in select value from jsonb_array_elements(p_payload->'attendees')
  loop
    v_participant_id := nullif(v_attendee->>'participant_id', '')::uuid;
    v_price := (v_attendee->>'unit_price_cents')::integer;
    v_method := nullif(v_attendee->>'payment_method', '');
    if v_participant_id is null or v_price is null then
      return jsonb_build_object('outcome', 'invalid_input');
    end if;
    if v_participant_id = any (v_seen) then
      return jsonb_build_object('outcome', 'duplicate_same_day_attendee', 'participant_id', v_participant_id);
    end if;
    v_seen := array_append(v_seen, v_participant_id);
    if exists (
      select 1 from public.open_play_visit_attendees
      where participant_id = v_participant_id
        and business_day_ymd = v_business
        and status = 'active'
    ) then
      return jsonb_build_object('outcome', 'duplicate_same_day_attendee', 'participant_id', v_participant_id);
    end if;
    if v_price > 0 and v_method not in ('cash', 'card') then
      return jsonb_build_object('outcome', 'payment_method_required');
    end if;
    if v_price = 0 and v_method is not null then
      return jsonb_build_object('outcome', 'free_attendee_cannot_have_payment_method');
    end if;
    if v_price < 0 then
      return jsonb_build_object('outcome', 'invalid_input');
    end if;
  end loop;

  -- Serialize same-day participant check-ins.
  perform pg_advisory_xact_lock(hashtextextended('open_play_day:' || v_business, 0));

  -- Re-check duplicates under lock (concurrent insert race).
  for v_attendee in select value from jsonb_array_elements(p_payload->'attendees')
  loop
    v_participant_id := nullif(v_attendee->>'participant_id', '')::uuid;
    if exists (
      select 1 from public.open_play_visit_attendees
      where participant_id = v_participant_id
        and business_day_ymd = v_business
        and status = 'active'
    ) then
      return jsonb_build_object('outcome', 'duplicate_same_day_attendee', 'participant_id', v_participant_id);
    end if;
  end loop;

  insert into public.open_play_visits (
    visit_date, business_day_ymd, created_by_staff_id, status, notes
  ) values (
    v_visit_date, v_business, v_staff, 'open', v_notes
  ) returning id into v_visit_id;

  for v_attendee in select value from jsonb_array_elements(p_payload->'attendees')
  loop
    v_participant_id := nullif(v_attendee->>'participant_id', '')::uuid;
    v_price := (v_attendee->>'unit_price_cents')::integer;
    v_method := nullif(v_attendee->>'payment_method', '');
    v_attendee_id := coalesce(nullif(v_attendee->>'attendee_id', '')::uuid, gen_random_uuid());

    -- After DML has begun, all failures MUST raise so the exception handler rolls back.
    if exists (
      select 1 from public.open_play_visit_attendees
      where participant_id = v_participant_id
        and business_day_ymd = v_business
        and status = 'active'
    ) then
      raise exception using errcode = 'P0001', message = 'duplicate_same_day_attendee';
    end if;

    if v_price > 0 and v_method not in ('cash', 'card') then
      raise exception using errcode = 'P0001', message = 'payment_method_required';
    end if;
    if v_price = 0 and v_method is not null then
      raise exception using errcode = 'P0001', message = 'free_attendee_cannot_have_payment_method';
    end if;

    insert into public.open_play_visit_attendees (
      id, visit_id, participant_id, waiver_submission_id, business_day_ymd,
      classification, age_years_on_visit, unit_price_cents, status
    ) values (
      v_attendee_id,
      v_visit_id,
      v_participant_id,
      (v_attendee->>'waiver_submission_id')::uuid,
      v_business,
      v_attendee->>'classification',
      (v_attendee->>'age_years_on_visit')::integer,
      v_price,
      'active'
    );

    v_created_attendees := v_created_attendees || jsonb_build_array(jsonb_build_object(
      'attendee_id', v_attendee_id,
      'participant_id', v_participant_id,
      'classification', v_attendee->>'classification',
      'unit_price_cents', v_price
    ));

    if v_price > 0 then
      v_payment_id := coalesce(nullif(v_attendee->>'payment_id', '')::uuid, gen_random_uuid());
      insert into public.open_play_payment_entries (
        id, visit_id, attendee_id, entry_type, method, amount_cents,
        related_entry_id, reason, created_by_staff_id
      ) values (
        v_payment_id, v_visit_id, v_attendee_id, 'charge', v_method, v_price,
        null, null, v_staff
      );
      v_created_payments := v_created_payments || jsonb_build_array(jsonb_build_object(
        'id', v_payment_id,
        'attendee_id', v_attendee_id,
        'method', v_method,
        'amount_cents', v_price
      ));
    end if;
  end loop;

  insert into public.open_play_audit_events (
    actor_staff_id, action, entity_type, entity_id, detail
  ) values (
    v_staff, 'visit_created', 'open_play_visit', v_visit_id::text,
    jsonb_build_object(
      'visitDate', v_business,
      'attendeeCount', jsonb_array_length(v_created_attendees),
      'chargeCount', jsonb_array_length(v_created_payments)
    )
  );

  return jsonb_build_object(
    'outcome', 'created',
    'visit_id', v_visit_id,
    'business_day_ymd', v_business,
    'attendees', v_created_attendees,
    'payments', v_created_payments
  );
exception
  when unique_violation then
    -- Rolls back all writes in this block, then returns stable outcome.
    return jsonb_build_object('outcome', 'duplicate_same_day_attendee');
  when sqlstate 'P0001' then
    return jsonb_build_object('outcome', SQLERRM);
  when others then
    return jsonb_build_object('outcome', 'failed', 'error_code', SQLSTATE);
end;
$$;

create or replace function public.apply_open_play_visit_correction_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_visit_id uuid := nullif(p_payload->>'visit_id', '')::uuid;
  v_staff text := nullif(trim(p_payload->>'staff_id'), '');
  v_type text := nullif(trim(p_payload->>'type'), '');
  v_reason text := nullif(trim(p_payload->>'reason'), '');
  v_visit public.open_play_visits%rowtype;
  v_related_id uuid;
  v_related public.open_play_payment_entries%rowtype;
  v_attendee_id uuid;
  v_entries jsonb := '[]'::jsonb;
  v_debit_id uuid;
  v_credit_id uuid;
  v_void_id uuid;
  v_refund_id uuid;
  v_amount integer;
  v_from text;
  v_to text;
  v_method text;
  v_effective text;
  v_corr record;
  v_void_count integer;
  v_refund_sum integer;
  v_updated integer;
begin
  if v_visit_id is null or v_staff is null or v_type is null or v_reason is null then
    return jsonb_build_object('outcome', 'invalid_input');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('open_play_visit:' || v_visit_id::text, 0));

  select * into v_visit from public.open_play_visits where id = v_visit_id for update;
  if not found then
    return jsonb_build_object('outcome', 'visit_not_found');
  end if;
  if v_visit.status = 'voided' then
    return jsonb_build_object('outcome', 'visit_voided');
  end if;

  if v_type = 'method_correction' then
    v_related_id := nullif(p_payload->>'related_entry_id', '')::uuid;
    v_from := p_payload->>'from_method';
    v_to := p_payload->>'to_method';
    v_amount := (p_payload->>'amount_cents')::integer;
    if v_from not in ('cash', 'card') or v_to not in ('cash', 'card') or v_from = v_to or v_amount is null then
      return jsonb_build_object('outcome', 'invalid_input');
    end if;
    select * into v_related from public.open_play_payment_entries where id = v_related_id for update;
    if not found or v_related.visit_id <> v_visit_id or v_related.entry_type <> 'charge' then
      return jsonb_build_object('outcome', 'related_entry_invalid');
    end if;
    if exists (select 1 from public.open_play_payment_entries where related_entry_id = v_related_id and entry_type = 'void') then
      return jsonb_build_object('outcome', 'charge_already_voided');
    end if;
    if exists (select 1 from public.open_play_payment_entries where related_entry_id = v_related_id and entry_type = 'refund') then
      return jsonb_build_object('outcome', 'correction_after_refund_rejected');
    end if;
    if exists (
      select 1 from public.open_play_payment_entries
      where related_entry_id = v_related_id and entry_type = 'correction' and amount_cents > 0
        and method is distinct from v_related.method
    ) then
      return jsonb_build_object('outcome', 'method_already_corrected');
    end if;
    if v_related.method is distinct from v_from or v_related.amount_cents is distinct from v_amount then
      return jsonb_build_object('outcome', 'correction_amount_or_method_mismatch');
    end if;
    v_debit_id := gen_random_uuid();
    v_credit_id := gen_random_uuid();
    insert into public.open_play_payment_entries (
      id, visit_id, attendee_id, entry_type, method, amount_cents, related_entry_id, reason, created_by_staff_id
    ) values
      (v_debit_id, v_visit_id, v_related.attendee_id, 'correction', v_from, -v_amount, v_related_id, v_reason, v_staff),
      (v_credit_id, v_visit_id, v_related.attendee_id, 'correction', v_to, v_amount, v_related_id, v_reason, v_staff);
    v_entries := jsonb_build_array(
      jsonb_build_object('id', v_debit_id, 'entry_type', 'correction', 'method', v_from, 'amount_cents', -v_amount),
      jsonb_build_object('id', v_credit_id, 'entry_type', 'correction', 'method', v_to, 'amount_cents', v_amount)
    );

  elsif v_type = 'void' then
    v_related_id := nullif(p_payload->>'related_entry_id', '')::uuid;
    select * into v_related from public.open_play_payment_entries where id = v_related_id for update;
    if not found or v_related.visit_id <> v_visit_id or v_related.entry_type <> 'charge' then
      return jsonb_build_object('outcome', 'related_entry_invalid');
    end if;
    select count(*) into v_void_count from public.open_play_payment_entries where related_entry_id = v_related_id and entry_type = 'void';
    if v_void_count > 0 then
      return jsonb_build_object('outcome', 'charge_already_voided');
    end if;
    select coalesce(sum(-amount_cents),0) into v_refund_sum from public.open_play_payment_entries where related_entry_id = v_related_id and entry_type = 'refund';
    if v_refund_sum > 0 then
      return jsonb_build_object('outcome', 'void_after_refund_rejected');
    end if;
    v_effective := v_related.method;
    for v_corr in
      select method, amount_cents from public.open_play_payment_entries
      where related_entry_id = v_related_id and entry_type = 'correction'
      order by created_at, id
    loop
      if v_corr.amount_cents > 0 then v_effective := v_corr.method; end if;
    end loop;
    v_attendee_id := nullif(p_payload->>'remove_attendee_id', '')::uuid;
    -- Validate attendee removal target BEFORE writing the void.
    if v_attendee_id is not null then
      if not exists (
        select 1 from public.open_play_visit_attendees
        where id = v_attendee_id and visit_id = v_visit_id and status = 'active'
      ) then
        return jsonb_build_object('outcome', 'attendee_not_found_or_removed');
      end if;
    end if;
    v_void_id := gen_random_uuid();
    insert into public.open_play_payment_entries (
      id, visit_id, attendee_id, entry_type, method, amount_cents, related_entry_id, reason, created_by_staff_id
    ) values (
      v_void_id, v_visit_id, v_related.attendee_id, 'void', v_effective, -abs(v_related.amount_cents), v_related_id, v_reason, v_staff
    );
    v_entries := jsonb_build_array(jsonb_build_object(
      'id', v_void_id, 'entry_type', 'void', 'method', v_effective, 'amount_cents', -abs(v_related.amount_cents)
    ));
    if v_attendee_id is not null then
      update public.open_play_visit_attendees
      set status = 'removed'
      where id = v_attendee_id and visit_id = v_visit_id and status = 'active';
      get diagnostics v_updated = row_count;
      if v_updated <> 1 then
        raise exception using errcode = 'P0001', message = 'attendee_not_found_or_removed';
      end if;
    end if;

  elsif v_type = 'refund' then
    v_related_id := nullif(p_payload->>'related_entry_id', '')::uuid;
    v_method := p_payload->>'method';
    v_amount := (p_payload->>'amount_cents')::integer;
    if v_method not in ('cash', 'card') or v_amount is null or v_amount <= 0 then
      return jsonb_build_object('outcome', 'invalid_input');
    end if;
    select * into v_related from public.open_play_payment_entries where id = v_related_id for update;
    if not found or v_related.visit_id <> v_visit_id or v_related.entry_type <> 'charge' then
      return jsonb_build_object('outcome', 'related_entry_invalid');
    end if;
    if exists (select 1 from public.open_play_payment_entries where related_entry_id = v_related_id and entry_type = 'void') then
      return jsonb_build_object('outcome', 'refund_after_void_rejected');
    end if;
    select coalesce(sum(-amount_cents),0) into v_refund_sum from public.open_play_payment_entries where related_entry_id = v_related_id and entry_type = 'refund';
    if v_amount > (v_related.amount_cents - v_refund_sum) then
      return jsonb_build_object('outcome', 'refund_exceeds_remaining');
    end if;
    v_effective := v_related.method;
    for v_corr in
      select method, amount_cents from public.open_play_payment_entries
      where related_entry_id = v_related_id and entry_type = 'correction'
      order by created_at, id
    loop
      if v_corr.amount_cents > 0 then v_effective := v_corr.method; end if;
    end loop;
    if v_method is distinct from v_effective then
      return jsonb_build_object('outcome', 'refund_method_mismatch');
    end if;
    v_refund_id := gen_random_uuid();
    insert into public.open_play_payment_entries (
      id, visit_id, attendee_id, entry_type, method, amount_cents, related_entry_id, reason, created_by_staff_id
    ) values (
      v_refund_id, v_visit_id, v_related.attendee_id, 'refund', v_method, -v_amount, v_related_id, v_reason, v_staff
    );
    v_entries := jsonb_build_array(jsonb_build_object(
      'id', v_refund_id, 'entry_type', 'refund', 'method', v_method, 'amount_cents', -v_amount
    ));

  elsif v_type = 'remove_attendee' then
    v_attendee_id := nullif(p_payload->>'attendee_id', '')::uuid;
    v_related_id := nullif(p_payload->>'related_entry_id', '')::uuid;
    if v_attendee_id is null then
      return jsonb_build_object('outcome', 'invalid_input');
    end if;
    if not exists (
      select 1 from public.open_play_visit_attendees
      where id = v_attendee_id and visit_id = v_visit_id and status = 'active'
    ) then
      return jsonb_build_object('outcome', 'attendee_not_found_or_removed');
    end if;
    -- Require financial reversal when an active charge remains.
    if v_related_id is null then
      select id into v_related_id
      from public.open_play_payment_entries e
      where e.visit_id = v_visit_id
        and e.attendee_id = v_attendee_id
        and e.entry_type = 'charge'
        and not exists (
          select 1 from public.open_play_payment_entries x
          where x.related_entry_id = e.id and x.entry_type = 'void'
        )
        and (
          e.amount_cents - coalesce((
            select sum(-r.amount_cents) from public.open_play_payment_entries r
            where r.related_entry_id = e.id and r.entry_type = 'refund'
          ), 0)
        ) > 0
      limit 1;
      if v_related_id is not null then
        return jsonb_build_object('outcome', 'financial_reversal_required', 'related_entry_id', v_related_id);
      end if;
    else
      select * into v_related from public.open_play_payment_entries where id = v_related_id for update;
      if not found or v_related.visit_id <> v_visit_id or v_related.attendee_id is distinct from v_attendee_id then
        return jsonb_build_object('outcome', 'related_entry_invalid');
      end if;
      if exists (select 1 from public.open_play_payment_entries where related_entry_id = v_related_id and entry_type = 'void') then
        return jsonb_build_object('outcome', 'charge_already_voided');
      end if;
      if exists (select 1 from public.open_play_payment_entries where related_entry_id = v_related_id and entry_type = 'refund') then
        return jsonb_build_object('outcome', 'void_after_refund_rejected');
      end if;
      v_effective := v_related.method;
      for v_corr in
        select method, amount_cents from public.open_play_payment_entries
        where related_entry_id = v_related_id and entry_type = 'correction'
        order by created_at, id
      loop
        if v_corr.amount_cents > 0 then v_effective := v_corr.method; end if;
      end loop;
      v_void_id := gen_random_uuid();
      insert into public.open_play_payment_entries (
        id, visit_id, attendee_id, entry_type, method, amount_cents, related_entry_id, reason, created_by_staff_id
      ) values (
        v_void_id, v_visit_id, v_attendee_id, 'void', v_effective, -abs(v_related.amount_cents), v_related_id, v_reason, v_staff
      );
      v_entries := jsonb_build_array(jsonb_build_object(
        'id', v_void_id, 'entry_type', 'void', 'method', v_effective, 'amount_cents', -abs(v_related.amount_cents)
      ));
    end if;

    update public.open_play_visit_attendees
    set status = 'removed'
    where id = v_attendee_id and visit_id = v_visit_id and status = 'active';
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception using errcode = 'P0001', message = 'attendee_not_found_or_removed';
    end if;

  else
    return jsonb_build_object('outcome', 'unsupported_type');
  end if;

  insert into public.open_play_audit_events (
    actor_staff_id, action, entity_type, entity_id, detail
  ) values (
    v_staff,
    'visit_' || v_type,
    'open_play_visit',
    v_visit_id::text,
    jsonb_build_object('correctionType', v_type, 'entryCount', jsonb_array_length(v_entries))
  );

  return jsonb_build_object('outcome', 'applied', 'entries', v_entries);
exception
  when sqlstate 'P0001' then
    return jsonb_build_object('outcome', SQLERRM);
  when others then
    return jsonb_build_object('outcome', 'failed', 'error_code', SQLSTATE);
end;
$$;

create or replace function public.search_waiver_participants_for_staff(
  p_query text,
  p_limit integer default 25
)
returns table (
  participant_id uuid,
  submission_id uuid,
  first_name text,
  last_name text,
  dob date,
  role text,
  expires_on date,
  signer_first_name text,
  signer_last_name text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_q text := lower(trim(both from coalesce(p_query, '')));
  v_like text;
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 25));
begin
  if length(v_q) < 2 or length(v_q) > 80 then
    raise exception 'invalid_search_query' using errcode = '22023';
  end if;
  if v_q ~ '[%_,()\\]' or v_q = '%' or v_q = '_' then
    raise exception 'invalid_search_query' using errcode = '22023';
  end if;
  -- Escape LIKE wildcards even after rejection of raw ones.
  v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select
    p.id,
    p.submission_id,
    p.first_name,
    p.last_name,
    p.dob,
    p.role,
    s.expires_on,
    s.signer_first_name,
    s.signer_last_name
  from public.waiver_participants p
  join public.waiver_submissions s on s.id = p.submission_id
  where s.status = 'completed'
    and (
      p.search_first_name like v_like escape '\'
      or p.search_last_name like v_like escape '\'
      or p.search_full_name like v_like escape '\'
    )
  order by
    case
      when p.search_full_name = v_q then 0
      when p.search_first_name = v_q or p.search_last_name = v_q then 1
      when p.search_full_name like (v_q || '%') escape '\' then 2
      when p.search_first_name like (v_q || '%') escape '\'
        or p.search_last_name like (v_q || '%') escape '\' then 3
      else 4
    end,
    p.last_name,
    p.first_name,
    p.dob,
    p.id
  limit v_limit;
end;
$$;

create or replace function public.get_waiver_completion_by_token_hash(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text := lower(nullif(trim(p_token_hash), ''));
  v_row public.waiver_submissions%rowtype;
  v_count integer;
begin
  if v_hash is null or v_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('outcome', 'not_found');
  end if;
  select * into v_row from public.waiver_submissions where public_token_hash = v_hash;
  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;
  if v_row.token_expires_at < now() then
    return jsonb_build_object('outcome', 'token_expired');
  end if;
  select count(*) into v_count from public.waiver_participants where submission_id = v_row.id;
  return jsonb_build_object(
    'outcome', 'ok',
    'submission_id', v_row.id,
    'signed_at', v_row.signed_at,
    'expires_on', v_row.expires_on,
    'status', v_row.status,
    'participant_count', v_count
  );
end;
$$;

revoke all on function public.submit_native_waiver_atomic(jsonb) from public, anon, authenticated;
revoke all on function public.create_open_play_visit_atomic(jsonb) from public, anon, authenticated;
revoke all on function public.apply_open_play_visit_correction_atomic(jsonb) from public, anon, authenticated;
revoke all on function public.search_waiver_participants_for_staff(text, integer) from public, anon, authenticated;
revoke all on function public.get_waiver_completion_by_token_hash(text) from public, anon, authenticated;

grant execute on function public.submit_native_waiver_atomic(jsonb) to service_role;
grant execute on function public.create_open_play_visit_atomic(jsonb) to service_role;
grant execute on function public.apply_open_play_visit_correction_atomic(jsonb) to service_role;
grant execute on function public.search_waiver_participants_for_staff(text, integer) to service_role;
grant execute on function public.get_waiver_completion_by_token_hash(text) to service_role;
