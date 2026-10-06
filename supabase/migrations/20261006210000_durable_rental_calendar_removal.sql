-- Cancellation and calendar work are committed in the same database transaction.
alter table public.bookings
  add column if not exists google_calendar_id text,
  add column if not exists google_calendar_secondary_id text,
  add column if not exists google_foam_calendar_id text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_source text,
  add column if not exists google_calendar_generation integer not null default 0;

create table public.rental_calendar_sync_operations (
  token uuid primary key default gen_random_uuid(), booking_id text not null,
  lease_until timestamptz not null default now() + interval '5 minutes'
);
alter table public.rental_calendar_sync_operations enable row level security;
revoke all on public.rental_calendar_sync_operations from public, anon, authenticated;
grant all on public.rental_calendar_sync_operations to service_role;

create function public.begin_rental_calendar_sync(p_booking_id text, p_generation integer)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_token uuid;
begin
  perform 1 from public.bookings where id::text = p_booking_id and status::text = 'approved'
    and google_calendar_generation = p_generation for update;
  if not found then return null; end if;
  delete from public.rental_calendar_sync_operations where lease_until < now();
  insert into public.rental_calendar_sync_operations (booking_id) values (p_booking_id) returning token into v_token;
  return v_token;
end $$;
revoke all on function public.begin_rental_calendar_sync(text, integer) from public, anon, authenticated;
grant execute on function public.begin_rental_calendar_sync(text, integer) to service_role;

create table public.rental_calendar_removals (
  id uuid primary key default gen_random_uuid(),
  booking_id text not null,
  destination text not null check (destination in ('primary', 'secondary', 'foam')),
  calendar_id text,
  event_id text not null,
  state text not null default 'pending' check (state in ('pending', 'processing', 'removed', 'access_required', 'attention_required')),
  attempts integer not null default 0,
  revision integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  removed_at timestamptz,
  unique (booking_id, destination, event_id)
);
create index rental_calendar_removals_due on public.rental_calendar_removals (next_attempt_at)
  where state in ('pending', 'processing');
alter table public.rental_calendar_removals enable row level security;
revoke all on public.rental_calendar_removals from public, anon, authenticated;
grant all on public.rental_calendar_removals to service_role;

create function public.enqueue_cancelled_rental_calendar_removal()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v jsonb := to_jsonb(new); t record;
begin
  if lower(new.status::text) not in ('cancelled', 'canceled') then return new; end if;
  for t in select * from (values
    ('primary', 'google_calendar_event_id', 'google_calendar_id'),
    ('secondary', 'google_calendar_secondary_event_id', 'google_calendar_secondary_id'),
    ('foam', 'google_foam_calendar_event_id', 'google_foam_calendar_id')
  ) as targets(destination, event_field, calendar_field) loop
    if nullif(v ->> t.event_field, '') is not null then
      insert into public.rental_calendar_removals (booking_id, destination, event_id, calendar_id)
      values (new.id::text, t.destination, v ->> t.event_field, v ->> t.calendar_field)
      on conflict (booking_id, destination, event_id) do update
        set state = case when rental_calendar_removals.state = 'processing' then 'processing' else 'pending' end,
            revision = rental_calendar_removals.revision + 1,
            calendar_id = coalesce(rental_calendar_removals.calendar_id, excluded.calendar_id),
            next_attempt_at = now(), removed_at = null;
    end if;
  end loop;
  return new;
end $$;
create trigger enqueue_cancelled_rental_calendar_removal
after insert or update of status, google_calendar_event_id, google_calendar_secondary_event_id, google_foam_calendar_event_id
on public.bookings for each row execute function public.enqueue_cancelled_rental_calendar_removal();

-- Block restoration while a deletion is queued or in flight. Otherwise the worker
-- could remove an event belonging to a newly restored/approved rental.
create function public.guard_rental_restore_calendar_removal()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if lower(old.status::text) in ('cancelled', 'canceled')
    and lower(new.status::text) not in ('cancelled', 'canceled')
    and (exists (select 1 from public.rental_calendar_removals where booking_id = old.id::text and state <> 'removed')
      or exists (select 1 from public.rental_calendar_sync_operations where booking_id = old.id::text and lease_until > now())) then
    raise exception 'calendar_removal_pending';
  end if;
  if lower(old.status::text) in ('cancelled', 'canceled') and lower(new.status::text) = 'pending' then
    new.google_calendar_generation := old.google_calendar_generation + 1;
    new.cancelled_at := null;
    new.cancellation_source := null;
  end if;
  return new;
end $$;
create trigger guard_rental_restore_calendar_removal before update of status
on public.bookings for each row execute function public.guard_rental_restore_calendar_removal();

