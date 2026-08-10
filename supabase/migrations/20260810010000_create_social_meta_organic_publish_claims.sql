-- Social Posts: dedicated durable Meta organic publish claim/result store.
-- Additive / idempotent. Service-role server writes only (RLS enabled, no anon policies).
-- Enforces at-most-one external Meta mutation per execution authorization.

create table if not exists public.social_meta_organic_publish_claims (
  authorization_id text primary key,
  claim_id uuid not null default gen_random_uuid(),
  social_post_id text not null,
  publication_target_id text not null,
  page_id text not null,
  owner_approval_id text not null,
  admin_actor_id text not null,
  fingerprint text not null,
  state text not null,
  lease_expires_at timestamptz not null,
  meta_invoked_at timestamptz null,
  external_publication_id text null,
  error_code text null,
  error_message text null,
  result_summary jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint social_meta_organic_publish_claims_state_valid
    check (state in ('in_progress', 'completed', 'failed')),
  constraint social_meta_organic_publish_claims_fingerprint_len
    check (char_length(fingerprint) = 64),
  constraint social_meta_organic_publish_claims_completed_shape
    check (
      state <> 'completed'
      or (
        external_publication_id is not null
        and completed_at is not null
      )
    ),
  constraint social_meta_organic_publish_claims_external_only_when_completed
    check (external_publication_id is null or state = 'completed'),
  constraint social_meta_organic_publish_claims_failed_shape
    check (state <> 'failed' or error_code is not null)
);

create index if not exists social_meta_organic_publish_claims_post_target_idx
  on public.social_meta_organic_publish_claims (
    social_post_id,
    publication_target_id,
    created_at desc
  );

create index if not exists social_meta_organic_publish_claims_in_progress_lease_idx
  on public.social_meta_organic_publish_claims (state, lease_expires_at)
  where state = 'in_progress';

create index if not exists social_meta_organic_publish_claims_page_idx
  on public.social_meta_organic_publish_claims (page_id, created_at desc);

