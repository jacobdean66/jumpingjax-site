-- Confirmed theme images are stored once by content hash. Only service-role
-- uploads are allowed; customers receive images through the read-only artwork route.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invitation-theme-artwork', 'invitation-theme-artwork', false, 8388608, array['image/png']),
       ('invitation-theme-artwork-preview', 'invitation-theme-artwork-preview', false, 8388608, array['image/png'])
on conflict (id) do nothing;
