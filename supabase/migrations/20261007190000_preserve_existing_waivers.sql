begin;

-- New signing evidence requirements must not revoke previously completed waivers.
alter table public.waiver_templates add column typed_agreements_from_version_id uuid
  references public.waiver_template_versions(id);
update public.waiver_templates
  set typed_agreements_from_version_id=required_version_id, required_version_id=null
  where required_version_id is not null;

create or replace function public.enforce_completed_group_agreements() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare required_number integer; signed_number integer;
begin
  select rv.version_number,sv.version_number into required_number,signed_number
    from public.waiver_templates t
    join public.waiver_template_versions rv on rv.id=t.typed_agreements_from_version_id
    join public.waiver_template_versions sv on sv.id=new.template_version_id
    where t.id=new.template_id;
  if new.source <> 'import' and signed_number>=required_number then
    if not exists(select 1 from public.waiver_group_records where submission_id=new.id)
      or (select count(*) from public.waiver_adult_agreements where submission_id=new.id)
      <> (select count(*) from public.waiver_participants where submission_id=new.id and role<>'child') then
      raise exception 'typed_adult_agreements_required' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_desk_native_waiver_policy() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare participant_role text; participant_dob date; submission_status text;
  expires date; typed_group boolean;
begin
  if new.source='native' then
    select p.role,p.dob,s.status,s.expires_on,
      exists(select 1 from public.waiver_group_records g where g.submission_id=s.id)
    into participant_role,participant_dob,submission_status,expires,typed_group
    from public.waiver_participants p join public.waiver_submissions s on s.id=p.submission_id
    where p.id=new.participant_id;
    if submission_status is distinct from 'completed' or expires<=new.business_day_ymd::date then
      raise exception 'A current completed waiver is required before admission.' using errcode='22023';
    end if;
    -- The age-18 renewal term belongs to the new group agreement only.
    if typed_group and participant_role='child'
      and public.jj_age_years_on_date(participant_dob,new.business_day_ymd::date)>=18 then
      raise exception 'This guest is now 18 and must sign their own adult waiver.' using errcode='22023';
    end if;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
commit;