create or replace function public.social_meta_organic_publish_claim_begin(
  p_authorization_id text,
  p_social_post_id text,
  p_publication_target_id text,
  p_page_id text,
  p_owner_approval_id text,
  p_admin_actor_id text,
  p_fingerprint text,
  p_lease_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_row public.social_meta_organic_publish_claims%rowtype;
  v_inserted integer;
  v_claim_id uuid;
  v_lease_ms integer := greatest(coalesce(p_lease_ms, 120000), 1000);
begin
  if nullif(trim(p_authorization_id), '') is null
     or nullif(trim(p_social_post_id), '') is null
     or nullif(trim(p_publication_target_id), '') is null
     or nullif(trim(p_page_id), '') is null
     or nullif(trim(p_owner_approval_id), '') is null
     or nullif(trim(p_admin_actor_id), '') is null
     or nullif(trim(p_fingerprint), '') is null
     or char_length(trim(p_fingerprint)) <> 64 then
    return jsonb_build_object(
      'ok', false,
      'kind', 'error',
      'code', 'invalid_claim_input',
      'message', 'Invalid Meta publish claim input.'
    );
  end if;

  select *
    into v_row
  from public.social_meta_organic_publish_claims
  where authorization_id = trim(p_authorization_id)
  for update;

  if found then
    if v_row.state = 'completed' then
      if v_row.fingerprint = trim(p_fingerprint) then
        return jsonb_build_object(
          'ok', true,
          'kind', 'replay',
          'claim_id', v_row.claim_id,
          'external_publication_id', v_row.external_publication_id,
          'result_summary', coalesce(v_row.result_summary, '{}'::jsonb),
          'fingerprint', v_row.fingerprint,
          'social_post_id', v_row.social_post_id,
          'publication_target_id', v_row.publication_target_id,
          'page_id', v_row.page_id,
          'authorization_id', v_row.authorization_id
        );
      end if;
      return jsonb_build_object(
        'ok', false,
        'kind', 'error',
        'code', 'fingerprint_conflict',
        'message', 'Completed Meta publish claim fingerprint mismatch.'
      );
    end if;

    if v_row.state = 'failed' then
      return jsonb_build_object(
        'ok', false,
        'kind', 'error',
        'code', 'authorization_consumed',
        'message', 'This execution authorization already recorded a Meta publish attempt and cannot create another post.'
      );
    end if;

    -- in_progress
    if v_row.fingerprint is distinct from trim(p_fingerprint) then
      return jsonb_build_object(
        'ok', false,
        'kind', 'error',
        'code', 'fingerprint_conflict',
        'message', 'Publish content no longer matches the durable authorization claim. Re-authorize before publishing.'
      );
    end if;

    if v_row.meta_invoked_at is not null then
      return jsonb_build_object(
        'ok', true,
        'kind', 'awaiting_reconciliation',
        'claim_id', v_row.claim_id,
        'external_publication_id', v_row.external_publication_id,
        'message', 'Meta may already have been invoked for this authorization. Manual reconciliation required — no second Meta mutation will be attempted.'
      );
    end if;

    if v_row.lease_expires_at > v_now then
      return jsonb_build_object(
        'ok', true,
        'kind', 'in_progress',
        'claim_id', v_row.claim_id,
        'message', 'A Meta publish attempt is already in progress for this authorization.'
      );
    end if;

    -- Stale pre-Meta reclaim (lease expired, meta never invoked).
    update public.social_meta_organic_publish_claims
       set claim_id = gen_random_uuid(),
           social_post_id = trim(p_social_post_id),
           publication_target_id = trim(p_publication_target_id),
           page_id = trim(p_page_id),
           owner_approval_id = trim(p_owner_approval_id),
           admin_actor_id = trim(p_admin_actor_id),
           fingerprint = trim(p_fingerprint),
           state = 'in_progress',
           lease_expires_at = v_now + make_interval(secs => v_lease_ms::double precision / 1000.0),
           meta_invoked_at = null,
           external_publication_id = null,
           error_code = null,
           error_message = null,
           result_summary = null,
           completed_at = null,
           updated_at = v_now
     where authorization_id = trim(p_authorization_id)
     returning claim_id into v_claim_id;

    return jsonb_build_object(
      'ok', true,
      'kind', 'proceed',
      'claim_id', v_claim_id,
      'reclaimed', true
    );
  end if;

  insert into public.social_meta_organic_publish_claims (
    authorization_id,
    social_post_id,
    publication_target_id,
    page_id,
    owner_approval_id,
    admin_actor_id,
    fingerprint,
    state,
    lease_expires_at,
    created_at,
    updated_at
  )
  values (
    trim(p_authorization_id),
    trim(p_social_post_id),
    trim(p_publication_target_id),
    trim(p_page_id),
    trim(p_owner_approval_id),
    trim(p_admin_actor_id),
    trim(p_fingerprint),
    'in_progress',
    v_now + make_interval(secs => v_lease_ms::double precision / 1000.0),
    v_now,
    v_now
  )
  on conflict (authorization_id) do nothing
  returning claim_id into v_claim_id;

  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    return jsonb_build_object(
      'ok', true,
      'kind', 'proceed',
      'claim_id', v_claim_id,
      'reclaimed', false
    );
  end if;

  -- Lost the insert race: lock winner and classify (never dual-proceed).
  select *
    into v_row
  from public.social_meta_organic_publish_claims
  where authorization_id = trim(p_authorization_id)
  for update;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'kind', 'in_progress',
      'message', 'A Meta publish attempt is already in progress for this authorization.'
    );
  end if;

  if v_row.state = 'completed' and v_row.fingerprint = trim(p_fingerprint) then
    return jsonb_build_object(
      'ok', true,
      'kind', 'replay',
      'claim_id', v_row.claim_id,
      'external_publication_id', v_row.external_publication_id,
      'result_summary', coalesce(v_row.result_summary, '{}'::jsonb),
      'fingerprint', v_row.fingerprint,
      'social_post_id', v_row.social_post_id,
      'publication_target_id', v_row.publication_target_id,
      'page_id', v_row.page_id,
      'authorization_id', v_row.authorization_id
    );
  end if;

  if v_row.state = 'failed' then
    return jsonb_build_object(
      'ok', false,
      'kind', 'error',
      'code', 'authorization_consumed',
      'message', 'This execution authorization already recorded a Meta publish attempt and cannot create another post.'
    );
  end if;

  if v_row.meta_invoked_at is not null then
    return jsonb_build_object(
      'ok', true,
      'kind', 'awaiting_reconciliation',
      'claim_id', v_row.claim_id,
      'external_publication_id', v_row.external_publication_id,
      'message', 'Meta may already have been invoked for this authorization. Manual reconciliation required — no second Meta mutation will be attempted.'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'kind', 'in_progress',
    'claim_id', v_row.claim_id,
    'message', 'A Meta publish attempt is already in progress for this authorization.'
  );
