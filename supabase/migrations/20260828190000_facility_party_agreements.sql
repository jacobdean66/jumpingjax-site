-- Versioned birthday-party agreements and POS payment receipts.
-- Service-role only: public access is mediated by short-lived-looking,
-- high-entropy URL tokens whose hashes are stored here.

create table if not exists public.facility_party_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.facility_bookings(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  payment_kind text not null check (payment_kind in ('deposit', 'partial', 'balance', 'paid_in_full', 'other')),
  payment_method text not null,
  paid_at timestamptz not null,
  pos_receipt_number text null,
  recorded_by text not null,
  notes text null,
  created_at timestamptz not null default now()
);

create table if not exists public.facility_party_agreements (
  id uuid primary key,
  booking_id uuid not null references public.facility_bookings(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null default 'sent'
    check (status in ('sent', 'signed', 'superseded')),
  email_status text not null default 'pending'
    check (email_status in ('pending', 'sent', 'failed')),
  public_token_hash text not null unique
    check (public_token_hash ~ '^[a-f0-9]{64}$'),
  snapshot jsonb not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz null,
  last_emailed_at timestamptz null,
  signed_at timestamptz null,
  signer_legal_name text null,
  signer_ip_hmac text null,
  signer_user_agent text null,
  superseded_at timestamptz null,
  unique (booking_id, version)
);

alter table public.facility_party_payments enable row level security;
alter table public.facility_party_agreements enable row level security;
revoke all on public.facility_party_payments from public, anon, authenticated;
revoke all on public.facility_party_agreements from public, anon, authenticated;

create index if not exists facility_party_payments_booking_idx
  on public.facility_party_payments (booking_id, paid_at, created_at);
create index if not exists facility_party_agreements_booking_idx
  on public.facility_party_agreements (booking_id, version desc);

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
  if lower(coalesce(v_booking.status, '')) <> 'confirmed' then
    return jsonb_build_object('outcome', 'booking_not_confirmed');
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

create or replace function public.sign_facility_party_agreement(
  p_public_token_hash text,
  p_signer_legal_name text,
  p_signer_ip_hmac text default null,
  p_signer_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.facility_party_agreements%rowtype;
begin
  if p_public_token_hash is null
     or p_public_token_hash !~ '^[a-f0-9]{64}$'
     or char_length(trim(coalesce(p_signer_legal_name, ''))) < 2
     or char_length(trim(coalesce(p_signer_legal_name, ''))) > 120 then
    return jsonb_build_object('outcome', 'invalid_input');
  end if;

  select * into v_row
  from public.facility_party_agreements
  where public_token_hash = p_public_token_hash
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;
  if v_row.status = 'superseded' then
    return jsonb_build_object('outcome', 'superseded');
  end if;
  if v_row.status = 'signed' then
    return jsonb_build_object(
      'outcome', 'already_signed',
      'agreement_id', v_row.id,
      'booking_id', v_row.booking_id,
      'signed_at', v_row.signed_at
    );
  end if;

  update public.facility_party_agreements
  set status = 'signed',
      signed_at = now(),
      signer_legal_name = trim(p_signer_legal_name),
      signer_ip_hmac = nullif(trim(p_signer_ip_hmac), ''),
      signer_user_agent = left(nullif(trim(p_signer_user_agent), ''), 512)
  where id = v_row.id;

  return jsonb_build_object(
    'outcome', 'signed',
    'agreement_id', v_row.id,
    'booking_id', v_row.booking_id,
    'signed_at', now()
  );
end;
$$;

create or replace function public.supersede_facility_party_agreements_on_booking_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if row(
    old.customer_name, old.email, old.phone, old.parent_name, old.child_name,
    old.room, old.party_kind, old.start_time, old.end_time, old.readable_date,
    old.readable_time, old.party_label, old.addon_selections,
    old.facility_package_price, old.addon_subtotal, old.subtotal, old.tax, old.total
  ) is distinct from row(
    new.customer_name, new.email, new.phone, new.parent_name, new.child_name,
    new.room, new.party_kind, new.start_time, new.end_time, new.readable_date,
    new.readable_time, new.party_label, new.addon_selections,
    new.facility_package_price, new.addon_subtotal, new.subtotal, new.tax, new.total
  ) then
    update public.facility_party_agreements
    set status = 'superseded', superseded_at = now()
    where booking_id = new.id and status in ('sent', 'signed');
  end if;
  return new;
end;
$$;

drop trigger if exists facility_party_agreement_booking_change on public.facility_bookings;
create trigger facility_party_agreement_booking_change
after update on public.facility_bookings
for each row execute function public.supersede_facility_party_agreements_on_booking_change();

revoke all on function public.create_facility_party_agreement_version(uuid, uuid, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.sign_facility_party_agreement(text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_facility_party_agreement_version(uuid, uuid, text, text, jsonb, jsonb) to service_role;
grant execute on function public.sign_facility_party_agreement(text, text, text, text) to service_role;
