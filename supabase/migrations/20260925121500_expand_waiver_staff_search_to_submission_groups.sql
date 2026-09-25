-- Staff check-in needs to find the whole signed waiver group, not only the
-- individual participant whose name matched the search text.

drop function if exists public.search_waiver_participants_for_staff(text, integer);

create function public.search_waiver_participants_for_staff(
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
  signer_last_name text,
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
begin
  if length(v_q) < 2 or length(v_q) > 80 then
    raise exception 'invalid_search_query' using errcode = '22023';
  end if;
  if v_q ~ '[%_,()\\]' or v_q = '%' or v_q = '_' then
    raise exception 'invalid_search_query' using errcode = '22023';
  end if;
  v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  with participant_display as (
    select
      p.id,
      p.submission_id,
      coalesce(c.corrected_first_name, p.first_name) as display_first_name,
      coalesce(c.corrected_last_name, p.last_name) as display_last_name,
      lower(trim(coalesce(c.corrected_first_name, p.first_name))) as search_first_name,
      lower(trim(coalesce(c.corrected_last_name, p.last_name))) as search_last_name,
      lower(trim(coalesce(c.corrected_first_name, p.first_name) || ' ' || coalesce(c.corrected_last_name, p.last_name))) as search_full_name,
      p.first_name as original_first_name,
      p.last_name as original_last_name,
      p.dob,
      p.role,
      (c.id is not null) as name_corrected
    from public.waiver_participants p
    left join lateral (
      select *
      from public.waiver_participant_name_corrections c
      where c.participant_id = p.id
      order by c.created_at desc, c.id desc
      limit 1
    ) c on true
  ),
  matched_submissions as (
    select
      s.id as submission_id,
      min(
        case
          when pd.search_full_name = v_q then 0
          when lower(trim(s.signer_first_name || ' ' || s.signer_last_name)) = v_q then 0
          when pd.search_first_name = v_q or pd.search_last_name = v_q then 1
          when lower(trim(s.signer_first_name)) = v_q
            or lower(trim(s.signer_last_name)) = v_q then 1
          when pd.search_full_name like (v_q || '%') escape '\' then 2
          when lower(trim(s.signer_first_name || ' ' || s.signer_last_name)) like (v_q || '%') escape '\' then 2
          when pd.search_first_name like (v_q || '%') escape '\'
            or pd.search_last_name like (v_q || '%') escape '\'
            or lower(trim(s.signer_first_name)) like (v_q || '%') escape '\'
            or lower(trim(s.signer_last_name)) like (v_q || '%') escape '\' then 3
          else 4
        end
      ) as submission_rank
    from public.waiver_submissions s
    join participant_display pd on pd.submission_id = s.id
    where s.status = 'completed'
      and (
        pd.search_first_name like v_like escape '\'
        or pd.search_last_name like v_like escape '\'
        or pd.search_full_name like v_like escape '\'
        or lower(trim(s.signer_first_name)) like v_like escape '\'
        or lower(trim(s.signer_last_name)) like v_like escape '\'
        or lower(trim(s.signer_first_name || ' ' || s.signer_last_name)) like v_like escape '\'
      )
    group by s.id
  )
  select
    pd.id,
    pd.submission_id,
    pd.display_first_name as first_name,
    pd.display_last_name as last_name,
    pd.dob,
    pd.role,
    s.expires_on,
    s.signer_first_name,
    s.signer_last_name,
    pd.original_first_name,
    pd.original_last_name,
    pd.name_corrected
  from matched_submissions ms
  join public.waiver_submissions s on s.id = ms.submission_id
  join participant_display pd on pd.submission_id = s.id
  order by
    ms.submission_rank,
    case
      when pd.search_full_name = v_q then 0
      when pd.search_first_name = v_q or pd.search_last_name = v_q then 1
      when pd.role = 'adult_signer' then 2
      when pd.role = 'child' then 3
      else 4
    end,
    pd.display_last_name,
    pd.display_first_name,
    pd.dob,
    pd.id
  limit v_limit;
end;
$$;

revoke all on function public.search_waiver_participants_for_staff(text, integer) from public, anon, authenticated;
grant execute on function public.search_waiver_participants_for_staff(text, integer) to service_role;

