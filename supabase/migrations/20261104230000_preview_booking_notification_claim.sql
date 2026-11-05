-- Keep initial email retries on one preview-linked booking and one owner list.
-- The booking transaction does not send email. This lease is only for dispatch
-- after that transaction has returned a saved booking ID.
alter table public.facility_invitation_previews
  add column notification_started_at timestamptz,
  add column notification_lease_id uuid,
  add column notification_lease_until timestamptz,
  add column notification_payload_fingerprint text,
  add column notification_owner_recipients text[];

create function public.claim_facility_preview_notifications(
  p_preview_id uuid, p_booking_id uuid, p_lease_id uuid, p_owner_recipients text[]
) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  preview public.facility_invitation_previews%rowtype;
  booking public.facility_bookings%rowtype;
  workflow public.booking_integration_workflows%rowtype;
  snapshot jsonb;
  fingerprint text;
  owners text[];
  claimed_at timestamptz;
begin
  if p_lease_id is null then return jsonb_build_object('status', 'unavailable'); end if;

  select * into preview from public.facility_invitation_previews
  where id = p_preview_id and booking_id = p_booking_id for update;
  if not found or preview.status is distinct from 'accepted' or preview.binding_fingerprint is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  claimed_at := clock_timestamp();
  select * into workflow from public.booking_integration_workflows
  where booking_kind = 'facility' and booking_id = p_booking_id::text;
  if not found then return jsonb_build_object('status', 'unavailable'); end if;
  if workflow.initial_customer_email_status = 'sent' and workflow.owner_notification_status = 'sent' then
    return jsonb_build_object('status', 'provider-accepted');
  end if;
  if preview.notification_lease_until > claimed_at then return jsonb_build_object('status', 'pending'); end if;

  -- Never automatically retry an ambiguous provider submission once its
  -- idempotency key may have expired.
  if preview.notification_started_at <= claimed_at - interval '23 hours' then
    return jsonb_build_object('status', 'requires-staff');
  end if;

  select * into booking from public.facility_bookings
  where id = p_booking_id for share;
  if not found or booking.status is distinct from 'pending'
    or booking.start_time is null or booking.start_time <= claimed_at
    or booking.idempotency_key is distinct from 'facility-preview-v1:' || p_preview_id::text then
    return jsonb_build_object('status', 'requires-staff');
  end if;

  snapshot := jsonb_build_object(
    'customer_name', booking.customer_name, 'email', booking.email, 'phone', booking.phone,
    'child_name', booking.child_name, 'child_gender', booking.child_gender, 'child_age', booking.child_age,
    'party_theme', booking.party_theme, 'balloon_colors', booking.balloon_colors,
    'table_cloth_colors', booking.table_cloth_colors, 'drink_choice', booking.drink_choice,
    'payment_method', booking.payment_method, 'deposit_acknowledged', booking.deposit_acknowledged,
    'notes', booking.notes, 'party_kind', booking.party_kind, 'room', booking.room,
    'start_time', booking.start_time, 'end_time', booking.end_time,
    'readable_date', booking.readable_date, 'readable_time', booking.readable_time,
    'party_label', booking.party_label, 'addon_selections', booking.addon_selections,
    'facility_package_price', booking.facility_package_price, 'addon_subtotal', booking.addon_subtotal,
    'subtotal', booking.subtotal, 'tax', booking.tax, 'total', booking.total,
    'tax_rate', booking.pricing_details->'taxRate',
    'invitation', booking.invitation, 'invitation_delivery_preference', booking.invitation_delivery_preference,
    'invitation_quantity', booking.invitation_quantity, 'preview_option_index', preview.selected_option_index
  );
  fingerprint := encode(sha256(convert_to(snapshot::text, 'UTF8')), 'hex');
  if preview.notification_payload_fingerprint is not null
     and preview.notification_payload_fingerprint is distinct from fingerprint then
    return jsonb_build_object('status', 'requires-staff');
  end if;
  owners := coalesce(preview.notification_owner_recipients, p_owner_recipients);
  if owners is null or cardinality(owners) not between 1 and 20
     or array_position(owners, null) is not null then
    return jsonb_build_object('status', 'requires-staff');
  end if;

  update public.facility_invitation_previews
    set notification_started_at = coalesce(notification_started_at, claimed_at),
        notification_lease_id = p_lease_id,
        notification_lease_until = claimed_at + interval '5 minutes',
        notification_payload_fingerprint = fingerprint,
        notification_owner_recipients = owners
    where id = p_preview_id;
  return jsonb_build_object('status', 'claimed', 'booking', snapshot, 'owners', owners);
end $$;

revoke all on function public.claim_facility_preview_notifications(uuid,uuid,uuid,text[])
  from public, anon, authenticated;
grant execute on function public.claim_facility_preview_notifications(uuid,uuid,uuid,text[])
  to service_role;
