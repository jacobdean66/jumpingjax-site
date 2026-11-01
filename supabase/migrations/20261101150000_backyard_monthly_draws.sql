-- Retain all entries and accepted terms; enforce uniqueness separately in each Eastern calendar month.
alter table public.campaign_event_signups add column if not exists backyard_month text;
update public.campaign_event_signups set backyard_month=to_char(created_at at time zone 'America/New_York','YYYY-MM')
  where event_id='backyard-takeover' and backyard_month is null;
drop index if exists public.backyard_one_entry_per_email;
create unique index if not exists backyard_one_entry_per_email_month
  on public.campaign_event_signups (lower(email),backyard_month) where event_id='backyard-takeover';

create or replace function public.assign_backyard_month() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.event_id='backyard-takeover' then
    new.backyard_month := to_char(coalesce(new.created_at,now()) at time zone 'America/New_York','YYYY-MM');
  end if;
  return new;
end; $$;
drop trigger if exists assign_backyard_month on public.campaign_event_signups;
create trigger assign_backyard_month before insert on public.campaign_event_signups for each row execute function public.assign_backyard_month();

-- Roll forward only an explicitly enabled, published monthly campaign; keep past entries untouched.
create or replace function public.refresh_backyard_month() returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_status text; v_config jsonb; v_start timestamp; v_end timestamp; v_start_utc timestamptz; v_end_utc timestamptz;
begin
  select status into v_status from public.campaign_events where id='backyard-takeover' for update;
  select config into v_config from public.backyard_takeover_settings where campaign_id='backyard-takeover' for update;
  if v_status is distinct from 'published' or coalesce(v_config->>'monthly','false') <> 'true'
    or nullif(v_config->>'closesAt','') is null or now() < (v_config->>'closesAt')::timestamptz then return false; end if;
  v_start := date_trunc('month',now() at time zone 'America/New_York');
  v_end := v_start + interval '1 month';
  v_start_utc := v_start at time zone 'America/New_York';
  v_end_utc := (v_end at time zone 'America/New_York') - interval '1 millisecond';
  v_config := v_config || jsonb_build_object(
    'opensAt',to_char(v_start_utc at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'closesAt',to_char(v_end_utc at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'announcesOn',to_char(v_end,'YYYY-MM-DD'));
  update public.backyard_takeover_settings set config=v_config,updated_at=now() where campaign_id='backyard-takeover';
  update public.campaign_events set event_date=(v_end - interval '1 day')::date,updated_at=now() where id='backyard-takeover';
  return true;
end; $$;

create table if not exists public.backyard_monthly_winners (
  month text primary key check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  entry_id uuid not null references public.campaign_event_signups(id),
  drawn_at timestamptz not null default now()
);
alter table public.backyard_monthly_winners enable row level security;
revoke all on public.backyard_monthly_winners from public,anon,authenticated;
grant select,insert on public.backyard_monthly_winners to service_role;

-- A month is drawn once, after it has ended. Repeated requests return the original result.
create or replace function public.draw_backyard_month(p_month text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_existing uuid; v_id uuid; v_end timestamptz;
begin
  if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Choose a valid drawing month'; end if;
  v_end := ((p_month||'-01')::date + interval '1 month') at time zone 'America/New_York';
  if now() < v_end then raise exception 'The drawing month has not ended'; end if;
  perform pg_advisory_xact_lock(hashtextextended('backyard-draw:'||p_month,0));
  select entry_id into v_existing from public.backyard_monthly_winners where month=p_month;
  if v_existing is not null then return jsonb_build_object('id',v_existing,'created',false); end if;
  select id into v_id from public.campaign_event_signups where event_id='backyard-takeover' and backyard_month=p_month order by gen_random_uuid() limit 1;
  if v_id is null then raise exception 'There are no entries for this month'; end if;
  insert into public.backyard_monthly_winners(month,entry_id) values(p_month,v_id);
  update public.campaign_event_signups set notes=jsonb_set(coalesce(nullif(notes,'')::jsonb,'{}'::jsonb),'{status}','"winner"'::jsonb,true)::text where id=v_id;
  return jsonb_build_object('id',v_id,'created',true);
end; $$;

create or replace function public.submit_backyard_entry(p_id uuid,p_customer jsonb,p_details jsonb,p_visit_id uuid,p_terms jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_event public.campaign_events; v_config jsonb; v_visit public.backyard_takeover_visits; v_id uuid; v_email text; v_month text; v_terms jsonb; v_version text; v_details jsonb;
begin
  select * into v_event from public.campaign_events where id='backyard-takeover' for share;
  select config into v_config from public.backyard_takeover_settings where campaign_id='backyard-takeover' for share;
  if v_event.status <> 'published' or coalesce(v_config->>'rulesConfirmed','false') <> 'true'
    or nullif(v_config->>'opensAt','') is null or nullif(v_config->>'closesAt','') is null
    or now() < (v_config->>'opensAt')::timestamptz or now() >= (v_config->>'closesAt')::timestamptz
    then raise exception 'Entries are not open'; end if;
  if coalesce(p_details->>'entryPermission','false') <> 'true' or coalesce(p_details->>'rulesAccepted','false') <> 'true' or jsonb_array_length(coalesce(p_details->'photos','[]'::jsonb)) not between 1 and 3
    then raise exception 'Entry requirements are incomplete'; end if;
  v_terms := jsonb_build_object('rules',v_event.rules_text,'prize',v_event.offer_text,'opensAt',v_config->>'opensAt','closesAt',v_config->>'closesAt','announcesOn',v_config->>'announcesOn','eligibleArea',v_config->>'eligibleArea','retailValue',v_config->>'retailValue');
  if p_terms is distinct from v_terms then raise exception 'Contest terms changed'; end if;
  v_version := encode(sha256(convert_to(v_terms::text,'UTF8')),'hex');
  v_details := p_details || jsonb_build_object('rulesAccepted',true,'rulesVersion',v_version,'rulesAcceptedAt',now());
  v_email := lower(trim(p_customer->>'email'));
  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email'; end if;
  v_month := to_char(now() at time zone 'America/New_York','YYYY-MM');
  perform pg_advisory_xact_lock(hashtextextended('backyard-entry:'||v_month||':'||v_email,0));
  select id into v_id from public.campaign_event_signups where event_id='backyard-takeover' and lower(email)=v_email and backyard_month=v_month;
  if v_id is not null then return jsonb_build_object('id',v_id,'created',false); end if;
  insert into public.backyard_takeover_terms(version,snapshot) values(v_version,v_terms) on conflict do nothing;
  if p_visit_id is not null then select * into v_visit from public.backyard_takeover_visits where id=p_visit_id and campaign_id='backyard-takeover'; end if;
  insert into public.campaign_event_signups(id,event_id,parent_name,email,phone,player_count,notes,utm_source,utm_medium,utm_campaign,utm_content,landing_url,tracking_visit_id)
  values(p_id,'backyard-takeover',p_customer->>'name',v_email,coalesce(p_customer->>'phone',''),1,v_details::text,
    coalesce(v_visit.source,p_customer->>'source','direct'),coalesce(v_visit.medium,''),coalesce(v_visit.attribution_campaign,'backyard_takeover'),coalesce(v_visit.content,'duck_jeep_v5'),
    '/campaigns/backyard-takeover',v_visit.id);
  if v_visit.id is not null then update public.backyard_takeover_visits set submitted_entry_id=coalesce(submitted_entry_id,p_id) where id=v_visit.id; end if;
  return jsonb_build_object('id',p_id,'created',true);
end; $$;

revoke all on function public.assign_backyard_month(),public.refresh_backyard_month(),public.draw_backyard_month(text),public.submit_backyard_entry(uuid,jsonb,jsonb,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.refresh_backyard_month(),public.draw_backyard_month(text),public.submit_backyard_entry(uuid,jsonb,jsonb,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
