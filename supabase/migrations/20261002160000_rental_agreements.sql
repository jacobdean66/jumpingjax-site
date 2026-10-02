-- Rental agreements retain the exact terms, booking snapshot, and signature.
create table public.rental_agreement_templates (
  version integer generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 160),
  terms text not null check (char_length(terms) between 20 and 20000),
  updated_by text not null,
  updated_at timestamptz not null default now()
);
insert into public.rental_agreement_templates (title, terms, updated_by) values (
  'Inflatable Rental Agreement and Safety Acknowledgment',
  $terms$Booking and payment: This agreement records the requested rentals, event details, and quoted charges shown above. Requests require Jumping Jax confirmation. Payment is recorded separately; signing does not process a payment. Final delivery and pickup arrangements will be confirmed by Jumping Jax. Contact Jumping Jax promptly about cancellation, rescheduling, or changes to your rental.

Setup: Provide a suitable, level setup area with the required clearance, safe access, and the electricity and water requested for your equipment. Obtain permission to use the property. Tell Jumping Jax about sprinkler lines, underground utilities, and any other setup hazards before installation.

Supervision: A responsible adult must continuously supervise participants whenever the inflatable is in use. Follow the equipment's posted instructions and the safety instructions provided at delivery, including rider count, weight, height, and age limits. Group participants by similar size and ability.

Safe use: Remove shoes and sharp objects before entering. Do not allow flips, wrestling, rough play, climbing exterior walls, or jumping from the inflatable. Keep food, drinks, gum, pets, and other prohibited items away. Use slides in the direction and manner demonstrated at delivery.

Equipment care: Do not move the inflatable, remove or change anchors, alter the blower or power setup, or use water unless Jumping Jax approves it for that equipment. Keep the entrance and exit clear. Only use the equipment for its intended purpose.

Weather and emergencies: Stop use and safely remove all participants if wind reaches the manufacturer's operating limit, lightning or other unsafe weather develops, power is lost, the inflatable deflates, or equipment appears damaged. Follow the shutdown instructions provided at delivery and contact Jumping Jax. Call emergency services when needed.

Damage and return: Report damage or incidents promptly. The renter is responsible for documented damage, missing equipment, or excessive cleaning caused by misuse or failure to follow the instructions. Ordinary wear is excluded. Any additional charges must be explained and documented.

Risk acknowledgment: Inflatable play involves risks including falls, collisions, and injury. I understand these risks and agree to follow the stated safety rules and supervise use. This acknowledgment does not replace Jumping Jax's responsibility to provide and set up equipment safely.

Electronic signature: I have reviewed the details and terms of this agreement. My typed full legal name, submitted with the required acknowledgment, is my electronic signature. I can retain a copy of the signed agreement.$terms$,
  'Initial rental agreement'
);

create table public.rental_agreements (
  id uuid primary key,
  booking_id bigint not null references public.bookings(id) on delete restrict,
  version integer not null check (version > 0),
  template_version integer not null references public.rental_agreement_templates(version),
  status text not null check (status in ('awaiting_signature', 'signed', 'superseded')),
  public_token_hash text not null unique check (public_token_hash ~ '^[a-f0-9]{64}$'),
  snapshot jsonb not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  signed_at timestamptz,
  signer_legal_name text,
  acknowledged boolean not null default false,
  acknowledgment_text text,
  signer_ip_hmac text,
  signer_user_agent text,
  superseded_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  email_status text not null default 'not_sent' check (email_status in ('not_sent', 'sent', 'failed')),
  last_emailed_at timestamptz,
  unique (booking_id, version),
  check (signed_at is null or (acknowledged and signer_legal_name is not null and acknowledgment_text is not null))
);
create index rental_agreements_booking_idx on public.rental_agreements (booking_id, version desc);
create unique index rental_agreements_current_idx on public.rental_agreements (booking_id) where status <> 'superseded';
alter table public.rental_agreements enable row level security;
alter table public.rental_agreement_templates enable row level security;
revoke all on public.rental_agreements, public.rental_agreement_templates from public, anon, authenticated;
grant all on public.rental_agreements, public.rental_agreement_templates to service_role;
grant usage, select on sequence public.rental_agreement_templates_version_seq to service_role;

create function public.rental_agreement_booking_state(p_booking public.bookings) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select jsonb_object_agg(key,value) from jsonb_each(to_jsonb(p_booking))
    where key = any(array['customer_name','customer_email','customer_phone','rental_item','rental_name',
      'event_date','duration','foam_duration','span_days','event_address','delivery_time','event_start_time',
      'requested_delivery_window','delivery_fee','mileage_fee','setup_location','setup_surface','setup_access',
      'setup_notes','payment_method','subtotal','total']);
$$;

