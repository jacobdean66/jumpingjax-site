-- Dedicated receptionist callback queue. No WhatsApp records or messaging.
create table public.receptionist_callback_notes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  call_id uuid not null,
  caller_name text not null check (length(trim(caller_name)) between 1 and 100),
  phone text not null check (length(trim(phone)) between 1 and 80),
  reason text not null check (length(trim(reason)) between 1 and 1000),
  caller_created_at timestamptz not null,
  status text not null default 'needs_review' check (status in ('needs_review','reviewed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);
create index receptionist_callback_notes_pending on public.receptionist_callback_notes(created_at desc) where status='needs_review';
alter table public.receptionist_callback_notes enable row level security;
revoke all on public.receptionist_callback_notes from public,anon,authenticated;
grant select,update(status,reviewed_at,reviewed_by) on public.receptionist_callback_notes to service_role;

create function public.receive_receptionist_callback_note(
  p_request_id uuid,p_call_id uuid,p_caller_name text,p_phone text,p_reason text,p_caller_created_at timestamptz
) returns table(id uuid,status text) language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_note public.receptionist_callback_notes%rowtype;
begin
  if p_request_id is null or p_call_id is null or p_caller_created_at is null or
    p_caller_name is null or length(trim(p_caller_name)) not between 1 and 100 or
    p_phone is null or length(trim(p_phone)) not between 1 and 80 or
    p_reason is null or length(trim(p_reason)) not between 1 and 1000 then
    raise exception using errcode='22023',message='invalid_callback_note';
  end if;
  insert into public.receptionist_callback_notes(request_id,call_id,caller_name,phone,reason,caller_created_at)
    values(p_request_id,p_call_id,p_caller_name,p_phone,p_reason,p_caller_created_at)
    on conflict(request_id) do nothing;
  select * into strict v_note from public.receptionist_callback_notes n where n.request_id=p_request_id;
  if v_note.call_id is distinct from p_call_id or v_note.caller_name is distinct from p_caller_name or
     v_note.phone is distinct from p_phone or v_note.reason is distinct from p_reason or
     v_note.caller_created_at is distinct from p_caller_created_at then
    raise exception using errcode='23505',message='callback_note_request_mismatch';
  end if;
  return query select v_note.id,v_note.status;
end;
$$;
revoke all on function public.receive_receptionist_callback_note(uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.receive_receptionist_callback_note(uuid,uuid,text,text,text,timestamptz) to service_role;
