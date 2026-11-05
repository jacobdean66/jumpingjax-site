-- Draft only: the trusted caller gate and send coordinator remain unexposed.
alter table public.receptionist_agreement_email_claims
  add column provider_email_id text null,
  add column resolution_code text null;
alter table public.receptionist_agreement_email_claims
  drop constraint receptionist_agreement_email_claims_state_check;
alter table public.receptionist_agreement_email_claims
  add constraint receptionist_agreement_email_claims_state_check
  check (state in ('outcome_unknown','accepted','not_sent'));
alter table public.booking_notification_outbox
  add column payload_mac text null;

create function public.accept_receptionist_agreement_email(
  p_operation_id uuid,p_payload_mac text,p_provider_email_id text,
  p_kind text,p_booking_id text,p_agreement_id uuid,p_version integer,
  p_purpose text,p_recipient text,p_subject text,p_body text
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare claim public.receptionist_agreement_email_claims%rowtype;
  outbox public.booking_notification_outbox%rowtype;
  v_message_key text;
begin
  if p_operation_id is null or p_payload_mac is null or p_payload_mac !~ '^[a-f0-9]{64}$' or
     p_provider_email_id is null or length(p_provider_email_id)>200 or
     p_kind is null or p_kind not in ('rental','facility') or p_booking_id is null or p_agreement_id is null or p_version is null or p_version<1 then
    raise exception using errcode='22023',message='invalid_agreement_email_acceptance';
  end if;
  v_message_key := 'receptionist-agreement-'||p_operation_id::text;
  select * into claim from public.receptionist_agreement_email_claims
    where operation_id=p_operation_id for update;
  if not found or claim.booking_kind<>p_kind or claim.booking_id<>p_booking_id or
     claim.agreement_id<>p_agreement_id or claim.agreement_version<>p_version or claim.payload_mac<>p_payload_mac then
    return jsonb_build_object('status','conflict');
  end if;
  select * into outbox from public.booking_notification_outbox where booking_notification_outbox.message_key=v_message_key for update;
  if not found or outbox.booking_kind<>p_kind or outbox.booking_id<>p_booking_id or
     outbox.purpose<>p_purpose or outbox.recipient<>p_recipient or outbox.subject<>p_subject or
     outbox.body<>p_body or outbox.html_body is not null or outbox.payload_mac<>p_payload_mac then
    return jsonb_build_object('status','conflict');
  end if;
  if claim.state='accepted' then
    if claim.provider_email_id=p_provider_email_id then return jsonb_build_object('status','accepted','duplicate',true); end if;
    return jsonb_build_object('status','conflict');
  end if;
  if claim.state<>'outcome_unknown' then return jsonb_build_object('status',claim.state); end if;
  update public.booking_notification_outbox set status='sent',sent_at=coalesce(sent_at,now()),
    last_error_class=null,updated_at=now() where booking_notification_outbox.message_key=v_message_key;
  update public.receptionist_agreement_email_claims set state='accepted',provider_email_id=p_provider_email_id,
    updated_at=now() where operation_id=p_operation_id;
  return jsonb_build_object('status','accepted','duplicate',false);
end;
$$;
revoke all on function public.accept_receptionist_agreement_email(uuid,text,text,text,text,uuid,integer,text,text,text,text) from public,anon,authenticated;
grant execute on function public.accept_receptionist_agreement_email(uuid,text,text,text,text,uuid,integer,text,text,text,text) to service_role;

create function public.release_receptionist_agreement_email_claim(p_operation_id uuid,p_payload_mac text,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare claim public.receptionist_agreement_email_claims%rowtype;
  outbox public.booking_notification_outbox%rowtype;
begin
  if p_operation_id is null or p_reason is null or p_reason not in ('pre_dispatch_changed','dispatch_not_started') or p_payload_mac is null or p_payload_mac !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='22023',message='invalid_agreement_email_release';
  end if;
  select * into claim from public.receptionist_agreement_email_claims where operation_id=p_operation_id for update;
  if not found or claim.payload_mac<>p_payload_mac then return jsonb_build_object('status','conflict'); end if;
  if claim.state='not_sent' then return jsonb_build_object('status','not_sent','duplicate',true); end if;
  if claim.state<>'outcome_unknown' then return jsonb_build_object('status',claim.state); end if;
  select * into outbox from public.booking_notification_outbox
    where message_key='receptionist-agreement-'||p_operation_id::text for update;
  if found then
    if outbox.status='sent' or (p_reason='pre_dispatch_changed') or
       (outbox.attempt_count>0 and not (outbox.status='failed' and outbox.last_error_class in ('customer_email_invalid','email_not_configured'))) then
      return jsonb_build_object('status','conflict');
    end if;
  end if;
  update public.receptionist_agreement_email_claims set state='not_sent',resolution_code=p_reason,updated_at=now()
    where operation_id=p_operation_id;
  return jsonb_build_object('status','not_sent','duplicate',false);
end;
$$;
revoke all on function public.release_receptionist_agreement_email_claim(uuid,text,text) from public,anon,authenticated;
grant execute on function public.release_receptionist_agreement_email_claim(uuid,text,text) to service_role;