create function public.protect_rental_agreement() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.id <> new.id or old.booking_id <> new.booking_id or old.version <> new.version
    or old.snapshot is distinct from new.snapshot or old.public_token_hash <> new.public_token_hash
    or old.template_version <> new.template_version or old.created_by <> new.created_by or old.created_at <> new.created_at then
    raise exception 'agreement_snapshot_immutable';
  end if;
  if old.signed_at is not null and (old.signed_at is distinct from new.signed_at
    or old.signer_legal_name is distinct from new.signer_legal_name or old.acknowledged <> new.acknowledged
    or old.acknowledgment_text is distinct from new.acknowledgment_text
    or old.signer_ip_hmac is distinct from new.signer_ip_hmac or old.signer_user_agent is distinct from new.signer_user_agent) then
    raise exception 'agreement_signature_immutable';
  end if;
  if old.status = 'superseded' and new.status <> 'superseded' then raise exception 'agreement_superseded'; end if;
  return new;
end; $$;
create trigger rental_agreement_immutable before update on public.rental_agreements
  for each row execute function public.protect_rental_agreement();

create function public.invalidate_rental_agreements() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public.rental_agreement_booking_state(old) is distinct from public.rental_agreement_booking_state(new)
    or lower(new.status::text) in ('cancelled', 'canceled', 'rejected', 'blocked') then
    update public.rental_agreements set status = 'superseded', superseded_at = now()
    where booking_id = new.id and status <> 'superseded';
  end if;
  return new;
end; $$;
create trigger rental_booking_agreement_changed after update on public.bookings
  for each row execute function public.invalidate_rental_agreements();

create function public.invalidate_rental_item_agreements() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.rental_agreements set status = 'superseded', superseded_at = now()
    where booking_id in (case when tg_op <> 'INSERT' then old.booking_id end, case when tg_op <> 'DELETE' then new.booking_id end)
      and status <> 'superseded';
  return coalesce(new, old);
end; $$;
create trigger rental_item_agreement_changed after insert or update or delete on public.booking_rental_items
  for each row execute function public.invalidate_rental_item_agreements();

create function public.create_rental_booking_with_agreement_atomic(
  p_booking jsonb, p_items jsonb, p_idempotency_key text, p_agreement jsonb
) returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id text; v_existing public.rental_agreements%rowtype; v_booking public.bookings%rowtype;
  v_template public.rental_agreement_templates%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('rental-agreement-request:' || p_idempotency_key, 0));
  select a.* into v_existing from public.rental_agreements a join public.bookings b on b.id = a.booking_id
    where b.idempotency_key = p_idempotency_key order by a.version asc limit 1;
  if found then
    if (v_existing.snapshot - 'bookingState') is distinct from p_agreement->'snapshot'
      or v_existing.signer_legal_name is distinct from trim(p_agreement->>'signerName') then
      raise exception 'agreement_idempotency_conflict';
    end if;
    return v_existing.booking_id::text;
  end if;
  if exists(select 1 from public.bookings where idempotency_key=p_idempotency_key) then raise exception 'agreement_idempotency_conflict'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rental-agreement-template', 0));
  select * into v_template from public.rental_agreement_templates order by version desc limit 1 for share;
  if v_template.version <> (p_agreement->>'templateVersion')::integer
    or v_template.terms is distinct from p_agreement->'snapshot'->>'terms'
    or v_template.title is distinct from p_agreement->'snapshot'->>'title' then raise exception 'agreement_template_changed'; end if;
  if nullif(trim(p_agreement->>'signerName'), '') is null or char_length(p_agreement->>'signerName') > 120
    or p_agreement->>'tokenHash' !~ '^[a-f0-9]{64}$' then raise exception 'invalid_agreement'; end if;
  v_id := public.create_rental_booking_atomic_v2(p_booking, p_items, p_idempotency_key);
  select * into v_booking from public.bookings where id = v_id::bigint for update;
  insert into public.rental_agreements (id, booking_id, version, template_version, status, public_token_hash,
    snapshot, created_by, signed_at, signer_legal_name, acknowledged, acknowledgment_text, signer_ip_hmac, signer_user_agent)
  values ((p_agreement->>'id')::uuid, v_id::bigint, 1, v_template.version, 'signed', p_agreement->>'tokenHash',
    (p_agreement->'snapshot') || jsonb_build_object('bookingState', public.rental_agreement_booking_state(v_booking)),
    'Customer at booking', now(), trim(p_agreement->>'signerName'), true,
    'I have read, understand, and agree to this rental agreement and safety rules. I intend my typed full legal name to be my electronic signature.',
    p_agreement->>'ipHmac', p_agreement->>'userAgent');
  return v_id;
end; $$;

