# Inflated dimensions research report

Branch: `feat/inventory-operational-fields`  
Canonical table: `public.rental_inventory_items`

## Summary counts

| Metric | Count |
|---|---|
| Initially missing one or more of L/W/H | **64** |
| Researched | **64** |
| Verified | **15** |
| High confidence | **2** |
| Medium (not applied) | **16** |
| Unresolved (not applied) | **31** |
| Inventory records updated with L/W/H | **17** |
| Still missing L/W/H after apply | **47** |

## Applied records (verified / high)

| Title | Manufacturer/model | Dimensions (ft) | Source | Confidence |
|---|---|---|---|---|
| Combo Bounce & Slide | Jumping Jax LLC - Combo1 | 15.833 × 20.333 × 14.5 | jumpingjaxllc.com/.../combo1 | verified |
| Dream Combo | Jumping Jax LLC - Dream Combo | 15.833 × 20.333 × 14.5 | .../dream-combo | verified |
| World Of Disney | Jumping Jax LLC - World of Disney | 15.833 × 20.333 × 14.5 | .../world-of-disney | verified |
| Spongebob Combo | Jumping Jax LLC - Spongebob Combo | 15 × 20 × 17 | .../spongebob-combo | verified |
| Cars Combo | Jumping Jax LLC - Cars Combo | 15 × 20 × 16 | .../cars-combo | verified |
| Fairies Combo | Jumping Jax LLC - Fairies Combo | 15 × 20 × 17 | .../fairies-combo | verified |
| Castle | Jumping Jax LLC - Castle | 15 × 15 × 17 | .../castle | verified |
| Dream Castle | Jumping Jax LLC - Dream Castle | 15 × 15 × 17 | .../dream-castle | verified |
| Pirate Slide | Jumping Jax LLC - Pirate Slide | 20 × 10 × 30 | .../pirate-slide | verified |
| Princess Slide | Jumping Jax LLC - Princess Slide | 35 × 16 × 18 | .../princess-slide | verified |
| Sports Course | Jumping Jax LLC - Sports Course | 65 × 15 × 20 | .../sports-course | verified |
| Toxic Course | Jumping Jax LLC - Toxic Course | 45 × 15 × 16 | .../toxic-course | verified |
| Call Of Duty Course | Jumping Jax LLC - Call of Duty Course | 40 × 13 × 16 | .../call-of-duty-course | verified |
| Rampage Doublelane Waterslide | Jumping Jax LLC - Rampage | 38 × 18 × 22 | .../rampage-doublelane-waterslide | verified |
| Ruby Falls Waterslide with Deep Pool | Jumping Jax LLC - Ruby Falls | 40 × 13 × 19 | .../ruby-falls-waterslide-with-deep-pool | verified |
| 6 Ft Table | Industry-standard banquet table | 6 × 2.5 × 2.417 | banquettablespro 30x72 | high |
| 8 Ft Table | Industry-standard banquet table | 8 × 2.5 × 2.417 | commercial 96x30x29 | high |

Full per-item research objects: `docs/dimension-research-results.json`  
Still-missing reasons: `docs/dimension-research-status.md`

## Duplicate / alias findings

- Dry `pirate-slide` / wet `pirate-waterslide` kept separate.
- Dry `princess-slide` / wet `princess-waterslide` kept separate.
- Dry `island-breeze-combo` / wet `island-breeze-combo-waterslide` kept separate.
- `mini-waterslide` and `mini-waterslide-2` kept separate (different photos).
- `double-lane-18ft-waterslide` not merged into tropical double-lane (photos differ).
- `combo1`, `dream-combo`, and `world-of-disney` share the same owner-listed footprint but remain distinct themed records.

## Sync preservation

Catalog sync (`buildCatalogSyncRows` / `syncCurrentRentalInventory`) omits all operational dimension columns. Covered by `catalog sync payload omits owner operational fields` in `src/lib/admin/inventory-ops.test.mts`.

## Migration note

Additive migration `add_inventory_operational_fields` was applied to the Jumping Jax bookings database so researched values could be stored and reloaded.

## Scope confirmation

Driver App, Social Posts, AI Marketing, public rental presentation, bookings, pricing, availability, facility parties, emails, Google Calendar, auth, nav, and deployment config were not modified in this research pass.
