-- Prepare old bookings without replacing a current agreement, and retain paper evidence privately.
-- Include agreed daily charges in the state checked when preparing/signing a version.
-- Null retains the state shape of existing one-day agreements.
create or replace function public.rental_agreement_booking_state(p_booking public.bookings) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select jsonb_object_agg(key,value) || case when p_booking.rental_day_charges is null then '{}'::jsonb
    else jsonb_build_object('rental_day_charges',p_booking.rental_day_charges) end
  from jsonb_each(to_jsonb(p_booking))
  where key = any(array['customer_name','customer_email','customer_phone','rental_item','rental_name',
    'event_date','duration','foam_duration','span_days','event_address','delivery_time','event_start_time',
    'requested_delivery_window','delivery_fee','mileage_fee','setup_location','setup_surface','setup_access',
    'setup_notes','payment_method','subtotal','total']);
$$;

alter table public.rental_agreements
  add column signature_method text not null default 'electronic' check (signature_method in ('electronic', 'paper')),
  add column paper_copy_path text,
  add column paper_signed_on date,
  add column paper_recorded_by text,
  add column paper_recorded_at timestamptz,
  add constraint rental_agreement_paper_evidence check (
    (signature_method = 'electronic' and paper_copy_path is null and paper_signed_on is null and paper_recorded_by is null and paper_recorded_at is null)
    or (signature_method = 'paper' and signed_at is not null and paper_copy_path is not null and paper_signed_on is not null and paper_recorded_by is not null and paper_recorded_at is not null)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rental-agreement-paper', 'rental-agreement-paper', false, 4194304, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;
-- Keep paper records private even if a broader storage policy is introduced later.
create policy rental_agreement_paper_service_only on storage.objects as restrictive
for all to anon, authenticated using (bucket_id <> 'rental-agreement-paper')
with check (bucket_id <> 'rental-agreement-paper');

create function public.protect_rental_agreement_paper() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.signed_at is not null and (
    old.signature_method is distinct from new.signature_method or old.paper_copy_path is distinct from new.paper_copy_path
    or old.paper_signed_on is distinct from new.paper_signed_on or old.paper_recorded_by is distinct from new.paper_recorded_by
    or old.paper_recorded_at is distinct from new.paper_recorded_at
  ) then raise exception 'agreement_paper_evidence_immutable'; end if;
  return new;
end; $$;
create trigger rental_agreement_paper_immutable before update on public.rental_agreements
for each row execute function public.protect_rental_agreement_paper();

create function public.ensure_rental_agreement_for_booking(p_id uuid, p_booking_id bigint, p_token_hash text, p_snapshot jsonb, p_created_by text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_booking public.bookings%rowtype; v_current public.rental_agreements%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or lower(v_booking.status::text) not in ('pending','approved') then return jsonb_build_object('outcome','unavailable'); end if;
  select * into v_current from public.rental_agreements where booking_id = p_booking_id and status <> 'superseded' order by version desc limit 1;
  if found then return jsonb_build_object('outcome', case when v_current.status = 'signed' then 'signed' else 'existing' end, 'id',v_current.id); end if;
  return public.create_rental_agreement_version(p_id,p_booking_id,p_token_hash,p_snapshot,p_created_by);
end; $$;

create function public.record_rental_paper_agreement(p_id uuid, p_booking_id bigint, p_name text, p_signed_on date, p_copy_path text, p_actor text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_booking public.bookings%rowtype; v_agreement public.rental_agreements%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  select * into v_agreement from public.rental_agreements where id = p_id and booking_id = p_booking_id for update;
  if not found then return jsonb_build_object('outcome','not_found'); end if;
  if v_agreement.status = 'signed' then
    if v_agreement.signature_method = 'paper' and v_agreement.paper_copy_path = p_copy_path
      and v_agreement.signer_legal_name = trim(p_name) and v_agreement.paper_signed_on = p_signed_on then return jsonb_build_object('outcome','recorded'); end if;
    return jsonb_build_object('outcome','already_signed');
  end if;
  if lower(v_booking.status::text) not in ('pending','approved') or v_agreement.status <> 'awaiting_signature'
    or public.rental_agreement_booking_state(v_booking) is distinct from v_agreement.snapshot->'bookingState' then return jsonb_build_object('outcome','changed'); end if;
  if char_length(trim(coalesce(p_name,''))) not between 2 and 120 or p_signed_on is null
    or p_signed_on > (now() at time zone 'America/New_York')::date
    or p_signed_on < (v_agreement.created_at at time zone 'America/New_York')::date
    or p_copy_path not like p_id::text || '/%' or position('..' in p_copy_path) > 0
    or not exists(select 1 from storage.objects where bucket_id = 'rental-agreement-paper' and name = p_copy_path)
    then return jsonb_build_object('outcome','invalid_evidence'); end if;
  update public.rental_agreements set status='signed', signed_at=now(), signer_legal_name=trim(p_name), acknowledged=true,
    acknowledgment_text='Paper signature recorded by staff from the uploaded signed agreement.',
    signature_method='paper', paper_copy_path=p_copy_path, paper_signed_on=p_signed_on, paper_recorded_by=p_actor, paper_recorded_at=now()
    where id=p_id;
  return jsonb_build_object('outcome','recorded');
end; $$;

revoke all on function public.ensure_rental_agreement_for_booking(uuid,bigint,text,jsonb,text), public.record_rental_paper_agreement(uuid,bigint,text,date,text,text) from public,anon,authenticated;
grant execute on function public.ensure_rental_agreement_for_booking(uuid,bigint,text,jsonb,text), public.record_rental_paper_agreement(uuid,bigint,text,date,text,text) to service_role;
notify pgrst, 'reload schema';
