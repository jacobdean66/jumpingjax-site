-- Presence is independent of admission payment. Original waiver records stay intact.
create table public.open_play_desk_attendance (
  id uuid primary key default gen_random_uuid(),
  business_day_ymd text not null check (business_day_ymd ~ '^\d{4}-\d{2}-\d{2}$'),
  source text not null check (source in ('native','legacy_smartwaiver')),
  participant_id uuid references public.waiver_participants(id),
  legacy_participant_id uuid references public.smartwaiver_legacy_participants(id),
  identity_key text not null,
  first_name text not null, last_name text not null, dob date,
  role text not null check (role in ('child','adult_signer','adult_covered')),
  waiver_expires_on date not null,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  created_by_staff_id text not null,
  unique (business_day_ymd, identity_key),
  check ((source='native' and participant_id is not null and legacy_participant_id is null)
      or (source='legacy_smartwaiver' and legacy_participant_id is not null and participant_id is null))
);
create table public.open_play_checkout_tickets (
  id uuid primary key,
  business_day_ymd text not null,
  payer_name text not null default '',
  created_at timestamptz not null default now(),
  created_by_staff_id text not null
);
create table public.open_play_checkout_items (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.open_play_checkout_tickets(id),
  attendance_id uuid not null unique references public.open_play_desk_attendance(id),
  classification text check (classification in ('child_2_or_under','child_3_plus','playing_adult','watching_adult')),
  amount_cents integer check (amount_cents between 0 and 50000),
  credited_cents integer not null default 0 check (credited_cents >= 0),
  reason text not null default '',
  unique (ticket_id,attendance_id)
);
create table public.open_play_checkout_payments (
  id uuid primary key,
  ticket_id uuid not null references public.open_play_checkout_tickets(id),
  method text not null check (method in ('cash','card')),
  amount_cents integer not null check (amount_cents between -1000000 and 1000000 and amount_cents<>0),
  entry_type text not null default 'payment' check (entry_type in ('payment','void')),
  related_payment_id uuid unique references public.open_play_checkout_payments(id),
  reason text not null default '',
  reference text not null default '',
  created_at timestamptz not null default now(),
  created_by_staff_id text not null,
  check ((entry_type='payment' and amount_cents>0 and related_payment_id is null) or
    (entry_type='void' and amount_cents<0 and related_payment_id is not null and length(trim(reason))>0))
);
-- Carry existing check-ins into the unified roster without creating payments.
insert into public.open_play_desk_attendance(business_day_ymd,source,participant_id,legacy_participant_id,
  identity_key,first_name,last_name,dob,role,waiver_expires_on,checked_in_at,created_by_staff_id)
select business_day_ymd,source,participant_id,legacy_participant_id,
  lower(regexp_replace(trim(first_name),'\s+',' ','g')) || '|' || lower(regexp_replace(trim(last_name),'\s+',' ','g')) || '|' || coalesce(dob::text,source || ':' || coalesce(participant_id,legacy_participant_id)::text),
  first_name,last_name,dob,role,expires_on,created_at,staff from (
  select a.business_day_ymd,'native'::text as source,p.id as participant_id,null::uuid as legacy_participant_id,
    p.first_name,p.last_name,p.dob,p.role,s.expires_on,a.created_at,v.created_by_staff_id as staff
  from public.open_play_visit_attendees a join public.waiver_participants p on p.id=a.participant_id
    join public.waiver_submissions s on s.id=p.submission_id join public.open_play_visits v on v.id=a.visit_id
  where a.status='active' and v.status<>'voided'
  union all
  select a.business_day_ymd,'legacy_smartwaiver',null,p.id,p.first_name,p.last_name,p.dob,p.role,w.expires_on,a.created_at,a.staff_id
  from public.smartwaiver_legacy_check_ins a join public.smartwaiver_legacy_participants p on p.id=a.legacy_participant_id
    join public.smartwaiver_legacy_waivers w on w.id=p.legacy_waiver_id join public.smartwaiver_legacy_visits v on v.id=a.legacy_visit_id
  where a.status='active' and v.status<>'voided'
) existing order by created_at on conflict(business_day_ymd,identity_key) do nothing;
create index open_play_checkout_tickets_day on public.open_play_checkout_tickets(business_day_ymd);
create index open_play_checkout_items_ticket on public.open_play_checkout_items(ticket_id);
create index open_play_checkout_payments_ticket on public.open_play_checkout_payments(ticket_id);
alter table public.open_play_desk_attendance enable row level security;
alter table public.open_play_checkout_tickets enable row level security;
alter table public.open_play_checkout_items enable row level security;
alter table public.open_play_checkout_payments enable row level security;
revoke all on public.open_play_desk_attendance,public.open_play_checkout_tickets,
  public.open_play_checkout_items,public.open_play_checkout_payments from public,anon,authenticated;
