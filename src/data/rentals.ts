export const CATEGORY_IDS = [
  "water-slides",
  "bounce-houses",
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
  "event-packages": {
    title: "Event Packages",
    blurb: "Flexible rental combinations for church groups, festivals, and parties.",
  },
};

export const RENTALS: Rental[] = [
  {
    slug: "tropical-tsunami",
    categoryId: "water-slides",
    title: "Tropical Tsunami",
    shortDescription:
      "A tall single-lane slide with splash landing—perfect for hot summer parties.",
    description:
      "Our Tropical Tsunami delivers big splash energy with a manageable footprint. Great when you want a headline slide without overwhelming smaller yards.",
    startingPrice: 325,
    dimensions: '28\' L × 12\' W × 18\' H',
    imageSrc:
      "https://images.unsplash.com/photo-1505142468610-359e7d316be0?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Colorful water slide at an outdoor summer party",
    ageRecommendation: "Ages 5+; adult supervision required for younger riders.",
    setupRequirements: [
      "Flat grass or level surface within 50 ft of power (standard outlet).",
      "Garden hose reach to slide landing area.",
      "Gate/opening at least 4 ft wide for rolled unit entry.",
    ],
  },
  {
    slug: "dual-lane-racer",
    categoryId: "water-slides",
    title: "Dual Lane Racer",
    shortDescription:
      "Two lanes, one winner—ideal for friendly races and larger guest lists.",
    description:
      "Two riders at a time keeps the line moving. Pairs beautifully with a bounce house add-on for mixed ages.",
    startingPrice: 385,
    dimensions: '32\' L × 16\' W × 20\' H',
    imageSrc:
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Outdoor festival with inflatables and green lawn",
    ageRecommendation: "Ages 6+ recommended for racing lanes.",
    setupRequirements: [
      "Level area free of sharp debris; stake points as needed.",
      "Dedicated hose bib; we provide the splitter and lead hoses.",
      "Clear vertical clearance for tall slide sections during inflation.",
    ],
  },
  {
    slug: "slip-n-splash-combo",
    categoryId: "water-slides",
    title: "Slip 'N Splash Combo",
    shortDescription:
      "Slide plus splash pool—compact combo that still feels like a full water day.",
    description:
      "All-in-one water fun when you want slide + splash without booking multiple pieces.",
    startingPrice: 295,
    dimensions: '24\' L × 14\' W × 15\' H',
    imageSrc:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Bright summer party setup outdoors",
    ageRecommendation: "Ages 4+ with adult supervision near water features.",
    setupRequirements: [
      "Grass preferred for anchoring; asphalt may require sandbags (we coordinate).",
      "Water source within 75 ft; GFCI outlet access.",
    ],
  },
  {
    slug: "hurricane-plunge",
    categoryId: "water-slides",
    title: "Hurricane Plunge",
    shortDescription:
      "Steep drop profile for thrill seekers—book early for peak weekends.",
    description:
      "The tallest option in our water lineup. Best for events with older kids and teens who want maximum excitement.",
    startingPrice: 425,
    dimensions: '34\' L × 15\' W × 22\' H',
    imageSrc:
      "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Outdoor celebration with colorful decorations",
    ageRecommendation: "Ages 8+; height and weight limits apply at setup.",
    setupRequirements: [
      "Wide delivery path; crew will walk through the placement plan on arrival.",
      "Dedicated 20A circuit if additional blowers are required.",
      "Hose and drain-friendly slope away from structures.",
    ],
  },
  {
    slug: "castle-kingdom",
    categoryId: "bounce-houses",
    title: "Castle Kingdom",
    shortDescription:
      "Classic castle bounce with generous jump area for birthdays and block parties.",
    description:
      "The evergreen favorite: bright, roomy, and easy for parents to supervise sightlines.",
    startingPrice: 195,
    dimensions: '15\' L × 15\' W × 14\' H',
    imageSrc:
      "https://images.unsplash.com/photo-1604881991720-f91add269bed?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Children playing at a colorful outdoor event",
    ageRecommendation: "Ages 3–12 typical; mixed ages OK with time splitting.",
    setupRequirements: [
      "Flat lawn or indoor gym with ceiling clearance noted in advance.",
      "Single dedicated outlet within 50 ft (no extension cords daisy-chained).",
    ],
  },
  {
    slug: "princess-palace",
    categoryId: "bounce-houses",
    title: "Princess Palace",
    shortDescription:
      "Pastel palace theme with wide entrance—photo-friendly for parties.",
    description:
      "Designed for picture-perfect parties while keeping the same safe bounce standards as our sport units.",
    startingPrice: 215,
    dimensions: '16\' L × 15\' W × 15\' H',
    imageSrc:
      "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Festive outdoor wedding or party celebration",
    ageRecommendation: "Ages 3–10; toddler sessions available on request.",
    setupRequirements: [
      "Level surface; remove yard toys and pet waste before delivery.",
      "Staking allowed; call 811 if you are unsure about underground lines.",
    ],
  },
  {
    slug: "sports-arena",
    categoryId: "bounce-houses",
    title: "Sports Arena",
    shortDescription:
      "Basketball hoop inside the bounce—great for school and team events.",
    description:
      "Keeps older kids engaged with light competition while still bouncing safely.",
    startingPrice: 225,
    dimensions: '17\' L × 16\' W × 15\' H',
    imageSrc:
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Soccer ball on grass field",
    ageRecommendation: "Ages 5–14; hoop play is optional and soft-foam only.",
    setupRequirements: [
      "Minimum pathway width 3.5 ft for rolled vinyl.",
      "Shade is nice but not required; avoid low tree branches over blower intake.",
    ],
  },
  {
    slug: "superhero-hq",
    categoryId: "bounce-houses",
    title: "Superhero HQ",
    shortDescription:
      "Bold comic styling with tall pillars—stands out at festivals.",
    description:
      "High visibility colors for large fields or parking lot setups with sandbag anchoring.",
    startingPrice: 235,
    dimensions: '18\' L × 16\' W × 16\' H',
    imageSrc:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Crowd at an outdoor concert or festival",
    ageRecommendation: "Ages 4–12; festival staff should monitor capacity.",
    setupRequirements: [
      "For hard surfaces, confirm sandbag plan when booking.",
      "Wind plan reviewed on delivery; safety comes first.",
    ],
  },
  {
    slug: "backyard-bash-bundle",
    categoryId: "event-packages",
    title: "Backyard Bash Bundle",
    shortDescription:
      "Bounce + tables & games bundle sized for typical residential parties.",
    description:
      "One quote for the essentials: inflatable, seating basics, and a lawn game set—ideal for hosts who want simplicity.",
    startingPrice: 349,
    dimensions: "Varies; bounce unit up to 16' footprint + game stations.",
    imageSrc:
      "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Outdoor gathering with people socializing",
    ageRecommendation: "All ages; bounce portion follows unit guidelines.",
    setupRequirements: [
      "Delivery window confirmed 48 hours prior.",
      "Driveway or yard access for staging cart.",
    ],
  },
  {
    slug: "school-fun-day",
    categoryId: "event-packages",
    title: "School Fun Day",
    shortDescription:
      "Two inflatables + attendant window—structured for field days.",
    description:
      "Built around higher throughput: two units, coordinated setup times, and optional generator add-on.",
    startingPrice: 799,
    dimensions: "Combined footprint typically 40' × 35' (layout on site).",
    imageSrc:
      "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "School building exterior on a sunny day",
    ageRecommendation: "Grade bands can rotate; chaperones required.",
    setupRequirements: [
      "Site map with power locations; custodial unlock schedule.",
      "Flat field cleared of stakes and sprinkler heads marked.",
    ],
  },
  {
    slug: "church-carnival-kit",
    categoryId: "event-packages",
    title: "Church Carnival Kit",
    shortDescription:
      "Slide + bounce + concession pathway markers—turnkey for parking lot events.",
    description:
      "Popular with fall festivals: high visibility layout and clear guest flow.",
    startingPrice: 949,
    dimensions: "Typical lot layout 45' × 40' with safety buffers.",
    imageSrc:
      "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Community gathering outdoors",
    ageRecommendation: "All ages; separate queues for slide vs. bounce.",
    setupRequirements: [
      "Lot section roped off prior to arrival when possible.",
      "Generator rental available if no shore power within 100 ft.",
    ],
  },
  {
    slug: "neighborhood-block-party",
    categoryId: "event-packages",
    title: "Neighborhood Block Party",
    shortDescription:
      "Three-piece package: bounce, slide wet/dry, and shade seating cluster.",
    description:
      "Designed for HOAs and street closures where you need variety without booking à la carte.",
    startingPrice: 1099,
    dimensions: "Street closure layout ~60' × 45' depending on slope.",
    imageSrc:
      "https://images.unsplash.com/photo-1523301343968-6a6ebf63c672?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "People enjoying an outdoor neighborhood event",
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
