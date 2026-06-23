create table if not exists public.rental_inventory_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category_id text not null,
  title text not null,
  short_description text not null default '',
  description text not null default '',
  starting_price numeric not null default 0,
  image_src text not null default '',
  image_alt text not null default '',
  age_recommendation text not null default '',
  setup_requirements text[] not null default '{}',
  route_kind text not null default 'standard',
  estimated_setup_minutes integer not null default 45,
  is_active boolean not null default true,
  public_visible boolean not null default false,
  source text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rental_inventory_items_category_check check (
    category_id in (
      'bounce-houses',
      'combos',
      'inflatable-games',
      'obstacle-courses',
      'slides',
      'water-slides',
      'foam-parties',
      'accessories',
      'yard-games'
    )
  ),
  constraint rental_inventory_items_route_kind_check check (
    route_kind in ('standard', 'big-slide', 'accessory', 'foam', 'yard-game')
  ),
  constraint rental_inventory_items_setup_minutes_check check (
    estimated_setup_minutes between 0 and 240
  )
);

create index if not exists rental_inventory_items_category_idx
  on public.rental_inventory_items (category_id, title);

create index if not exists rental_inventory_items_active_idx
  on public.rental_inventory_items (is_active, public_visible);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rental_inventory_items_set_updated_at
  on public.rental_inventory_items;

create trigger rental_inventory_items_set_updated_at
before update on public.rental_inventory_items
for each row execute function public.set_updated_at();

alter table public.rental_inventory_items enable row level security;