grant select,insert,update,delete on public.open_play_desk_attendance,public.open_play_checkout_tickets,
  public.open_play_checkout_items,public.open_play_checkout_payments to service_role;

create or replace function public.open_play_desk_command(
  p_day text, p_action text, p_staff text, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_person record; v_presence public.open_play_desk_attendance;
  v_ticket public.open_play_checkout_tickets; v_item public.open_play_checkout_items;
  v_payment public.open_play_checkout_payments;
  v_id uuid; v_source text; v_identity text; v_class text; v_amount integer;
  v_paid integer; v_due integer; v_credit integer := 0; v_result jsonb; v_reason text := '';
begin
  if p_day is null or p_day !~ '^\d{4}-\d{2}-\d{2}$' or p_day::date is null
     or p_staff is null or length(trim(p_staff))=0 then
    raise exception 'Invalid visit day or staff identity' using errcode='22023';
  end if;
  if p_action='mark_here' then
    v_source := p_payload->>'source'; v_id := (p_payload->>'participantId')::uuid;
    if v_source='native' then
      select p.id,p.first_name as original_first,p.last_name as original_last,
        coalesce(c.corrected_first_name,p.first_name) as first_name,
        coalesce(c.corrected_last_name,p.last_name) as last_name,p.dob,p.role,s.expires_on
      into v_person from waiver_participants p join waiver_submissions s on s.id=p.submission_id
      left join lateral (select * from waiver_participant_name_corrections c where c.participant_id=p.id order by c.created_at desc,c.id desc limit 1)c on true
      where p.id=v_id and s.status='completed';
    elsif v_source='legacy_smartwaiver' then
      select p.id,p.first_name as original_first,p.last_name as original_last,
        coalesce(c.corrected_first_name,p.first_name) as first_name,
        coalesce(c.corrected_last_name,p.last_name) as last_name,p.dob,p.role,w.expires_on
      into v_person from smartwaiver_legacy_participants p join smartwaiver_legacy_waivers w on w.id=p.legacy_waiver_id
      left join lateral (select * from smartwaiver_legacy_participant_name_corrections c where c.legacy_participant_id=p.id order by c.created_at desc,c.id desc limit 1)c on true
      where p.id=v_id and w.activated;
    else raise exception 'Choose a valid waiver source' using errcode='22023'; end if;
    if v_person.id is null then raise exception 'Waiver participant was not found' using errcode='22023'; end if;
    v_identity := lower(regexp_replace(trim(v_person.original_first),'\s+',' ','g')) || '|' ||
      lower(regexp_replace(trim(v_person.original_last),'\s+',' ','g')) || '|' ||
      coalesce(v_person.dob::text,v_source || ':' || v_id::text);
    insert into open_play_desk_attendance(business_day_ymd,source,participant_id,legacy_participant_id,identity_key,
      first_name,last_name,dob,role,waiver_expires_on,created_by_staff_id)
    values(p_day,v_source,case when v_source='native' then v_id end,case when v_source='legacy_smartwaiver' then v_id end,
      v_identity,v_person.first_name,v_person.last_name,v_person.dob,v_person.role,v_person.expires_on,p_staff)
    on conflict(business_day_ymd,identity_key) do update set checked_out_at=null,
      first_name=excluded.first_name,last_name=excluded.last_name,
      source=case when excluded.waiver_expires_on>=open_play_desk_attendance.waiver_expires_on then excluded.source else open_play_desk_attendance.source end,
      participant_id=case when excluded.waiver_expires_on>=open_play_desk_attendance.waiver_expires_on then excluded.participant_id else open_play_desk_attendance.participant_id end,
      legacy_participant_id=case when excluded.waiver_expires_on>=open_play_desk_attendance.waiver_expires_on then excluded.legacy_participant_id else open_play_desk_attendance.legacy_participant_id end,
      role=case when excluded.waiver_expires_on>=open_play_desk_attendance.waiver_expires_on then excluded.role else open_play_desk_attendance.role end,
      waiver_expires_on=greatest(excluded.waiver_expires_on,open_play_desk_attendance.waiver_expires_on)
    returning * into v_presence;
    update open_play_checkout_items i set classification=null,amount_cents=null
      where i.attendance_id=v_presence.id and i.classification is not null
        and ((v_presence.role='child' and i.classification in ('playing_adult','watching_adult')) or
          (v_presence.role<>'child' and i.classification in ('child_2_or_under','child_3_plus')))
        and coalesce((select sum(p.amount_cents) from open_play_checkout_payments p where p.ticket_id=i.ticket_id),0)=0;
    insert into open_play_audit_events(actor_staff_id,action,entity_type,entity_id,detail)
      values(p_staff,'desk_mark_here','open_play_desk_attendance',v_presence.id::text,jsonb_build_object('day',p_day));
    return jsonb_build_object('attendanceId',v_presence.id);
  end if;
  if p_action='depart' then
    update open_play_desk_attendance set checked_out_at=coalesce(checked_out_at,now())
      where id=(p_payload->>'attendanceId')::uuid and business_day_ymd=p_day;
    if not found then raise exception 'Arrival was not found for this day' using errcode='22023'; end if;
    insert into open_play_audit_events(actor_staff_id,action,entity_type,entity_id,detail)
      values(p_staff,'desk_depart','open_play_desk_attendance',p_payload->>'attendanceId',jsonb_build_object('day',p_day));
    return jsonb_build_object('ok',true);
  end if;
  if p_action='create_ticket' then
    v_id := (p_payload->>'ticketId')::uuid;
    insert into open_play_checkout_tickets(id,business_day_ymd,created_by_staff_id)
      values(v_id,p_day,p_staff) on conflict(id) do nothing;
    if not exists(select 1 from open_play_checkout_tickets where id=v_id and business_day_ymd=p_day) then
      raise exception 'Ticket belongs to another day' using errcode='22023';
    end if;
    return jsonb_build_object('ticketId',v_id);
  end if;
  select * into v_ticket from open_play_checkout_tickets where id=(p_payload->>'ticketId')::uuid and business_day_ymd=p_day for update;
  if v_ticket.id is null then raise exception 'Checkout ticket was not found for this day' using errcode='22023'; end if;
  select coalesce(sum(amount_cents),0) into v_paid from open_play_checkout_payments where ticket_id=v_ticket.id;
  if p_action='payer' then
    update open_play_checkout_tickets set payer_name=left(trim(coalesce(p_payload->>'payerName','')),120) where id=v_ticket.id;
  elsif p_action='add' then
    -- Marking here and attaching to the ticket succeed or roll back together.
    v_result := open_play_desk_command(p_day,'mark_here',p_staff,p_payload);
    select * into v_presence from open_play_desk_attendance where id=(v_result->>'attendanceId')::uuid for update;
    select * into v_item from open_play_checkout_items where attendance_id=v_presence.id;
    if v_item.id is not null then return jsonb_build_object('ticketId',v_item.ticket_id,'attendanceId',v_presence.id); end if;
    if v_paid>0 then raise exception 'Start a new ticket to add people after a payment has been recorded' using errcode='22023'; end if;
    if v_presence.role='child' and v_presence.dob is not null and v_presence.dob<=p_day::date then
      v_class := case when extract(year from age(p_day::date,v_presence.dob))<=2 then 'child_2_or_under' else 'child_3_plus' end;
      v_amount := case when v_class='child_2_or_under' then 700 else 1000 end;
    end if;
    if v_presence.source='native' and exists(select 1 from facility_party_guests g join facility_bookings b on b.id=g.booking_id
      where g.waiver_participant_id=v_presence.participant_id and g.checked_in_at is not null
        and (b.start_time at time zone 'America/New_York')::date=p_day::date) then
      v_amount := 0; v_reason := 'Birthday party admission included';
      if v_presence.role<>'child' then v_class := 'watching_adult'; end if;
    end if;
    -- Recognize admission already recorded by the previous front-desk system.
    select greatest(0,coalesce(sum(p.amount_cents),0)) into v_credit from (
      select e.amount_cents from open_play_payment_entries e join open_play_visit_attendees a on a.id=e.attendee_id
        join waiver_participants w on w.id=a.participant_id join open_play_visits v on v.id=a.visit_id
        where a.business_day_ymd=p_day and a.status='active' and v.status<>'voided'
          and lower(regexp_replace(trim(w.first_name),'\s+',' ','g')) || '|' || lower(regexp_replace(trim(w.last_name),'\s+',' ','g')) || '|' || w.dob::text=v_presence.identity_key
      union all
      select e.amount_cents from smartwaiver_legacy_payment_entries e join smartwaiver_legacy_check_ins a on a.id=e.legacy_check_in_id
        join smartwaiver_legacy_participants w on w.id=a.legacy_participant_id join smartwaiver_legacy_visits v on v.id=a.legacy_visit_id
        where a.business_day_ymd=p_day and a.status='active' and v.status<>'voided'
          and lower(regexp_replace(trim(w.first_name),'\s+',' ','g')) || '|' || lower(regexp_replace(trim(w.last_name),'\s+',' ','g')) || '|' || w.dob::text=v_presence.identity_key
    )p;
    insert into open_play_checkout_items(ticket_id,attendance_id,classification,amount_cents,credited_cents,reason)
      values(v_ticket.id,v_presence.id,v_class,v_amount,v_credit,v_reason);
  elsif p_action in ('edit','remove') then
    if v_paid>0 then raise exception 'This ticket has a recorded payment; its admission lines are locked' using errcode='22023'; end if;
    select * into v_item from open_play_checkout_items where id=(p_payload->>'itemId')::uuid and ticket_id=v_ticket.id for update;
    if v_item.id is null then raise exception 'Participant is no longer on this ticket' using errcode='22023'; end if;
    if p_action='remove' then delete from open_play_checkout_items where id=v_item.id;
    else
      select * into v_presence from open_play_desk_attendance where id=v_item.attendance_id;
      v_class := p_payload->>'classification'; v_amount := (p_payload->>'amountCents')::integer;
      if v_class is null or v_amount is null or v_amount not between 0 and 50000
        or (v_presence.role='child' and v_class not in ('child_2_or_under','child_3_plus'))
        or (v_presence.role<>'child' and v_class not in ('playing_adult','watching_adult'))
        or (v_class='watching_adult' and v_amount<>0)
        or (v_presence.role='child' and v_presence.dob is not null and v_class<>(case when extract(year from age(p_day::date,v_presence.dob))<=2 then 'child_2_or_under' else 'child_3_plus' end)) then
        raise exception 'Choose a valid admission type and amount' using errcode='22023';
      end if;
      if v_amount=0 and v_class<>'watching_adult' and length(trim(coalesce(p_payload->>'reason','')))=0 then
        raise exception 'Enter a reason for a free admission' using errcode='22023';
      end if;
      update open_play_checkout_items set classification=v_class,amount_cents=v_amount,
        reason=left(trim(coalesce(p_payload->>'reason','')),300) where id=v_item.id;
    end if;
  elsif p_action='void_payment' then
    select * into v_payment from open_play_checkout_payments where id=(p_payload->>'paymentId')::uuid and ticket_id=v_ticket.id and entry_type='payment' for update;
    if v_payment.id is null then raise exception 'Saved receipt was not found' using errcode='22023';end if;
    if length(trim(coalesce(p_payload->>'reason','')))=0 then raise exception 'Enter a reason for voiding this receipt' using errcode='22023';end if;
    insert into open_play_checkout_payments(id,ticket_id,method,amount_cents,entry_type,related_payment_id,reason,reference,created_by_staff_id)
      values(gen_random_uuid(),v_ticket.id,v_payment.method,-v_payment.amount_cents,'void',v_payment.id,
        left(trim(p_payload->>'reason'),300),v_payment.reference,p_staff) on conflict(related_payment_id) do nothing;
  elsif p_action='pay' then
    v_id := (p_payload->>'paymentId')::uuid; v_amount := (p_payload->>'amountCents')::integer;
    select * into v_payment from open_play_checkout_payments where id=v_id;
    if v_payment.id is not null then
      if v_payment.ticket_id<>v_ticket.id or v_payment.amount_cents is distinct from v_amount or v_payment.method is distinct from p_payload->>'method'
        or v_payment.reference is distinct from left(trim(coalesce(p_payload->>'reference','')),200) then
        raise exception 'Payment retry does not match the saved receipt' using errcode='22023';
      end if;
      return jsonb_build_object('ticketId',v_ticket.id,'paymentId',v_id);
    end if;
    if not exists(select 1 from open_play_checkout_items where ticket_id=v_ticket.id)
      or exists(select 1 from open_play_checkout_items where ticket_id=v_ticket.id and (classification is null or amount_cents is null)) then
      raise exception 'Choose admission for everyone before recording payment' using errcode='22023';
    end if;
    select coalesce(sum(greatest(0,amount_cents-credited_cents)),0)-v_paid into v_due from open_play_checkout_items where ticket_id=v_ticket.id;
    if v_amount is null or v_amount<=0 or v_amount>v_due or coalesce(p_payload->>'method','') not in ('cash','card') then
      raise exception 'Payment must be positive and cannot exceed the ticket balance' using errcode='22023';
    end if;
    if exists(select 1 from open_play_checkout_items i join open_play_desk_attendance a on a.id=i.attendance_id where i.ticket_id=v_ticket.id and a.waiver_expires_on<=p_day::date) then
      raise exception 'A guest needs a current waiver. Their arrival remains saved; renew the waiver before checkout.' using errcode='22023';
    end if;
    insert into open_play_checkout_payments(id,ticket_id,method,amount_cents,reference,created_by_staff_id)
      values(v_id,v_ticket.id,p_payload->>'method',v_amount,left(trim(coalesce(p_payload->>'reference','')),200),p_staff);
  else raise exception 'Unknown desk action' using errcode='22023'; end if;
  insert into open_play_audit_events(actor_staff_id,action,entity_type,entity_id,detail)
    values(p_staff,'desk_' || p_action,'open_play_checkout_ticket',v_ticket.id::text,jsonb_build_object('day',p_day,'payload',p_payload));
  return jsonb_build_object('ticketId',v_ticket.id);
end;
$$;
revoke all on function public.open_play_desk_command(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.open_play_desk_command(text,text,text,jsonb) to service_role;
-- Receipt history cannot be rewritten by a later form submission.
create function public.prevent_open_play_checkout_payment_rewrite() returns trigger language plpgsql as $$
begin raise exception 'Saved checkout payments are immutable'; end;
$$;
create trigger immutable_checkout_payments before update or delete on public.open_play_checkout_payments
for each row execute function public.prevent_open_play_checkout_payment_rewrite();
