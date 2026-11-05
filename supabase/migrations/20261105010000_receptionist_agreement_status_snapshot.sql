-- Internal read-only snapshot. This does not establish caller authority or
-- prove that every possible terms change supersedes an older agreement.
create function public.receptionist_agreement_status_snapshot(p_kind text, p_booking_id text)
returns jsonb language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if p_kind = 'rental' then
    if p_booking_id !~ '^[1-9][0-9]{0,18}$' or
       (length(p_booking_id) = 19 and p_booking_id > '9223372036854775807') then
      raise exception using errcode = '22023', message = 'invalid_agreement_booking';
    end if;
    select jsonb_build_object(
      'booking', jsonb_build_object('id',b.id::text,'status',b.status,'customer_name',b.customer_name),
      'agreements', coalesce((select jsonb_agg(to_jsonb(a) order by a.version desc) from (
        select id,booking_id::text as booking_id,version,status,signed_at,email_status,signer_legal_name,reviewed_at
        from public.rental_agreements where booking_id=b.id and status <> 'superseded' order by version desc limit 2
      ) a),'[]'::jsonb)
    ) into result from public.bookings b where b.id=p_booking_id::bigint;
  elsif p_kind = 'facility' then
    if p_booking_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception using errcode = '22023', message = 'invalid_agreement_booking';
    end if;
    select jsonb_build_object(
      'booking', jsonb_build_object('id',b.id::text,'status',b.status),
      'agreements', coalesce((select jsonb_agg(to_jsonb(a) order by a.version desc) from (
        select id,booking_id::text as booking_id,version,status,signed_at,email_status
        from public.facility_party_agreements where booking_id=b.id and status <> 'superseded' order by version desc limit 2
      ) a),'[]'::jsonb)
    ) into result from public.facility_bookings b where b.id=p_booking_id::uuid;
  else
    raise exception using errcode = '22023', message = 'invalid_agreement_kind';
  end if;
  return coalesce(result,jsonb_build_object('booking',null,'agreements','[]'::jsonb));
end;
$$;
revoke all on function public.receptionist_agreement_status_snapshot(text,text) from public, anon, authenticated;
grant execute on function public.receptionist_agreement_status_snapshot(text,text) to service_role;
