-- Older kiosk/party/admin callers may still create an original visit during rollout.
-- Keep those arrivals visible on the new desk without generating another payment.
create function public.sync_existing_open_play_arrival_to_desk() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare p record; v_source text; v_staff text;
begin
  if new.status<>'active' then return new;end if;
  if tg_table_name='open_play_visit_attendees' then
    select w.id,w.first_name,w.last_name,w.dob,w.role,s.expires_on into p
      from waiver_participants w join waiver_submissions s on s.id=w.submission_id where w.id=new.participant_id;
    select created_by_staff_id into v_staff from open_play_visits where id=new.visit_id;
    v_source := 'native';
  else
    select w.id,w.first_name,w.last_name,w.dob,w.role,s.expires_on into p
      from smartwaiver_legacy_participants w join smartwaiver_legacy_waivers s on s.id=w.legacy_waiver_id where w.id=new.legacy_participant_id;
    v_staff := new.staff_id; v_source := 'legacy_smartwaiver';
  end if;
  insert into open_play_desk_attendance(business_day_ymd,source,participant_id,legacy_participant_id,identity_key,
    first_name,last_name,dob,role,waiver_expires_on,checked_in_at,created_by_staff_id)
  values(new.business_day_ymd,v_source,case when v_source='native' then p.id end,case when v_source='legacy_smartwaiver' then p.id end,
    lower(regexp_replace(trim(p.first_name),'\s+',' ','g')) || '|' || lower(regexp_replace(trim(p.last_name),'\s+',' ','g')) || '|' || coalesce(p.dob::text,v_source || ':' || p.id::text),
    p.first_name,p.last_name,p.dob,p.role,p.expires_on,new.created_at,coalesce(v_staff,'existing-check-in'))
  on conflict(business_day_ymd,identity_key) do nothing;
  return new;
end;$$;
revoke all on function public.sync_existing_open_play_arrival_to_desk() from public,anon,authenticated;
create trigger sync_native_arrival_to_desk after insert on public.open_play_visit_attendees
for each row execute function public.sync_existing_open_play_arrival_to_desk();
create trigger sync_legacy_arrival_to_desk after insert on public.smartwaiver_legacy_check_ins
for each row execute function public.sync_existing_open_play_arrival_to_desk();
-- Reconcile arrivals received between the initial backfill and this compatibility trigger.
insert into public.open_play_desk_attendance(business_day_ymd,source,participant_id,legacy_participant_id,identity_key,
  first_name,last_name,dob,role,waiver_expires_on,checked_in_at,created_by_staff_id)
select a.business_day_ymd,'native',p.id,null,
  lower(regexp_replace(trim(p.first_name),'\s+',' ','g')) || '|' || lower(regexp_replace(trim(p.last_name),'\s+',' ','g')) || '|' || p.dob::text,
  p.first_name,p.last_name,p.dob,p.role,s.expires_on,a.created_at,v.created_by_staff_id
from open_play_visit_attendees a join waiver_participants p on p.id=a.participant_id join waiver_submissions s on s.id=p.submission_id join open_play_visits v on v.id=a.visit_id
where a.status='active' and v.status<>'voided' on conflict(business_day_ymd,identity_key) do nothing;
insert into public.open_play_desk_attendance(business_day_ymd,source,participant_id,legacy_participant_id,identity_key,
  first_name,last_name,dob,role,waiver_expires_on,checked_in_at,created_by_staff_id)
select a.business_day_ymd,'legacy_smartwaiver',null,p.id,
  lower(regexp_replace(trim(p.first_name),'\s+',' ','g')) || '|' || lower(regexp_replace(trim(p.last_name),'\s+',' ','g')) || '|' || coalesce(p.dob::text,'legacy_smartwaiver:' || p.id::text),
  p.first_name,p.last_name,p.dob,p.role,w.expires_on,a.created_at,a.staff_id
from smartwaiver_legacy_check_ins a join smartwaiver_legacy_participants p on p.id=a.legacy_participant_id join smartwaiver_legacy_waivers w on w.id=p.legacy_waiver_id join smartwaiver_legacy_visits v on v.id=a.legacy_visit_id
where a.status='active' and v.status<>'voided' on conflict(business_day_ymd,identity_key) do nothing;
