-- Desktop WhatsApp scope only. Laptop applies after integration.
-- Serialize each call, deduplicate before mutation, and preserve owner review.
create or replace function public.upsert_whatsapp_answering_call(
  p_provider_call_id text, p_source_event_id text, p_caller_ref text,
  p_caller_display_name text, p_status text, p_transcript text,
  p_transcript_complete boolean, p_service_kind text, p_event_date date,
  p_facility_start_time time, p_rental_items text[], p_agent_summary text
)
returns public.answering_machine_calls
language plpgsql security definer set search_path = public
as $$
declare
  v_call public.answering_machine_calls;
  v_inserted boolean;
  v_owner_reviewed boolean;
begin
  if nullif(btrim(p_provider_call_id), '') is null or length(p_provider_call_id) > 240 then raise exception 'invalid provider call id'; end if;
  if nullif(btrim(p_source_event_id), '') is null or length(p_source_event_id) > 300 then raise exception 'invalid source event id'; end if;
  if nullif(btrim(p_caller_ref), '') is null or length(p_caller_ref) > 240 then raise exception 'invalid caller reference'; end if;
  if p_status is null or p_status not in ('received','in_progress','processing','needs_review','failed') then raise exception 'invalid provider status'; end if;
  if p_service_kind is not null and p_service_kind not in ('rental','facility_party') then raise exception 'invalid service kind'; end if;
  if coalesce(length(p_transcript), 0) > 50000 or coalesce(length(p_agent_summary), 0) > 2000 then raise exception 'answering machine content is too large'; end if;
  if cardinality(coalesce(p_rental_items, '{}')) > 20 then raise exception 'too many rental selections'; end if;

  insert into public.answering_machine_calls (
    provider_call_id, last_source_event_id, caller_ref, caller_display_name, status,
    transcript, transcript_complete, service_kind, event_date, facility_start_time, rental_items, agent_summary
  ) values (
    p_provider_call_id, p_source_event_id, p_caller_ref, nullif(btrim(p_caller_display_name), ''), p_status,
    coalesce(p_transcript, ''), coalesce(p_transcript_complete, false), p_service_kind,
    p_event_date, p_facility_start_time, coalesce(p_rental_items, '{}'), coalesce(p_agent_summary, '')
  ) on conflict (provider_call_id) do nothing returning * into v_call;
  v_inserted := found;

  if not v_inserted then
    select * into strict v_call from public.answering_machine_calls
      where provider_call_id = p_provider_call_id for update;
    if exists (select 1 from public.answering_machine_events
      where call_id = v_call.id and source_event_id = p_source_event_id) then return v_call; end if;
    select exists (select 1 from public.answering_machine_events
      where call_id = v_call.id and event_type like 'owner.%') into v_owner_reviewed;

    if v_call.status not in ('approved','rejected') and not v_owner_reviewed then
      update public.answering_machine_calls set
        last_source_event_id = p_source_event_id,
        caller_display_name = coalesce(nullif(btrim(p_caller_display_name), ''), caller_display_name),
        status = case
          when voicemail_media_id is not null or status = 'needs_review' then 'needs_review'
          when status = 'processing' and p_status in ('received','in_progress') then status
          when status = 'in_progress' and p_status = 'received' then status
          when status = 'failed' and p_status in ('received','in_progress','processing') then status
          else p_status end,
        transcript = case when coalesce(p_transcript, '') <> '' then p_transcript else transcript end,
        transcript_complete = transcript_complete or coalesce(p_transcript_complete, false),
        service_kind = coalesce(p_service_kind, service_kind),
        event_date = coalesce(p_event_date, event_date),
        facility_start_time = coalesce(p_facility_start_time, facility_start_time),
        rental_items = case when cardinality(coalesce(p_rental_items, '{}')) > 0 then p_rental_items else rental_items end,
        agent_summary = case when coalesce(p_agent_summary, '') <> '' then p_agent_summary else agent_summary end,
        revision = revision + 1,
        updated_at = now()
      where id = v_call.id returning * into v_call;
    end if;
  end if;

  insert into public.answering_machine_events(call_id, source_event_id, event_type, summary, metadata)
  values (v_call.id, p_source_event_id, 'whatsapp.' || p_status,
    'WhatsApp call event recorded; existing owner review is preserved.',
    jsonb_build_object('status', v_call.status, 'transcriptComplete', v_call.transcript_complete))
  on conflict (call_id, source_event_id) do nothing;
  return v_call;
