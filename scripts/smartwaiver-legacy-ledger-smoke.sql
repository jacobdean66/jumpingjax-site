-- Production-safe transactional smoke test. Every inserted row is rolled back.
begin;

do $$
declare
  v_participant uuid;
  v_visit uuid := gen_random_uuid();
  v_check_in uuid := gen_random_uuid();
  v_payment uuid := gen_random_uuid();
  v_created jsonb;
  v_corrected jsonb;
begin
  select p.id into v_participant
  from public.smartwaiver_legacy_participants p
  join public.smartwaiver_legacy_waivers w on w.id = p.legacy_waiver_id
  where p.dob is not null
    and w.activated = true
    and w.expires_on > current_date
  limit 1;

  if v_participant is null then
    raise exception 'no eligible test participant';
  end if;

  v_created := public.create_smartwaiver_legacy_check_ins_atomic(
    jsonb_build_object(
      'legacy_visit_id', v_visit,
      'business_day_ymd', to_char(current_date, 'YYYY-MM-DD'),
      'staff_id', 'transaction-smoke-test',
      'notes', 'rolled back smoke test',
      'attendees', jsonb_build_array(jsonb_build_object(
        'check_in_id', v_check_in,
        'payment_id', v_payment,
        'audit_id', gen_random_uuid(),
        'legacy_participant_id', v_participant,
        'waiver_id', 'redacted-smoke-test',
        'classification', 'playing_adult',
        'age_years_on_visit', 30,
        'unit_price_cents', 700,
        'payment_method', 'cash'
      ))
    )
  );
  if v_created->>'outcome' <> 'created' then
    raise exception 'create failed: %', v_created->>'outcome';
  end if;

  v_corrected := public.apply_smartwaiver_legacy_visit_correction_atomic(
    jsonb_build_object(
      'visit_id', v_visit,
      'staff_id', 'transaction-smoke-test',
      'type', 'method_correction',
      'reason', 'rolled back smoke test',
      'related_entry_id', v_payment,
      'from_method', 'cash',
      'to_method', 'card',
      'amount_cents', 700
    )
  );
  if v_corrected->>'outcome' <> 'applied' then
    raise exception 'correction failed: %', v_corrected->>'outcome';
  end if;

  if (
    select count(*)
    from public.smartwaiver_legacy_payment_entries
    where legacy_visit_id = v_visit
  ) <> 3 then
    raise exception 'ledger row count mismatch';
  end if;
end $$;

rollback;
