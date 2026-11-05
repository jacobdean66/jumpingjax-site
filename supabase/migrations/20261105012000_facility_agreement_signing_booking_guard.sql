-- Prevent signing a facility agreement after its party is cancelled.
-- Lock the booking first, matching agreement creation and booking updates.
create or replace function public.sign_facility_party_agreement(
  p_public_token_hash text,
  p_signer_legal_name text,
  p_signer_ip_hmac text default null,
  p_signer_user_agent text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_booking_id uuid;
  v_booking_status text;
  v_row public.facility_party_agreements%rowtype;
begin
  if p_public_token_hash is null or p_public_token_hash !~ '^[a-f0-9]{64}$'
     or char_length(trim(coalesce(p_signer_legal_name, ''))) < 2
     or char_length(trim(coalesce(p_signer_legal_name, ''))) > 120 then
    return jsonb_build_object('outcome', 'invalid_input');
  end if;
  -- This initial lookup is not authority: the row is checked again under lock.
  select booking_id into v_booking_id from public.facility_party_agreements
    where public_token_hash = p_public_token_hash;
  if not found then return jsonb_build_object('outcome', 'not_found'); end if;
  select status into v_booking_status from public.facility_bookings where id = v_booking_id for update;
  if not found then return jsonb_build_object('outcome', 'not_found'); end if;
  select * into v_row from public.facility_party_agreements
    where public_token_hash = p_public_token_hash and booking_id = v_booking_id for update;
  if not found then return jsonb_build_object('outcome', 'not_found'); end if;
  if v_row.status = 'superseded' then return jsonb_build_object('outcome', 'superseded'); end if;
  if v_booking_status is null or lower(btrim(v_booking_status)) not in ('pending', 'confirmed') then
    return jsonb_build_object('outcome', 'booking_inactive');
  end if;
  if v_row.status = 'signed' and v_row.signed_at is null then
    return jsonb_build_object('outcome', 'invalid_state');
  end if;
  if v_row.status = 'signed' then
    return jsonb_build_object('outcome', 'already_signed', 'agreement_id', v_row.id,
      'booking_id', v_row.booking_id, 'signed_at', v_row.signed_at);
  end if;
  if v_row.status is distinct from 'sent' or v_row.signed_at is not null then
    return jsonb_build_object('outcome', 'invalid_state');
  end if;
  update public.facility_party_agreements set status = 'signed', signed_at = now(),
    signer_legal_name = trim(p_signer_legal_name), signer_ip_hmac = nullif(trim(p_signer_ip_hmac), ''),
    signer_user_agent = left(nullif(trim(p_signer_user_agent), ''), 512) where id = v_row.id;
  return jsonb_build_object('outcome', 'signed', 'agreement_id', v_row.id,
    'booking_id', v_row.booking_id, 'signed_at', now());
end;
$$;
revoke all on function public.sign_facility_party_agreement(text,text,text,text) from public, anon, authenticated;
grant execute on function public.sign_facility_party_agreement(text,text,text,text) to service_role;
