/**
 * Single source of truth for rental inventory.
 *
 * Fields:
 * - slug: URL segment under /rentals/[category]/[slug].
 * - categoryId: One of CATEGORY_IDS; drives routing and grouping.
 * - title / shortDescription / description: Customer-facing copy.
 * - startingPrice: Display “from” price in USD.
 * - dimensions: Setup footprint string shown on cards and detail.
 * - imageSrc: Path under public/ (static file). Prefer real photos under /inflatables/, /games/, or /party-rentals/.
 * - imageAlt: Accessible description of the unit in the photo.
 * - ageRecommendation / setupRequirements: Detail page content.
 *
 * Adding a rental: add a photo under public/ and set imageSrc to its URL path, then append a RENTALS entry.
 */

export const CATEGORY_IDS = [
  "water-slides",
  "bounce-houses",
  "obstacle-courses",
  "combos",
  "event-packages",
] as const;

export type RentalCategoryId = (typeof CATEGORY_IDS)[number];

export type Rental = {
  slug: string;
  categoryId: RentalCategoryId;
  title: string;
  shortDescription: string;
  /** Richer copy for detail page intro */
  description: string;
  startingPrice: number;
  dimensions: string;
  imageSrc: string;
  imageAlt: string;
  ageRecommendation: string;
  setupRequirements: string[];
};

export const CATEGORY_COPY: Record<
  RentalCategoryId,
  { title: string; blurb: string }
> = {
  "water-slides": {
    title: "Water Slides",
    blurb: "High-energy slide options for birthdays, schools, and summer events.",
  },
  "bounce-houses": {
    title: "Bounce Houses",
    blurb: "Classic inflatable favorites delivered clean and ready for safe fun.",
  },
  "obstacle-courses": {
    title: "Obstacle Courses",
    blurb: "Race-style courses that keep lines moving and energy high at big gatherings.",
  },
  "combos": {
    title: "Combos",
    blurb: "Bounce plus slide (wet or dry) in one footprint—great when you want variety without extra deliveries.",
  },
  "event-packages": {
    title: "Event Packages",
    blurb: "Flexible rental combinations for church groups, festivals, and parties.",
  },
};

