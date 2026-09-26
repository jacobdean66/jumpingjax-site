-- Finish the owner-reviewed Answering Machine handoff into the existing booking systems.
-- The booking itself is still created by the existing atomic rental/facility APIs.

alter table public.answering_machine_calls
  add column if not exists booking_details jsonb not null default '{}',
  add column if not exists booking_kind text,
  add column if not exists booking_id text,
  add column if not exists booking_created_at timestamptz,
  add column if not exists booking_error text not null default '';

alter table public.answering_machine_calls
  drop constraint if exists answering_machine_calls_booking_details_check,
  add constraint answering_machine_calls_booking_details_check check (jsonb_typeof(booking_details) = 'object'),
  drop constraint if exists answering_machine_calls_booking_kind_check,
  add constraint answering_machine_calls_booking_kind_check
    check (booking_kind is null or booking_kind in ('rental','facility_party')),
  drop constraint if exists answering_machine_calls_booking_link_check,
  add constraint answering_machine_calls_booking_link_check check (
    (booking_id is null and booking_kind is null and booking_created_at is null)
    or (booking_id is not null and booking_kind is not null and booking_created_at is not null)
  ),
  drop constraint if exists answering_machine_calls_booking_error_check,
  add constraint answering_machine_calls_booking_error_check check (length(booking_error) <= 500);

create unique index if not exists answering_machine_calls_booking_link_idx
  on public.answering_machine_calls(booking_kind, booking_id)
  where booking_id is not null;

-- Earlier releases used "approved" to mean information-only approval. Return
-- those rows to review so the owner can complete the new booking fields.
update public.answering_machine_calls
set status = 'needs_review', reviewed_by = null, reviewed_at = null,
    revision = revision + 1, updated_at = now()
where status = 'approved' and booking_id is null;

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
begin
  if p_action not in ('save','reject') then raise exception 'invalid review action'; end if;
  if nullif(btrim(p_actor_id), '') is null then raise exception 'owner actor is required'; end if;
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'invalid review patch'; end if;
  if exists (select 1 from jsonb_object_keys(p_patch) key where key not in (
    'serviceKind','eventDate','facilityStartTime','rentalItems','transcript',
    'transcriptComplete','agentSummary','ownerNotes','bookingDetails'
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
    booking_details = case when p_patch ? 'bookingDetails' then p_patch->'bookingDetails' else booking_details end,
    booking_error = '',
    status = case p_action when 'reject' then 'rejected' else status end,
    reviewed_by = case when p_action = 'reject' then left(p_actor_id, 200) else reviewed_by end,
    reviewed_at = case when p_action = 'reject' then now() else reviewed_at end,
    revision = revision + 1,
    updated_at = now()
  where id = p_call_id
  returning * into v_call;

  if length(v_call.transcript) > 50000 or length(v_call.agent_summary) > 2000
     or length(v_call.owner_notes) > 2000 then raise exception 'answering machine content is too large'; end if;
  if cardinality(v_call.rental_items) > 20 then raise exception 'too many rental selections'; end if;

  insert into public.answering_machine_events(call_id, source_event_id, event_type, actor_id, summary, metadata)
  values (
    v_call.id, 'owner:' || v_call.revision::text, 'owner.' || p_action, left(p_actor_id, 200),
    case p_action when 'reject' then 'Owner rejected the captured booking information.'
      else 'Owner edited the captured booking information.' end,
    jsonb_build_object('status', v_call.status, 'revision', v_call.revision,
      'serviceKind', v_call.service_kind, 'eventDate', v_call.event_date)
  );
  return v_call;
end
$$;

create or replace function public.complete_answering_machine_booking(
  p_call_id uuid,
  p_expected_revision integer,
  p_booking_kind text,
  p_booking_id text,
  p_actor_id text
)
returns public.answering_machine_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call public.answering_machine_calls;
begin
  if p_booking_kind not in ('rental','facility_party') then raise exception 'invalid booking kind'; end if;
  if nullif(btrim(p_booking_id), '') is null or length(p_booking_id) > 200 then raise exception 'invalid booking id'; end if;
  if nullif(btrim(p_actor_id), '') is null then raise exception 'owner actor is required'; end if;

  select * into v_call from public.answering_machine_calls where id = p_call_id for update;
  if not found then raise exception 'answering machine call not found'; end if;
  if v_call.booking_id is not null then
    if v_call.booking_kind = p_booking_kind and v_call.booking_id = p_booking_id then return v_call; end if;
    raise exception 'answering machine call already has a different booking';
  end if;
  if v_call.status = 'rejected' then raise exception 'rejected call cannot create a booking'; end if;
  if v_call.revision <> p_expected_revision then raise exception 'answering machine call changed; refresh and try again'; end if;
  if v_call.service_kind <> p_booking_kind then raise exception 'booking kind does not match the reviewed call'; end if;
  if not v_call.transcript_complete or v_call.event_date is null
     or (v_call.service_kind = 'facility_party' and v_call.facility_start_time is null)
     or (v_call.service_kind = 'rental' and cardinality(v_call.rental_items) = 0) then
    raise exception 'required booking details are incomplete';
  end if;

  update public.answering_machine_calls set
    status = 'approved', booking_kind = p_booking_kind, booking_id = btrim(p_booking_id),
    booking_created_at = now(), booking_error = '', reviewed_by = left(p_actor_id, 200),
    reviewed_at = now(), revision = revision + 1, updated_at = now()
  where id = p_call_id returning * into v_call;

  insert into public.answering_machine_events(call_id, source_event_id, event_type, actor_id, summary, metadata)
  values (
    v_call.id, 'owner:booking:' || v_call.revision::text, 'owner.booking_created', left(p_actor_id, 200),
    'Owner reviewed the call and created a pending booking through the existing booking workflow.',
    jsonb_build_object('status', v_call.status, 'revision', v_call.revision,
      'bookingKind', v_call.booking_kind, 'bookingId', v_call.booking_id)
  );
  return v_call;
end
$$;

revoke all on function public.complete_answering_machine_booking(uuid,integer,text,text,text)
  from public, anon, authenticated;
grant execute on function public.complete_answering_machine_booking(uuid,integer,text,text,text)
  to service_role;
