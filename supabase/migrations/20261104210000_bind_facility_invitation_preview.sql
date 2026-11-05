-- Preview booking remains disabled at the HTTP boundary. This service-role
-- transaction accepts a server-validated booking, never a raw customer body.
alter table public.facility_invitation_previews
  add column binding_fingerprint text,
  add constraint facility_invitation_previews_binding_receipt_check check (
    (booking_id is null and binding_fingerprint is null)
    or (booking_id is not null and binding_fingerprint is not null
        and binding_fingerprint ~ '^[a-f0-9]{64}$')
  );

create function public.bind_facility_invitation_preview_atomic(
  p_preview_id uuid,
  p_request_key text,
  p_booking jsonb
) returns uuid
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  preview public.facility_invitation_previews%rowtype;
  fingerprint text;
  booking_key text;
  booking_id_result uuid;
  booking_date date;
  start_at timestamptz;
  end_at timestamptz;
  booking_time text;
  v_invitation jsonb;
  insert_marker uuid;
  rows_updated integer;
begin
  if p_preview_id is null or p_request_key is null
     or p_request_key !~ '^[A-Za-z0-9._:-]{16,128}$'
     or jsonb_typeof(p_booking) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'invalid_preview_binding';
  end if;

  fingerprint := encode(sha256(convert_to(
    jsonb_build_array('facility-preview-bind-v1', p_preview_id, p_request_key, p_booking)::text,
    'UTF8'
  )), 'hex');
  select * into preview from public.facility_invitation_previews
    where id = p_preview_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'preview_unavailable';
  end if;
  if preview.booking_id is not null then
    if preview.binding_fingerprint is distinct from fingerprint then
      raise exception using errcode = 'P0001', message = 'preview_binding_conflict';
    end if;
    return preview.booking_id;
  end if;

  if preview.status <> 'accepted' or preview.expires_at <= clock_timestamp()
     or preview.selected_option_index is null
     or preview.delivery_preferences is null or preview.invitation_quantity is null then
    raise exception using errcode = 'P0001', message = 'preview_unavailable';
  end if;
  start_at := (p_booking->>'start_time')::timestamptz;
  end_at := (p_booking->>'end_time')::timestamptz;
  if start_at is null or end_at is null or not isfinite(start_at) or not isfinite(end_at)
     or start_at <= clock_timestamp() or end_at - start_at <> interval '90 minutes'
     or start_at <> date_trunc('minute', start_at) or end_at <> date_trunc('minute', end_at)
     or p_booking->>'party_kind' is distinct from 'public'
     or coalesce(p_booking->>'room', '') not in ('room-10', 'room-20') then
    raise exception using errcode = '22023', message = 'invalid_preview_booking_slot';
  end if;
  booking_date := (start_at at time zone 'America/New_York')::date;
  booking_time := to_char(start_at at time zone 'America/New_York', 'FMHH12:MI AM')
    || ' - ' || to_char(end_at at time zone 'America/New_York', 'FMHH12:MI AM');
  v_invitation := p_booking->'invitation';

  if preview.party_date is distinct from to_char(booking_date, 'YYYY-MM-DD')
     or preview.party_time is distinct from booking_time
     or lower(btrim(p_booking->>'email')) is distinct from preview.recipient
     or p_booking->>'child_name' is distinct from preview.child_name
     or p_booking->>'child_age' is distinct from preview.child_age
     or p_booking->>'phone' is distinct from preview.customer_phone
     or p_booking->>'balloon_colors' is distinct from preview.balloon_colors
     or p_booking->>'table_cloth_colors' is distinct from preview.table_cloth_colors
     or p_booking->>'party_theme' is distinct from preview.party_theme
     or v_invitation->>'creationPreference' is distinct from 'create'
     or v_invitation->'confirmedTheme' is distinct from preview.confirmed_theme
     or v_invitation->'optionIndex' is distinct from to_jsonb(preview.selected_option_index)
     or v_invitation->>'deliveryPreference' is distinct from preview.delivery_preferences[1]
     or p_booking->>'invitation_delivery_preference' is distinct from array_to_string(preview.delivery_preferences, ',')
     or p_booking->'invitation_quantity' is distinct from to_jsonb(preview.invitation_quantity)
     or nullif(btrim(p_booking->>'invitation_template_id'), '') is null
     or v_invitation ? '_previewBindingInsertMarker' then
    raise exception using errcode = 'P0001', message = 'preview_binding_mismatch';
  end if;

  booking_key := 'facility-preview-v1:' || p_preview_id::text;
  insert_marker := gen_random_uuid();
  -- The current RPC returns an existing UUID for a matching key. A fresh marker
  -- proves that this call inserted the row before we modify or bind anything.
  booking_id_result := public.create_facility_booking_atomic(
    jsonb_set(
      p_booking || jsonb_build_object('readable_date', to_char(booking_date, 'YYYY-MM-DD'),
                                      'readable_time', booking_time),
      '{invitation,_previewBindingInsertMarker}', to_jsonb(insert_marker)
    ),
    booking_key
  );
  update public.facility_bookings
    set invitation = invitation - '_previewBindingInsertMarker',
        invitation_delivery_preference = array_to_string(preview.delivery_preferences, ','),
        invitation_template_id = p_booking->>'invitation_template_id',
        invitation_quantity = preview.invitation_quantity
    where id = booking_id_result and idempotency_key = booking_key
      and invitation->>'_previewBindingInsertMarker' = insert_marker::text;
  get diagnostics rows_updated = row_count;
  if rows_updated <> 1 then
    raise exception using errcode = 'P0001', message = 'preview_booking_key_conflict';
  end if;

  update public.facility_invitation_previews
    set booking_id = booking_id_result, binding_fingerprint = fingerprint
    where id = p_preview_id;
  return booking_id_result;
end;
$$;

revoke all on function public.bind_facility_invitation_preview_atomic(uuid,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.bind_facility_invitation_preview_atomic(uuid,text,jsonb)
  to service_role;
