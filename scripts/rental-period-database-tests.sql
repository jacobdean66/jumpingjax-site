create function pg_temp.fixture(p_item text, p_date date) returns text language sql as $$
  select public.create_rental_booking_atomic_v2(jsonb_build_object(
    'rental_item',p_item,'rental_name','Isolated period test','customer_name','CODEX PERIOD TEST',
    'event_date',p_date,'span_days',1,'subtotal',300,'total',335,'delivery_fee',25,'mileage_fee',10,
    'payment_method','Cash','duration','One Day','event_address','Isolated test'),
    jsonb_build_array(jsonb_build_object('rental_item',p_item,'rental_name','Isolated period test')),gen_random_uuid()::text);
$$;
create function pg_temp.expected(p_id text) returns jsonb language sql as $$
  select jsonb_build_object('event_date',event_date,'span_days',span_days,'subtotal',subtotal,'total',total,'rental_day_charges',rental_day_charges)
  from public.bookings where id::text=p_id;
$$;
create function pg_temp.edit(p_id text,p_span integer,p_days jsonb) returns jsonb language sql as $$
  select public.edit_rental_booking_atomic(p_id,(select to_jsonb(b) from public.bookings b where id::text=p_id),
    jsonb_build_object('spanDays',p_span,'dayCharges',p_days),pg_temp.expected(p_id));
$$;
do $$
declare a text; b text; c text; d text; old_state jsonb; result jsonb; days jsonb; expected numeric;
  choice2 text; choice3 text; suffix text := gen_random_uuid()::text; msg text; det text;
