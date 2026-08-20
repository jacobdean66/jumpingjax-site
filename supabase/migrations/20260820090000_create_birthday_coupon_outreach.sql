create table if not exists public.birthday_coupon_outreach (
  id uuid primary key default gen_random_uuid(),
  waiver_submission_id uuid not null
    references public.waiver_submissions (id)
    on delete restrict,
  waiver_participant_id uuid not null
    references public.waiver_participants (id)
    on delete restrict,
  child_identity_key text not null
    check (child_identity_key ~ '^[a-f0-9]{64}$'),
  signer_email text not null
    check (length(trim(signer_email)) > 0 and length(trim(signer_email)) <= 254),
  signer_first_name text null
    check (signer_first_name is null or length(trim(signer_first_name)) <= 80),
  signer_last_name text null
    check (signer_last_name is null or length(trim(signer_last_name)) <= 80),
  child_first_name text not null
    check (length(trim(child_first_name)) > 0 and length(trim(child_first_name)) <= 80),
  child_last_name text not null
    check (length(trim(child_last_name)) > 0 and length(trim(child_last_name)) <= 80),
  child_dob date not null,
  birthday_year integer not null
    check (birthday_year >= 1900 and birthday_year <= 3000),
  birthday_date date not null,
  send_on date not null,
  coupon_percent integer not null default 20
    check (coupon_percent = 20),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  last_error text null,
  claim_token uuid null,
  claimed_at timestamptz null,
  claim_expires_at timestamptz null,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint birthday_coupon_outreach_birthday_matches_year
    check (extract(year from birthday_date)::integer = birthday_year),
  constraint birthday_coupon_outreach_sent_shape
    check (status <> 'sent' or sent_at is not null)
);

alter table public.birthday_coupon_outreach enable row level security;

drop policy if exists "No public birthday coupon outreach access"
  on public.birthday_coupon_outreach;
create policy "No public birthday coupon outreach access"
  on public.birthday_coupon_outreach for all to anon, authenticated
  using (false) with check (false);

create unique index if not exists birthday_coupon_outreach_participant_year_uidx
  on public.birthday_coupon_outreach (waiver_participant_id, birthday_year);

create unique index if not exists birthday_coupon_outreach_identity_year_uidx
  on public.birthday_coupon_outreach (child_identity_key, birthday_year);

create index if not exists birthday_coupon_outreach_due_idx
  on public.birthday_coupon_outreach (status, send_on, claim_expires_at)
  where status in ('pending', 'failed');

create index if not exists birthday_coupon_outreach_recent_idx
  on public.birthday_coupon_outreach (updated_at desc);

create or replace function public.claim_due_birthday_coupon_outreach(
  p_as_of date,
  p_limit integer default 25,
  p_lease_seconds integer default 300
)
returns setof public.birthday_coupon_outreach
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_claim uuid := gen_random_uuid();
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_lease_seconds integer := least(greatest(coalesce(p_lease_seconds, 300), 30), 1800);
begin
  return query
  with due as (
    select id
    from public.birthday_coupon_outreach
    where status in ('pending', 'failed')
      and send_on <= coalesce(p_as_of, current_date)
      and sent_at is null
      and (
        claim_expires_at is null
        or claim_expires_at <= v_now
      )
    order by send_on asc, created_at asc
    limit v_limit
    for update skip locked
  )
  update public.birthday_coupon_outreach outreach
     set claim_token = v_claim,
         claimed_at = v_now,
         claim_expires_at = v_now + make_interval(secs => v_lease_seconds),
         attempt_count = attempt_count + 1,
         last_error = null,
         updated_at = v_now
    from due
   where outreach.id = due.id
  returning outreach.*;
end;
$$;

create or replace function public.mark_birthday_coupon_outreach_sent(
  p_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_updated integer;
begin
  update public.birthday_coupon_outreach
     set status = 'sent',
         sent_at = v_now,
         last_error = null,
         claim_token = null,
         claimed_at = null,
         claim_expires_at = null,
         updated_at = v_now
   where id = p_id
     and claim_token = p_claim_token
     and status in ('pending', 'failed')
     and sent_at is null;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.mark_birthday_coupon_outreach_failed(
  p_id uuid,
  p_claim_token uuid,
  p_error text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_updated integer;
begin
  update public.birthday_coupon_outreach
     set status = 'failed',
         last_error = left(coalesce(nullif(trim(p_error), ''), 'unknown_error'), 500),
         claim_token = null,
         claimed_at = null,
         claim_expires_at = null,
         updated_at = v_now
   where id = p_id
     and claim_token = p_claim_token
     and status in ('pending', 'failed')
     and sent_at is null;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on public.birthday_coupon_outreach from public, anon, authenticated;
grant select, insert, update on public.birthday_coupon_outreach to service_role;
revoke all on function public.claim_due_birthday_coupon_outreach(date, integer, integer)
  from public, anon, authenticated;
revoke all on function public.mark_birthday_coupon_outreach_sent(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.mark_birthday_coupon_outreach_failed(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.claim_due_birthday_coupon_outreach(date, integer, integer)
  to service_role;
grant execute on function public.mark_birthday_coupon_outreach_sent(uuid, uuid)
  to service_role;
grant execute on function public.mark_birthday_coupon_outreach_failed(uuid, uuid, text)
  to service_role;