export const RENTALS: Rental[] = [
  {
    slug: "18ft-tropical-splash",
    categoryId: "water-slides",
    title: "18ft Tropical Splash",
    shortDescription:
      "Single-lane slide with a bright tropical print—big fun for summer birthdays and block parties.",
    description:
      "A tall single-lane profile with a splash landing area. Sized for typical residential yards when you want a headline water piece without a festival footprint.",
    startingPrice: 325,
    dimensions: '28\' L × 12\' W × 18\' H',
    imageSrc: "/inflatables/tiki-plunge.jpg",
    imageAlt: "18ft tropical themed inflatable water slide on grass",
    ageRecommendation: "Ages 5+; adult supervision required for younger riders.",
    setupRequirements: [
      "Flat grass or level surface within 50 ft of power (standard outlet).",
      "Garden hose reach to slide landing area.",
      "Gate or opening at least 4 ft wide for rolled unit entry.",
    ],
  },
  {
    slug: "dual-lane-racer-slide",
    categoryId: "water-slides",
    title: "Dual Lane Racer Slide",
    shortDescription:
      "Two lanes side by side—perfect for friendly races and higher guest counts.",
    description:
      "Keeps throughput up with two riders at a time. Pairs well with a bounce house add-on for mixed ages at the same event.",
    startingPrice: 385,
    dimensions: '32\' L × 16\' W × 20\' H',
    imageSrc: "/inflatables/double-splash.jpg",
    imageAlt: "Dual lane inflatable water slide setup outdoors",
    ageRecommendation: "Ages 6+ recommended for racing lanes.",
    setupRequirements: [
      "Level area free of sharp debris; stake points as needed.",
      "Dedicated hose bib; we provide the splitter and lead hoses.",
      "Clear vertical clearance for tall slide sections during inflation.",
    ],
  },
  {
    slug: "compact-splash-combo-slide",
    categoryId: "water-slides",
    title: "Compact Splash Combo Slide",
    shortDescription:
      "Slide plus splash pool in a tighter layout—full water-day feel with easier placement.",
    description:
      "Ideal when you want slide and splash together but need to respect smaller yards or shared driveways.",
    startingPrice: 295,
    dimensions: '24\' L × 14\' W × 15\' H',
    imageSrc: "/inflatables/mini-waterslide-12-ft.jpg",
    imageAlt: "Compact inflatable water slide with splash area",
    ageRecommendation: "Ages 4+ with adult supervision near water features.",
    setupRequirements: [
      "Grass preferred for anchoring; asphalt may require sandbags (we coordinate).",
      "Water source within 75 ft; GFCI outlet access.",
    ],
  },
  {
    slug: "hurricane-drop-water-slide",
    categoryId: "water-slides",
    title: "Hurricane Drop Water Slide",
    shortDescription:
      "Steeper profile for thrill seekers—reserve early for peak summer weekends.",
    description:
      "The tallest option in our water lineup. Best for events with older kids and teens who want maximum excitement.",
    startingPrice: 425,
    dimensions: '34\' L × 15\' W × 22\' H',
    imageSrc: "/inflatables/purple-hurricane.jpg",
    imageAlt: "Tall hurricane themed water slide inflatable",
    ageRecommendation: "Ages 8+; height and weight limits apply at setup.",
    setupRequirements: [
      "Wide delivery path; crew walks through placement on arrival.",
      "Dedicated 20A circuit if additional blowers are required.",
      "Hose and drain-friendly slope away from structures.",
    ],
  },
  {
    slug: "castle-bounce-house",
    categoryId: "bounce-houses",
    title: "Castle Bounce House",
    shortDescription:
      "Classic castle silhouette with a roomy jump floor—birthday and block-party staple.",
    description:
      "Bright, easy-to-supervise sightlines for parents. Our most requested bounce profile year after year.",
    startingPrice: 195,
    dimensions: '15\' L × 15\' W × 14\' H',
    imageSrc: "/inflatables/funcity.jpg",
    imageAlt: "Castle themed bounce house inflatable",
    ageRecommendation: "Ages 3–12 typical; mixed ages OK with time splitting.",
    setupRequirements: [
      "Flat lawn or indoor gym with ceiling clearance noted in advance.",
      "Single dedicated outlet within 50 ft (no extension cords daisy-chained).",
    ],
  },
  {
    slug: "princess-palace-bouncer",
    categoryId: "bounce-houses",
    title: "Princess Palace Bouncer",
    shortDescription:
      "Palace styling with a wide entrance—photo-friendly for themed parties.",
    description:
      "Designed for picture-perfect parties while keeping the same safe bounce standards as our sport units.",
    startingPrice: 215,
    dimensions: '16\' L × 15\' W × 15\' H',
    imageSrc: "/inflatables/princess-waterslide.jpg",
    imageAlt: "Princess palace inflatable bounce house",
    ageRecommendation: "Ages 3–10; toddler sessions available on request.",
    setupRequirements: [
      "Level surface; remove yard toys and pet waste before delivery.",
      "Staking allowed; call 811 if you are unsure about underground lines.",
    ],
  },
  {
    slug: "sports-court-bounce",
    categoryId: "bounce-houses",
    title: "Sports Court Bounce",
    shortDescription:
      "Arena graphics with optional hoop activity—great for schools and team parties.",
    description:
      "Keeps older kids engaged with light competition while still bouncing safely inside the walls.",
    startingPrice: 225,
    dimensions: '17\' L × 16\' W × 15\' H',
    imageSrc: "/inflatables/tiger.jpg",
    imageAlt: "Sports themed bounce house with court graphics",
    ageRecommendation: "Ages 5–14; hoop play is optional and soft-foam only.",
    setupRequirements: [
      "Minimum pathway width 3.5 ft for rolled vinyl.",
      "Avoid low tree branches over blower intake.",
    ],
  },
  {
    slug: "superhero-city-bouncer",
    categoryId: "bounce-houses",
    title: "Superhero City Bouncer",
    shortDescription:
      "Bold city skyline artwork—stands out on large fields and festival layouts.",
    description:
      "High-visibility colors for big open areas or parking lot setups with sandbag anchoring when stakes are not allowed.",
    startingPrice: 235,
    dimensions: '18\' L × 16\' W × 16\' H',
    imageSrc: "/inflatables/kahuna.jpg",
    imageAlt: "Superhero city themed bounce house",
    ageRecommendation: "Ages 4–12; festival staff should monitor capacity.",
    setupRequirements: [
      "For hard surfaces, confirm sandbag plan when booking.",
      "Wind plan reviewed on delivery; safety comes first.",
    ],
  },
  {
    slug: "ninja-warrior-obstacle",
    categoryId: "obstacle-courses",
    title: "Ninja Warrior Obstacle",
    shortDescription:
      "Tunnel, pop-ups, and climb-through elements in one continuous course.",
    description:
      "Built for timed runs or casual relays. Popular for field days and teen-heavy guest lists.",
    startingPrice: 425,
    dimensions: '38\' L × 12\' W × 10\' H',
    imageSrc: "/inflatables/whackamole.jpg",
    imageAlt: "Inflatable ninja warrior style obstacle course",
    ageRecommendation: "Ages 6+; one direction of travel recommended.",
    setupRequirements: [
      "Long, level run with clear start and finish staging.",
      "Power within 75 ft of both ends if dual blowers are used.",
    ],
  },
  {
    slug: "boot-camp-challenge-course",
    categoryId: "obstacle-courses",
    title: "Boot Camp Challenge Course",
    shortDescription:
      "Military-camp styling with crawl, weave, and climb sections.",
    description:
      "Higher throughput than a single bounce—great when you need active entertainment for 40+ guests.",
    startingPrice: 465,
    dimensions: '42\' L × 14\' W × 11\' H',
    imageSrc: "/inflatables/ruby-falls.jpg",
    imageAlt: "Boot camp themed inflatable obstacle course",
    ageRecommendation: "Ages 7+; staggered starts for younger participants.",
    setupRequirements: [
      "Grass or turf preferred for full staking.",
      "Delivery path free of low wires and narrow gate issues.",
    ],
  },
  {
    slug: "bounce-slide-wet-dry-combo",
    categoryId: "combos",
    title: "Bounce Slide Wet–Dry Combo",
    shortDescription:
      "Jump area connected to a slide—run wet with a hose or dry for cooler days.",
    description:
      "One unit, two activities: bounce session plus slide runs. Switching wet/dry may require same-day setup notes—tell us when you book.",
    startingPrice: 345,
    dimensions: '28\' L × 16\' W × 15\' H',
    imageSrc: "/inflatables/sidessplash-waterslide.jpg",
    imageAlt: "Inflatable combo unit with bounce area and attached slide",
    ageRecommendation: "Ages 4+; water mode needs active adult supervision.",
    setupRequirements: [
      "Level surface; hose bib within 50 ft for wet mode.",
      "Standard outlet; confirm GFCI for outdoor circuits.",
    ],
  },
  {
    slug: "toddler-combo-playland",
    categoryId: "combos",
    title: "Toddler Combo Playland",
    shortDescription:
      "Low walls, small slide, and soft obstacles sized for younger guests.",
    description:
      "Keeps little ones contained and visible. Ideal alongside adult-sized units at family reunions.",
    startingPrice: 265,
    dimensions: '20\' L × 18\' W × 8\' H',
    imageSrc: "/inflatables/toddler-land.webp",
    imageAlt: "Toddler sized inflatable combo playland",
    ageRecommendation: "Ages 2–6; older siblings should use other units.",
    setupRequirements: [
      "Shaded or sunny placement OK; flat grass best.",
      "Parent seating nearby for easy supervision.",
    ],
  },
  {
    slug: "backyard-bash-package",
    categoryId: "event-packages",
    title: "Backyard Bash Package",
    shortDescription:
      "Bounce plus tables and lawn games—one quote for a typical home party.",
    description:
      "One quote for the essentials: inflatable, seating basics, and a lawn game set—ideal for hosts who want simplicity.",
    startingPrice: 349,
    dimensions: "Varies; bounce unit up to 16' footprint + game stations.",
    imageSrc: "/party-rentals/chairs.jpg",
    imageAlt: "Backyard party package with inflatable and games",
    ageRecommendation: "All ages; bounce portion follows unit guidelines.",
    setupRequirements: [
      "Delivery window confirmed 48 hours prior.",
      "Driveway or yard access for staging cart.",
    ],
  },
  {
    slug: "school-field-day-package",
    categoryId: "event-packages",
    title: "School Field Day Package",
    shortDescription:
      "Two inflatables plus a coordinated setup window built for field days.",
    description:
      "Higher throughput: two units, coordinated setup times, and optional generator add-on for remote fields.",
    startingPrice: 799,
    dimensions: "Combined footprint typically 40' × 35' (layout on site).",
    imageSrc: "/games/cornhole.jpg",
    imageAlt: "School field day inflatable package setup",
    ageRecommendation: "Grade bands can rotate; chaperones required.",
    setupRequirements: [
      "Site map with power locations; custodial unlock schedule.",
      "Flat field cleared of stakes and sprinkler heads marked.",
    ],
  },
  {
    slug: "church-festival-package",
    categoryId: "event-packages",
    title: "Church Festival Package",
    shortDescription:
      "Slide plus bounce with flow markers—turnkey for parking-lot festivals.",
    description:
      "Popular with fall festivals: high visibility layout and clear guest flow between attractions.",
    startingPrice: 949,
    dimensions: "Typical lot layout 45' × 40' with safety buffers.",
    imageSrc: "/games/dunk-tank.webp",
    imageAlt: "Church festival inflatable layout",
    ageRecommendation: "All ages; separate queues for slide vs. bounce.",
    setupRequirements: [
      "Lot section roped off prior to arrival when possible.",
      "Generator rental available if no shore power within 100 ft.",
    ],
  },
  {
    slug: "block-party-triple",
    categoryId: "event-packages",
    title: "Block Party Triple",
    shortDescription:
      "Three-piece layout: bounce, slide, and a shaded seating cluster.",
    description:
      "Designed for HOAs and street closures where you need variety without booking everything à la carte.",
    startingPrice: 1099,
    dimensions: "Street closure layout ~60' × 45' depending on slope.",
    imageSrc: "/games/cashcube.webp",
    imageAlt: "Neighborhood block party inflatable setup",
    ageRecommendation: "Mixed ages; timed sessions recommended over 40 guests.",
    setupRequirements: [
      "Permit copy emailed before delivery if municipality requires.",
      "Water optional for slide; can run dry with advance notice.",
    ],
  },
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

export function relatedRentals(rental: Rental, limit = 3): Rental[] {
  return RENTALS.filter(
    (r) => r.categoryId === rental.categoryId && r.slug !== rental.slug,
  ).slice(0, limit);
}
