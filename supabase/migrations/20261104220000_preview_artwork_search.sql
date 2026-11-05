alter table public.facility_invitation_previews
  alter column confirmed_theme drop not null,
  drop constraint facility_invitation_previews_check,
  add constraint facility_invitation_previews_confirmed_theme_check check (
    confirmed_theme is null or (
      jsonb_typeof(confirmed_theme) = 'object'
      and confirmed_theme->>'label' is not distinct from party_theme
      and coalesce(confirmed_theme->>'imagePath', '') ~ '^/api/facility/invitations/artwork/[a-f0-9]{64}$'
    )
  ),
  add column artwork_search_keys uuid[] not null default '{}',
  add column artwork_search_pending_key uuid,
  add column artwork_search_pending_until timestamptz,
  add column artwork_candidate_key uuid,
  add column artwork_candidates jsonb,
  add constraint facility_preview_artwork_search_limit check (cardinality(artwork_search_keys) <= 3),
  add constraint facility_preview_confirmed_before_layout check (
    confirmed_theme is not null or (selected_option_index is null and booking_id is null)
  );

-- A search retry uses the same key. Row locking makes the budget and lease
-- shared by every tab and email reopen. A failed search still consumes a try.
create function public.claim_facility_preview_artwork_search(
  p_id uuid, p_search_key uuid, p_initial_lease uuid
) returns text language plpgsql security invoker set search_path = public, pg_temp as $$
declare preview public.facility_invitation_previews%rowtype;
begin
  select * into preview from public.facility_invitation_previews where id = p_id for update;
  if not found or p_search_key is null or preview.expires_at <= clock_timestamp()
     or preview.confirmed_theme is not null or preview.booking_id is not null
     or not (
       (p_initial_lease is null and preview.status = 'accepted')
       or (p_initial_lease is not null and preview.status = 'sending'
           and preview.lease_id is not distinct from p_initial_lease
           and preview.lease_until > clock_timestamp())
     ) then
    return 'unavailable';
  end if;
  if p_search_key = any(preview.artwork_search_keys) then return 'duplicate'; end if;
  if cardinality(preview.artwork_search_keys) >= 3 then return 'limited'; end if;
  if preview.artwork_search_pending_until > clock_timestamp() then return 'busy'; end if;
  update public.facility_invitation_previews
    set artwork_search_keys = array_append(artwork_search_keys, p_search_key),
        artwork_search_pending_key = p_search_key,
        artwork_search_pending_until = clock_timestamp() + interval '90 seconds'
    where id = p_id;
  return 'claimed';
end $$;

revoke all on function public.claim_facility_preview_artwork_search(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_facility_preview_artwork_search(uuid,uuid,uuid) to service_role;
