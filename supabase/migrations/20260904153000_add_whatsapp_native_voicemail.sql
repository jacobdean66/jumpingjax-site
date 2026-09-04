-- Add Meta's native WhatsApp voicemail as a reversible test transport.
-- Media is fetched only for an authenticated owner; URLs and tokens are never stored.

alter table public.answering_machine_calls
  add column if not exists voicemail_media_id text,
  add column if not exists voicemail_mime_type text,
  add column if not exists voicemail_sha256 text;

alter table public.answering_machine_calls
  drop constraint if exists answering_machine_calls_voicemail_media_id_check,
  add constraint answering_machine_calls_voicemail_media_id_check
    check (voicemail_media_id is null or length(voicemail_media_id) between 1 and 240),
  drop constraint if exists answering_machine_calls_voicemail_mime_type_check,
  add constraint answering_machine_calls_voicemail_mime_type_check
    check (voicemail_mime_type is null or (length(voicemail_mime_type) <= 120 and voicemail_mime_type like 'audio/%')),
  drop constraint if exists answering_machine_calls_voicemail_sha256_check,
  add constraint answering_machine_calls_voicemail_sha256_check
    check (voicemail_sha256 is null or length(voicemail_sha256) <= 128);

create or replace function public.record_whatsapp_answering_voicemail(
  p_provider_call_id text,
  p_source_event_id text,
  p_caller_ref text,
  p_caller_display_name text,
  p_media_id text,
  p_mime_type text,
  p_sha256 text
)
returns public.answering_machine_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call public.answering_machine_calls;
begin
  if nullif(btrim(p_provider_call_id), '') is null or length(p_provider_call_id) > 240 then raise exception 'invalid provider call id'; end if;
  if nullif(btrim(p_source_event_id), '') is null or length(p_source_event_id) > 300 then raise exception 'invalid source event id'; end if;
  if nullif(btrim(p_caller_ref), '') is null or length(p_caller_ref) > 240 then raise exception 'invalid caller reference'; end if;
  if nullif(btrim(p_media_id), '') is null or length(p_media_id) > 240 then raise exception 'invalid voicemail media id'; end if;
  if p_mime_type not like 'audio/%' or length(p_mime_type) > 120 then raise exception 'invalid voicemail media type'; end if;
  if p_sha256 is not null and length(p_sha256) > 128 then raise exception 'invalid voicemail hash'; end if;

  insert into public.answering_machine_calls (
    provider_call_id, last_source_event_id, caller_ref, caller_display_name, status,
    voicemail_media_id, voicemail_mime_type, voicemail_sha256
  ) values (
    p_provider_call_id, p_source_event_id, p_caller_ref, nullif(btrim(p_caller_display_name), ''), 'needs_review',
    p_media_id, p_mime_type, p_sha256
  )
  on conflict (provider_call_id) do update set
    last_source_event_id = excluded.last_source_event_id,
    caller_display_name = coalesce(excluded.caller_display_name, answering_machine_calls.caller_display_name),
    status = case when answering_machine_calls.status in ('approved','rejected')
      then answering_machine_calls.status else 'needs_review' end,
    voicemail_media_id = excluded.voicemail_media_id,
    voicemail_mime_type = excluded.voicemail_mime_type,
    voicemail_sha256 = excluded.voicemail_sha256,
    updated_at = now()
  returning * into v_call;

  insert into public.answering_machine_events(call_id, source_event_id, event_type, summary, metadata)
  values (
    v_call.id, p_source_event_id, 'whatsapp.voicemail',
    'WhatsApp voicemail is ready for owner playback and review.',
    jsonb_build_object('status', v_call.status, 'mimeType', p_mime_type)
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
    'serviceKind','eventDate','facilityStartTime','rentalItems','transcript','transcriptComplete','agentSummary','ownerNotes'
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
    transcript_complete = case when p_patch ? 'transcriptComplete' then (p_patch->>'transcriptComplete')::boolean else transcript_complete end,
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
  if v_call.transcript_complete and nullif(btrim(v_call.transcript), '') is null then raise exception 'completed transcript cannot be empty'; end if;
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

revoke all on function public.record_whatsapp_answering_voicemail(text,text,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.record_whatsapp_answering_voicemail(text,text,text,text,text,text,text)
  to service_role;
