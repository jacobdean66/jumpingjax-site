-- Additive operational inventory fields for Driver App, trip sheets, and Social Posts.
-- Canonical source: rental_inventory_items (keyed by slug).

alter table public.rental_inventory_items
  add column if not exists length_ft numeric,
  add column if not exists width_ft numeric,
  add column if not exists height_ft numeric,
  add column if not exists dimension_units text not null default 'ft',
  add column if not exists dimension_notes text not null default '',
  add column if not exists dimension_source text not null default '',
  add column if not exists dimension_confidence text,
  add column if not exists blowers jsonb not null default '[]'::jsonb,
  add column if not exists tarps jsonb not null default '[]'::jsonb,
  add column if not exists requires_slide_spray boolean,
  add column if not exists requires_disinfectant boolean;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_inventory_items_dimension_units_check'
  ) then
    alter table public.rental_inventory_items
      add constraint rental_inventory_items_dimension_units_check
      check (dimension_units in ('ft', 'in', 'm'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_inventory_items_dimension_confidence_check'
  ) then
    alter table public.rental_inventory_items
      add constraint rental_inventory_items_dimension_confidence_check
      check (
        dimension_confidence is null
        or dimension_confidence in ('high', 'likely', 'unresolved')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_inventory_items_blowers_array_check'
  ) then
    alter table public.rental_inventory_items
      add constraint rental_inventory_items_blowers_array_check
      check (jsonb_typeof(blowers) = 'array');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_inventory_items_tarps_array_check'
  ) then
    alter table public.rental_inventory_items
      add constraint rental_inventory_items_tarps_array_check
      check (jsonb_typeof(tarps) = 'array');
  end if;
end $$;

comment on column public.rental_inventory_items.blowers is
  'Array of {quantity:number, description:string} blower requirements';
comment on column public.rental_inventory_items.tarps is
  'Array of {quantity:number, description:string} tarp requirements';
comment on column public.rental_inventory_items.requires_slide_spray is
  'Null means apply category default; true/false is an explicit override';
comment on column public.rental_inventory_items.requires_disinfectant is
  'Null means apply category default; true/false is an explicit override';
