-- Editable legacy Smartwaiver display names for staff search/check-in.
-- Additive only: imported Smartwaiver source rows and documents remain immutable.

create table if not exists public.smartwaiver_legacy_participant_name_corrections (
  id uuid primary key default gen_random_uuid(),
  legacy_participant_id uuid not null
    references public.smartwaiver_legacy_participants (id)
    on delete restrict,
  legacy_waiver_id uuid not null
    references public.smartwaiver_legacy_waivers (id)
    on delete restrict,
  original_first_name text not null
    check (length(trim(original_first_name)) > 0 and length(original_first_name) <= 80),
  original_last_name text not null
    check (length(trim(original_last_name)) > 0 and length(original_last_name) <= 80),
  corrected_first_name text not null
    check (length(trim(corrected_first_name)) > 0 and length(corrected_first_name) <= 80),
  corrected_last_name text not null
    check (length(trim(corrected_last_name)) > 0 and length(corrected_last_name) <= 80),
  corrected_search_first_name text generated always as (lower(trim(corrected_first_name))) stored,
  corrected_search_last_name text generated always as (lower(trim(corrected_last_name))) stored,
  corrected_search_full_name text generated always as (lower(trim(corrected_first_name) || ' ' || trim(corrected_last_name))) stored,
  reason text not null
    check (length(trim(reason)) > 0 and length(reason) <= 500),
  corrected_by_staff_id text not null
    check (length(trim(corrected_by_staff_id)) > 0),
  created_at timestamptz not null default now(),
  append_only boolean not null default true
    check (append_only = true)
);

create index if not exists smartwaiver_legacy_participant_name_corrections_participant_created_idx
  on public.smartwaiver_legacy_participant_name_corrections (legacy_participant_id, created_at desc, id desc);
create index if not exists smartwaiver_legacy_participant_name_corrections_search_first_idx
  on public.smartwaiver_legacy_participant_name_corrections (corrected_search_first_name);
create index if not exists smartwaiver_legacy_participant_name_corrections_search_last_idx
  on public.smartwaiver_legacy_participant_name_corrections (corrected_search_last_name);
create index if not exists smartwaiver_legacy_participant_name_corrections_search_full_idx
  on public.smartwaiver_legacy_participant_name_corrections (corrected_search_full_name);

drop trigger if exists prevent_smartwaiver_legacy_participant_name_correction_mutation_trg
  on public.smartwaiver_legacy_participant_name_corrections;
create trigger prevent_smartwaiver_legacy_participant_name_correction_mutation_trg
  before update or delete on public.smartwaiver_legacy_participant_name_corrections
  for each row
  execute function public.prevent_append_only_mutation();

alter table public.smartwaiver_legacy_participant_name_corrections enable row level security;

drop policy if exists "No public smartwaiver_legacy_participant_name_corrections access"
  on public.smartwaiver_legacy_participant_name_corrections;
create policy "No public smartwaiver_legacy_participant_name_corrections access"
  on public.smartwaiver_legacy_participant_name_corrections for all to anon, authenticated
  using (false) with check (false);

create or replace function public.correct_smartwaiver_legacy_participant_display_name_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_participant_id uuid := nullif(p_payload->>'legacy_participant_id', '')::uuid;
  v_staff text := nullif(trim(p_payload->>'staff_id'), '');
  v_first text := nullif(regexp_replace(trim(p_payload->>'first_name'), '\s+', ' ', 'g'), '');
  v_last text := nullif(regexp_replace(trim(p_payload->>'last_name'), '\s+', ' ', 'g'), '');
  v_reason text := nullif(regexp_replace(trim(p_payload->>'reason'), '\s+', ' ', 'g'), '');
  v_participant public.smartwaiver_legacy_participants%rowtype;
  v_latest public.smartwaiver_legacy_participant_name_corrections%rowtype;
  v_original_first text;
  v_original_last text;
  v_correction_id uuid;
  v_created_at timestamptz;