create function public.cancel_rental_with_calendar_removal(p_booking_id text, p_calendars jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare b public.bookings%rowtype;
begin
  select * into b from public.bookings where id::text = p_booking_id for update;
  if not found or lower(b.status::text) not in ('pending', 'approved', 'cancelled', 'canceled') then return null; end if;
  update public.bookings set status = 'cancelled',
    cancelled_at = coalesce(cancelled_at, now()), cancellation_source = coalesce(cancellation_source, 'admin'),
    google_calendar_id = coalesce(google_calendar_id, p_calendars ->> 'primary'),
    google_calendar_secondary_id = coalesce(google_calendar_secondary_id, p_calendars ->> 'secondary'),
    google_foam_calendar_id = coalesce(google_foam_calendar_id, p_calendars ->> 'foam')
  where id = b.id returning * into b;
  update public.rental_calendar_removals set state = 'pending', attempts = 0, next_attempt_at = now()
  where booking_id = p_booking_id and state in ('pending', 'access_required', 'attention_required');
  return to_jsonb(b);
end $$;

create function public.claim_rental_calendar_removal(p_booking_id text, p_calendars jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare j public.rental_calendar_removals%rowtype;
begin
  select q.* into j from public.rental_calendar_removals q
  join public.bookings b on b.id::text = q.booking_id
  where lower(b.status::text) in ('cancelled', 'canceled')
    and not exists (select 1 from public.rental_calendar_sync_operations s where s.booking_id = q.booking_id and s.lease_until > now())
    and (p_booking_id is null or q.booking_id = p_booking_id)
    and ((q.state = 'pending' and q.next_attempt_at <= now())
      or (q.state = 'processing' and q.lease_until <= now()))
  order by q.next_attempt_at, q.id for update of q skip locked limit 1;
  if not found then return null; end if;
  update public.rental_calendar_removals set state = 'processing', attempts = attempts + 1,
    calendar_id = coalesce(calendar_id, p_calendars ->> destination),
    lease_token = gen_random_uuid(), lease_until = now() + interval '2 minutes'
  where id = j.id returning * into j;
  return to_jsonb(j);
end $$;

create function public.finish_rental_calendar_removal(p_job_id uuid, p_lease_token uuid, p_revision integer, p_outcome text, p_delay_seconds integer)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare j public.rental_calendar_removals%rowtype; v_field text;
begin
  -- Match enqueue's booking -> queue lock order.
  perform 1 from public.bookings b join public.rental_calendar_removals q on q.booking_id = b.id::text
    where q.id = p_job_id for update of b;
  select * into j from public.rental_calendar_removals where id = p_job_id for update;
  if not found or j.state <> 'processing' or j.lease_token is distinct from p_lease_token then return false; end if;
  -- A late sync may have recreated this event while deletion was in flight.
  if j.revision <> p_revision then
    update public.rental_calendar_removals set state = 'pending', next_attempt_at = now(), lease_token = null, lease_until = null where id = j.id;
    return false;
  end if;
  if p_outcome not in ('removed', 'retry', 'access_required') then raise exception 'invalid removal outcome'; end if;
  update public.rental_calendar_removals set
    state = case when p_outcome = 'removed' then 'removed' when p_outcome = 'access_required' then 'access_required'
      when attempts >= 8 then 'attention_required' else 'pending' end,
    removed_at = case when p_outcome = 'removed' then now() else null end,
    next_attempt_at = now() + make_interval(secs => greatest(30, least(p_delay_seconds, 3600))),
    lease_token = null, lease_until = null
  where id = j.id;
  if p_outcome = 'removed' then
    v_field := case j.destination when 'primary' then 'google_calendar_event_id'
      when 'secondary' then 'google_calendar_secondary_event_id' else 'google_foam_calendar_event_id' end;
    execute format('update public.bookings set %I = null where id::text = $1 and %I = $2 and lower(status::text) in (''cancelled'', ''canceled'')', v_field, v_field)
      using j.booking_id, j.event_id;
  end if;
  return true;
end $$;

-- Existing cancelled rentals enter the same queue. Calendar IDs are resolved and
-- saved on first claim for legacy records that predate destination tracking.
insert into public.rental_calendar_removals (booking_id, destination, event_id, calendar_id)
select b.id::text, t.destination, t.event_id, t.calendar_id from public.bookings b
cross join lateral (values
  ('primary', b.google_calendar_event_id, b.google_calendar_id),
  ('secondary', b.google_calendar_secondary_event_id, b.google_calendar_secondary_id),
  ('foam', b.google_foam_calendar_event_id, b.google_foam_calendar_id)
) t(destination, event_id, calendar_id)
where lower(b.status::text) in ('cancelled', 'canceled') and nullif(t.event_id, '') is not null
on conflict do nothing;

revoke all on function public.cancel_rental_with_calendar_removal(text, jsonb) from public, anon, authenticated;
revoke all on function public.claim_rental_calendar_removal(text, jsonb) from public, anon, authenticated;
revoke all on function public.finish_rental_calendar_removal(uuid, uuid, integer, text, integer) from public, anon, authenticated;
revoke all on function public.enqueue_cancelled_rental_calendar_removal() from public, anon, authenticated;
revoke all on function public.guard_rental_restore_calendar_removal() from public, anon, authenticated;
grant execute on function public.cancel_rental_with_calendar_removal(text, jsonb) to service_role;
grant execute on function public.claim_rental_calendar_removal(text, jsonb) to service_role;
grant execute on function public.finish_rental_calendar_removal(uuid, uuid, integer, text, integer) to service_role;
