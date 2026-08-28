-- Agreements may be prepared and signed before staff confirms a party.
create or replace function public.create_facility_party_agreement_version(
  p_agreement_id uuid,
  p_booking_id uuid,
  p_public_token_hash text,
  p_created_by text,
  p_snapshot jsonb,
  p_payment jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.facility_bookings%rowtype;
  v_version integer;
  v_payments jsonb;
  v_paid_total numeric(12, 2);
  v_total numeric(12, 2);
  v_snapshot jsonb;
begin
  if p_agreement_id is null
     or p_booking_id is null
     or p_public_token_hash is null
     or p_public_token_hash !~ '^[a-f0-9]{64}$'
     or nullif(trim(p_created_by), '') is null
     or p_snapshot is null then
    return jsonb_build_object('outcome', 'invalid_input');
  end if;

  select * into v_booking
  from public.facility_bookings
  where id = p_booking_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'booking_not_found');
  end if;
  if lower(coalesce(v_booking.status, '')) in ('cancelled', 'canceled', 'rejected') then
    return jsonb_build_object('outcome', 'booking_inactive');
  end if;

  if p_payment is not null then
    if coalesce((p_payment->>'amount')::numeric, 0) <= 0
       or coalesce(p_payment->>'payment_kind', '') not in ('deposit', 'partial', 'balance', 'paid_in_full', 'other')
       or nullif(trim(p_payment->>'payment_method'), '') is null
       or nullif(trim(p_payment->>'paid_at'), '') is null then
      return jsonb_build_object('outcome', 'invalid_payment');
    end if;

    insert into public.facility_party_payments (
      booking_id, amount, payment_kind, payment_method, paid_at,
      pos_receipt_number, recorded_by, notes
    ) values (
      p_booking_id,
      round((p_payment->>'amount')::numeric, 2),
      p_payment->>'payment_kind',
      trim(p_payment->>'payment_method'),
      (p_payment->>'paid_at')::timestamptz,
      nullif(trim(p_payment->>'pos_receipt_number'), ''),
      p_created_by,
      nullif(trim(p_payment->>'notes'), '')
    );
  end if;

  select
    coalesce(sum(amount), 0),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'amount', amount,
          'paymentKind', payment_kind,
          'paymentMethod', payment_method,
          'paidAt', paid_at,
          'posReceiptNumber', pos_receipt_number,
          'recordedBy', recorded_by,
          'notes', notes
        ) order by paid_at, created_at
      ),
      '[]'::jsonb
    )
  into v_paid_total, v_payments
  from public.facility_party_payments
  where booking_id = p_booking_id;

  v_total := round(coalesce((p_snapshot->>'total')::numeric, 0), 2);
  v_snapshot := p_snapshot || jsonb_build_object(
    'payments', v_payments,
    'paidTotal', round(v_paid_total, 2),
    'balanceDue', greatest(round(v_total - v_paid_total, 2), 0)
  );

  select coalesce(max(version), 0) + 1 into v_version
  from public.facility_party_agreements
  where booking_id = p_booking_id;

  update public.facility_party_agreements
  set status = 'superseded', superseded_at = now()
  where booking_id = p_booking_id and status in ('sent', 'signed');

  insert into public.facility_party_agreements (
    id, booking_id, version, status, email_status, public_token_hash,
    snapshot, created_by, sent_at
  ) values (
    p_agreement_id, p_booking_id, v_version, 'sent', 'pending',
    p_public_token_hash, v_snapshot, p_created_by, now()
  );

  return jsonb_build_object(
    'outcome', 'created',
    'agreement_id', p_agreement_id,
    'version', v_version,
    'snapshot', v_snapshot
  );
exception
  when unique_violation then
    return jsonb_build_object('outcome', 'conflict');
  when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
    return jsonb_build_object('outcome', 'invalid_input');
end;
$$;

revoke all on function public.create_facility_party_agreement_version(uuid, uuid, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_facility_party_agreement_version(uuid, uuid, text, text, jsonb, jsonb) to service_role;