begin
  if v_participant_id is null or v_staff is null
     or v_first is null or v_last is null or v_reason is null
     or length(v_first) > 80 or length(v_last) > 80 or length(v_reason) > 500
     or v_first !~ '^[A-Za-z0-9][A-Za-z0-9 ''\.-]*$'
     or v_last !~ '^[A-Za-z0-9][A-Za-z0-9 ''\.-]*$' then
    return jsonb_build_object('outcome', 'invalid_input');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('smartwaiver_legacy_participant_name:' || v_participant_id::text, 0));

  select * into v_participant
  from public.smartwaiver_legacy_participants
  where id = v_participant_id;

  if not found then
    return jsonb_build_object('outcome', 'participant_not_found');
  end if;

  select * into v_latest
  from public.smartwaiver_legacy_participant_name_corrections
  where legacy_participant_id = v_participant_id
  order by created_at desc, id desc
  limit 1;

  v_original_first := coalesce(v_latest.corrected_first_name, v_participant.first_name);
  v_original_last := coalesce(v_latest.corrected_last_name, v_participant.last_name);

  if lower(v_original_first) = lower(v_first) and lower(v_original_last) = lower(v_last) then
    return jsonb_build_object('outcome', 'no_change');
  end if;

  v_correction_id := gen_random_uuid();
  v_created_at := now();

  insert into public.smartwaiver_legacy_participant_name_corrections (
    id, legacy_participant_id, legacy_waiver_id,
    original_first_name, original_last_name,
    corrected_first_name, corrected_last_name,
    reason, corrected_by_staff_id, created_at
  ) values (
    v_correction_id, v_participant.id, v_participant.legacy_waiver_id,
    v_original_first, v_original_last,
    v_first, v_last,
    v_reason, v_staff, v_created_at
  );

  insert into public.open_play_audit_events (
    actor_staff_id, action, entity_type, entity_id, detail
  ) values (
    v_staff,
    'smartwaiver_legacy_participant_name_corrected',
    'smartwaiver_legacy_participant',
    v_participant.id::text,
    jsonb_build_object(
      'correctionId', v_correction_id,
      'legacyParticipantId', v_participant.id,
      'legacyWaiverId', v_participant.legacy_waiver_id,
      'original', jsonb_build_object('firstName', v_original_first, 'lastName', v_original_last),
      'corrected', jsonb_build_object('firstName', v_first, 'lastName', v_last),
      'reason', v_reason,
      'signedName', jsonb_build_object('firstName', v_participant.first_name, 'lastName', v_participant.last_name)
    )
  );

  return jsonb_build_object(
    'outcome', 'corrected',
    'participant_id', '',
    'submission_id', '',
    'legacy_participant_id', v_participant.id,
    'legacy_waiver_id', v_participant.legacy_waiver_id,
    'original_first_name', v_original_first,
    'original_last_name', v_original_last,
    'corrected_first_name', v_first,
    'corrected_last_name', v_last,
    'corrected_at', v_created_at
  );
exception
  when sqlstate 'P0001' then
    return jsonb_build_object('outcome', SQLERRM);
  when others then
    return jsonb_build_object('outcome', 'failed', 'error_code', SQLSTATE);
end;
$$;

drop function if exists public.search_smartwaiver_legacy_participants_for_staff(text, integer);

