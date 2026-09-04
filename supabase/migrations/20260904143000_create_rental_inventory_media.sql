create table if not exists public.rental_inventory_media (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rental_inventory_items(id) on delete cascade,
  media_type text not null,
  url text not null,
  alt_text text not null default '',
  caption text not null default '',
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  poster_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rental_inventory_media_type_check check (media_type in ('image', 'video')),
  constraint rental_inventory_media_url_check check (length(trim(url)) > 0),
  constraint rental_inventory_media_cover_check check (not is_cover or media_type = 'image'),
  constraint rental_inventory_media_rental_url_unique unique (rental_id, url)
);

create index if not exists rental_inventory_media_order_idx
  on public.rental_inventory_media (rental_id, sort_order, created_at);

create unique index if not exists rental_inventory_media_one_cover_idx
  on public.rental_inventory_media (rental_id)
  where is_cover;

drop trigger if exists rental_inventory_media_set_updated_at
  on public.rental_inventory_media;

create trigger rental_inventory_media_set_updated_at
before update on public.rental_inventory_media
for each row execute function public.set_updated_at();

alter table public.rental_inventory_media enable row level security;

-- Idempotently preserve every legacy rental photo as its first gallery image.
-- The unique (rental_id, url) constraint prevents repeat migrations/backfills.
insert into public.rental_inventory_media (
  rental_id,
  media_type,
  url,
  alt_text,
  sort_order,
  is_cover
)
select
  item.id,
  'image',
  item.image_src,
  coalesce(nullif(item.image_alt, ''), item.title),
  0,
  true
from public.rental_inventory_items item
where length(trim(item.image_src)) > 0
  and not exists (
    select 1
    from public.rental_inventory_media media
    where media.rental_id = item.id
  )
on conflict (rental_id, url) do nothing;

-- Replace one rental's gallery and synchronize its legacy cover atomically.
create or replace function public.replace_rental_inventory_media(
  p_rental_id uuid,
  p_media jsonb
)
returns void
language plpgsql
set search_path = public
as $$
declare
  image_count integer;
  cover_count integer;
begin
  if jsonb_typeof(p_media) <> 'array' then
    raise exception 'Rental media must be a JSON array.';
  end if;

  select
    count(*) filter (where value->>'mediaType' = 'image'),
    count(*) filter (
      where value->>'mediaType' = 'image'
        and coalesce((value->>'isCover')::boolean, false)
    )
  into image_count, cover_count
  from jsonb_array_elements(p_media);

  if image_count < 1 or cover_count <> 1 then
    raise exception 'Every rental gallery requires exactly one image cover.';
  end if;

  update public.rental_inventory_media
  set is_cover = false
  where rental_id = p_rental_id;

  delete from public.rental_inventory_media existing
  where existing.rental_id = p_rental_id
    and not exists (
      select 1
      from jsonb_array_elements(p_media) desired
      where desired->>'url' = existing.url
    );

  insert into public.rental_inventory_media (
    rental_id,
    media_type,
    url,
    alt_text,
    caption,
    sort_order,
    is_cover,
    poster_url
  )
  select
    p_rental_id,
    value->>'mediaType',
    trim(value->>'url'),
    coalesce(value->>'altText', ''),
    coalesce(value->>'caption', ''),
    (ordinality - 1)::integer,
    coalesce((value->>'isCover')::boolean, false),
    nullif(trim(value->>'posterUrl'), '')
  from jsonb_array_elements(p_media) with ordinality
  on conflict (rental_id, url) do update set
    media_type = excluded.media_type,
    alt_text = excluded.alt_text,
    caption = excluded.caption,
    sort_order = excluded.sort_order,
    is_cover = excluded.is_cover,
    poster_url = excluded.poster_url;

  update public.rental_inventory_items item
  set
    image_src = cover.url,
    image_alt = coalesce(nullif(cover.alt_text, ''), item.title)
  from public.rental_inventory_media cover
  where item.id = p_rental_id
    and cover.rental_id = p_rental_id
    and cover.is_cover;
end;
$$;

revoke all on function public.replace_rental_inventory_media(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_rental_inventory_media(uuid, jsonb)
  to service_role;
