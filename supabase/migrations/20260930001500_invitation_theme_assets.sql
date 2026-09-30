-- Private, reusable, searchable artwork. Public clients use signed selections;
-- only the service role can read/write the catalog or approve a verified image.
create table if not exists public.invitation_theme_assets (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  label text not null check (length(label) between 1 and 160),
  normalized_label text not null,
  aliases text[] not null default '{}',
  franchise text not null,
  description text not null check (length(description) between 1 and 500),
  storage_bucket text not null check (storage_bucket in ('invitation-theme-artwork','invitation-theme-artwork-preview')),
  storage_path text not null check (storage_path ~ '^[a-f0-9]{64}\.png$'),
  source_url text not null,
  source_image_url text not null,
  provenance jsonb not null default '{}',
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  verified_at timestamptz not null default now(),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, normalized_label, storage_path)
);
alter table public.invitation_theme_assets enable row level security;
revoke all on public.invitation_theme_assets from anon, authenticated;
grant all on public.invitation_theme_assets to service_role;
create index if not exists invitation_theme_assets_aliases on public.invitation_theme_assets using gin (aliases);
create index if not exists invitation_theme_assets_search on public.invitation_theme_assets using gin
  (to_tsvector('simple', normalized_label || ' ' || franchise || ' ' || description));

create or replace function public.search_invitation_theme_assets(p_query text, p_bucket text)
returns setof public.invitation_theme_assets language sql stable security invoker
set search_path = public, pg_temp as $$
  select a.* from public.invitation_theme_assets a
  where a.approval_status = 'approved' and a.storage_bucket = p_bucket
    and (a.normalized_label = p_query or p_query = any(a.aliases)
      or to_tsvector('simple', a.normalized_label || ' ' || a.franchise || ' ' || a.description)
         @@ plainto_tsquery('simple', left(p_query, 460)))
  order by (a.normalized_label = p_query) desc, a.approved_at desc limit 8;
$$;
revoke all on function public.search_invitation_theme_assets(text,text) from public, anon, authenticated;
grant execute on function public.search_invitation_theme_assets(text,text) to service_role;

comment on table public.invitation_theme_assets is 'Vision-verified artwork; approved only after explicit picture confirmation. Preview and production assets remain separate.';
