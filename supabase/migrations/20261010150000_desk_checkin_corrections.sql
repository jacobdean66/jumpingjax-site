-- Corrections preserve signed waivers and append reversal/replacement receipts.
alter table public.open_play_desk_attendance
 add column deleted_at timestamptz,
 add column corrected_at timestamptz,
 add column payment_period text not null default '';
alter table public.open_play_checkout_payments add column item_id uuid references public.open_play_checkout_items(id);

create or replace function public.prevent_completed_ticket_item_rewrite() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if coalesce(current_setting('jumpingjax.desk_correction',true),'')<>'on'
 and exists(select 1 from public.open_play_checkout_completions where ticket_id=case when tg_op='DELETE' then old.ticket_id else new.ticket_id end) then
  raise exception 'Completed checkout admission is locked. Use Edit check-in for a saved correction.' using errcode='22023';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$$;

create function public.correct_open_play_desk_checkin(p_day text,p_staff text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 person public.open_play_desk_attendance; target public.open_play_checkout_items;
 ticket public.open_play_checkout_tickets; receipt public.open_play_checkout_payments;
 line public.open_play_checkout_items; guest record;
 allocations jsonb:='[]'::jsonb; remaining jsonb:='{}'::jsonb; allocation jsonb;
 amount integer; available integer; applied integer; corrected_amount integer;
 method text:=p_payload->>'method'; deleting boolean:=p_payload->>'action'='delete_checkin';
 v_reason text:=trim(coalesce(p_payload->>'reason','')); old_guard text;
begin
 if p_staff is null or trim(p_staff)='' or p_day!~'^\d{4}-\d{2}-\d{2}$' or p_day::date is null
 or v_reason='' or length(v_reason)>300 or coalesce(p_payload->>'action','') not in ('correct_checkin','delete_checkin') then
  raise exception 'Enter a reason for this check-in correction.' using errcode='22023';
 end if;
 -- Serialize per day, then lock ticket before attendance (same order as checkout).
 perform pg_advisory_xact_lock(hashtextextended('desk_correction:'||p_day,0));
 if p_payload->>'attendanceId' like 'facility:%' then
  select g.*,p.submission_id,s.expires_on from public.facility_party_guests g
   join public.facility_bookings b on b.id=g.booking_id
   join public.waiver_participants p on p.id=g.waiver_participant_id
   join public.waiver_submissions s on s.id=p.submission_id
   where g.id=substring(p_payload->>'attendanceId' from 10)::uuid
   and (b.start_time at time zone 'America/New_York')::date=p_day::date and g.checked_in_at is not null
   into guest;
  if not found then raise exception 'Party check-in was not found.' using errcode='22023'; end if;
  insert into public.open_play_desk_attendance(business_day_ymd,source,participant_id,identity_key,
   first_name,last_name,dob,role,waiver_expires_on,checked_in_at,created_by_staff_id,facility_party_booking_id)
   values(p_day,'native',guest.waiver_participant_id,
    lower(regexp_replace(trim(guest.guest_first_name),'\s+',' ','g'))||'|'||lower(regexp_replace(trim(guest.guest_last_name),'\s+',' ','g'))||'|'||guest.guest_dob::text,
    guest.guest_first_name,guest.guest_last_name,guest.guest_dob,guest.participant_role,guest.expires_on,guest.checked_in_at,p_staff,guest.booking_id)
   on conflict(business_day_ymd,identity_key) do nothing;
  select * into person from public.open_play_desk_attendance where business_day_ymd=p_day and participant_id=guest.waiver_participant_id;
 else
  select * into person from public.open_play_desk_attendance where id=(p_payload->>'attendanceId')::uuid and business_day_ymd=p_day;
 end if;
 if person.id is null then raise exception 'Check-in was not found for this date.' using errcode='22023'; end if;
 select * into target from public.open_play_checkout_items where attendance_id=person.id;
 if target.id is not null then
  select * into ticket from public.open_play_checkout_tickets where id=target.ticket_id for update;
 end if;
 select * into person from public.open_play_desk_attendance where id=person.id for update;
 if person.deleted_at is not null then
  if deleting then return jsonb_build_object('attendanceId',person.id,'deleted',true); end if;
  raise exception 'This check-in was deleted. Refresh before editing.' using errcode='22023';
 end if;
 if not deleting then
  corrected_amount:=(p_payload->>'amountCents')::integer;
  if method is null or method not in ('cash','card','free_pass','birthday_party','unpaid','no_charge')
   or corrected_amount is null or corrected_amount not between 0 and 50000
   or (method in ('cash','card') and corrected_amount=0)
   or (method in ('free_pass','birthday_party','no_charge') and corrected_amount<>0)
   or length(coalesce(p_payload->>'paymentPeriod',''))>100 then
   raise exception 'Choose a valid payment method, amount and period.' using errcode='22023';
  end if;
  if method='birthday_party' and not exists(select 1 from public.facility_bookings
   where id=nullif(p_payload->>'birthdayPartyId','')::uuid and readable_date=p_day
   and lower(trim(coalesce(status,''))) not in ('cancelled','canceled') and nullif(trim(child_name),'') is not null) then
   raise exception 'Choose an available birthday party for this date.' using errcode='22023';
  end if;
 end if;
 old_guard:=coalesce(current_setting('jumpingjax.desk_correction',true),'');
 perform set_config('jumpingjax.desk_correction','on',true);
 if target.id is null and not deleting then
  insert into public.open_play_checkout_tickets(id,business_day_ymd,created_by_staff_id) values(gen_random_uuid(),p_day,p_staff) returning * into ticket;
  insert into public.open_play_checkout_items(ticket_id,attendance_id,classification,amount_cents)
   values(ticket.id,person.id,case when person.role<>'child' then 'playing_adult'
    when public.jj_age_years_on_date(person.dob,p_day::date)<=2 then 'child_2_or_under' else 'child_3_plus' end,0) returning * into target;
 end if;
 if target.id is not null then
  -- Allocate current money before changing any line, including mixed cash/card groups.
  for line in select * from public.open_play_checkout_items where ticket_id=ticket.id order by id for update loop
   remaining:=jsonb_set(remaining,array[line.id::text],to_jsonb(greatest(0,coalesce(line.amount_cents,0)-line.credited_cents)));
  end loop;
  for receipt in select p.* from public.open_play_checkout_payments p where p.ticket_id=ticket.id and p.entry_type='payment'
   and not exists(select 1 from public.open_play_checkout_payments v where v.related_payment_id=p.id) order by p.created_at,p.id loop
   amount:=receipt.amount_cents;
   for line in select * from public.open_play_checkout_items where ticket_id=ticket.id
    and (receipt.item_id is null or id=receipt.item_id) order by id loop
    available:=coalesce((remaining->>line.id::text)::integer,0); applied:=least(amount,available);
    if applied>0 then
     allocations:=allocations||jsonb_build_array(jsonb_build_object('item',line.id,'amount',applied,'method',receipt.method,'reference',receipt.reference));
     remaining:=jsonb_set(remaining,array[line.id::text],to_jsonb(available-applied)); amount:=amount-applied;
    end if;
   end loop;
   if amount<>0 then raise exception 'Receipt does not reconcile. Review this ticket before correcting.' using errcode='22023'; end if;
   insert into public.open_play_checkout_payments(id,ticket_id,method,amount_cents,entry_type,related_payment_id,reason,reference,created_by_staff_id,item_id)
    values(gen_random_uuid(),ticket.id,receipt.method,-receipt.amount_cents,'void',receipt.id,v_reason,receipt.reference,p_staff,receipt.item_id);
  end loop;
  -- Recreate the other guests' allocated money without changing their methods or amounts.
  for allocation in select value from jsonb_array_elements(allocations) loop
   if allocation->>'item'<>target.id::text then
    insert into public.open_play_checkout_payments(id,ticket_id,item_id,method,amount_cents,reference,reason,created_by_staff_id)
     values(gen_random_uuid(),ticket.id,(allocation->>'item')::uuid,allocation->>'method',(allocation->>'amount')::integer,
      allocation->>'reference','Retained after check-in correction: '||v_reason,p_staff);
   end if;
  end loop;
  update public.open_play_checkout_items set amount_cents=case when deleting then 0 else corrected_amount end,
   classification=case when person.role<>'child' and not deleting
    then case when method='no_charge' then 'watching_adult' else 'playing_adult' end
    when not deleting and person.role='child' then case when public.jj_age_years_on_date(person.dob,p_day::date)<=2 then 'child_2_or_under' else 'child_3_plus' end
    else classification end,
   credited_cents=0,reason=v_reason where id=target.id;
  if not deleting and method in ('cash','card') then
   insert into public.open_play_checkout_payments(id,ticket_id,item_id,method,amount_cents,reference,reason,created_by_staff_id)
    values(gen_random_uuid(),ticket.id,target.id,method,corrected_amount,'Corrected check-in',v_reason,p_staff);
  end if;
 end if;
 -- Remove the previous party arrival; a party correction can reassign it below.
 update public.facility_party_guests g set checked_in_at=null,checked_in_by=null,updated_at=now()
  from public.facility_bookings b where b.id=g.booking_id and b.readable_date=p_day
  and (g.waiver_participant_id=person.participant_id or g.legacy_participant_id=person.legacy_participant_id);
 update public.open_play_desk_attendance set corrected_at=now(),deleted_at=case when deleting then now() end,
  identity_key=case when deleting then identity_key||'|deleted:'||id::text else identity_key end,
  payment_period=case when deleting then payment_period else trim(coalesce(p_payload->>'paymentPeriod','')) end,
  facility_party_booking_id=case when not deleting and method='birthday_party' then (p_payload->>'birthdayPartyId')::uuid end
  where id=person.id;
 if deleting then
  update public.open_play_visit_attendees set status='removed' where participant_id=person.participant_id and business_day_ymd=p_day and status='active';
  update public.smartwaiver_legacy_check_ins set status='removed' where legacy_participant_id=person.legacy_participant_id and business_day_ymd=p_day and status='active';
 end if;
 -- Effective free-pass and party status are kept separately from immutable original passes.
 insert into public.open_play_desk_checkin_corrections(attendance_id,method,amount_cents,reason,staff_id,deleted)
  values(person.id,case when deleting then null else method end,case when deleting then 0 else corrected_amount end,v_reason,p_staff,deleting);
 if not deleting and method='birthday_party' then
  if person.source='native' then
   insert into public.facility_party_guests(booking_id,waiver_submission_id,waiver_participant_id,guest_first_name,guest_last_name,
    guest_dob,participant_role,signer_first_name,signer_last_name,waiver_expires_on,checked_in_at,checked_in_by)
    select (p_payload->>'birthdayPartyId')::uuid,p.submission_id,p.id,person.first_name,person.last_name,p.dob,p.role,
     s.signer_first_name,s.signer_last_name,s.expires_on,person.checked_in_at,p_staff
    from public.waiver_participants p join public.waiver_submissions s on s.id=p.submission_id where p.id=person.participant_id
    on conflict(booking_id,waiver_participant_id) do update set checked_in_at=excluded.checked_in_at,checked_in_by=p_staff,updated_at=now();
  else
   insert into public.facility_party_guests(booking_id,legacy_waiver_id,legacy_participant_id,guest_first_name,guest_last_name,
    guest_dob,participant_role,signer_first_name,signer_last_name,waiver_expires_on,checked_in_at,checked_in_by)
    select (p_payload->>'birthdayPartyId')::uuid,p.legacy_waiver_id,p.id,person.first_name,person.last_name,p.dob,p.role,
     coalesce(w.signer_first_name,person.first_name),coalesce(w.signer_last_name,person.last_name),w.expires_on,person.checked_in_at,p_staff
    from public.smartwaiver_legacy_participants p join public.smartwaiver_legacy_waivers w on w.id=p.legacy_waiver_id where p.id=person.legacy_participant_id
    on conflict(booking_id,legacy_participant_id) do update set checked_in_at=excluded.checked_in_at,checked_in_by=p_staff,updated_at=now();
  end if;
 end if;
 insert into public.open_play_audit_events(actor_staff_id,action,entity_type,entity_id,detail)
  values(p_staff,'desk_'||(p_payload->>'action'),'open_play_desk_attendance',person.id::text,
   jsonb_build_object('day',p_day,'before',to_jsonb(person),'beforeItem',to_jsonb(target),'payload',p_payload));
 perform set_config('jumpingjax.desk_correction',old_guard,true);
 return jsonb_build_object('attendanceId',person.id,'ticketId',ticket.id,'deleted',deleting);
end;
$$;

create table public.open_play_desk_checkin_corrections(
 id bigint generated always as identity primary key,
 attendance_id uuid not null references public.open_play_desk_attendance(id),
 method text check(method in ('cash','card','free_pass','birthday_party','unpaid','no_charge')),
 amount_cents integer not null,reason text not null,staff_id text not null,
 deleted boolean not null default false,created_at timestamptz not null default now()
);
alter table public.open_play_desk_checkin_corrections enable row level security;
revoke all on public.open_play_desk_checkin_corrections from public,anon,authenticated;
grant select,insert on public.open_play_desk_checkin_corrections to service_role;
create trigger checkin_corrections_immutable before update or delete on public.open_play_desk_checkin_corrections
 for each row execute function public.prevent_append_only_mutation();
revoke all on function public.correct_open_play_desk_checkin(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.correct_open_play_desk_checkin(text,text,jsonb) to service_role;

