-- Birthday party checkout covers admission without consuming free passes or recording cash/card.
alter table public.open_play_desk_attendance add column facility_party_booking_id uuid
 references public.facility_bookings(id);
create index desk_attendance_party_idx on public.open_play_desk_attendance(facility_party_booking_id)
 where facility_party_booking_id is not null;

-- Imported waivers can attend a party without creating a replacement native waiver.
alter table public.facility_party_guests alter column waiver_submission_id drop not null,
 alter column waiver_participant_id drop not null,
 add column legacy_waiver_id uuid references public.smartwaiver_legacy_waivers(id),
 add column legacy_participant_id uuid references public.smartwaiver_legacy_participants(id),
 add constraint party_guest_one_waiver_source check (
  (waiver_submission_id is not null and waiver_participant_id is not null and legacy_waiver_id is null and legacy_participant_id is null)
  or (waiver_submission_id is null and waiver_participant_id is null and legacy_waiver_id is not null and legacy_participant_id is not null)),
 add constraint party_guest_legacy_unique unique(booking_id,legacy_participant_id);

create or replace function public.complete_open_play_desk_checkout_atomic(p_day text,p_staff text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.open_play_checkout_tickets; prior public.open_play_checkout_completions;
 item public.open_play_checkout_items; person public.open_play_desk_attendance;
 passes jsonb:=coalesce(p_payload->'freePassItemIds','[]'::jsonb); pass_id text; pass_amount integer;
 party_id uuid:=nullif(p_payload->>'birthdayPartyId','')::uuid; booking public.facility_bookings;
 key text:=p_payload->>'idempotencyKey'; request_hash text; paid integer; due integer; payment_id uuid; result jsonb;
begin
 if p_staff is null or length(trim(p_staff))=0 or p_day!~'^\d{4}-\d{2}-\d{2}$'
  or key is null or length(key) not between 16 and 128 or jsonb_typeof(passes)<>'array' or jsonb_array_length(passes)>40 then
  raise exception 'Invalid checkout request' using errcode='22023';
 end if;
 if jsonb_array_length(passes)<>(select count(distinct value#>>'{}') from jsonb_array_elements(passes)) then
  raise exception 'A participant can use one free pass per checkout.' using errcode='22023';
 end if;
 request_hash:=encode(sha256(convert_to(jsonb_build_object('ticket',p_payload->>'ticketId','day',p_day,
  'method',p_payload->>'method','passes',(select coalesce(jsonb_agg(value order by value),'[]'::jsonb) from jsonb_array_elements(passes)))::text,'UTF8')),'hex');
 if party_id is not null then
  request_hash:=encode(sha256(convert_to(jsonb_build_object('request',request_hash,'birthdayPartyId',party_id)::text,'UTF8')),'hex');
 end if;
 perform pg_advisory_xact_lock(hashtextextended('desk_checkout:'||key,0));
 select * into prior from public.open_play_checkout_completions where idempotency_key=key;
 if found then
  if prior.request_hash<>request_hash or prior.staff_id<>p_staff then raise exception 'Checkout retry changed. Refresh to review the saved receipt.' using errcode='22023'; end if;
  return prior.response;
 end if;
 select * into t from public.open_play_checkout_tickets where id=(p_payload->>'ticketId')::uuid and business_day_ymd=p_day for update;
 if not found then raise exception 'Checkout ticket not found.' using errcode='22023'; end if;
 if t.completed_at is not null then raise exception 'This checkout is already complete. Refresh to view the receipt.' using errcode='22023'; end if;
 if not exists(select 1 from public.open_play_checkout_items where ticket_id=t.id)
  or exists(select 1 from public.open_play_checkout_items where ticket_id=t.id and (classification is null or amount_cents is null)) then
  raise exception 'Choose admission for every participant before checkout.' using errcode='22023';
 end if;
 if exists(select 1 from public.open_play_checkout_items i join public.open_play_desk_attendance a on a.id=i.attendance_id
  where i.ticket_id=t.id and a.waiver_expires_on<=p_day::date) then
  raise exception 'A guest needs a current waiver before admission.' using errcode='22023';
 end if;
 -- Party assignment, admission credit and guest-list check-in share this transaction.
 if party_id is not null then
  select * into booking from public.facility_bookings where id=party_id for share;
  if not found or booking.readable_date is distinct from p_day
   or lower(trim(coalesce(booking.status,''))) in ('cancelled','canceled')
   or nullif(trim(booking.child_name),'') is null then
   raise exception 'Choose an available birthday party for this desk date.' using errcode='22023';
  end if;
  if jsonb_array_length(passes)>0 or nullif(p_payload->>'method','') is not null
   or exists(select 1 from public.open_play_checkout_payments where ticket_id=t.id) then
   raise exception 'Birthday party admission is free. Remove payment and free-pass choices before completing.' using errcode='22023';
  end if;
  if exists(select 1 from public.open_play_checkout_items i join public.open_play_desk_attendance a on a.id=i.attendance_id
   where i.ticket_id=t.id and ((a.facility_party_booking_id is not null and a.facility_party_booking_id<>party_id)
    or exists(select 1 from public.facility_party_guests g join public.facility_bookings b on b.id=g.booking_id
     where g.booking_id<>party_id and g.checked_in_at is not null and b.readable_date=p_day
      and (g.waiver_participant_id=a.participant_id or g.legacy_participant_id=a.legacy_participant_id)))) then
   raise exception 'A guest is already checked into another birthday party.' using errcode='22023';
  end if;
  for item in select * from public.open_play_checkout_items where ticket_id=t.id for update loop
   select * into person from public.open_play_desk_attendance where id=item.attendance_id for update;
   update public.open_play_desk_attendance set facility_party_booking_id=party_id,checked_out_at=null where id=person.id;
   update public.open_play_checkout_items set credited_cents=greatest(credited_cents,amount_cents),reason='Birthday party admission included' where id=item.id;
   if person.source='native' then
    insert into public.facility_party_guests(booking_id,waiver_submission_id,waiver_participant_id,
     guest_first_name,guest_last_name,guest_dob,participant_role,signer_first_name,signer_last_name,waiver_expires_on,checked_in_at,checked_in_by)
    select party_id,p.submission_id,p.id,person.first_name,person.last_name,p.dob,p.role,s.signer_first_name,s.signer_last_name,s.expires_on,person.checked_in_at,p_staff
     from public.waiver_participants p join public.waiver_submissions s on s.id=p.submission_id where p.id=person.participant_id
    on conflict(booking_id,waiver_participant_id) do update
     set checked_in_at=coalesce(facility_party_guests.checked_in_at,excluded.checked_in_at),checked_in_by=excluded.checked_in_by,updated_at=now();
   else
    insert into public.facility_party_guests(booking_id,legacy_waiver_id,legacy_participant_id,
     guest_first_name,guest_last_name,guest_dob,participant_role,signer_first_name,signer_last_name,waiver_expires_on,checked_in_at,checked_in_by)
    select party_id,p.legacy_waiver_id,p.id,person.first_name,person.last_name,p.dob,p.role,
     coalesce(nullif(trim(w.signer_first_name),''),person.first_name),coalesce(nullif(trim(w.signer_last_name),''),person.last_name),w.expires_on,person.checked_in_at,p_staff
     from public.smartwaiver_legacy_participants p join public.smartwaiver_legacy_waivers w on w.id=p.legacy_waiver_id where p.id=person.legacy_participant_id
    on conflict(booking_id,legacy_participant_id) do update
     set checked_in_at=coalesce(facility_party_guests.checked_in_at,excluded.checked_in_at),checked_in_by=excluded.checked_in_by,updated_at=now();
   end if;
  end loop;
 end if;
 for pass_id in select value#>>'{}' from jsonb_array_elements(passes) loop
  select * into item from public.open_play_checkout_items where id=pass_id::uuid and ticket_id=t.id for update;
  if not found then raise exception 'Assign the pass to a participant on this checkout.' using errcode='22023'; end if;
  select * into person from public.open_play_desk_attendance where id=item.attendance_id;
  if item.classification='watching_adult' or item.amount_cents<=item.credited_cents or person.dob is null then
   raise exception 'This participant is already free or lacks a date of birth.' using errcode='22023';
  end if;
  pass_amount:=case when person.role='child' and public.jj_age_years_on_date(person.dob,p_day::date)<=2 then 700 else 1000 end;
  if item.amount_cents-item.credited_cents<pass_amount then
   raise exception 'This admission is partly covered already. Remove the pass assignment and review the remaining amount.' using errcode='22023';
  end if;
  update public.open_play_checkout_items set credited_cents=credited_cents+pass_amount where id=item.id;
  insert into public.open_play_checkout_passes(ticket_id,item_id,attendance_id,amount_cents,created_by_staff_id)
   values(t.id,item.id,person.id,pass_amount,p_staff);
 end loop;
 select coalesce(sum(amount_cents),0) into paid from public.open_play_checkout_payments where ticket_id=t.id;
 select coalesce(sum(greatest(0,amount_cents-credited_cents)),0)-paid into due from public.open_play_checkout_items where ticket_id=t.id;
 if due>0 then
  if coalesce(p_payload->>'method','') not in ('cash','card') then raise exception 'Choose card or cash for the remaining balance.' using errcode='22023'; end if;
  payment_id:=gen_random_uuid();
  perform public.open_play_desk_command(p_day,'pay',p_staff,jsonb_build_object('ticketId',t.id,'paymentId',payment_id,
   'method',p_payload->>'method','amountCents',due,'reference','Completed checkout'));
 end if;
 update public.open_play_checkout_tickets set completed_at=now() where id=t.id;
 result:=jsonb_build_object('ticketId',t.id,'paymentId',payment_id,'amountPaidCents',greatest(0,due),'freePassCount',jsonb_array_length(passes),'birthdayPartyId',party_id);
 insert into public.open_play_checkout_completions(ticket_id,idempotency_key,request_hash,response,staff_id)
  values(t.id,key,request_hash,result,p_staff);
 insert into public.open_play_audit_events(actor_staff_id,action,entity_type,entity_id,detail)
  values(p_staff,'desk_checkout_completed','open_play_checkout_ticket',t.id::text,result);
 return result;
end;
$$;
revoke all on function public.complete_open_play_desk_checkout_atomic(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.complete_open_play_desk_checkout_atomic(text,text,jsonb) to service_role;
