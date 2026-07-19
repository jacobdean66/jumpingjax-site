-- Additive operational fields for rental inventory.
-- Preserves all existing rows; new columns are nullable or default-safe.

alter table public.rental_inventory_items
  add column if not exists blower_requirements jsonb not null default '[]'::jsonb,
  add column if not exists tarp_requirement text not null default '',
  add column if not exists cleaning_supply text null,
  add column if not exists length_ft numeric null,
  add column if not exists width_ft numeric null,
  add column if not exists height_ft numeric null,
  add column if not exists dimension_unit text not null default 'ft',
  add column if not exists dimension_source_text text not null default '',
  add column if not exists dimension_source_url text not null default '',
  add column if not exists dimension_manufacturer text not null default '',
  add column if not exists dimension_confidence text null,
  add column if not exists dimension_research_notes text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_inventory_items_cleaning_supply_check'
  ) then
    alter table public.rental_inventory_items
      add constraint rental_inventory_items_cleaning_supply_check
      check (
        cleaning_supply is null
        or cleaning_supply in ('slide-spray', 'disinfectant')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_inventory_items_dimension_unit_check'
  ) then
    alter table public.rental_inventory_items
      add constraint rental_inventory_items_dimension_unit_check
      check (dimension_unit in ('ft', 'in', 'm'));
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
        or dimension_confidence in ('verified', 'high', 'medium', 'unresolved')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_inventory_items_dimension_positive_check'
  ) then
    alter table public.rental_inventory_items
      add constraint rental_inventory_items_dimension_positive_check
      check (
        (length_ft is null or length_ft > 0)
        and (width_ft is null or width_ft > 0)
        and (height_ft is null or height_ft > 0)
      );
  end if;
end $$;
