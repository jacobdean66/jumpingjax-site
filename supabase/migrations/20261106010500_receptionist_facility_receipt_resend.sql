-- One customer-acknowledgment resend per receptionist-created booking.
-- A claimed or uncertain attempt is never automatically eligible again.
create table public.receptionist_facility_receipt_resends (
  booking_id uuid primary key,
  operation_id uuid not null unique,
  call_id text not null,
  review_turn_id text not null,
  affirmation_turn_id text not null,
  email_hash text not null check (email_hash ~ '^[a-f0-9]{64}$'),
  state text not null check (state in ('sending','accepted','unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.receptionist_facility_receipt_resends enable row level security;
revoke all on public.receptionist_facility_receipt_resends from public, anon, authenticated, service_role;

create function public.claim_receptionist_facility_receipt_resend_v1(
  p_booking_id uuid,p_operation_id uuid,p_expected_email text,p_call_id text,p_review_turn_id text,p_affirmation_turn_id text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  existing public.receptionist_facility_receipt_resends%rowtype;
  recipient text; original public.booking_notification_outbox%rowtype;
begin
  if p_booking_id is null or p_operation_id is null or p_expected_email is null or length(p_expected_email)>254
    or p_call_id is null or p_call_id !~ '^[A-Za-z0-9_-]{1,80}$'
    or p_review_turn_id is null or p_review_turn_id !~ '^[A-Za-z0-9_-]{1,80}$'
    or p_affirmation_turn_id is null or p_affirmation_turn_id !~ '^[A-Za-z0-9_-]{1,80}$'
    or p_review_turn_id=p_affirmation_turn_id then raise exception 'invalid_resend_scope'; end if;
  perform pg_advisory_xact_lock(hashtextextended('facility-receipt-resend:'||p_booking_id::text,0));
  select * into existing from public.receptionist_facility_receipt_resends where booking_id=p_booking_id for update;
  if found then
    if existing.operation_id=p_operation_id and existing.email_hash=encode(sha256(convert_to(lower(btrim(p_expected_email)),'UTF8')),'hex') and existing.call_id=p_call_id and existing.review_turn_id=p_review_turn_id
       and existing.affirmation_turn_id=p_affirmation_turn_id and existing.state='accepted' then
      return jsonb_build_object('status','provider-accepted');
    end if;
    return jsonb_build_object('status','unavailable');
  end if;
  select email into recipient from public.facility_bookings where id=p_booking_id and status='pending' for share;
  if recipient is null or lower(btrim(recipient))<>lower(btrim(p_expected_email)) then return jsonb_build_object('status','unavailable'); end if;
  if not exists(select 1 from public.receptionist_facility_notifications where booking_id=p_booking_id and kind='customer' and state='sent')
    then return jsonb_build_object('status','unavailable'); end if;
  select * into original from public.booking_notification_outbox
    where message_key='receptionist-facility:'||p_booking_id::text||':customer:0' and booking_kind='facility'
      and booking_id=p_booking_id::text and purpose='initial_customer_receipt' and status='sent' for share;
  if not found or lower(btrim(original.recipient))<>lower(btrim(recipient)) then return jsonb_build_object('status','unavailable'); end if;
  insert into public.receptionist_facility_receipt_resends(booking_id,operation_id,call_id,review_turn_id,affirmation_turn_id,email_hash,state)
    values(p_booking_id,p_operation_id,p_call_id,p_review_turn_id,p_affirmation_turn_id,encode(sha256(convert_to(lower(btrim(p_expected_email)),'UTF8')),'hex'),'sending');
  return jsonb_build_object('status','claimed','recipient',original.recipient,'subject',original.subject,'body',original.body,'html',original.html_body);
end;
$$;
revoke all on function public.claim_receptionist_facility_receipt_resend_v1(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_receptionist_facility_receipt_resend_v1(uuid,uuid,text,text,text,text) to service_role;

create function public.finish_receptionist_facility_receipt_resend_v1(p_booking_id uuid,p_operation_id uuid,p_accepted boolean)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_accepted is null then return false; end if;
  update public.receptionist_facility_receipt_resends set state=case when p_accepted then 'accepted' else 'unknown' end,updated_at=now()
  where booking_id=p_booking_id and operation_id=p_operation_id and state='sending';
  return found;
end;
$$;
revoke all on function public.finish_receptionist_facility_receipt_resend_v1(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.finish_receptionist_facility_receipt_resend_v1(uuid,uuid,boolean) to service_role;
