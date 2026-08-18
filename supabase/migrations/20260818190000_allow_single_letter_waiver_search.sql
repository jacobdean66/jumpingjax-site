-- Admin check-in searches from the first typed letter.
-- Keep the service-role-only boundary and existing wildcard protections.

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

revoke all on function public.search_waiver_participants_for_staff(text, integer)
  from public, anon, authenticated;
grant execute on function public.search_waiver_participants_for_staff(text, integer)
  to service_role;

revoke all on function public.search_smartwaiver_legacy_participants_for_staff(text, integer)
  from public, anon, authenticated;
grant execute on function public.search_smartwaiver_legacy_participants_for_staff(text, integer)
  to service_role;
