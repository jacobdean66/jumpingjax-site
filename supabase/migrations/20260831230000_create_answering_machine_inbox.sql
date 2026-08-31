-- Private WhatsApp answering-machine inbox.
-- Calls remain owner-reviewed drafts; this migration does not create bookings,
-- write external calendars, contact customers, or process payments.

create table if not exists public.answering_machine_calls (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'whatsapp' check (provider = 'whatsapp'),
  provider_call_id text not null unique,
  last_source_event_id text not null,
  caller_ref text not null,
  caller_display_name text,
  status text not null default 'received'
    check (status in ('received','in_progress','processing','needs_review','approved','rejected','failed')),
  service_kind text check (service_kind in ('rental','facility_party')),
  event_date date,
  facility_start_time time,
  rental_items text[] not null default '{}',
  transcript text not null default '',
  transcript_complete boolean not null default false,
  agent_summary text not null default '',
  owner_notes text not null default '',
  revision integer not null default 1 check (revision > 0),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(provider_call_id) between 1 and 240),
  check (length(last_source_event_id) between 1 and 300),
  check (length(caller_ref) between 1 and 240),
  check (caller_display_name is null or length(caller_display_name) <= 160),
  check (length(transcript) <= 50000),
  check (length(agent_summary) <= 2000),
  check (length(owner_notes) <= 2000),
  check (cardinality(rental_items) <= 20),
  check (status <> 'approved' or transcript_complete),
  check (status <> 'approved' or service_kind is not null),
  check (status <> 'approved' or event_date is not null),
  check (status <> 'approved' or service_kind <> 'facility_party' or facility_start_time is not null),
  check (status <> 'approved' or service_kind <> 'rental' or cardinality(rental_items) > 0)
);

create index if not exists answering_machine_calls_review_idx
  on public.answering_machine_calls(status, updated_at desc);

create table if not exists public.answering_machine_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.answering_machine_calls(id),
  source_event_id text not null,
  event_type text not null,
  actor_id text,
  summary text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (call_id, source_event_id),
  check (length(source_event_id) between 1 and 300),
  check (length(event_type) between 1 and 100),
  check (length(summary) between 1 and 500),
  check (jsonb_typeof(metadata) = 'object')
);

create index if not exists answering_machine_events_call_idx
  on public.answering_machine_events(call_id, created_at desc);

create or replace function public.upsert_whatsapp_answering_call(
  p_provider_call_id text,
  p_source_event_id text,
  p_caller_ref text,
  p_caller_display_name text,
  p_status text,
  p_transcript text,
  p_transcript_complete boolean,
  p_service_kind text,
  p_event_date date,
  p_facility_start_time time,
  p_rental_items text[],
  p_agent_summary text
)
returns public.answering_machine_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call public.answering_machine_calls;
begin
  if nullif(btrim(p_provider_call_id), '') is null or length(p_provider_call_id) > 240 then
    raise exception 'invalid provider call id';
  end if;
  if nullif(btrim(p_source_event_id), '') is null or length(p_source_event_id) > 300 then
    raise exception 'invalid source event id';
  end if;
  if nullif(btrim(p_caller_ref), '') is null or length(p_caller_ref) > 240 then
    raise exception 'invalid caller reference';
  end if;
  if p_status not in ('received','in_progress','processing','needs_review','failed') then
    raise exception 'invalid provider status';
  end if;
  if p_service_kind is not null and p_service_kind not in ('rental','facility_party') then
    raise exception 'invalid service kind';
  end if;
  if coalesce(length(p_transcript), 0) > 50000 or coalesce(length(p_agent_summary), 0) > 2000 then
    raise exception 'answering machine content is too large';
  end if;
  if cardinality(coalesce(p_rental_items, '{}')) > 20 then
    raise exception 'too many rental selections';
  end if;

  insert into public.answering_machine_calls (
    provider_call_id, last_source_event_id, caller_ref, caller_display_name, status,
    transcript, transcript_complete, service_kind, event_date, facility_start_time,
    rental_items, agent_summary
  ) values (
    p_provider_call_id, p_source_event_id, p_caller_ref, nullif(btrim(p_caller_display_name), ''), p_status,
    coalesce(p_transcript, ''), coalesce(p_transcript_complete, false), p_service_kind,
    p_event_date, p_facility_start_time, coalesce(p_rental_items, '{}'), coalesce(p_agent_summary, '')
  )
  on conflict (provider_call_id) do update set
    last_source_event_id = excluded.last_source_event_id,
    caller_display_name = coalesce(excluded.caller_display_name, answering_machine_calls.caller_display_name),
    status = case when answering_machine_calls.status in ('approved','rejected')
      then answering_machine_calls.status else excluded.status end,
    transcript = case when excluded.transcript <> '' then excluded.transcript else answering_machine_calls.transcript end,
    transcript_complete = answering_machine_calls.transcript_complete or excluded.transcript_complete,
    service_kind = coalesce(excluded.service_kind, answering_machine_calls.service_kind),
    event_date = coalesce(excluded.event_date, answering_machine_calls.event_date),
    facility_start_time = coalesce(excluded.facility_start_time, answering_machine_calls.facility_start_time),
    rental_items = case when cardinality(excluded.rental_items) > 0 then excluded.rental_items else answering_machine_calls.rental_items end,
    agent_summary = case when excluded.agent_summary <> '' then excluded.agent_summary else answering_machine_calls.agent_summary end,
    updated_at = now()
  returning * into v_call;

  insert into public.answering_machine_events(call_id, source_event_id, event_type, summary, metadata)
  values (
    v_call.id, p_source_event_id, 'whatsapp.' || p_status,
    case when p_status = 'needs_review'
      then 'WhatsApp call transcript is ready for owner review.'
      else 'WhatsApp call state updated.' end,
    jsonb_build_object('status', p_status, 'transcriptComplete', coalesce(p_transcript_complete, false))
  ) on conflict (call_id, source_event_id) do nothing;

  return v_call;
