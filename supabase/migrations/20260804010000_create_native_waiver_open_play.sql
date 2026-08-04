-- Native waiver + Open Play foundation (additive only).
-- NOT applied by agents; owner/ops apply separately.
-- Legal note: three-year calendar expiration rule requires attorney/insurer confirmation.

-- ---------------------------------------------------------------------------
-- Helpers: append-only / immutable guards
-- ---------------------------------------------------------------------------
create or replace function public.prevent_append_only_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only and cannot be updated or deleted', tg_table_name;
end;
$$;

create or replace function public.prevent_published_waiver_version_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'waiver_template_versions cannot be deleted after publish';
  end if;
  if new.body_html is distinct from old.body_html
     or new.body_sha256 is distinct from old.body_sha256
     or new.version_number is distinct from old.version_number
     or new.template_id is distinct from old.template_id
     or new.published_at is distinct from old.published_at then
    raise exception 'published waiver_template_versions body/version metadata are immutable';
  end if;
  return new;
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
  public_token text not null unique
    check (length(public_token) >= 32 and length(public_token) <= 128),
  idempotency_key text null unique
    check (idempotency_key is null or (length(trim(idempotency_key)) > 0 and length(idempotency_key) <= 128)),
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
  source text not null
    check (source in ('web', 'kiosk', 'import')),
  status text not null default 'completed'
    check (status in ('completed', 'voided')),
  smartwaiver_external_id text null
    check (smartwaiver_external_id is null or length(trim(smartwaiver_external_id)) > 0),
  created_at timestamptz not null default now()
);

create unique index if not exists waiver_submissions_smartwaiver_external_id_uidx
  on public.waiver_submissions (smartwaiver_external_id)
  where smartwaiver_external_id is not null;

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
    )
);

create table if not exists public.waiver_signatures (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique
    references public.waiver_submissions (id)
    on delete restrict,
  storage_path text not null
    check (length(trim(storage_path)) > 0 and length(storage_path) <= 512),
  content_type text not null
    check (length(trim(content_type)) > 0 and length(content_type) <= 120),
  ip_hash text null
    check (ip_hash is null or ip_hash ~ '^[a-f0-9]{64}$'),
  user_agent text null
    check (user_agent is null or length(user_agent) <= 512),
  consent_payload jsonb not null default '{}'::jsonb,
  signed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.waiver_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique
    references public.waiver_submissions (id)
    on delete restrict,
  storage_path text not null
    check (length(trim(storage_path)) > 0 and length(storage_path) <= 512),
  sha256 text not null
    check (sha256 ~ '^[a-f0-9]{64}$'),
  generated_at timestamptz not null default now(),
  source text not null default 'pending'
    check (source in ('pending', 'generated', 'imported')),
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'failed')),
  created_at timestamptz not null default now()
);

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
  created_at timestamptz not null default now()
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
  unique (visit_id, participant_id)
);

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
      (entry_type = 'charge' and reason is null)
      or (entry_type <> 'charge' and reason is not null)
    )
);

drop trigger if exists prevent_open_play_payment_entry_mutation
  on public.open_play_payment_entries;
create trigger prevent_open_play_payment_entry_mutation
  before update or delete on public.open_play_payment_entries
  for each row
  execute function public.prevent_append_only_mutation();

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
-- Smartwaiver import staging (generic; no invented CSV columns)
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
create index if not exists waiver_submissions_status_idx
  on public.waiver_submissions (status);

create index if not exists open_play_visits_business_day_ymd_idx
  on public.open_play_visits (business_day_ymd);
create index if not exists open_play_visits_visit_date_idx
  on public.open_play_visits (visit_date);
create index if not exists open_play_visit_attendees_visit_id_idx
  on public.open_play_visit_attendees (visit_id);
create index if not exists open_play_visit_attendees_participant_id_idx
  on public.open_play_visit_attendees (participant_id);
create index if not exists open_play_payment_entries_visit_id_idx
  on public.open_play_payment_entries (visit_id);
create index if not exists open_play_payment_entries_created_at_idx
  on public.open_play_payment_entries (created_at);
create index if not exists open_play_audit_events_entity_idx
  on public.open_play_audit_events (entity_type, entity_id);
create index if not exists open_play_audit_events_created_at_idx
  on public.open_play_audit_events (created_at desc);

create index if not exists smartwaiver_import_rows_batch_status_idx
  on public.smartwaiver_import_rows (batch_id, status);
create index if not exists smartwaiver_document_imports_batch_status_idx
  on public.smartwaiver_document_imports (batch_id, status);

-- ---------------------------------------------------------------------------
-- RLS deny-all (service role bypasses; public/anon blocked)
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
