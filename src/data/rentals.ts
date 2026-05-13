/**
 * Rental inventory — built from real assets under /public/inflatables/.
 *
 * TODO(pricing): Replace category default startingPrice values with live quotes from operations.
 *
 * Regenerate file list after adding images: npm run inventory:sync
 *
 * Fields:
 * - id: Stable composite key `${categoryId}/${slug}` (use for analytics / future CMS).
 * - slug: URL segment; must be globally unique (bookings key off rental_slug).
 * - categoryId: Routes under /rentals/[categoryId]/[slug].
 */

import { INFLATABLE_MANIFEST } from "./inflatables.manifest";

export const CATEGORY_IDS = [
  "bounce-houses",
  "combos",
  "inflatable-games",
  "obstacle-courses",
  "slides",
  "water-slides",
  "yard-games",
] as const;

export type RentalCategoryId = (typeof CATEGORY_IDS)[number];

export type Rental = {
  id: string;
  slug: string;
  categoryId: RentalCategoryId;
  title: string;
  shortDescription: string;
  description: string;
  startingPrice: number;
  imageSrc: string;
  imageAlt: string;
  ageRecommendation: string;
  setupRequirements: string[];
};

export const CATEGORY_COPY: Record<
  RentalCategoryId,
  { title: string; blurb: string }
> = {
  "bounce-houses": {
    title: "Bounce Houses",
    blurb:
      "Classic jumpers and castle styles—delivered clean, set up safely, and ready for smiles.",
  },
  combos: {
    title: "Combos",
    blurb:
      "Bounce plus slide in one unit—ideal when you want more play without a second delivery.",
  },
  "inflatable-games": {
    title: "Inflatable Games",
    blurb:
      "Interactive inflatable attractions that keep lines moving and guests competing in friendly fun.",
  },
  "obstacle-courses": {
    title: "Obstacle Courses",
    blurb:
      "Race-ready layouts for field days, teen groups, and festivals that need high throughput energy.",
  },
  slides: {
    title: "Slides",
    blurb:
      "Dry slide options for big impact—great when you want height and speed without water setup.",
  },
  "water-slides": {
    title: "Water Slides",
    blurb:
      "Cool off with our wet slide lineup—perfect for summer birthdays, schools, and neighborhood bashes.",
  },
  "yard-games": {
    title: "Yard Games",
    blurb:
      "Add-on attractions and classic yard games that pair perfectly with inflatables for mixed-age events.",
  },
};

/** Disk folder under public/inflatables → URL category id */
const FOLDER_TO_CATEGORY_ID: Record<string, RentalCategoryId> = {
  "bounce-houses": "bounce-houses",
  combos: "combos",
  "inflatable-games": "inflatable-games",
  "obstacle-courses": "obstacle-courses",
  slides: "slides",
  waterslides: "water-slides",
  "yard-games": "yard-games",
};

const DEFAULT_STARTING_PRICE: Record<RentalCategoryId, number> = {
  "bounce-houses": 195,
  combos: 295,
  "inflatable-games": 325,
  "obstacle-courses": 449,
  slides: 279,
  "water-slides": 349,
  "yard-games": 175,
};

const TITLE_OVERRIDES: Record<string, string> = {
  "dalmation-bounce": "Dalmatian Bounce House",
  "jumpingjax-basketball-shootout": "Jumping Jax Basketball Shootout",
  "human-whackamole": "Human Whac-A-Mole",
  "4-in-1-sports-game": "4-in-1 Sports Game",
  "candy-land-toddle-combo": "Candy Land Toddler Combo",
  combo1: "Combo Bounce & Slide",
};

/**
 * Filename stems flagged for editorial follow-up (titles inferred; confirm with ops).
 * TODO(content): Replace inferred names when official SKU / licensing labels are finalized.
 */
export const INVENTORY_CONTENT_TODO_STEMS: ReadonlySet<string> = new Set([
  "combo1",
  "candy-land-toddle-combo",
  "whoville-igloo-combo-grinch-themed-inflatable-bounce-house",
]);

function fileStem(file: string): string {
  const i = file.lastIndexOf(".");
  return i === -1 ? file : file.slice(0, i);
}

