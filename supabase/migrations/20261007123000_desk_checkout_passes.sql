-- Complete a current-customer ticket with recipient-specific passes and one receipt.
alter table public.open_play_checkout_tickets add column completed_at timestamptz;
create table public.open_play_checkout_completions (
 ticket_id uuid primary key references public.open_play_checkout_tickets(id),
 idempotency_key text not null unique check(length(idempotency_key) between 16 and 128),
 request_hash text not null, response jsonb not null, staff_id text not null,
 created_at timestamptz not null default now()
);
create table public.open_play_checkout_passes (
 id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.open_play_checkout_tickets(id),
 item_id uuid not null unique references public.open_play_checkout_items(id),
 attendance_id uuid not null references public.open_play_desk_attendance(id),
 amount_cents integer not null check(amount_cents in (700,1000)), created_by_staff_id text not null,
 created_at timestamptz not null default now()
);
alter table public.open_play_checkout_completions enable row level security;
alter table public.open_play_checkout_passes enable row level security;
revoke all on public.open_play_checkout_completions, public.open_play_checkout_passes from public,anon,authenticated;
grant select,insert on public.open_play_checkout_completions, public.open_play_checkout_passes to service_role;
create trigger checkout_completions_immutable before update or delete on public.open_play_checkout_completions
 for each row execute function public.prevent_append_only_mutation();
create trigger checkout_passes_immutable before update or delete on public.open_play_checkout_passes
 for each row execute function public.prevent_append_only_mutation();

create function public.prevent_completed_ticket_item_rewrite() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.open_play_checkout_completions where ticket_id=case when tg_op='DELETE' then old.ticket_id else new.ticket_id end) then
  raise exception 'Completed checkout admission is locked. Start a new ticket for additional guests.' using errcode='22023';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$$;
create trigger completed_ticket_items_locked before insert or update or delete on public.open_play_checkout_items
 for each row execute function public.prevent_completed_ticket_item_rewrite();

create function public.enforce_desk_native_waiver_policy() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare signed_number integer; required_number integer; participant_role text; participant_dob date; status text; expires date;
begin
 if new.source='native' then
  select p.role,p.dob,s.status,s.expires_on,sv.version_number,rv.version_number
  into participant_role,participant_dob,status,expires,signed_number,required_number
  from public.waiver_participants p join public.waiver_submissions s on s.id=p.submission_id
   join public.waiver_templates t on t.id=s.template_id
   join public.waiver_template_versions sv on sv.id=s.template_version_id
   left join public.waiver_template_versions rv on rv.id=t.required_version_id where p.id=new.participant_id;
  if status is distinct from 'completed' or expires<=new.business_day_ymd::date
   or (required_number is not null and signed_number<required_number) then
   raise exception 'A current waiver with the updated agreement is required. Please complete the new waiver.' using errcode='22023';
  end if;
  if participant_role='child' and public.jj_age_years_on_date(participant_dob,new.business_day_ymd::date)>=18 then
   raise exception 'This guest is now 18 and must sign their own adult waiver.' using errcode='22023';
  end if;
 end if;
 return new;
end;
$$;
create trigger require_current_desk_waiver before insert on public.open_play_desk_attendance
 for each row execute function public.enforce_desk_native_waiver_policy();

create function public.complete_open_play_desk_checkout_atomic(p_day text,p_staff text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.open_play_checkout_tickets; prior public.open_play_checkout_completions;
 item public.open_play_checkout_items; person public.open_play_desk_attendance;
 passes jsonb:=coalesce(p_payload->'freePassItemIds','[]'::jsonb); pass_id text; pass_amount integer;
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
 result:=jsonb_build_object('ticketId',t.id,'paymentId',payment_id,'amountPaidCents',greatest(0,due),'freePassCount',jsonb_array_length(passes));
 insert into public.open_play_checkout_completions(ticket_id,idempotency_key,request_hash,response,staff_id)
  values(t.id,key,request_hash,result,p_staff);
 insert into public.open_play_audit_events(actor_staff_id,action,entity_type,entity_id,detail)
  values(p_staff,'desk_checkout_completed','open_play_checkout_ticket',t.id::text,result);
 return result;
end;
$$;
revoke all on function public.complete_open_play_desk_checkout_atomic(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.complete_open_play_desk_checkout_atomic(text,text,jsonb) to service_role;
