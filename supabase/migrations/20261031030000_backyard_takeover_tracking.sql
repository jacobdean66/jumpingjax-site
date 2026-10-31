begin;

insert into public.campaign_events (id, name, slug, status, offer_text, rules_text)
values ('backyard-takeover', 'Backyard Takeover — This Party Has No Chill', 'backyard-takeover', 'draft', 'Prize package to be finalized.', 'Contest dates, eligibility, judging criteria and entry rules are pending. Public entries are not open.')
on conflict (id) do nothing;

create table if not exists public.backyard_takeover_settings (
  campaign_id text primary key references public.campaign_events(id),
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint backyard_settings_scope check (campaign_id = 'backyard-takeover')
);
insert into public.backyard_takeover_settings(campaign_id) values ('backyard-takeover') on conflict do nothing;

create table if not exists public.backyard_takeover_terms (
  version text primary key check (version ~ '^[0-9a-f]{64}$'),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.backyard_takeover_visits (
  id uuid primary key,
  campaign_id text not null references public.campaign_events(id) check (campaign_id = 'backyard-takeover'),
  source text not null check (source in ('google','facebook','instagram','direct','email','other')),
  medium text not null default '', attribution_campaign text not null default '', content text not null default '',
  ad_campaign_id text not null default '', ad_id text not null default '',
  gclid text not null default '', fbclid text not null default '', gbraid text not null default '', wbraid text not null default '',
  created_at timestamptz not null default now(),
  link_opened_at timestamptz, landed_at timestamptz, form_started_at timestamptz, rental_clicked_at timestamptz,
  submitted_entry_id uuid references public.campaign_event_signups(id) on delete set null
);
create index if not exists backyard_visits_created_idx on public.backyard_takeover_visits(created_at desc);
alter table public.campaign_event_signups add column if not exists tracking_visit_id uuid references public.backyard_takeover_visits(id) on delete set null;
create unique index if not exists backyard_one_entry_per_email on public.campaign_event_signups(lower(email)) where event_id = 'backyard-takeover';

alter table public.backyard_takeover_settings enable row level security;
alter table public.backyard_takeover_visits enable row level security;
alter table public.backyard_takeover_terms enable row level security;
revoke all on public.backyard_takeover_settings, public.backyard_takeover_visits, public.backyard_takeover_terms from public, anon, authenticated;
grant all on public.backyard_takeover_settings, public.backyard_takeover_visits, public.backyard_takeover_terms to service_role;

create or replace function public.record_backyard_activity(p_visit_id uuid, p_kind text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_kind not in ('landing','form_started','rental_click') then raise exception 'Invalid activity'; end if;
  update public.backyard_takeover_visits set
    landed_at = case when p_kind='landing' then coalesce(landed_at,now()) else landed_at end,
    form_started_at = case when p_kind='form_started' then coalesce(form_started_at,now()) else form_started_at end,
    rental_clicked_at = case when p_kind='rental_click' then coalesce(rental_clicked_at,now()) else rental_clicked_at end
  where id=p_visit_id and campaign_id='backyard-takeover' and created_at > now()-interval '1 day';
  return found;
end; $$;

drop function if exists public.submit_backyard_entry(uuid,jsonb,jsonb,uuid);
create or replace function public.submit_backyard_entry(p_id uuid, p_customer jsonb, p_details jsonb, p_visit_id uuid, p_terms jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_event public.campaign_events; v_config jsonb; v_visit public.backyard_takeover_visits; v_id uuid; v_email text; v_terms jsonb; v_version text; v_details jsonb;
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
  perform pg_advisory_xact_lock(hashtextextended('backyard-entry:'||v_email,0));
  select id into v_id from public.campaign_event_signups where event_id='backyard-takeover' and lower(email)=v_email;
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

create or replace function public.backyard_tracking_summary(p_since date, p_until date)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
with bounds as (
 select p_since::timestamp at time zone 'America/New_York' as starts, (p_until+1)::timestamp at time zone 'America/New_York' as ends
), visits as (
 select v.* from public.backyard_takeover_visits v,bounds b where v.created_at>=b.starts and v.created_at<b.ends
), entries as (
 select e.* from public.campaign_event_signups e,bounds b where e.event_id='backyard-takeover' and e.created_at>=b.starts and e.created_at<b.ends
), public_entries as (select * from entries where landing_url='/campaigns/backyard-takeover'), source_names as (
 select source from visits union select coalesce(utm_source,'direct') from public_entries
), source_rows as (
 select s.source,
 (select count(*) from visits v where v.source=s.source and link_opened_at is not null) as opens,
 (select count(*) from visits v where v.source=s.source and landed_at is not null) as visits,
 (select count(*) from visits v where v.source=s.source and form_started_at is not null) as starts,
 (select count(*) from public_entries e where coalesce(e.utm_source,'direct')=s.source) as entries
 from source_names s
)
select jsonb_build_object(
 'opens',(select count(*) from visits where link_opened_at is not null), 'visits',(select count(*) from visits where landed_at is not null),
 'starts',(select count(*) from visits where form_started_at is not null), 'rentalClicks',(select count(*) from visits where rental_clicked_at is not null),
 'entries',(select count(*) from public_entries), 'manualEntries',(select count(*) from entries where landing_url is distinct from '/campaigns/backyard-takeover'),
 'photos',(select coalesce(sum(jsonb_array_length(coalesce(notes::jsonb->'photos','[]'::jsonb))),0) from public_entries),
 'sources',coalesce((select jsonb_agg(to_jsonb(s) order by s.visits desc,s.source) from source_rows s),'[]'::jsonb),
 'recent',coalesce((select jsonb_agg(r order by r.at desc) from (
   select created_at as at,source,link_opened_at is not null as opened,landed_at is not null as landed,form_started_at is not null as started,submitted_entry_id is not null as submitted
   from visits order by created_at desc limit 30
 ) r),'[]'::jsonb)
); $$;

revoke all on function public.record_backyard_activity(uuid,text), public.submit_backyard_entry(uuid,jsonb,jsonb,uuid,jsonb), public.backyard_tracking_summary(date,date) from public,anon,authenticated;
grant execute on function public.record_backyard_activity(uuid,text), public.submit_backyard_entry(uuid,jsonb,jsonb,uuid,jsonb), public.backyard_tracking_summary(date,date) to service_role;

notify pgrst, 'reload schema';

commit;
