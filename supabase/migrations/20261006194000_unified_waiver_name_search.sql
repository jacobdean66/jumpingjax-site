-- First, last, full, and partially typed names use the same matching rules.
create or replace function public.search_waiver_participants_for_staff(p_query text,p_limit integer default 25)
returns table(participant_id uuid,submission_id uuid,first_name text,last_name text,dob date,role text,
  expires_on date,signer_first_name text,signer_last_name text,original_first_name text,original_last_name text,name_corrected boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
declare q text:=lower(regexp_replace(trim(coalesce(p_query,'')),'\s+',' ','g')); lim integer:=greatest(1,least(coalesce(p_limit,25),25));
begin
  if length(q)<1 or length(q)>80 or q ~ '[%_,()\\]' then raise exception 'invalid_search_query' using errcode='22023'; end if;
  return query
  with displayed as (
    select p.*,coalesce(c.corrected_first_name,p.first_name) as df,coalesce(c.corrected_last_name,p.last_name) as dl,c.id is not null as corrected,
      s.expires_on,s.signer_first_name,s.signer_last_name
    from waiver_participants p join waiver_submissions s on s.id=p.submission_id
    left join lateral(select * from waiver_participant_name_corrections c where c.participant_id=p.id order by c.created_at desc,c.id desc limit 1)c on true
    where s.status='completed'
  ), matched as (
    select d.submission_id,min(case when lower(d.df || ' ' || d.dl)=q then 0 when lower(d.df)=q or lower(d.dl)=q then 1 else 2 end) as rank
    from displayed d where
      not exists(select 1 from unnest(string_to_array(q,' ')) token where
        position(token in lower(concat_ws(' ',d.df,d.dl,d.first_name,d.last_name,d.signer_first_name,d.signer_last_name)))=0)
      or q=to_char(d.dob,'YYYY') or q=to_char(d.dob,'YYYY-MM-DD')
    group by d.submission_id
  )
  select d.id,d.submission_id,d.df,d.dl,d.dob,d.role,d.expires_on,d.signer_first_name,d.signer_last_name,d.first_name,d.last_name,d.corrected
  from displayed d join matched m on m.submission_id=d.submission_id
  order by m.rank,case when lower(d.df || ' ' || d.dl)=q then 0 when lower(d.df)=q or lower(d.dl)=q then 1 else 2 end,d.dl,d.df,d.id limit lim;
end; $$;

create or replace function public.search_smartwaiver_legacy_participants_for_staff(p_query text,p_limit integer default 25)
returns table(legacy_participant_id uuid,legacy_waiver_id uuid,waiver_id text,first_name text,last_name text,dob date,role text,
  expires_on date,signer_first_name text,signer_last_name text,check_in_eligible boolean,source_label text,
  original_first_name text,original_last_name text,name_corrected boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
declare q text:=lower(regexp_replace(trim(coalesce(p_query,'')),'\s+',' ','g')); lim integer:=greatest(1,least(coalesce(p_limit,25),25));
begin
  if length(q)<1 or length(q)>80 or q ~ '[%_,()\\]' then raise exception 'invalid_search_query' using errcode='22023'; end if;
  return query
  with displayed as (
    select p.*,coalesce(c.corrected_first_name,p.first_name) as df,coalesce(c.corrected_last_name,p.last_name) as dl,c.id is not null as corrected,
      w.expires_on,w.signer_first_name,w.signer_last_name
    from smartwaiver_legacy_participants p join smartwaiver_legacy_waivers w on w.id=p.legacy_waiver_id
    left join lateral(select * from smartwaiver_legacy_participant_name_corrections c where c.legacy_participant_id=p.id order by c.created_at desc,c.id desc limit 1)c on true
    where w.activated
  ), matched as (
    select d.legacy_waiver_id,min(case when lower(d.df || ' ' || d.dl)=q then 0 when lower(d.df)=q or lower(d.dl)=q then 1 else 2 end) as rank
    from displayed d where
      not exists(select 1 from unnest(string_to_array(q,' ')) token where
        position(token in lower(concat_ws(' ',d.df,d.dl,d.first_name,d.last_name,d.signer_first_name,d.signer_last_name)))=0)
      or q=to_char(d.dob,'YYYY') or q=to_char(d.dob,'YYYY-MM-DD')
    group by d.legacy_waiver_id
  )
  select d.id,d.legacy_waiver_id,d.waiver_id,d.df,d.dl,d.dob,d.role,d.expires_on,d.signer_first_name,d.signer_last_name,
    (d.dob is not null and d.expires_on>(timezone('America/New_York',now()))::date),'Legacy Smartwaiver'::text,d.first_name,d.last_name,d.corrected
  from displayed d join matched m on m.legacy_waiver_id=d.legacy_waiver_id
  order by m.rank,case when lower(d.df || ' ' || d.dl)=q then 0 when lower(d.df)=q or lower(d.dl)=q then 1 else 2 end,d.dl,d.df,d.id limit lim;
end; $$;
revoke all on function public.search_waiver_participants_for_staff(text,integer),public.search_smartwaiver_legacy_participants_for_staff(text,integer) from public,anon,authenticated;
grant execute on function public.search_waiver_participants_for_staff(text,integer),public.search_smartwaiver_legacy_participants_for_staff(text,integer) to service_role;