end
$$;

create or replace function public.review_answering_machine_call(
  p_call_id uuid,
  p_action text,
  p_expected_revision integer,
  p_patch jsonb,
  p_actor_id text
)
returns public.answering_machine_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call public.answering_machine_calls;
  v_status text;
begin
  if p_action not in ('save','approve','reject') then raise exception 'invalid review action'; end if;
  if nullif(btrim(p_actor_id), '') is null then raise exception 'owner actor is required'; end if;
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'invalid review patch'; end if;
  if exists (select 1 from jsonb_object_keys(p_patch) key where key not in (
    'serviceKind','eventDate','facilityStartTime','rentalItems','transcript','agentSummary','ownerNotes'
  )) then raise exception 'unsupported review field'; end if;

  select * into v_call from public.answering_machine_calls where id = p_call_id for update;
  if not found then raise exception 'answering machine call not found'; end if;
  if v_call.status in ('approved','rejected') then raise exception 'answering machine review is already final'; end if;
  if v_call.revision <> p_expected_revision then raise exception 'answering machine call changed; refresh and try again'; end if;

  update public.answering_machine_calls set
    service_kind = case when p_patch ? 'serviceKind' then nullif(p_patch->>'serviceKind', '') else service_kind end,
    event_date = case when p_patch ? 'eventDate' then nullif(p_patch->>'eventDate', '')::date else event_date end,
    facility_start_time = case when p_patch ? 'facilityStartTime' then nullif(p_patch->>'facilityStartTime', '')::time else facility_start_time end,
    rental_items = case when p_patch ? 'rentalItems' then array(select jsonb_array_elements_text(p_patch->'rentalItems')) else rental_items end,
    transcript = case when p_patch ? 'transcript' then p_patch->>'transcript' else transcript end,
    agent_summary = case when p_patch ? 'agentSummary' then p_patch->>'agentSummary' else agent_summary end,
    owner_notes = case when p_patch ? 'ownerNotes' then p_patch->>'ownerNotes' else owner_notes end,
    status = case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else status end,
    reviewed_by = case when p_action in ('approve','reject') then left(p_actor_id, 200) else reviewed_by end,
    reviewed_at = case when p_action in ('approve','reject') then now() else reviewed_at end,
    revision = revision + 1,
    updated_at = now()
  where id = p_call_id
  returning * into v_call;

  if length(v_call.transcript) > 50000 or length(v_call.agent_summary) > 2000 or length(v_call.owner_notes) > 2000 then
    raise exception 'answering machine content is too large';
  end if;
  if cardinality(v_call.rental_items) > 20 then raise exception 'too many rental selections'; end if;
  if p_action = 'approve' and (
    not v_call.transcript_complete or v_call.service_kind is null or v_call.event_date is null
    or (v_call.service_kind = 'facility_party' and v_call.facility_start_time is null)
    or (v_call.service_kind = 'rental' and cardinality(v_call.rental_items) = 0)
  ) then raise exception 'required booking details are incomplete'; end if;

  v_status := v_call.status;
  insert into public.answering_machine_events(call_id, source_event_id, event_type, actor_id, summary, metadata)
  values (
    v_call.id, 'owner:' || v_call.revision::text, 'owner.' || p_action, left(p_actor_id, 200),
    case p_action
      when 'approve' then 'Owner approved the captured booking information for the next staged step.'
      when 'reject' then 'Owner rejected the captured booking information.'
      else 'Owner edited the captured booking information.' end,
    jsonb_build_object('status', v_status, 'revision', v_call.revision, 'serviceKind', v_call.service_kind, 'eventDate', v_call.event_date)
  );
  return v_call;
end
$$;

alter table public.answering_machine_calls enable row level security;
alter table public.answering_machine_events enable row level security;
revoke all on public.answering_machine_calls from anon, authenticated;
revoke all on public.answering_machine_events from anon, authenticated;
grant select, insert, update on public.answering_machine_calls to service_role;
grant select, insert on public.answering_machine_events to service_role;
revoke all on function public.upsert_whatsapp_answering_call(text,text,text,text,text,text,boolean,text,date,time,text[],text)
  from public, anon, authenticated;
grant execute on function public.upsert_whatsapp_answering_call(text,text,text,text,text,text,boolean,text,date,time,text[],text)
  to service_role;
revoke all on function public.review_answering_machine_call(uuid,text,integer,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.review_answering_machine_call(uuid,text,integer,jsonb,text)
  to service_role;
