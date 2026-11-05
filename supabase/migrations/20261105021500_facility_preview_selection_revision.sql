-- Require every layout change to advance the preview revision. This protects
-- against stale app versions which still issue unconditional selection writes.
alter table public.facility_invitation_previews
  add column selection_revision integer not null default 0 check (selection_revision >= 0);
create function public.enforce_facility_preview_selection_revision()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if row(new.selected_option_index,new.delivery_preferences,new.invitation_quantity,new.selection_revision)
     is distinct from row(old.selected_option_index,old.delivery_preferences,old.invitation_quantity,old.selection_revision)
  then
    if old.selection_revision = 2147483647 or new.selection_revision <> old.selection_revision + 1 then
      raise exception using errcode='23514',message='preview_selection_revision_required';
    end if;
    -- This executes under the row lock; an application timestamp taken before
    -- waiting cannot authorize a selection after its expiry or booking.
    if old.status <> 'accepted' or old.expires_at <= clock_timestamp() or old.booking_id is not null or old.confirmed_theme is null then
      raise exception using errcode='23514',message='preview_selection_unavailable';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_facility_preview_selection_revision() from public,anon,authenticated;
grant execute on function public.enforce_facility_preview_selection_revision() to service_role;
create trigger facility_preview_selection_revision_guard
  before update on public.facility_invitation_previews
  for each row execute function public.enforce_facility_preview_selection_revision();