end
$$;

create or replace function public.record_whatsapp_answering_voicemail(
  p_provider_call_id text, p_source_event_id text, p_caller_ref text,
  p_caller_display_name text, p_media_id text, p_mime_type text, p_sha256 text
)
returns public.answering_machine_calls
language plpgsql security definer set search_path = public
as $$
declare
  v_call public.answering_machine_calls;
  v_inserted boolean;
begin
  if nullif(btrim(p_provider_call_id), '') is null or length(p_provider_call_id) > 240 then raise exception 'invalid provider call id'; end if;
  if nullif(btrim(p_source_event_id), '') is null or length(p_source_event_id) > 300 then raise exception 'invalid source event id'; end if;
  if nullif(btrim(p_caller_ref), '') is null or length(p_caller_ref) > 240 then raise exception 'invalid caller reference'; end if;
  if nullif(btrim(p_media_id), '') is null or length(p_media_id) > 240 then raise exception 'invalid voicemail media id'; end if;
  if p_mime_type is null or p_mime_type not like 'audio/%' or length(p_mime_type) > 120 then raise exception 'invalid voicemail media type'; end if;
  if p_sha256 is not null and length(p_sha256) > 128 then raise exception 'invalid voicemail hash'; end if;

  insert into public.answering_machine_calls (
    provider_call_id, last_source_event_id, caller_ref, caller_display_name, status,
    voicemail_media_id, voicemail_mime_type, voicemail_sha256
  ) values (
    p_provider_call_id, p_source_event_id, p_caller_ref, nullif(btrim(p_caller_display_name), ''), 'needs_review',
    p_media_id, p_mime_type, p_sha256
  ) on conflict (provider_call_id) do nothing returning * into v_call;
  v_inserted := found;

  if not v_inserted then
    select * into strict v_call from public.answering_machine_calls
      where provider_call_id = p_provider_call_id for update;
    if exists (select 1 from public.answering_machine_events
      where call_id = v_call.id and source_event_id = p_source_event_id) then return v_call; end if;
    -- Attach the first recording only. Later webhook deliveries cannot replace reviewed audio.
    if v_call.voicemail_media_id is null and v_call.status not in ('approved','rejected') then
      update public.answering_machine_calls set
        last_source_event_id = p_source_event_id,
        status = 'needs_review',
        voicemail_media_id = p_media_id,
        voicemail_mime_type = p_mime_type,
        voicemail_sha256 = p_sha256,
        revision = revision + 1,
        updated_at = now()
      where id = v_call.id returning * into v_call;
    end if;
  end if;

  insert into public.answering_machine_events(call_id, source_event_id, event_type, summary, metadata)
  values (v_call.id, p_source_event_id, 'whatsapp.voicemail',
    'WhatsApp voicemail event recorded; existing owner review and recording are preserved.',
    jsonb_build_object('status', v_call.status, 'mimeType', p_mime_type))
  on conflict (call_id, source_event_id) do nothing;
  return v_call;
end
$$;

revoke all on function public.upsert_whatsapp_answering_call(text,text,text,text,text,text,boolean,text,date,time,text[],text) from public, anon, authenticated;
grant execute on function public.upsert_whatsapp_answering_call(text,text,text,text,text,text,boolean,text,date,time,text[],text) to service_role;
revoke all on function public.record_whatsapp_answering_voicemail(text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.record_whatsapp_answering_voicemail(text,text,text,text,text,text,text) to service_role;
