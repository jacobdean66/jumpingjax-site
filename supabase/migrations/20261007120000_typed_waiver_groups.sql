begin;

alter table public.waiver_templates add column required_version_id uuid null references public.waiver_template_versions(id);
create or replace function public.jj_open_play_unit_price(p_classification text) returns integer
language sql immutable as $$ select case p_classification when 'child_2_or_under' then 700
  when 'child_3_plus' then 1000 when 'playing_adult' then 1000 when 'watching_adult' then 0 else null end; $$;


create table public.waiver_group_records (
  submission_id uuid primary key references public.waiver_submissions(id) on delete restrict,
  legal_body_html text not null,
  legal_body_sha256 text not null check (legal_body_sha256 ~ '^[a-f0-9]{64}$'),
  record_payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.waiver_group_records enable row level security;
revoke all on public.waiver_group_records from public, anon, authenticated;
grant all on public.waiver_group_records to service_role;
create trigger waiver_group_records_immutable before update or delete on public.waiver_group_records for each row execute function public.prevent_append_only_mutation();

create table public.waiver_adult_agreements (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.waiver_submissions(id) on delete restrict,
  participant_id uuid not null unique references public.waiver_participants(id) on delete restrict,
  first_name text not null check (length(trim(first_name)) between 1 and 80),
  last_name text not null check (length(trim(last_name)) between 1 and 80),
  adult_mode text not null check (adult_mode in ('playing','watching')),
  signature_type text not null default 'typed_name' check (signature_type='typed_name'),
  consent_payload jsonb not null,
  ip_hmac text null,
  user_agent text null,
  signed_at timestamptz not null
);

alter table public.waiver_adult_agreements enable row level security;
revoke all on public.waiver_adult_agreements from public, anon, authenticated;
grant all on public.waiver_adult_agreements to service_role;
create trigger waiver_adult_agreements_immutable before update or delete on public.waiver_adult_agreements for each row execute function public.prevent_append_only_mutation();

create index waiver_adult_agreements_submission_idx on public.waiver_adult_agreements(submission_id);

create or replace function public.enforce_completed_group_agreements() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare required_number integer; signed_number integer;
begin
  select rv.version_number,sv.version_number into required_number,signed_number
    from public.waiver_templates t join public.waiver_template_versions rv on rv.id=t.required_version_id
    join public.waiver_template_versions sv on sv.id=new.template_version_id where t.id=new.template_id;
  if new.source <> 'import' and signed_number>=required_number then
    if not exists(select 1 from public.waiver_group_records where submission_id=new.id)
      or (select count(*) from public.waiver_adult_agreements where submission_id=new.id)
      <> (select count(*) from public.waiver_participants where submission_id=new.id and role<>'child') then
      raise exception 'typed_adult_agreements_required' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;

create constraint trigger completed_group_agreements_required after insert on public.waiver_submissions deferrable initially deferred for each row execute function public.enforce_completed_group_agreements();

create or replace function public.jj_normalize_signing_name(p_name text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select lower(regexp_replace(trim(normalize(p_name, NFC)), '\s+', ' ', 'g'));
$$;

create or replace function public.submit_typed_waiver_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idempotency text := nullif(trim(p_payload->>'idempotency_key'), '');
  v_request_hash text := lower(nullif(trim(p_payload->>'request_hash'), ''));
  v_token_hash text := lower(nullif(trim(p_payload->>'public_token_hash'), ''));
  v_template_version_id uuid := nullif(p_payload->>'template_version_id', '')::uuid;
  v_template_id uuid;
  v_signed_at timestamptz := coalesce((p_payload->>'signed_at')::timestamptz, now());
  v_expires date;
  v_token_expires timestamptz;
  v_source text := nullif(trim(p_payload->>'source'), '');
  v_submission_id uuid;
  v_existing public.waiver_submissions%rowtype;
  v_participant jsonb;
  v_adult_map jsonb := '{}'::jsonb;
  v_temp text;
  v_pid uuid;
  v_guardian_temp text;
  v_guardian_id uuid;
  v_sig_path text;
  v_doc_path text;
  v_content_type text;
  v_signer_first text;
  v_signer_last text;
  v_signer_match boolean := false;
  v_adult_count integer := 0;
  v_child_count integer := 0;
  v_agreement jsonb;
  v_body text;
  v_agreement_count integer;
begin
  if v_idempotency is null or length(v_idempotency) < 16
     or v_request_hash is null or v_request_hash !~ '^[a-f0-9]{64}$'
     or v_token_hash is null or v_token_hash !~ '^[a-f0-9]{64}$'
     or v_template_version_id is null
     or v_source is null or v_source not in ('web', 'kiosk', 'import')
     or jsonb_typeof(p_payload->'participants') <> 'array'
     or jsonb_array_length(p_payload->'participants') < 1
     or jsonb_array_length(p_payload->'participants') > 20 then
    return jsonb_build_object('outcome', 'invalid_input');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('waiver_submit:' || v_idempotency, 0));

  select * into v_existing
  from public.waiver_submissions
  where idempotency_key = v_idempotency;

  if found then
    if v_existing.request_hash is distinct from v_request_hash then
      return jsonb_build_object('outcome', 'idempotency_conflict');
    end if;
    if not exists (
      select 1 from public.waiver_participants where submission_id = v_existing.id
    ) or not exists (
      select 1 from public.waiver_adult_agreements where submission_id = v_existing.id
    ) or not exists (
      select 1 from public.waiver_group_records where submission_id = v_existing.id
    ) or not exists (
      select 1 from public.open_play_audit_events
      where entity_type = 'waiver_submission' and entity_id = v_existing.id::text
        and action = 'waiver_submitted'
    ) then
      return jsonb_build_object('outcome', 'incomplete_prior_state');
    end if;
    return jsonb_build_object(
      'outcome', 'reused',
      'submission_id', v_existing.id,
      'expires_on', v_existing.expires_on,
      'token_expires_at', v_existing.token_expires_at
    );
  end if;

  select template_id into v_template_id
  from public.waiver_template_versions
  where id = v_template_version_id;
  if v_template_id is null then
    return jsonb_build_object('outcome', 'template_version_not_found');
  end if;


  select replace(body_html, '{{WAIVER_CURRENT_DATE}}',
    trim(to_char(v_signed_at at time zone 'America/New_York', 'FMMonth FMDD, YYYY')))
    into v_body from public.waiver_template_versions where id=v_template_version_id;
  if v_body is distinct from p_payload->>'legal_body_html' then
    return jsonb_build_object('outcome','legal_text_changed');
  end if;
  if jsonb_typeof(p_payload->'agreements') is distinct from 'array' then
    return jsonb_build_object('outcome','consent_required');
  end if;
  select count(*) into v_agreement_count from jsonb_array_elements(p_payload->'agreements');
  if v_agreement_count <> (select count(*) from jsonb_array_elements(p_payload->'participants') p where p->>'role'<>'child')
    or v_agreement_count <> (select count(distinct a->>'participantTempId') from jsonb_array_elements(p_payload->'agreements') a)
    or (select count(*) from jsonb_array_elements(p_payload->'participants') p where p->>'role'='adult_signer') <> 1
    or jsonb_array_length(p_payload->'participants') <> (select count(distinct p->>'temp_id') from jsonb_array_elements(p_payload->'participants') p) then
    return jsonb_build_object('outcome','invalid_input');
  end if;
  for v_participant in select value from jsonb_array_elements(p_payload->'participants') where value->>'role'<>'child' loop
    select value into v_agreement from jsonb_array_elements(p_payload->'agreements') where value->>'participantTempId'=v_participant->>'temp_id';
    if v_agreement is null
      or public.jj_normalize_signing_name(v_agreement->>'firstName') is distinct from public.jj_normalize_signing_name(v_participant->>'first_name')
      or public.jj_normalize_signing_name(v_agreement->>'lastName') is distinct from public.jj_normalize_signing_name(v_participant->>'last_name') then
      return jsonb_build_object('outcome','signature_name_mismatch');
    end if;
    if coalesce((v_agreement->>'acknowledgedRisk')::boolean,false) is not true
      or coalesce((v_agreement->>'acknowledgedTerms')::boolean,false) is not true
      or coalesce((v_agreement->>'electronicSignature')::boolean,false) is not true then
      return jsonb_build_object('outcome','consent_required');
    end if;
    if exists (select 1 from jsonb_array_elements(p_payload->'participants') p where p->>'role'='child' and p->>'guardian_temp_id'=v_participant->>'temp_id')
      and coalesce((v_agreement->>'guardianAuthority')::boolean,false) is not true then
      return jsonb_build_object('outcome','consent_required');
    end if;
    if coalesce(v_participant->>'adult_mode','') not in ('watching','playing') then
      return jsonb_build_object('outcome','invalid_input');
    end if;
  end loop;

  v_expires := public.jj_expires_on_from_signed_at(v_signed_at);
  v_token_expires := v_signed_at + interval '7 days';
  v_signer_first := trim(p_payload#>>'{signer,first_name}');
  v_signer_last := trim(p_payload#>>'{signer,last_name}');
  v_content_type := coalesce(nullif(trim(p_payload->>'signature_content_type'), ''), 'image/png');
  if v_content_type not in ('image/png', 'image/jpeg', 'image/webp', 'text/plain') then
    return jsonb_build_object('outcome', 'invalid_signature_content_type');
  end if;

  -- SQL-side consent verification (independent of TypeScript).
  if coalesce((p_payload#>>'{consent,acknowledgedRisk}')::boolean, false) is not true
     or coalesce((p_payload#>>'{consent,acknowledgedTerms}')::boolean, false) is not true
     or coalesce((p_payload#>>'{consent,isLegalGuardian}')::boolean, false) is not true then
    return jsonb_build_object('outcome', 'consent_required');
  end if;

  -- Pre-validate every DOB before any DML.
  for v_participant in select value from jsonb_array_elements(p_payload->'participants')
  loop
    if coalesce(v_participant->>'role', '') not in ('child', 'adult_signer', 'adult_covered') then
      return jsonb_build_object('outcome', 'invalid_input');
    end if;
    begin
      if to_char((trim(v_participant->>'dob'))::date, 'YYYY-MM-DD')
           is distinct from trim(v_participant->>'dob') then
        return jsonb_build_object('outcome', 'invalid_dob');
      end if;
      if (trim(v_participant->>'dob'))::date
           > (v_signed_at at time zone 'America/New_York')::date then
        return jsonb_build_object('outcome', 'future_dob');
      end if;
    exception
      when others then
        return jsonb_build_object('outcome', 'invalid_dob');
    end;
  end loop;


  for v_participant in select value from jsonb_array_elements(p_payload->'participants') loop
    if (v_participant->>'role'='child') is distinct from
      (public.jj_age_years_on_date((v_participant->>'dob')::date,(v_signed_at at time zone 'America/New_York')::date)<18) then
      return jsonb_build_object('outcome','invalid_participant_age');
    end if;
  end loop;
  insert into public.waiver_submissions (
    public_token_hash, idempotency_key, request_hash, template_id, template_version_id,
    signer_first_name, signer_last_name, signer_email, signer_phone,
    signed_at, expires_on, token_expires_at, source, status
  ) values (
    v_token_hash, v_idempotency, v_request_hash, v_template_id, v_template_version_id,
    v_signer_first, v_signer_last,
    trim(p_payload#>>'{signer,email}'),
    trim(p_payload#>>'{signer,phone}'),
    v_signed_at, v_expires, v_token_expires, v_source, 'completed'
  ) returning id into v_submission_id;

  -- Adults first
  for v_participant in
    select value from jsonb_array_elements(p_payload->'participants')
    where value->>'role' in ('adult_signer', 'adult_covered')
  loop
    v_adult_count := v_adult_count + 1;
    if v_adult_count > 8 then
      raise exception 'too_many_adults' using errcode = 'P0001';
    end if;
    v_temp := trim(v_participant->>'temp_id');
    insert into public.waiver_participants (
      submission_id, first_name, last_name, dob, role, guardian_participant_id
    ) values (
      v_submission_id,
      trim(v_participant->>'first_name'),
      trim(v_participant->>'last_name'),
      (v_participant->>'dob')::date,
      v_participant->>'role',
      null
    ) returning id into v_pid;
    v_adult_map := v_adult_map || jsonb_build_object(v_temp, v_pid::text);
    if v_participant->>'role' = 'adult_signer'
       and lower(trim(v_participant->>'first_name')) = lower(v_signer_first)
       and lower(trim(v_participant->>'last_name')) = lower(v_signer_last) then
      v_signer_match := true;
    end if;
  end loop;

  if not v_signer_match then
    raise exception 'signer_participant_mismatch' using errcode = 'P0001';
  end if;

  for v_participant in
    select value from jsonb_array_elements(p_payload->'participants')
    where value->>'role' = 'child'
  loop
    v_child_count := v_child_count + 1;
    if v_child_count > 12 then
      raise exception 'too_many_children' using errcode = 'P0001';
    end if;
    v_guardian_temp := trim(v_participant->>'guardian_temp_id');
    v_guardian_id := nullif(v_adult_map->>v_guardian_temp, '')::uuid;
    if v_guardian_id is null then
      raise exception 'child_guardian_missing' using errcode = 'P0001';
    end if;
    insert into public.waiver_participants (
      submission_id, first_name, last_name, dob, role, guardian_participant_id
    ) values (
      v_submission_id,
      trim(v_participant->>'first_name'),
      trim(v_participant->>'last_name'),
      (v_participant->>'dob')::date,
      'child',
      v_guardian_id
    );
  end loop;


  for v_participant in select value from jsonb_array_elements(p_payload->'participants') where value->>'role'<>'child' loop
    select value into v_agreement from jsonb_array_elements(p_payload->'agreements') where value->>'participantTempId'=v_participant->>'temp_id';
    insert into public.waiver_adult_agreements
      (submission_id,participant_id,first_name,last_name,adult_mode,consent_payload,ip_hmac,user_agent,signed_at)
    values (v_submission_id,(v_adult_map->>(v_participant->>'temp_id'))::uuid,
      trim(v_agreement->>'firstName'),trim(v_agreement->>'lastName'),v_participant->>'adult_mode',v_agreement,
      nullif(p_payload->>'ip_hmac',''),left(p_payload->>'user_agent',512),v_signed_at);
  end loop;
  insert into public.waiver_group_records (submission_id,legal_body_html,legal_body_sha256,record_payload)
  values (v_submission_id,v_body,encode(sha256(convert_to(v_body,'UTF8')),'hex'),
    jsonb_build_object('participants',p_payload->'participants','agreements',p_payload->'agreements','agreementText',p_payload->'agreement_text',
      'signer',p_payload->'signer','signedAt',v_signed_at,'expiresOn',v_expires,'templateVersionId',v_template_version_id));

  insert into public.open_play_audit_events (
    actor_staff_id, action, entity_type, entity_id, detail
  ) values (
    null,
    'waiver_submitted',
    'waiver_submission',
    v_submission_id::text,
    jsonb_build_object(
      'source', v_source,
      'participantCount', jsonb_array_length(p_payload->'participants'),
      'templateVersionId', v_template_version_id
    )
  );

  return jsonb_build_object(
    'outcome', 'created',
    'submission_id', v_submission_id,
    'expires_on', v_expires,
    'token_expires_at', v_token_expires,
    'agreement_count', v_agreement_count
  );
exception
  when unique_violation then
    select * into v_existing from public.waiver_submissions where idempotency_key = v_idempotency;
    if found and v_existing.request_hash = v_request_hash then
      return jsonb_build_object(
        'outcome', 'reused',
        'submission_id', v_existing.id,
        'expires_on', v_existing.expires_on,
        'token_expires_at', v_existing.token_expires_at
      );
    end if;
    return jsonb_build_object('outcome', 'idempotency_conflict');
  when sqlstate 'P0001' then
    -- Rolls back all writes; SQLERRM carries our stable outcome code.
    return jsonb_build_object('outcome', SQLERRM);
  when others then
    return jsonb_build_object('outcome', 'failed', 'error_code', SQLSTATE);
end;
$$;

revoke all on function public.submit_typed_waiver_atomic(jsonb) from public,anon,authenticated;
grant execute on function public.submit_typed_waiver_atomic(jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
