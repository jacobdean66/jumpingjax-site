-- Pre-booking previews have their own identity; they are not facility bookings.
create table public.facility_invitation_previews (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  payload_hash text not null,
  recipient text not null,
  child_name text not null,
  child_age text not null check (child_age ~ '^([1-9]|1[0-8])?$'),
  customer_phone text not null,
  balloon_colors text not null,
  table_cloth_colors text not null,
  party_theme text not null,
  party_date text not null,
  party_time text not null,
  confirmed_theme jsonb not null check (
    jsonb_typeof(confirmed_theme) = 'object'
    and confirmed_theme->>'label' is not distinct from party_theme
    and coalesce(confirmed_theme->>'imagePath', '') ~ '^/api/facility/invitations/artwork/[a-f0-9]{64}$'
  ),
  selected_option_index smallint check (selected_option_index in (0, 1, 2)),
  delivery_preferences text[] check (
    cardinality(delivery_preferences) between 1 and 3
    and delivery_preferences <@ array['print', 'email', 'office_pickup']::text[]
  ),
  invitation_quantity smallint check (invitation_quantity in (4, 8, 12, 16, 20, 24, 28)),
  booking_id uuid unique references public.facility_bookings(id),
  check (
    (selected_option_index is null and delivery_preferences is null and invitation_quantity is null)
    or (selected_option_index is not null and delivery_preferences is not null and invitation_quantity is not null)
  ),
  status text not null default 'pending' check (status in ('pending','sending','accepted','failed')),
  lease_id uuid,
  lease_until timestamptz,
  provider_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
alter table public.facility_invitation_previews enable row level security;
revoke all on public.facility_invitation_previews from public, anon, authenticated;
grant select, insert, update on public.facility_invitation_previews to service_role;

-- Serialize reservation/quota checks and claim a short sending lease. A retry
-- of the same key is permitted without consuming another quota slot.
create function public.claim_facility_invitation_preview(
  p_key text, p_hash text, p_recipient text, p_child text, p_theme text,
  p_date text, p_time text, p_confirmed_theme jsonb, p_lease uuid,
  p_child_age text, p_customer_phone text, p_balloon_colors text, p_table_cloth_colors text
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare r public.facility_invitation_previews%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('facility_invitation_preview_quota'));
  select * into r from public.facility_invitation_previews where request_key = p_key for update;
  if found then
    if r.payload_hash <> p_hash then return jsonb_build_object('result','conflict'); end if;
    if r.expires_at <= now() then return jsonb_build_object('result','expired'); end if;
    if r.status = 'accepted' then return jsonb_build_object('result','accepted','id',r.id); end if;
    if r.status = 'sending' and r.lease_until > now() then
      return jsonb_build_object('result','processing','id',r.id);
    end if;
    -- The provider retains idempotency keys for 24 hours. Do not repeat an
    -- ambiguous send after our conservative 23-hour reconciliation deadline.
    if r.created_at <= now() - interval '23 hours' then
      return jsonb_build_object('result','reconciliation_required','id',r.id);
    end if;
  else
    if (select count(*) from public.facility_invitation_previews where created_at > now() - interval '1 hour') >= 60
       or (select count(*) from public.facility_invitation_previews where recipient = p_recipient and created_at > now() - interval '1 hour') >= 3 then
      return jsonb_build_object('result','limited');
    end if;
    insert into public.facility_invitation_previews (
      request_key, payload_hash, recipient, child_name, party_theme, party_date, party_time, confirmed_theme,
      child_age, customer_phone, balloon_colors, table_cloth_colors
    )
    values (
      p_key, p_hash, p_recipient, p_child, p_theme, p_date, p_time, p_confirmed_theme,
      p_child_age, p_customer_phone, p_balloon_colors, p_table_cloth_colors
    ) returning * into r;
  end if;
  update public.facility_invitation_previews set status='sending', lease_id=p_lease,
    lease_until=now()+interval '2 minutes' where id=r.id;
  return jsonb_build_object('result','claimed','id',r.id,'created_at',r.created_at);
end $$;
revoke all on function public.claim_facility_invitation_preview(text,text,text,text,text,text,text,jsonb,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.claim_facility_invitation_preview(text,text,text,text,text,text,text,jsonb,uuid,text,text,text,text) to service_role;
