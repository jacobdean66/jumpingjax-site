# Missing physical dimensions report

Generated during the ops-inventory-driver-ai implementation pass.

## Scope clarification

There are two different “dimensions” concepts in this codebase:

1. **Image pixel / aspect dimensions** (Social Posts Asset Intelligence) — width/height of image files for placement readiness. Fixed in this pass by probing local `public/` files.
2. **Physical inflatable L×W×H** (inventory operational fields) — length/width/height of rental units for Driver App, trip sheets, and AI product context. Stored on `rental_inventory_items` (`length_ft`, `width_ft`, `height_ft`, source, confidence).

This report covers **physical** dimensions.

## Authoritative storage

- Table: `rental_inventory_items`
- Editor: `/admin/inventory` → Operational information
- Consumers: Driver App, trip sheets, deliveries enrichment by slug

## Research status (external browser research)

External manufacturer research was **not** applied automatically in this environment. Do not invent measurements.

### High confidence

_None applied yet._ Owner should enter confirmed manufacturer/listing measurements in the inventory editor with confidence `high` and a source URL/note.

### Likely matches needing owner review

_None staged._ When researching, record conflicting listings here before applying.

### Unresolved — exact inventory list to research

Catalog inflatables currently without applied physical dimensions in inventory: **50**.

All rows below start as unresolved until high-confidence research is entered in `/admin/inventory`.

