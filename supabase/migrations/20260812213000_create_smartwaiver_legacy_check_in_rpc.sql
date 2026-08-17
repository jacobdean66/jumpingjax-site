-- Atomically records a prepared Legacy Smartwaiver check-in group and its
-- audit events. Only the server-side service role can call this function.
create or replace function public.create_smartwaiver_legacy_check_ins_atomic(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day text := p_payload->>'business_day_ymd';
  v_staff text := p_payload->>'staff_id';
  v_notes text := nullif(trim(p_payload->>'notes'), '');
  v_item jsonb;
  v_check_in_id uuid;
  v_payment_id uuid;
  v_attendees jsonb := '[]'::jsonb;
  v_payments jsonb := '[]'::jsonb;
  v_ids jsonb := '[]'::jsonb;
begin
  if v_day is null or v_day !~ '^\d{4}-\d{2}-\d{2}$'
     or v_staff is null or length(trim(v_staff)) = 0
     or jsonb_typeof(p_payload->'attendees') <> 'array'
     or jsonb_array_length(p_payload->'attendees') = 0 then
    return jsonb_build_object('outcome', 'invalid_input');
  end if;

  for v_item in select value from jsonb_array_elements(p_payload->'attendees')
  loop
    v_check_in_id := (v_item->>'check_in_id')::uuid;
    v_payment_id := nullif(v_item->>'payment_id', '')::uuid;

    insert into public.smartwaiver_legacy_check_ins (
      id, legacy_participant_id, business_day_ymd, classification,
      age_years_on_visit, unit_price_cents, payment_method, staff_id,
      source_kind, status, notes
    ) values (
      v_check_in_id,
      (v_item->>'legacy_participant_id')::uuid,
      v_day,
      v_item->>'classification',
      (v_item->>'age_years_on_visit')::integer,
      (v_item->>'unit_price_cents')::integer,
      nullif(v_item->>'payment_method', ''),
      v_staff,
      'legacy_smartwaiver',
      'active',
      v_notes
    );

    insert into public.open_play_audit_events (
      id, actor_staff_id, action, entity_type, entity_id, detail
    ) values (
      (v_item->>'audit_id')::uuid,
      v_staff,
      'legacy_smartwaiver_check_in',
      'smartwaiver_legacy_check_in',
      v_check_in_id::text,
      jsonb_build_object(
        'source', 'legacy_smartwaiver',
        'legacy_participant_id', v_item->>'legacy_participant_id',
        'waiver_id', v_item->>'waiver_id',
        'business_day_ymd', v_day,
        'classification', v_item->>'classification',
        'unit_price_cents', (v_item->>'unit_price_cents')::integer
      )
    );

    v_ids := v_ids || jsonb_build_array(v_check_in_id::text);
    v_attendees := v_attendees || jsonb_build_array(jsonb_build_object(
      'attendee_id', v_check_in_id::text,
      'participant_id', 'legacy:' || (v_item->>'legacy_participant_id'),
      'classification', v_item->>'classification',
      'unit_price_cents', (v_item->>'unit_price_cents')::integer
    ));

    if (v_item->>'unit_price_cents')::integer > 0 then
      v_payments := v_payments || jsonb_build_array(jsonb_build_object(
        'id', v_payment_id::text,
        'attendee_id', v_check_in_id::text,
        'method', v_item->>'payment_method',
        'amount_cents', (v_item->>'unit_price_cents')::integer
      ));
    end if;
  end loop;

  return jsonb_build_object(
    'outcome', 'created',
    'check_in_ids', v_ids,
    'attendees', v_attendees,
    'payments', v_payments
  );
exception
  when unique_violation then
    return jsonb_build_object('outcome', 'duplicate_same_day_attendee');
  when others then
    return jsonb_build_object('outcome', 'failed', 'error_code', SQLSTATE);
end;
$$;

revoke all on function public.create_smartwaiver_legacy_check_ins_atomic(jsonb)
  from public, anon, authenticated;
grant execute on function public.create_smartwaiver_legacy_check_ins_atomic(jsonb)
  to service_role;