end;
$$;

create or replace function public.social_meta_organic_publish_mark_meta_invoked(
  p_authorization_id text,
  p_claim_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_row public.social_meta_organic_publish_claims%rowtype;
begin
  select *
    into v_row
  from public.social_meta_organic_publish_claims
  where authorization_id = trim(p_authorization_id)
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'claim_not_found',
      'message', 'Durable Meta publish claim not found.'
    );
  end if;

  if v_row.claim_id is distinct from p_claim_id then
    return jsonb_build_object(
      'ok', false,
      'code', 'claim_id_mismatch',
      'message', 'Durable Meta publish claim id mismatch.'
    );
  end if;

  if v_row.state is distinct from 'in_progress' then
    return jsonb_build_object(
      'ok', false,
      'code', 'claim_not_in_progress',
      'message', 'Durable Meta publish claim is not in progress.'
    );
  end if;

  if v_row.meta_invoked_at is not null then
    return jsonb_build_object(
      'ok', false,
      'code', 'meta_already_invoked',
      'message', 'Meta has already been marked invoked for this claim.'
    );
  end if;

  update public.social_meta_organic_publish_claims
     set meta_invoked_at = v_now,
         updated_at = v_now
   where authorization_id = trim(p_authorization_id)
     and claim_id = p_claim_id
     and state = 'in_progress'
     and meta_invoked_at is null;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'mark_meta_invoked_failed',
      'message', 'Unable to mark Meta invoked; fail closed before HTTP.'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'claim_id', p_claim_id,
    'meta_invoked_at', v_now
  );
end;
$$;

-- Note: PL/pgSQL FOUND after UPDATE reflects whether a row was updated.

create or replace function public.social_meta_organic_publish_complete(
  p_authorization_id text,
  p_claim_id uuid,
  p_external_publication_id text,
  p_result_summary jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_row public.social_meta_organic_publish_claims%rowtype;
  v_external text := nullif(trim(p_external_publication_id), '');
begin
  if v_external is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'external_publication_id_required',
      'message', 'Sanitized external publication id is required to complete.'
    );
  end if;

  select *
    into v_row
  from public.social_meta_organic_publish_claims
  where authorization_id = trim(p_authorization_id)
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'claim_not_found',
      'message', 'Durable Meta publish claim not found at completion.'
    );
  end if;

  if v_row.claim_id is distinct from p_claim_id then
    return jsonb_build_object(
      'ok', false,
      'code', 'claim_id_mismatch',
      'message', 'Durable Meta publish claim id mismatch at completion.'
    );
  end if;

  if v_row.state = 'completed' then
    if v_row.external_publication_id = v_external then
      return jsonb_build_object(
        'ok', true,
        'kind', 'idempotent',
        'claim_id', v_row.claim_id,
        'external_publication_id', v_row.external_publication_id
      );
    end if;
    return jsonb_build_object(
      'ok', false,
      'code', 'external_publication_id_conflict',
      'message', 'Completed claim already stores a different external publication id.'
    );
  end if;

  if v_row.state <> 'in_progress' then
    return jsonb_build_object(
      'ok', false,
      'code', 'claim_not_completable',
      'message', 'Durable Meta publish claim cannot be completed from current state.'
    );
  end if;

  update public.social_meta_organic_publish_claims
     set state = 'completed',
         external_publication_id = v_external,
         result_summary = coalesce(p_result_summary, '{}'::jsonb),
         error_code = null,
         error_message = null,
         completed_at = v_now,
         updated_at = v_now
   where authorization_id = trim(p_authorization_id)
     and claim_id = p_claim_id
     and state = 'in_progress';

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'complete_failed',
      'message', 'Unable to persist durable Meta publish completion.'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'kind', 'completed',
    'claim_id', p_claim_id,
    'external_publication_id', v_external
  );
end;
$$;

