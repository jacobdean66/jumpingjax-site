-- Seed the row from verified saved pricing before enabling the website cutover.
-- An empty table is deliberate. There is no fallback for a fresh preview booking.
create function public.is_normalized_facility_pricing(p_pricing jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select case when jsonb_typeof(p_pricing) = 'object' then
    p_pricing ?& array[
      'publicRoom10', 'publicRoom20Weekday', 'publicRoom20Weekend',
      'privateWeekday90', 'privateWeekday120', 'privateWeekend90',
      'privateWeekend120', 'privateAny180', 'taxRate'
    ]
    and (select count(*) = 9 and bool_and(
      case when jsonb_typeof(value) = 'number' then
        (value::numeric >= 0)
        and (key <> 'taxRate' or value::numeric <= 1)
        and value::numeric = round(value::numeric, case when key = 'taxRate' then 4 else 2 end)
      else false end
    ) from jsonb_each(p_pricing))
  else false end
$$;
revoke all on function public.is_normalized_facility_pricing(jsonb)
  from public, anon, authenticated;

create table public.facility_pricing_settings (
  singleton boolean primary key default true check (singleton),
  pricing jsonb not null check (public.is_normalized_facility_pricing(pricing)),
  revision bigint not null default 1 check (revision between 1 and 9007199254740991)
);
alter table public.facility_pricing_settings enable row level security;
revoke all on public.facility_pricing_settings from public, anon, authenticated, service_role;
grant select on public.facility_pricing_settings to service_role;

-- The application cannot overwrite the row or reset its revision directly.
create function public.update_facility_pricing_settings(p_pricing jsonb, p_expected_revision bigint)
returns boolean language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin
  update public.facility_pricing_settings
    set pricing = p_pricing, revision = revision + 1
    where singleton and revision = p_expected_revision;
  return found;
end;
$$;
revoke all on function public.update_facility_pricing_settings(jsonb,bigint)
  from public, anon, authenticated;
grant execute on function public.update_facility_pricing_settings(jsonb,bigint) to service_role;

-- A share lock conflicts with the writer's row lock and lasts through the
-- outer booking transaction. Definer privileges allow the locking read while
-- direct updates to pricing remain restricted to the update function.
create function public.require_facility_pricing_revision(p_expected_revision bigint)
returns void language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare
  actual_revision bigint;
begin
  select revision into actual_revision
    from public.facility_pricing_settings where singleton for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'pricing_unavailable';
  end if;
  if actual_revision is distinct from p_expected_revision then
    raise exception using errcode = 'P0001', message = 'approved_price_changed';
  end if;
end;
$$;
revoke all on function public.require_facility_pricing_revision(bigint)
  from public, anon, authenticated;
grant execute on function public.require_facility_pricing_revision(bigint) to service_role;

-- Replace the old signature so it cannot bypass the pricing guard.
drop function public.bind_facility_invitation_preview_atomic(uuid,text,jsonb);

create function public.bind_facility_invitation_preview_atomic(
  p_preview_id uuid,
  p_request_key text,
  p_booking jsonb,
  p_pricing_revision bigint
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

  perform public.require_facility_pricing_revision(p_pricing_revision);

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

  -- This path does not yet execute the website's email workflow. Record the
  -- missing notifications atomically so staff can see that work is required.
  insert into public.booking_integration_workflows
    (booking_kind, booking_id, operator_required, last_error_class)
    values ('facility', booking_id_result::text, true, 'preview_notifications_pending')
    on conflict (booking_kind, booking_id) do nothing;

  update public.facility_invitation_previews
    set booking_id = booking_id_result, binding_fingerprint = fingerprint
    where id = p_preview_id;
  return booking_id_result;
end;
$$;

revoke all on function public.bind_facility_invitation_preview_atomic(uuid,text,jsonb,bigint)
  from public, anon, authenticated;
grant execute on function public.bind_facility_invitation_preview_atomic(uuid,text,jsonb,bigint)
  to service_role;
