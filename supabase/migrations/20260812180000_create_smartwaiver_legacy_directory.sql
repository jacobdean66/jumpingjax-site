-- Smartwaiver searchable legacy directory (CSV-only; not Native Waiver evidence).
-- Additive. Does not rewrite Native waiver_submissions / participants / signatures / documents.

create table if not exists public.smartwaiver_legacy_import_batches (
  id uuid primary key default gen_random_uuid(),
  import_version text not null
    check (length(trim(import_version)) > 0 and length(import_version) <= 80),
  code_version text not null
    check (length(trim(code_version)) > 0 and length(code_version) <= 80),
  status text not null default 'pending'
    check (status in ('pending', 'validated', 'activated', 'rolled_back', 'failed')),
  dry_run boolean not null default true,
  source_manifest jsonb not null default '{}'::jsonb,
  raw_row_count integer not null default 0 check (raw_row_count >= 0),
  unique_waiver_id_count integer not null default 0 check (unique_waiver_id_count >= 0),
  duplicate_group_count integer not null default 0 check (duplicate_group_count >= 0),
  duplicate_row_count integer not null default 0 check (duplicate_row_count >= 0),
  core_conflict_count integer not null default 0 check (core_conflict_count >= 0),
  eligible_count integer not null default 0 check (eligible_count >= 0),
  skipped_missing_identity_count integer not null default 0 check (skipped_missing_identity_count >= 0),
  inserted_waiver_count integer not null default 0 check (inserted_waiver_count >= 0),
  reused_waiver_count integer not null default 0 check (reused_waiver_count >= 0),
  inserted_participant_count integer not null default 0 check (inserted_participant_count >= 0),
  additional_minors_imported integer not null default 0 check (additional_minors_imported >= 0),
  additional_minors_skipped integer not null default 0 check (additional_minors_skipped >= 0),
  notes text null check (notes is null or length(notes) <= 4000),
  created_at timestamptz not null default now(),
  activated_at timestamptz null
);

create table if not exists public.smartwaiver_legacy_waivers (
  id uuid primary key default gen_random_uuid(),
  waiver_id text not null
    check (length(trim(waiver_id)) > 0 and length(waiver_id) <= 120),
  signed_at timestamptz null,
  signed_on_ymd date null,
  expires_on date not null,
  waiver_title text null check (waiver_title is null or length(waiver_title) <= 300),
  tags text[] not null default '{}'::text[],
  check_ins text[] not null default '{}'::text[],
  marketing_consent boolean not null default false,
  phone text null check (phone is null or length(phone) <= 40),
  email text null check (email is null or length(email) <= 320),
  signer_first_name text null check (signer_first_name is null or length(signer_first_name) <= 100),
  signer_last_name text null check (signer_last_name is null or length(signer_last_name) <= 100),
  signer_dob date null,
  primary_first_name text not null check (length(trim(primary_first_name)) > 0 and length(primary_first_name) <= 100),
  primary_last_name text not null check (length(trim(primary_last_name)) > 0 and length(primary_last_name) <= 100),
  primary_dob date null,
  primary_role text not null
    check (primary_role in ('child', 'adult_signer', 'adult_covered')),
  source_files text[] not null default '{}'::text[],
  import_batch_id uuid not null
    references public.smartwaiver_legacy_import_batches (id)
    on delete restrict,
  activated boolean not null default true,
  created_at timestamptz not null default now(),
  constraint smartwaiver_legacy_waivers_waiver_id_uidx unique (waiver_id)
);

create table if not exists public.smartwaiver_legacy_participants (
  id uuid primary key default gen_random_uuid(),
  legacy_waiver_id uuid not null
    references public.smartwaiver_legacy_waivers (id)
    on delete restrict,
  waiver_id text not null
    check (length(trim(waiver_id)) > 0 and length(waiver_id) <= 120),
  participant_slot text not null
    check (participant_slot in ('primary', 'additional_minor')),
  minor_index integer null check (minor_index is null or (minor_index >= 1 and minor_index <= 10)),
  first_name text not null check (length(trim(first_name)) > 0 and length(first_name) <= 100),
  last_name text not null check (length(trim(last_name)) > 0 and length(last_name) <= 100),
  dob date null,
  role text not null check (role in ('child', 'adult_signer', 'adult_covered')),
  search_first_name text generated always as (lower(trim(first_name))) stored,
  search_last_name text generated always as (lower(trim(last_name))) stored,
  search_full_name text generated always as (lower(trim(first_name) || ' ' || trim(last_name))) stored,
  created_at timestamptz not null default now(),
  constraint smartwaiver_legacy_participants_slot_chk check (
    (participant_slot = 'primary' and minor_index is null)
    or (participant_slot = 'additional_minor' and minor_index is not null)
  )
);

create unique index if not exists smartwaiver_legacy_participants_slot_uidx
  on public.smartwaiver_legacy_participants (
    legacy_waiver_id,
    participant_slot,
    coalesce(minor_index, -1)
  );