create or replace function public.social_meta_organic_publish_fail(
  p_authorization_id text,
  p_claim_id uuid,
  p_error_code text,
  p_error_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_row public.social_meta_organic_publish_claims%rowtype;
  v_code text := nullif(trim(p_error_code), '');
begin
  if v_code is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'error_code_required',
      'message', 'error_code is required to fail a Meta publish claim.'
    );
  end if;

  select *
    into v_row
  from public.social_meta_organic_publish_claims
  where authorization_id = trim(p_authorization_id)
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'claim_not_found',
      'message', 'Durable Meta publish claim not found at failure.'
    );
  end if;

  if v_row.claim_id is distinct from p_claim_id then
    return jsonb_build_object(
      'ok', false,
      'code', 'claim_id_mismatch',
      'message', 'Durable Meta publish claim id mismatch at failure.'
    );
  end if;

  if v_row.state = 'completed' then
    return jsonb_build_object(
      'ok', false,
      'code', 'already_completed',
      'message', 'Completed Meta publish claim cannot be failed.'
    );
  end if;

  if v_row.state = 'failed' then
    return jsonb_build_object(
      'ok', true,
      'kind', 'idempotent_failed',
      'claim_id', v_row.claim_id
    );
  end if;

  if v_row.meta_invoked_at is not null then
    return jsonb_build_object(
      'ok', false,
      'kind', 'awaiting_reconciliation',
      'code', 'meta_already_invoked',
      'message', 'Meta may already have been invoked. Failure cannot reopen this authorization for another Meta mutation.'
    );
  end if;

  update public.social_meta_organic_publish_claims
     set state = 'failed',
         error_code = v_code,
         error_message = left(coalesce(nullif(trim(p_error_message), ''), v_code), 500),
         updated_at = v_now
   where authorization_id = trim(p_authorization_id)
     and claim_id = p_claim_id
     and state = 'in_progress'
     and meta_invoked_at is null;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'kind', 'awaiting_reconciliation',
      'code', 'fail_race',
      'message', 'Unable to mark pre-Meta failure; treat as awaiting reconciliation.'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'kind', 'failed',
    'claim_id', p_claim_id
  );
end;
$$;

create or replace function public.social_meta_organic_publish_claim_get(
  p_authorization_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.social_meta_organic_publish_claims%rowtype;
begin
  if nullif(trim(p_authorization_id), '') is null then
    return jsonb_build_object('ok', true, 'kind', 'none');
  end if;

  select *
    into v_row
  from public.social_meta_organic_publish_claims
  where authorization_id = trim(p_authorization_id);

  if not found then
    return jsonb_build_object('ok', true, 'kind', 'none');
  end if;

  return jsonb_build_object(
    'ok', true,
    'kind', 'found',
    'authorization_id', v_row.authorization_id,
    'claim_id', v_row.claim_id,
    'state', v_row.state,
    'fingerprint', v_row.fingerprint,
    'meta_invoked_at', v_row.meta_invoked_at,
    'lease_expires_at', v_row.lease_expires_at,
    'external_publication_id', v_row.external_publication_id,
    'error_code', v_row.error_code,
    'error_message', v_row.error_message,
    'result_summary', v_row.result_summary,
    'social_post_id', v_row.social_post_id,
    'publication_target_id', v_row.publication_target_id,
    'page_id', v_row.page_id,
    'owner_approval_id', v_row.owner_approval_id
  );
end;
$$;

alter table public.social_meta_organic_publish_claims enable row level security;

revoke all on table public.social_meta_organic_publish_claims from anon, authenticated;
revoke all on function public.social_meta_organic_publish_claim_begin(text, text, text, text, text, text, text, integer) from anon, authenticated;
revoke all on function public.social_meta_organic_publish_mark_meta_invoked(text, uuid) from anon, authenticated;
revoke all on function public.social_meta_organic_publish_complete(text, uuid, text, jsonb) from anon, authenticated;
revoke all on function public.social_meta_organic_publish_fail(text, uuid, text, text) from anon, authenticated;
revoke all on function public.social_meta_organic_publish_claim_get(text) from anon, authenticated;

grant select, insert, update, delete on table public.social_meta_organic_publish_claims to service_role;
grant execute on function public.social_meta_organic_publish_claim_begin(text, text, text, text, text, text, text, integer) to service_role;
grant execute on function public.social_meta_organic_publish_mark_meta_invoked(text, uuid) to service_role;
grant execute on function public.social_meta_organic_publish_complete(text, uuid, text, jsonb) to service_role;
grant execute on function public.social_meta_organic_publish_fail(text, uuid, text, text) to service_role;
grant execute on function public.social_meta_organic_publish_claim_get(text) to service_role;