begin
  a := pg_temp.fixture('period-a-'||suffix,'2035-12-31');
  insert into public.booking_rental_items(booking_id,rental_item,rental_name) values(a::bigint,'period-extra-'||suffix,'Additional test item');
  insert into public.booking_payment_entries(booking_kind,booking_id,entry_type,payment_method,amount_cents,recorded_by,status)
    values('rental',a,'rental_payment','cash',10000,'Isolated SQL test','posted');
  insert into public.booking_invoices(booking_kind,booking_id,invoice_number,payload,subtotal,total,balance_due)
    values('rental',a,'TEST-'||a,jsonb_build_object('lineItems',jsonb_build_array(jsonb_build_object('id','custom','description','Preserved custom line','quantity',1,'unitPrice',300)),
      'deliveryFee',35,'paymentsReceived',100,'eventDate','2035-12-31'),300,335,235);
  foreach choice2 in array array['free','charge'] loop
    days := jsonb_build_array(jsonb_build_object('day',2,'choice',choice2,'amount',case when choice2='free' then 0 else 80.25 end));
    result := pg_temp.edit(a,2,days);
    expected := 335 + case when choice2='free' then 0 else 80.25 end;
    if (result->>'total')::numeric <> expected or (result->>'span_days')::int <> 2 or result->'rental_day_charges' <> days then raise exception 'two_day_persistence'; end if;
    foreach choice3 in array array['free','charge'] loop
      days := jsonb_build_array(jsonb_build_object('day',2,'choice',choice2,'amount',case when choice2='free' then 0 else 80.25 end),
        jsonb_build_object('day',3,'choice',choice3,'amount',case when choice3='free' then 0 else 70.50 end));
      result := pg_temp.edit(a,3,days);
      expected := 335 + case when choice2='free' then 0 else 80.25 end + case when choice3='free' then 0 else 70.50 end;
      if (result->>'total')::numeric <> expected or result->'rental_day_charges' <> days then raise exception 'three_day_total'; end if;
      if not exists(select 1 from public.booking_invoices where booking_id=a and total=expected and balance_due=expected-100
        and payload->'lineItems'->0->>'description'='Preserved custom line' and jsonb_array_length(payload->'lineItems')=3) then raise exception 'invoice_balance'; end if;
    end loop;
  end loop;
  if not exists(select 1 from public.bookings where id::text=a and delivery_fee=25 and mileage_fee=10 and subtotal=450.75) then raise exception 'fees_changed'; end if;
  if not exists(select 1 from public.booking_payment_entries where booking_id=a and amount_cents=10000 and status='posted') then raise exception 'payment_changed'; end if;
  -- Both primary and additional items must block checkout on days 2 and 3.
  foreach choice2 in array array['period-a-','period-extra-'] loop
    for offset_day in 1..2 loop
      begin
        perform pg_temp.fixture(choice2||suffix,'2035-12-31'::date + offset_day);
        raise exception 'conflict_was_allowed';
      exception when raise_exception then
        get stacked diagnostics msg = message_text;
        if msg <> 'booking_conflict' then raise; end if;
      end;
    end loop;
  end loop;
  -- Shortening releases both removed dates. Extending into another booking
  -- must leave all booking, pricing and invoice data unchanged.
  perform pg_temp.edit(a,1,'[]');
  b := pg_temp.fixture('period-extra-'||suffix,'2036-01-01');
  c := pg_temp.fixture('period-a-'||suffix,'2036-01-02');
  old_state := (select to_jsonb(x) from public.bookings x where id::text=a);
  begin
    perform pg_temp.edit(a,3,'[{"day":2,"choice":"free","amount":0},{"day":3,"choice":"charge","amount":50}]');
    raise exception 'conflict_was_allowed';
  exception when raise_exception then
    get stacked diagnostics msg=message_text, det=pg_exception_detail;
    if msg <> 'booking_conflict' or det not like '%2036-01-01%' then raise; end if;
  end;
  if old_state is distinct from (select to_jsonb(x) from public.bookings x where id::text=a) then raise exception 'rejected_save_mutated'; end if;
  if not exists(select 1 from public.booking_invoices where booking_id=a and total=335 and balance_due=235) then raise exception 'rejected_invoice_mutated'; end if;
  update public.bookings set status='cancelled' where id::text=b;
  begin
    perform pg_temp.edit(a,3,'[{"day":2,"choice":"free","amount":0},{"day":3,"choice":"free","amount":0}]');
    raise exception 'day3_conflict_allowed';
  exception when raise_exception then
    get stacked diagnostics msg=message_text, det=pg_exception_detail;
    if msg <> 'booking_conflict' or det not like '%2036-01-02%' then raise; end if;
  end;
  update public.bookings set status='cancelled' where id::text=c;
  perform pg_temp.edit(a,3,'[{"day":2,"choice":"free","amount":0},{"day":3,"choice":"free","amount":0}]');
  -- Direct writers and restoration share the same guard.
  begin
    update public.bookings set status='approved' where id::text=b;
    raise exception 'restore_conflict_allowed';
  exception when raise_exception then if sqlerrm <> 'booking_conflict' then raise; end if; end;
  d := pg_temp.fixture('period-other-'||suffix,'2036-01-02');
  begin
    insert into public.booking_rental_items(booking_id,rental_item) values(d::bigint,'period-extra-'||suffix);
    raise exception 'additional_item_conflict_allowed';
  exception when raise_exception then if sqlerrm <> 'booking_conflict' then raise; end if; end;
  -- Invalid pricing and stale edits reject without mutation.
  begin
    perform pg_temp.edit(a,2,'[{"day":2,"choice":"free","amount":10}]');
    raise exception 'invalid_price_allowed';
  exception when raise_exception then if sqlerrm <> 'invalid_rental_day_charge' then raise; end if; end;
  begin
    perform public.edit_rental_booking_atomic(a,old_state,'{"spanDays":1,"dayCharges":[]}','{}');
    raise exception 'stale_save_allowed';
  exception when raise_exception then if sqlerrm <> 'rental_edit_stale' then raise; end if; end;
  if has_function_privilege('anon','public.edit_rental_booking_atomic(text,jsonb,jsonb,jsonb)','EXECUTE') then raise exception 'public_edit_permission'; end if;
end; $$;
select 'PASS: six charge combinations, persistence, partially paid invoice, one-time fees, cross-year dates, primary/additional conflicts, rollback, shortening, cancellation, restore, direct writes, stale edits and permissions' as result;
