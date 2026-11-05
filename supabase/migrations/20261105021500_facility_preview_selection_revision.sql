-- Require every layout change to advance the preview revision. This protects
-- against stale app versions which still issue unconditional selection writes.
alter table public.facility_invitation_previews
  add column selection_revision integer not null default 0 check (selection_revision >= 0),
  add column selection_attempt_id uuid;

-- Keep a minimal, service-only record so a past attempt cannot be reused
-- after a later choice. No caller or selection details are duplicated.
create table public.facility_preview_selection_receipts (
  preview_id uuid not null references public.facility_invitation_previews(id) on delete cascade,
  attempt_id uuid not null,
  selection_revision integer not null check (selection_revision > 0),
  primary key (preview_id, attempt_id),
  unique (preview_id, selection_revision)
);
alter table public.facility_preview_selection_receipts enable row level security;
revoke all on public.facility_preview_selection_receipts from public, anon, authenticated;
grant insert on public.facility_preview_selection_receipts to service_role;

create function public.enforce_facility_preview_selection_revision()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if row(new.selected_option_index,new.delivery_preferences,new.invitation_quantity,new.selection_revision,new.selection_attempt_id)
     is distinct from row(old.selected_option_index,old.delivery_preferences,old.invitation_quantity,old.selection_revision,old.selection_attempt_id)
  then
    if old.selection_revision = 2147483647 or new.selection_revision <> old.selection_revision + 1 then
      raise exception using errcode='23514',message='preview_selection_revision_required';
    end if;
    if new.selection_attempt_id is null or new.selection_attempt_id is not distinct from old.selection_attempt_id then
      raise exception using errcode='23514',message='preview_selection_attempt_required';
    end if;
    -- This executes under the row lock; an application timestamp taken before
    -- waiting cannot authorize a selection after its expiry or booking.
    if old.status <> 'accepted' or old.expires_at <= clock_timestamp() or old.booking_id is not null or old.confirmed_theme is null then
      raise exception using errcode='23514',message='preview_selection_unavailable';
    end if;
    insert into public.facility_preview_selection_receipts(preview_id,attempt_id,selection_revision)
    values (old.id,new.selection_attempt_id,new.selection_revision);
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_facility_preview_selection_revision() from public,anon,authenticated;
grant execute on function public.enforce_facility_preview_selection_revision() to service_role;
create trigger facility_preview_selection_revision_guard
  before update on public.facility_invitation_previews
  for each row execute function public.enforce_facility_preview_selection_revision();
