-- Forward-only, not applied by development. Claims are one-at-a-time and an
-- expired or uncertain delivery is never automatically returned to pending.
alter table public.receptionist_facility_notifications
  add column if not exists execution_hash text,
  add column if not exists lease_until timestamptz,
  add column if not exists last_error_class text,
  add column if not exists sent_at timestamptz;

alter table public.receptionist_facility_notifications
  add constraint receptionist_facility_notification_lease_consistency check (
    (state='sending' and execution_hash is not null and execution_hash ~ '^[a-f0-9]{64}$' and lease_until is not null)
    or (state<>'sending' and execution_hash is null and lease_until is null)
  );

create index if not exists receptionist_facility_notification_pending_idx
  on public.receptionist_facility_notifications(created_at,booking_id,kind) where state='pending';
create index if not exists receptionist_facility_notification_expiry_idx
  on public.receptionist_facility_notifications(lease_until,booking_id,kind) where state='sending';

-- State transitions must go through the checked RPCs, not direct updates.
revoke update (state, attempts, updated_at) on public.receptionist_facility_notifications from service_role;

create or replace function public.claim_receptionist_facility_notification_v1(p_booking_id uuid default null,p_kind text default null)
returns table(booking_id uuid, kind text, execution_token uuid, attempt integer, message_key text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.receptionist_facility_notifications%rowtype;
  v_token uuid;
begin
  if p_kind is not null and p_kind not in ('owner','customer') then
    raise exception using errcode = '22023', message = 'invalid_receptionist_notification_kind';
  end if;
  select n.* into v_row from public.receptionist_facility_notifications n
  where n.state='pending' and (p_booking_id is null or n.booking_id=p_booking_id)
    and (p_kind is null or n.kind=p_kind) order by n.created_at,n.booking_id,n.kind
  for update of n skip locked limit 1;
  if not found then return; end if;
  if not exists(select 1 from public.facility_bookings f where f.id=v_row.booking_id) then
    update public.receptionist_facility_notifications n
    set state='unknown',last_error_class='booking_missing',updated_at=now()
    where n.booking_id=v_row.booking_id and n.kind=v_row.kind;
    return;
  end if;
  if not exists(select 1 from public.receptionist_facility_confirmation_snapshots s where s.booking_id=v_row.booking_id) then
    update public.receptionist_facility_notifications n
    set state='unknown',last_error_class='snapshot_missing',updated_at=now()
    where n.booking_id=v_row.booking_id and n.kind=v_row.kind;
    return;
  end if;
  v_token := gen_random_uuid();
  update public.receptionist_facility_notifications n
  set state='sending',attempts=n.attempts+1,execution_hash=encode(sha256(convert_to(v_token::text,'UTF8')),'hex'),
      lease_until=now()+interval '2 minutes',last_error_class=null,updated_at=now()
  where n.booking_id=v_row.booking_id and n.kind=v_row.kind;
  return query select v_row.booking_id,v_row.kind,v_token,v_row.attempts+1,
    'receptionist-facility:'||v_row.booking_id::text||':'||v_row.kind;
end;
$$;
revoke all on function public.claim_receptionist_facility_notification_v1(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_receptionist_facility_notification_v1(uuid,text) to service_role;

create or replace function public.finish_receptionist_facility_notification_v1(
  p_booking_id uuid, p_kind text, p_execution_token uuid, p_outcome text, p_error_class text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_state text;
begin
  if p_booking_id is null or p_kind is null or p_kind not in ('owner','customer') or p_execution_token is null
     or p_outcome is null or p_outcome not in ('sent','unknown','not_attempted')
     or (p_outcome='sent' and p_error_class is not null)
     or (p_outcome='not_attempted' and (p_error_class is null or p_error_class not in ('not_configured')))
     or (p_outcome='unknown' and (p_error_class is null or p_error_class not in ('transport_unknown','provider_unknown','interrupted','booking_unavailable'))) then
    raise exception using errcode = '22023', message = 'invalid_receptionist_notification_outcome';
  end if;
  v_state := case when p_outcome='not_attempted' then 'pending' else p_outcome end;
  update public.receptionist_facility_notifications n
  set state=v_state,execution_hash=null,lease_until=null,last_error_class=p_error_class,
      sent_at=case when v_state='sent' then now() else null end,updated_at=now()
  where n.booking_id=p_booking_id and n.kind=p_kind and n.state='sending'
    and n.execution_hash=encode(sha256(convert_to(p_execution_token::text,'UTF8')),'hex');
  if not found then raise exception using errcode = 'P0001', message = 'receptionist_notification_claim_changed'; end if;
  return v_state;
end;
$$;
revoke all on function public.finish_receptionist_facility_notification_v1(uuid,text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.finish_receptionist_facility_notification_v1(uuid,text,uuid,text,text) to service_role;

create or replace function public.recover_receptionist_facility_notification_leases_v1()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  with expired as (
    select n.booking_id,n.kind from public.receptionist_facility_notifications n
    where n.state='sending' and n.lease_until<=now()
    order by n.lease_until,n.booking_id,n.kind for update of n skip locked limit 100
  )
  update public.receptionist_facility_notifications n
  set state='unknown',execution_hash=null,lease_until=null,last_error_class='interrupted',updated_at=now()
  from expired e where n.booking_id=e.booking_id and n.kind=e.kind;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.recover_receptionist_facility_notification_leases_v1() from public, anon, authenticated;
grant execute on function public.recover_receptionist_facility_notification_leases_v1() to service_role;
