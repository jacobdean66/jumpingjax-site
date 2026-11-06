-- Forward-only and not applied by development. Supabase Storage metadata is
-- read and row-locked only; uploads still go exclusively through Storage API.
-- Refuse unfamiliar/multiple/missing versions rather than guessing which
-- object represents the current site settings.
create or replace function public.receptionist_facility_settings_version_v1()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version text;
begin
  select version into strict v_version from storage.objects
  where bucket_id='site-settings' and name='public-settings.json';
  if v_version is null or v_version !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    raise exception using errcode = 'P0001', message = 'receptionist_facility_settings_version_unavailable';
  end if;
  return v_version;
exception when no_data_found or too_many_rows then
  raise exception using errcode = 'P0001', message = 'receptionist_facility_settings_version_unavailable';
end;
$$;
revoke all on function public.receptionist_facility_settings_version_v1() from public, anon, authenticated;
grant execute on function public.receptionist_facility_settings_version_v1() to service_role;

create or replace function public.create_receptionist_facility_booking_guarded_v3(
  p_request jsonb,
  p_booking jsonb,
  p_request_key text,
  p_settings_version text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing text;
  v_version text;
begin
  -- Reconcile accepted work before looking at today’s prices or settings.
  v_existing := public.lookup_receptionist_facility_booking_v2(p_request,p_request_key);
  if v_existing is not null then return v_existing; end if;
  if p_settings_version is null or p_settings_version !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    raise exception using errcode = '22023', message = 'invalid_receptionist_facility_settings_version';
  end if;
  begin
    select version into strict v_version from storage.objects
    where bucket_id='site-settings' and name='public-settings.json' for share;
  exception when no_data_found or too_many_rows then
    raise exception using errcode = 'P0001', message = 'receptionist_facility_settings_version_unavailable';
  end;
  if v_version is distinct from p_settings_version then
    raise exception using errcode = 'P0001', message = 'receptionist_facility_settings_changed';
  end if;
  -- The lock is held through receipt, booking and queue commit. Competing
  -- Storage metadata updates must wait, or this check sees their new version.
  return public.create_receptionist_facility_booking_queued_v2(p_request,p_booking,p_request_key);
end;
$$;
revoke all on function public.create_receptionist_facility_booking_guarded_v3(jsonb,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.create_receptionist_facility_booking_guarded_v3(jsonb,jsonb,text,text) to service_role;