create index if not exists smartwaiver_legacy_participants_search_first_name_idx
  on public.smartwaiver_legacy_participants (search_first_name);
create index if not exists smartwaiver_legacy_participants_search_last_name_idx
  on public.smartwaiver_legacy_participants (search_last_name);
create index if not exists smartwaiver_legacy_participants_search_full_name_idx
  on public.smartwaiver_legacy_participants (search_full_name);
create index if not exists smartwaiver_legacy_participants_waiver_id_idx
  on public.smartwaiver_legacy_participants (waiver_id);

create table if not exists public.smartwaiver_legacy_check_ins (
  id uuid primary key default gen_random_uuid(),
  legacy_participant_id uuid not null
    references public.smartwaiver_legacy_participants (id)
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
  age_years_on_visit integer null
    check (age_years_on_visit is null or (age_years_on_visit >= 0 and age_years_on_visit <= 130)),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  payment_method text null check (payment_method is null or payment_method in ('cash', 'card')),
  staff_id text not null check (length(trim(staff_id)) > 0 and length(staff_id) <= 120),
  source_kind text not null default 'legacy_smartwaiver'
    check (source_kind = 'legacy_smartwaiver'),
  status text not null default 'active' check (status in ('active', 'removed')),
  notes text null check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now()
);

create unique index if not exists smartwaiver_legacy_check_ins_active_same_day_uidx
  on public.smartwaiver_legacy_check_ins (legacy_participant_id, business_day_ymd)
  where status = 'active';

alter table public.smartwaiver_legacy_import_batches enable row level security;
alter table public.smartwaiver_legacy_waivers enable row level security;
alter table public.smartwaiver_legacy_participants enable row level security;
alter table public.smartwaiver_legacy_check_ins enable row level security;

drop policy if exists "No public smartwaiver_legacy_import_batches access" on public.smartwaiver_legacy_import_batches;
create policy "No public smartwaiver_legacy_import_batches access"
  on public.smartwaiver_legacy_import_batches for all to anon, authenticated
  using (false) with check (false);

drop policy if exists "No public smartwaiver_legacy_waivers access" on public.smartwaiver_legacy_waivers;
create policy "No public smartwaiver_legacy_waivers access"
  on public.smartwaiver_legacy_waivers for all to anon, authenticated
  using (false) with check (false);

drop policy if exists "No public smartwaiver_legacy_participants access" on public.smartwaiver_legacy_participants;
create policy "No public smartwaiver_legacy_participants access"
  on public.smartwaiver_legacy_participants for all to anon, authenticated
  using (false) with check (false);

drop policy if exists "No public smartwaiver_legacy_check_ins access" on public.smartwaiver_legacy_check_ins;
create policy "No public smartwaiver_legacy_check_ins access"
  on public.smartwaiver_legacy_check_ins for all to anon, authenticated
  using (false) with check (false);

create or replace function public.search_smartwaiver_legacy_participants_for_staff(
  p_query text,
  p_limit integer default 25
)
returns table (
  legacy_participant_id uuid,
  legacy_waiver_id uuid,
  waiver_id text,
  first_name text,
  last_name text,
  dob date,
  role text,
  expires_on date,
  signer_first_name text,
  signer_last_name text,
  check_in_eligible boolean,
  source_label text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_q text := lower(trim(both from coalesce(p_query, '')));
  v_like text;
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 25));
  v_today date := (timezone('America/New_York', now()))::date;
begin
  if length(v_q) < 2 or length(v_q) > 80 then
    raise exception 'invalid_search_query' using errcode = '22023';
  end if;
  if v_q ~ '[%_,()\\]' or v_q = '%' or v_q = '_' then
    raise exception 'invalid_search_query' using errcode = '22023';
  end if;
  v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select
    p.id,
    p.legacy_waiver_id,
    p.waiver_id,
    p.first_name,
    p.last_name,
    p.dob,
    p.role,
    w.expires_on,
    w.signer_first_name,
    w.signer_last_name,
    (p.dob is not null and w.expires_on > v_today) as check_in_eligible,
    'Legacy Smartwaiver'::text as source_label
  from public.smartwaiver_legacy_participants p
  join public.smartwaiver_legacy_waivers w on w.id = p.legacy_waiver_id
  where w.activated = true
    and (
      p.search_first_name like v_like escape '\'
      or p.search_last_name like v_like escape '\'
      or p.search_full_name like v_like escape '\'
      or (
        length(v_q) = 4
        and v_q ~ '^\d{4}$'
        and p.dob is not null
        and to_char(p.dob, 'YYYY') = v_q
      )
      or (
        length(v_q) = 10
        and v_q ~ '^\d{4}-\d{2}-\d{2}$'
        and p.dob is not null
        and to_char(p.dob, 'YYYY-MM-DD') = v_q
      )
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
    p.dob nulls last,
    p.id
  limit v_limit;
end;
$$;

revoke all on function public.search_smartwaiver_legacy_participants_for_staff(text, integer)
  from public, anon, authenticated;
grant execute on function public.search_smartwaiver_legacy_participants_for_staff(text, integer)
  to service_role;