function slugFromStem(stem: string): string {
  return stem
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function inferTitle(stem: string): string {
  const override = TITLE_OVERRIDES[stem];
  if (override) return override;

  const parts = stem.split("-").filter(Boolean);
  const titled = parts.map((segment) => {
    if (/^\d+$/.test(segment)) return segment;
    const lower = segment.toLowerCase();
    if (lower === "ft") return "Ft";
    if (lower === "nba" || lower === "sc") return segment.toUpperCase();
    return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
  });
  return titled.join(" ");
}

function shortBlurb(categoryId: RentalCategoryId, title: string): string {
  const templates: Record<RentalCategoryId, string> = {
    "bounce-houses": `${title} — roomy jump floor, bright artwork, and parent-friendly sightlines.`,
    combos: `${title} — bounce zone plus slide in one unit; ask about wet or dry configuration when you book.`,
    "inflatable-games": `${title} — keeps guests active and rotating; great alongside a bounce or slide.`,
    "obstacle-courses": `${title} — built for relays and timed runs; ideal for schools and large guest lists.`,
    slides: `${title} — tall slide presence without water requirements; great for dry events and cooler days.`,
    "water-slides": `${title} — summer-ready water fun; hose and power placement confirmed before delivery.`,
    "yard-games": `${title} — pairs well with inflatables for festivals, churches, and backyard parties.`,
  };
  return templates[categoryId];
}

function longDescription(categoryId: RentalCategoryId, title: string): string {
  return `Reserve ${title} for your next South Carolina event. ${shortBlurb(categoryId, title)} Our crew handles delivery, inflation, and safety review so you can focus on your guests.`;
}

function ageForCategory(categoryId: RentalCategoryId): string {
  switch (categoryId) {
    case "bounce-houses":
      return "Ages 3–12 typical; mixed ages OK with adult supervision and capacity limits.";
    case "combos":
      return "Ages 4+ common; water features require active adult supervision.";
    case "inflatable-games":
      return "Ages 6+ recommended; stagger participants for competitive games.";
    case "obstacle-courses":
      return "Ages 7+ recommended for full course; younger guests may need modified routes.";
    case "slides":
      return "Ages 5+ typical for taller dry slides; height and weight limits reviewed at setup.";
    case "water-slides":
      return "Ages 5+ with swimming comfort; adult supervision required near water landing areas.";
    case "yard-games":
      return "All ages with host supervision; follow posted rules for dunk tanks and shooting games.";
    default:
      return "Ages vary by unit; we confirm guidelines when you book.";
  }
}

function setupForCategory(categoryId: RentalCategoryId): string[] {
  const base = [
    "Level setup area with clear path for delivery cart (typically 3.5–4 ft gate minimum).",
    "Standard 120V outlet within 50 ft (no overloaded circuits or daisy-chained extension cords).",
  ];
  if (categoryId === "water-slides") {
    return [
      ...base,
      "Garden hose reach to the slide landing / pool area; GFCI-protected outdoor outlet.",
    ];
  }
  if (categoryId === "obstacle-courses") {
    return [
      "Long, level run with clear start/finish staging and unobstructed sightlines.",
      ...base.slice(0, 1),
      "Power within 75 ft of blower placement (dual-blower layouts may need a second circuit).",
    ];
  }
  if (categoryId === "yard-games") {
    return [
      "Flat, well-drained area; dunk tanks need water fill/drain access and host-provided hose reach.",
      "Adequate perimeter space for safe spectating and participant queueing.",
      base[1]!,
    ];
  }
  return [
    ...base,
    "Grass or turf preferred for staking; asphalt setups may use sandbags when permitted.",
  ];
}

function manifestToRentals(): Rental[] {
  const list: Rental[] = [];

  for (const row of INFLATABLE_MANIFEST) {
    const categoryId = FOLDER_TO_CATEGORY_ID[row.categoryFolder];
    if (!categoryId) continue;

    const stem = fileStem(row.file);
    const slug = slugFromStem(stem);
    const title = inferTitle(stem);
    const imageSrc = `/inflatables/${row.categoryFolder}/${row.file}`;

    list.push({
      id: `${categoryId}/${slug}`,
      slug,
      categoryId,
      title,
      shortDescription: shortBlurb(categoryId, title),
      description: longDescription(categoryId, title),
      startingPrice: DEFAULT_STARTING_PRICE[categoryId],
      imageSrc,
      imageAlt: `${title} inflatable rental from Jumping Jax`,
      ageRecommendation: ageForCategory(categoryId),
      setupRequirements: setupForCategory(categoryId),
    });
  }

  const bySlug = new Map<string, Rental[]>();
  for (const r of list) {
    const arr = bySlug.get(r.slug) ?? [];
    arr.push(r);
    bySlug.set(r.slug, arr);
  }
  const dupes = [...bySlug.entries()].filter(([, v]) => v.length > 1);
  if (dupes.length > 0) {
    const msg = dupes.map(([s]) => s).join(", ");
    throw new Error(
      `[rentals] Duplicate slug(s) across inventory — fix filenames or add disambiguation: ${msg}`,
    );
  }

  return list;
}

export const RENTALS: Rental[] = manifestToRentals();

/** Full-bleed homepage hero (Next/Image); distinct from first “Popular” tile to avoid duplicate visuals. */
export const HOMEPAGE_HERO_ASSET = {
  src: "/inflatables/slides/30-ft-long-rock-climb-slide.webp",
  alt: "30 Ft Long Rock Climb Slide inflatable rental at an outdoor event",
} as const;

/** Rentals hub: high-intent categories first for conversion browsing. */
export const CATEGORY_BROWSE_ORDER: RentalCategoryId[] = [
  "water-slides",
  "bounce-houses",
  "combos",
  "slides",
  "obstacle-courses",
  "inflatable-games",
  "yard-games",
];

/** Preview image per category on /rentals (falls back to first unit in category). */
const CATEGORY_PREVIEW_SLUG: Partial<Record<RentalCategoryId, string>> = {
  "water-slides": "18-ft-tropical-double-lane-waterslide",
  "bounce-houses": "dream-castle",
  combos: "world-of-disney",
  slides: "30-ft-long-rock-climb-slide",
  "obstacle-courses": "offshore-obstacle-course",
  "inflatable-games": "human-whackamole",
  "yard-games": "dunk-tank",
};

export function categoryPreviewRental(
  categoryId: RentalCategoryId,
): Rental | undefined {
  const slug = CATEGORY_PREVIEW_SLUG[categoryId];
  if (slug) {
    const exact = RENTALS.find(
      (r) => r.categoryId === categoryId && r.slug === slug,
    );
    if (exact) return exact;
  }
  return RENTALS.find((r) => r.categoryId === categoryId);
}

/** Homepage “Popular rentals” — strongest first: flagship wet, blockbuster combo, tall dry slide. */
const HOMEPAGE_FEATURED: readonly { categoryId: RentalCategoryId; slug: string }[] =
  [
    { categoryId: "water-slides", slug: "18-ft-tropical-double-lane-waterslide" },
    { categoryId: "combos", slug: "world-of-disney" },
    { categoryId: "slides", slug: "30-ft-long-rock-climb-slide" },
  ];

export function isCategoryId(id: string): id is RentalCategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(id);
}

export function rentalsInCategory(categoryId: RentalCategoryId): Rental[] {
  return RENTALS.filter((r) => r.categoryId === categoryId);
}

export function rentalDetailPath(r: Rental): string {
  return `/rentals/${r.categoryId}/${r.slug}`;
}

export function getRentalInCategory(
  categoryId: string,
  slug: string,
): Rental | undefined {
  if (!isCategoryId(categoryId)) return undefined;
  return RENTALS.find(
    (r) => r.slug === slug && r.categoryId === categoryId,
  );
}

/** `slug` is globally unique across inventory (used by booking / store). */
export function getRentalBySlug(slug: string): Rental | undefined {
  return RENTALS.find((r) => r.slug === slug);
}

export function homeFeaturedRentals(): Rental[] {
  return HOMEPAGE_FEATURED.map(({ categoryId, slug }) =>
    getRentalInCategory(categoryId, slug),
  ).filter((r): r is Rental => Boolean(r));
}

export function relatedRentals(rental: Rental, limit = 3): Rental[] {
  return RENTALS.filter(
    (r) => r.categoryId === rental.categoryId && r.slug !== rental.slug,
  ).slice(0, limit);
}