create function public.create_rental_agreement_version(p_id uuid, p_booking_id bigint, p_token_hash text, p_snapshot jsonb, p_created_by text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_booking public.bookings%rowtype; v_version integer; v_existing public.rental_agreements%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or lower(v_booking.status::text) not in ('pending', 'approved') then return jsonb_build_object('outcome', 'unavailable'); end if;
  select * into v_existing from public.rental_agreements where id = p_id;
  if found then
    if v_existing.booking_id = p_booking_id and v_existing.snapshot = p_snapshot then
      return jsonb_build_object('outcome', 'created', 'id', v_existing.id);
    end if;
    return jsonb_build_object('outcome', 'conflict');
  end if;
  if public.rental_agreement_booking_state(v_booking) is distinct from p_snapshot->'bookingState' then return jsonb_build_object('outcome', 'booking_changed'); end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' or char_length(coalesce(p_snapshot->>'additionalTerms','')) > 10000
    or char_length(coalesce(p_snapshot->>'terms','')) < 20 then return jsonb_build_object('outcome', 'invalid_input'); end if;
  select coalesce(max(version), 0) + 1 into v_version from public.rental_agreements where booking_id = p_booking_id;
  update public.rental_agreements set status = 'superseded', superseded_at = now() where booking_id = p_booking_id and status <> 'superseded';
  insert into public.rental_agreements (id, booking_id, version, template_version, status, public_token_hash, snapshot, created_by)
    values (p_id, p_booking_id, v_version, (p_snapshot->>'templateVersion')::integer, 'awaiting_signature', p_token_hash, p_snapshot, p_created_by);
  return jsonb_build_object('outcome', 'created', 'id', p_id, 'version', v_version);
end; $$;

create function public.sign_rental_agreement(p_token_hash text, p_name text, p_ip_hmac text, p_user_agent text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_agreement public.rental_agreements%rowtype; v_booking public.bookings%rowtype; v_booking_id bigint;
begin
  select booking_id into v_booking_id from public.rental_agreements where public_token_hash = p_token_hash;
  if not found then return jsonb_build_object('outcome', 'not_found'); end if;
  select * into v_booking from public.bookings where id = v_booking_id for update;
  select * into v_agreement from public.rental_agreements where public_token_hash = p_token_hash for update;
  if v_agreement.status = 'superseded' or lower(v_booking.status::text) not in ('pending', 'approved') then return jsonb_build_object('outcome', 'superseded'); end if;
  if v_agreement.status = 'signed' then return jsonb_build_object('outcome', 'already_signed'); end if;
  if public.rental_agreement_booking_state(v_booking) is distinct from v_agreement.snapshot->'bookingState' then
    update public.rental_agreements set status = 'superseded', superseded_at = now() where id = v_agreement.id;
    return jsonb_build_object('outcome', 'superseded');
  end if;
  if char_length(trim(coalesce(p_name,''))) not between 2 and 120 then return jsonb_build_object('outcome', 'invalid_name'); end if;
  update public.rental_agreements set status = 'signed', signed_at = now(), signer_legal_name = trim(p_name),
    acknowledged = true, acknowledgment_text = 'I have read, understand, and agree to this rental agreement and safety rules. I intend my typed full legal name to be my electronic signature.',
    signer_ip_hmac = p_ip_hmac, signer_user_agent = left(p_user_agent, 500) where id = v_agreement.id;
  return jsonb_build_object('outcome', 'signed');
end; $$;

create function public.save_rental_agreement_template(p_expected_version integer, p_title text, p_terms text, p_actor text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_version integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('rental-agreement-template', 0));
  select max(version) into v_version from public.rental_agreement_templates;
  if v_version <> p_expected_version then return jsonb_build_object('outcome', 'changed'); end if;
  insert into public.rental_agreement_templates (title, terms, updated_by) values (trim(p_title), trim(p_terms), p_actor) returning version into v_version;
  return jsonb_build_object('outcome', 'saved', 'version', v_version);
end; $$;

revoke all on function public.create_rental_booking_with_agreement_atomic(jsonb,jsonb,text,jsonb),
  public.create_rental_agreement_version(uuid,bigint,text,jsonb,text), public.sign_rental_agreement(text,text,text,text),
  public.save_rental_agreement_template(integer,text,text,text), public.rental_agreement_booking_state(public.bookings)
  from public, anon, authenticated;
grant execute on function public.create_rental_booking_with_agreement_atomic(jsonb,jsonb,text,jsonb),
  public.create_rental_agreement_version(uuid,bigint,text,jsonb,text), public.sign_rental_agreement(text,text,text,text),
  public.save_rental_agreement_template(integer,text,text,text), public.rental_agreement_booking_state(public.bookings)
  to service_role;
notify pgrst, 'reload schema';