| Category | Slug | Title | Image |
|---|---|---|---|
| water-slides | `18-ft-basic-waterslide` | 18' Basic Waterslide | `/inflatables/waterslides/legacy/18-ft-basic-waterslide.jpg` |
| water-slides | `22-ft-hurricane-waterslide` | 22' Hurricane Waterslide | `/inflatables/waterslides/legacy/22-ft-hurricane-waterslide.jpg` |
| water-slides | `22-ft-tropical-hurricane-waterslide` | 22' Tropical Hurricane Waterslide | `/inflatables/waterslides/legacy/22-ft-tropical-hurricane-waterslide.jpg` |
| water-slides | `double-lane-18ft-waterslide` | Double Lane 18ft Waterslide | `/inflatables/waterslides/legacy/double-lane-18ft-waterslide.jpg` |
| water-slides | `double-splash-waterslide` | Double Splash Waterslide | `/inflatables/waterslides/legacy/double-splash-waterslide.jpg` |
| water-slides | `mini-tiki-plunge` | Mini Tiki Plunge | `/inflatables/waterslides/legacy/mini-tiki-plunge.jpg` |
| water-slides | `mini-waterslide` | Mini Waterslide | `/inflatables/waterslides/legacy/mini-waterslide.jpg` |
| water-slides | `mini-waterslide-2` | Mini Waterslide 2 | `/inflatables/waterslides/legacy/mini-waterslide-2.jpg` |
| water-slides | `purple-hurricane-18ft` | Purple Hurricane 18ft | `/inflatables/waterslides/legacy/purple-hurricane-18ft.jpg` |
| water-slides | `rampage-doublelane-waterslide` | Rampage Doublelane Waterslide | `/inflatables/waterslides/legacy/rampage-doublelane-waterslide.jpg` |
| water-slides | `ruby-falls-waterslide-with-deep-pool` | Ruby Falls Waterslide with Deep Pool | `/inflatables/waterslides/legacy/ruby-falls-waterslide-with-deep-pool.jpg` |
| bounce-houses | `castle` | Castle | `/inflatables/bounce-houses/castle.webp` |
| bounce-houses | `dalmation-bounce` | Dalmatian Bounce House | `/inflatables/bounce-houses/dalmation-bounce.webp` |
| bounce-houses | `dream-castle` | Dream Castle | `/inflatables/bounce-houses/dream-castle.webp` |
| bounce-houses | `jumbo-castle-bouncer` | Jumbo Castle Bouncer | `/inflatables/bounce-houses/jumbo-castle-bouncer.webp` |
| bounce-houses | `tiger-belly-bounce` | Tiger Belly Bounce | `/inflatables/bounce-houses/tiger-belly-bounce.jpg` |
| combos | `candy-land-toddle-combo` | Candy Land Toddler Combo | `/inflatables/combos/candy-land-toddle-combo.jpg` |
| combos | `cars-combo` | Cars Combo | `/inflatables/combos/cars-combo.webp` |
| combos | `castle-combo` | Castle Combo | `/inflatables/combos/castle-combo.webp` |
| combos | `combo1` | Combo Bounce & Slide | `/inflatables/combos/combo1.jpg` |
| combos | `dream-combo` | Dream Combo | `/inflatables/combos/dream-combo.webp` |
| combos | `fairies-combo` | Fairies Combo | `/inflatables/combos/fairies-combo.webp` |
| combos | `island-breeze-combo` | Island Breeze Combo | `/inflatables/combos/island-breeze-combo.webp` |
| combos | `spongebob-combo` | Spongebob Combo | `/inflatables/combos/spongebob-combo.webp` |
| combos | `whoville-igloo-combo-grinch-themed-inflatable-bounce-house` | Whoville Igloo Combo Grinch Themed Inflatable Bounce House | `/inflatables/combos/whoville-igloo-combo-grinch-themed-inflatable-bounce-house.webp` |
| combos | `world-of-disney` | World Of Disney | `/inflatables/combos/world-of-disney.webp` |
| inflatable-games | `4-in-1-sports-game` | 4-in-1 Sports Game | `/inflatables/inflatable-games/4-in-1-sports-game.webp` |
| inflatable-games | `floating-baseball-game` | Floating Baseball Game | `/inflatables/inflatable-games/floating-baseball-game.jpg` |
| inflatable-games | `football-game` | Football Game | `/inflatables/inflatable-games/football-game.jpg` |
| inflatable-games | `human-whackamole` | Human Whac-A-Mole | `/inflatables/inflatable-games/human-whackamole.webp` |
| inflatable-games | `hungry-hippo` | Hungry Hippo | `/inflatables/inflatable-games/hungry-hippo.jpg` |
| inflatable-games | `jumpingjax-basketball-shootout` | Jumping Jax Basketball Shootout | `/inflatables/inflatable-games/jumpingjax-basketball-shootout.webp` |
| inflatable-games | `sports-star` | Sports Star | `/inflatables/inflatable-games/sports-star.webp` |
| obstacle-courses | `call-of-duty-course` | Call Of Duty Course | `/inflatables/obstacle-courses/call-of-duty-course.webp` |
| obstacle-courses | `criss-cross-course` | Criss Cross Course | `/inflatables/obstacle-courses/criss-cross-course.jpg` |
| obstacle-courses | `grinch-whoville-mayhem` | Grinch Whoville Mayhem | `/inflatables/obstacle-courses/grinch-whoville-mayhem.webp` |
| obstacle-courses | `offshore-obstacle-course` | Offshore Obstacle Course | `/inflatables/obstacle-courses/offshore-obstacle-course.webp` |
| obstacle-courses | `sports-course` | Sports Course | `/inflatables/obstacle-courses/sports-course.webp` |
| obstacle-courses | `toxic-course` | Toxic Course | `/inflatables/obstacle-courses/toxic-course.webp` |
| slides | `18-ft-slide` | 18 Ft Slide | `/inflatables/slides/18-ft-slide.webp` |
| slides | `18-ft-tropical-double-lane-slide` | 18 Ft Tropical Double Lane Slide | `/inflatables/slides/18-ft-tropical-double-lane-slide.webp` |
| slides | `24-ft-slide` | 24 Ft Slide | `/inflatables/slides/24-ft-slide.webp` |
| slides | `30-ft-long-rock-climb-slide` | 30 Ft Long Rock Climb Slide | `/inflatables/slides/30-ft-long-rock-climb-slide.webp` |
| slides | `pirate-slide` | Pirate Slide | `/inflatables/slides/pirate-slide.webp` |
| slides | `princess-slide` | Princess Slide | `/inflatables/slides/princess-slide.webp` |
| slides | `sugar-rush-slide` | Sugar Rush Slide | `/inflatables/slides/sugar-rush-slide.webp` |
| water-slides | `18-ft-tropical-double-lane-waterslide` | 18 Ft Tropical Double Lane Waterslide | `/inflatables/waterslides/18-ft-tropical-double-lane-waterslide.webp` |
| water-slides | `island-breeze-combo-waterslide` | Island Breeze Combo Waterslide | `/inflatables/waterslides/island-breeze-combo-waterslide.webp` |
| water-slides | `pirate-waterslide` | Pirate Waterslide | `/inflatables/waterslides/pirate-waterslide.webp` |
| water-slides | `princess-waterslide` | Princess Waterslide | `/inflatables/waterslides/princess-waterslide.webp` |