create function public.search_smartwaiver_legacy_participants_for_staff(
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
  source_label text,
  original_first_name text,
  original_last_name text,
  name_corrected boolean
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
  if length(v_q) < 1 or length(v_q) > 80 then
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
    coalesce(c.corrected_first_name, p.first_name) as first_name,
    coalesce(c.corrected_last_name, p.last_name) as last_name,
    p.dob,
    p.role,
    w.expires_on,
    w.signer_first_name,
    w.signer_last_name,
    (p.dob is not null and w.expires_on > v_today) as check_in_eligible,
    'Legacy Smartwaiver'::text as source_label,
    p.first_name as original_first_name,
    p.last_name as original_last_name,
    (c.id is not null) as name_corrected
  from public.smartwaiver_legacy_participants p
  join public.smartwaiver_legacy_waivers w on w.id = p.legacy_waiver_id
  left join lateral (
    select *
    from public.smartwaiver_legacy_participant_name_corrections c
    where c.legacy_participant_id = p.id
    order by c.created_at desc, c.id desc
    limit 1
  ) c on true
  where w.activated = true
    and (
      lower(trim(coalesce(c.corrected_first_name, p.first_name))) like v_like escape '\'
      or lower(trim(coalesce(c.corrected_last_name, p.last_name))) like v_like escape '\'
      or lower(trim(coalesce(c.corrected_first_name, p.first_name) || ' ' || coalesce(c.corrected_last_name, p.last_name))) like v_like escape '\'
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
      when lower(trim(coalesce(c.corrected_first_name, p.first_name) || ' ' || coalesce(c.corrected_last_name, p.last_name))) = v_q then 0
      when lower(trim(coalesce(c.corrected_first_name, p.first_name))) = v_q
        or lower(trim(coalesce(c.corrected_last_name, p.last_name))) = v_q then 1
      when lower(trim(coalesce(c.corrected_first_name, p.first_name) || ' ' || coalesce(c.corrected_last_name, p.last_name))) like (v_q || '%') escape '\' then 2
      when lower(trim(coalesce(c.corrected_first_name, p.first_name))) like (v_q || '%') escape '\'
        or lower(trim(coalesce(c.corrected_last_name, p.last_name))) like (v_q || '%') escape '\' then 3
      else 4
    end,
    coalesce(c.corrected_last_name, p.last_name),
    coalesce(c.corrected_first_name, p.first_name),
    p.dob nulls last,
    p.id
  limit v_limit;
end;
$$;

create or replace function public.list_smartwaiver_legacy_same_day_conflicts(
  p_business_day_ymd text,
  p_legacy_participant_ids uuid[]
)
returns table (
  attendee_id uuid,
  visit_id uuid,
  legacy_participant_id uuid,
  legacy_waiver_id uuid,
  first_name text,
  last_name text,
  original_first_name text,
  original_last_name text,
  name_corrected boolean,
  classification text,
  unit_price_cents integer,
  created_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    a.id as attendee_id,
    a.legacy_visit_id as visit_id,
    a.legacy_participant_id,
    p.legacy_waiver_id,
    coalesce(c.corrected_first_name, p.first_name) as first_name,
    coalesce(c.corrected_last_name, p.last_name) as last_name,
    p.first_name as original_first_name,
    p.last_name as original_last_name,
    (c.id is not null) as name_corrected,
    a.classification,
    a.unit_price_cents,
    a.created_at
  from public.smartwaiver_legacy_check_ins a
  join public.smartwaiver_legacy_participants p on p.id = a.legacy_participant_id
  join public.smartwaiver_legacy_visits v on v.id = a.legacy_visit_id
  left join lateral (
    select *
    from public.smartwaiver_legacy_participant_name_corrections c
    where c.legacy_participant_id = p.id
    order by c.created_at desc, c.id desc
    limit 1
  ) c on true
  where v.business_day_ymd = p_business_day_ymd
    and a.status = 'active'
    and a.legacy_participant_id = any(p_legacy_participant_ids)
  order by a.created_at, a.id;
$$;

revoke all on function public.correct_smartwaiver_legacy_participant_display_name_atomic(jsonb) from public, anon, authenticated;
revoke all on function public.search_smartwaiver_legacy_participants_for_staff(text, integer) from public, anon, authenticated;
revoke all on function public.list_smartwaiver_legacy_same_day_conflicts(text, uuid[]) from public, anon, authenticated;
grant execute on function public.correct_smartwaiver_legacy_participant_display_name_atomic(jsonb) to service_role;
grant execute on function public.search_smartwaiver_legacy_participants_for_staff(text, integer) to service_role;
grant execute on function public.list_smartwaiver_legacy_same_day_conflicts(text, uuid[]) to service_role;
