-- Social Posts agent durable rate-limit + idempotency store.
-- Additive / idempotent. Service-role server writes only (RLS enabled, no anon policies).

create table if not exists public.social_agent_rate_limit_buckets (
  bucket_key text primary key,
  category text not null,
  hit_count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint social_agent_rate_limit_buckets_count_nonnegative
    check (hit_count >= 0)
);

create index if not exists social_agent_rate_limit_buckets_reset_idx
  on public.social_agent_rate_limit_buckets (reset_at);

create table if not exists public.social_agent_idempotency_records (
  store_key text primary key,
  action text not null,
  client_key text not null,
  idempotency_key text,
  fingerprint text not null,
  state text not null,
  response_status integer,
  response_body jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint social_agent_idempotency_state_valid
    check (state in ('in_flight', 'completed'))
);

create index if not exists social_agent_idempotency_expires_idx
  on public.social_agent_idempotency_records (expires_at);

create index if not exists social_agent_idempotency_client_action_idx
  on public.social_agent_idempotency_records (client_key, action);

create or replace function public.social_agent_rate_limit_hit(
  p_bucket_key text,
  p_category text,
  p_limit integer,
  p_window_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_row public.social_agent_rate_limit_buckets%rowtype;
  v_retry integer;
begin
  if p_limit is null or p_limit < 1 or p_window_ms is null or p_window_ms < 1 then
    raise exception 'invalid rate limit parameters';
  end if;

  select *
    into v_row
  from public.social_agent_rate_limit_buckets
  where bucket_key = p_bucket_key
  for update;

  if not found or v_row.reset_at <= v_now then
    insert into public.social_agent_rate_limit_buckets (
      bucket_key,
      category,
      hit_count,
      reset_at,
      updated_at
    )
    values (
      p_bucket_key,
      p_category,
      1,
      v_now + make_interval(secs => greatest(p_window_ms, 1)::double precision / 1000.0),
      v_now
    )
    on conflict (bucket_key) do update
      set category = excluded.category,
          hit_count = 1,
          reset_at = excluded.reset_at,
          updated_at = excluded.updated_at;
    return jsonb_build_object('limited', false);
  end if;

  update public.social_agent_rate_limit_buckets
     set hit_count = hit_count + 1,
         updated_at = v_now
   where bucket_key = p_bucket_key
   returning * into v_row;

  if v_row.hit_count <= p_limit then
    return jsonb_build_object('limited', false);
  end if;

  v_retry := greatest(
    1,
    ceil(extract(epoch from (v_row.reset_at - v_now)))::integer
  );

  return jsonb_build_object(
    'limited', true,
    'retryAfterSeconds', v_retry,
    'category', p_category
  );
end;
$$;

create or replace function public.social_agent_idempotency_begin(
  p_store_key text,
  p_action text,
  p_client_key text,
  p_idempotency_key text,
  p_fingerprint text,
  p_in_flight_ttl_ms integer,
  p_completed_ttl_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_row public.social_agent_idempotency_records%rowtype;
  v_retry integer;
  v_inserted integer;
begin
  delete from public.social_agent_idempotency_records
   where store_key = p_store_key
     and expires_at <= v_now;

  select *
    into v_row
  from public.social_agent_idempotency_records
  where store_key = p_store_key
  for update;

  if found then
    if v_row.state = 'completed' and v_row.fingerprint = p_fingerprint then
      return jsonb_build_object(
        'kind', 'replay',
        'status', coalesce(v_row.response_status, 200),
        'body', coalesce(v_row.response_body, 'null'::jsonb)
      );
    end if;

    if v_row.state = 'completed' and p_idempotency_key is not null then
      return jsonb_build_object(
        'kind', 'replay',
        'status', 409,
        'body', jsonb_build_object(
          'ok', false,
          'error', 'Idempotency-Key was already used with a different request payload.',
          'code', 'idempotency_payload_conflict'
        )
      );
    end if;

    if v_row.state = 'in_flight' then
      v_retry := greatest(
        1,
        ceil(extract(epoch from (v_row.expires_at - v_now)))::integer
      );
      return jsonb_build_object(
        'kind', 'in_progress',
        'retryAfterSeconds', v_retry
      );
    end if;
  end if;

  insert into public.social_agent_idempotency_records (
    store_key,
    action,
    client_key,
    idempotency_key,
    fingerprint,
    state,
    started_at,
    expires_at,
    updated_at
  )
  values (
    p_store_key,
    p_action,
    p_client_key,
    p_idempotency_key,
    p_fingerprint,
    'in_flight',
    v_now,
    v_now + make_interval(secs => greatest(p_in_flight_ttl_ms, 1)::double precision / 1000.0),
    v_now
  )
  on conflict (store_key) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    return jsonb_build_object('kind', 'proceed', 'storeKey', p_store_key);
  end if;

  -- Lost the insert race: lock the winner and classify (never dual-proceed).
  select *
    into v_row
  from public.social_agent_idempotency_records
  where store_key = p_store_key
  for update;

  if not found then
    return jsonb_build_object(
      'kind', 'in_progress',
      'retryAfterSeconds', greatest(
        1,
        ceil(greatest(p_in_flight_ttl_ms, 1)::double precision / 1000.0)::integer
      )
    );
  end if;

  if v_row.state = 'completed' and v_row.fingerprint = p_fingerprint then
    return jsonb_build_object(
      'kind', 'replay',
      'status', coalesce(v_row.response_status, 200),
      'body', coalesce(v_row.response_body, 'null'::jsonb)
    );
  end if;

  if v_row.state = 'completed' and p_idempotency_key is not null then
    return jsonb_build_object(
      'kind', 'replay',
      'status', 409,
      'body', jsonb_build_object(
        'ok', false,
        'error', 'Idempotency-Key was already used with a different request payload.',
        'code', 'idempotency_payload_conflict'
      )
    );
  end if;

  v_retry := greatest(
    1,
    ceil(extract(epoch from (v_row.expires_at - v_now)))::integer
  );
  return jsonb_build_object(
    'kind', 'in_progress',
    'retryAfterSeconds', v_retry
  );
end;
$$;

create or replace function public.social_agent_idempotency_complete(
  p_store_key text,
  p_fingerprint text,
  p_status integer,
  p_body jsonb,
  p_completed_ttl_ms integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  update public.social_agent_idempotency_records
     set state = 'completed',
         fingerprint = p_fingerprint,
         response_status = p_status,
         response_body = p_body,
         completed_at = v_now,
         expires_at = v_now + make_interval(
           secs => greatest(p_completed_ttl_ms, 1)::double precision / 1000.0
         ),
         updated_at = v_now
   where store_key = p_store_key;
end;
$$;

create or replace function public.social_agent_idempotency_fail(
  p_store_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.social_agent_idempotency_records
   where store_key = p_store_key
     and state = 'in_flight';
end;
$$;

alter table public.social_agent_rate_limit_buckets enable row level security;
alter table public.social_agent_idempotency_records enable row level security;

revoke all on table public.social_agent_rate_limit_buckets from anon, authenticated;
revoke all on table public.social_agent_idempotency_records from anon, authenticated;
revoke all on function public.social_agent_rate_limit_hit(text, text, integer, integer) from anon, authenticated;
revoke all on function public.social_agent_idempotency_begin(text, text, text, text, text, integer, integer) from anon, authenticated;
revoke all on function public.social_agent_idempotency_complete(text, text, integer, jsonb, integer) from anon, authenticated;
revoke all on function public.social_agent_idempotency_fail(text) from anon, authenticated;

grant execute on function public.social_agent_rate_limit_hit(text, text, integer, integer) to service_role;
grant execute on function public.social_agent_idempotency_begin(text, text, text, text, text, integer, integer) to service_role;
grant execute on function public.social_agent_idempotency_complete(text, text, integer, jsonb, integer) to service_role;
grant execute on function public.social_agent_idempotency_fail(text) to service_role;
grant select, insert, update, delete on table public.social_agent_rate_limit_buckets to service_role;
grant select, insert, update, delete on table public.social_agent_idempotency_records to service_role;
