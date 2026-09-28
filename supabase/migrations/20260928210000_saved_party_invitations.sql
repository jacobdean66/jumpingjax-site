-- Private, booking-scoped approved print files. The application only serves
-- files referenced by an active booking whose printed details still match.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('party-invitation-files', 'party-invitation-files', false, 10485760,
        array['image/png', 'application/pdf'])
on conflict (id) do nothing;
