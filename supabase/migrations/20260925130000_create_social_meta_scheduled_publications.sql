create table if not exists public.social_meta_scheduled_publications (
  schedule_id uuid primary key default gen_random_uuid(),
  social_post_id uuid not null references public.social_posts(id) on delete restrict,
  publication_target_id uuid not null references public.social_publication_targets(publication_target_id) on delete restrict,
  page_id text not null check (length(trim(page_id)) > 0),
  authorization_id text not null unique references public.social_execution_authorizations(authorization_id) on delete restrict,
  scheduled_for timestamptz not null,
  state text not null default 'pending'
    check (state in ('pending', 'processing', 'published', 'failed', 'recovery_required', 'cancelled')),
  lease_expires_at timestamptz null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz null,
  external_post_id text null,
  result_code text null,
  result_message text null,
  created_by_actor text not null check (length(trim(created_by_actor)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_meta_scheduled_publications_due_idx
  on public.social_meta_scheduled_publications (scheduled_for asc)
  where state = 'pending';

create index if not exists social_meta_scheduled_publications_stale_idx
  on public.social_meta_scheduled_publications (lease_expires_at asc)
  where state = 'processing';

create index if not exists social_meta_scheduled_publications_post_idx
  on public.social_meta_scheduled_publications (social_post_id, created_at desc);

create or replace function public.create_social_meta_scheduled_publication(
  p_social_post_id uuid,
  p_publication_target_id uuid,
  p_page_id text,
  p_authorization_id text,
  p_scheduled_for timestamptz,
  p_created_by_actor text
)
returns setof public.social_meta_scheduled_publications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.social_meta_scheduled_publications%rowtype;
  v_created public.social_meta_scheduled_publications%rowtype;
begin
  select * into v_existing
  from public.social_meta_scheduled_publications
  where authorization_id = p_authorization_id;

  if found then
    if v_existing.social_post_id <> p_social_post_id
      or v_existing.publication_target_id <> p_publication_target_id
      or v_existing.page_id <> trim(p_page_id)
      or v_existing.scheduled_for <> p_scheduled_for then
      raise exception 'scheduled publication authorization scope mismatch';
    end if;
    return next v_existing;
    return;
  end if;

  insert into public.social_meta_scheduled_publications (
    social_post_id,
    publication_target_id,
    page_id,
    authorization_id,
    scheduled_for,
    created_by_actor
  ) values (
    p_social_post_id,
    p_publication_target_id,
    trim(p_page_id),
    p_authorization_id,
    p_scheduled_for,
    trim(p_created_by_actor)
  ) returning * into v_created;

  update public.social_posts
  set status = 'scheduled',
      scheduled_for = p_scheduled_for,
      posted_at = null,
      error_message = null,
      updated_at = now()
  where id = p_social_post_id;

  if not found then
    raise exception 'social post not found';
  end if;

  return next v_created;
end;
$$;

create or replace function public.claim_due_social_meta_scheduled_publications(
  p_limit integer default 10
)
returns setof public.social_meta_scheduled_publications
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select schedule_id
    from public.social_meta_scheduled_publications
    where (
      (state = 'pending' and scheduled_for <= now())
      or (state = 'processing' and lease_expires_at < now())
    )
    order by scheduled_for asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  )
  update public.social_meta_scheduled_publications as scheduled
  set state = 'processing',
      lease_expires_at = now() + interval '10 minutes',
      attempt_count = scheduled.attempt_count + 1,
      last_attempt_at = now(),
      updated_at = now()
  from due
  where scheduled.schedule_id = due.schedule_id
  returning scheduled.*;
end;
$$;

create or replace function public.finish_social_meta_scheduled_publication(
  p_schedule_id uuid,
  p_state text,
  p_external_post_id text,
  p_result_code text,
  p_result_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.social_meta_scheduled_publications%rowtype;
begin
  if p_state not in ('published', 'failed', 'recovery_required') then
    raise exception 'invalid scheduled publication terminal state';
  end if;

  update public.social_meta_scheduled_publications
  set state = p_state,
      lease_expires_at = null,
      external_post_id = nullif(trim(p_external_post_id), ''),
      result_code = nullif(trim(p_result_code), ''),
      result_message = nullif(trim(p_result_message), ''),
      updated_at = now()
  where schedule_id = p_schedule_id
    and state = 'processing'
  returning * into v_job;

  if not found then
    raise exception 'scheduled publication is not processing';
  end if;

  if p_state = 'published' then
    update public.social_posts
    set status = 'posted',
        posted_at = coalesce(posted_at, now()),
        scheduled_for = null,
        error_message = null,
        updated_at = now()
    where id = v_job.social_post_id;
  else
    update public.social_posts
    set status = 'failed',
        error_message = left(coalesce(nullif(trim(p_result_message), ''), p_result_code), 1000),
        updated_at = now()
    where id = v_job.social_post_id;
  end if;
end;
$$;

alter table public.social_meta_scheduled_publications enable row level security;

revoke all on table public.social_meta_scheduled_publications from anon, authenticated;
revoke all on function public.create_social_meta_scheduled_publication(uuid, uuid, text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.claim_due_social_meta_scheduled_publications(integer) from public, anon, authenticated;
revoke all on function public.finish_social_meta_scheduled_publication(uuid, text, text, text, text) from public, anon, authenticated;

grant select, insert, update on table public.social_meta_scheduled_publications to service_role;
grant execute on function public.create_social_meta_scheduled_publication(uuid, uuid, text, text, timestamptz, text) to service_role;
grant execute on function public.claim_due_social_meta_scheduled_publications(integer) to service_role;
grant execute on function public.finish_social_meta_scheduled_publication(uuid, text, text, text, text) to service_role;
