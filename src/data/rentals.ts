/**
 * Rental inventory — built from real assets under /public/inflatables/.
 *
 * TODO(pricing): Replace category default startingPrice values with live quotes from operations.
 *
 * Regenerate file list after adding images: npm run inventory:sync
 *
 * Fields:
 * - id: Stable composite key `${categoryId}/${slug}` (use for analytics / future CMS).
 * - slug: URL segment; must be globally unique (bookings key off rental_item).
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
  "foam-parties",
  "accessories",
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
  "foam-parties": {
    title: "Foam Parties",
    blurb:
      "Bubble-filled foam party packages that can stand alone or pair with an inflatable rental.",
  },
  accessories: {
    title: "Accessories",
    blurb:
      "Tables, chairs, generators, concession machines, balloons, and party add-ons.",
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
  "foam-parties": "foam-parties",
  accessories: "accessories",
  "yard-games": "yard-games",
};

const DEFAULT_STARTING_PRICE: Record<RentalCategoryId, number> = {
  "bounce-houses": 175,
  combos: 225,
  "inflatable-games": 175,
  "obstacle-courses": 350,
  slides: 300,
  "water-slides": 350,
  "foam-parties": 200,
  accessories: 25,
  "yard-games": 125,
};

const ITEM_STARTING_PRICE: Record<string, number> = {
  castle: 150,
  "dalmation-bounce": 175,
  "dream-castle": 150,
  "jumbo-castle-bouncer": 185,
  "tiger-belly-bounce": 150,
  "candy-land-toddle-combo": 165,
  "cars-combo": 200,
  "castle-combo": 175,
  combo1: 175,
  "dream-combo": 175,
  "fairies-combo": 175,
  "island-breeze-combo": 240,
  "spongebob-combo": 175,
  "whoville-igloo-combo-grinch-themed-inflatable-bounce-house": 275,
  "world-of-disney": 175,
  "4-in-1-sports-game": 225,
  "floating-baseball-game": 75,
  "football-game": 75,
  "human-whackamole": 180,
  "hungry-hippo": 325,
  "jumpingjax-basketball-shootout": 225,
  "sports-star": 75,
  "call-of-duty-course": 225,
  "criss-cross-course": 350,
  "grinch-whoville-mayhem": 375,
  "offshore-obstacle-course": 450,
  "sports-course": 275,
  "toxic-course": 275,
  "18-ft-slide": 175,
  "18-ft-tropical-double-lane-slide": 325,
  "24-ft-slide": 225,
  "30-ft-long-rock-climb-slide": 200,
  "pirate-slide": 175,
  "princess-slide": 175,
  "sugar-rush-slide": 175,
  "18-ft-tropical-double-lane-waterslide": 450,
  "island-breeze-combo-waterslide": 300,
  "pirate-waterslide": 325,
  "princess-waterslide": 325,
  "foam-party": 200,
  "40in-helium-number-balloons": 10,
  "6-ft-table": 6,
  "8-ft-table": 8,
  chairs: 3,
  "cotton-candy": 85,
  "cotton-candy-birthday-package": 30,
  "dunk-tank": 190,
  generator: 100,
  "helium-latex-balloons": 10,
  "inflatable-birthday-chair": 75,
  "popcorn-machine": 100,
  "sno-cone": 85,
  "basketball-game": 105,
};

const LEGACY_WATERSLIDE_RENTALS: Rental[] = [
  {
    id: "water-slides/18-ft-basic-waterslide",
    slug: "18-ft-basic-waterslide",
    categoryId: "water-slides",
    title: "18' Basic Waterslide",
    shortDescription:
      "18' Basic Waterslide - classic backyard water slide fun for hot South Carolina days.",
    description:
      "Reserve 18' Basic Waterslide for your next South Carolina event. This classic water slide keeps guests cool with a straightforward climb, slide, and splash setup. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
    startingPrice: 325,
    imageSrc: "/inflatables/waterslides/legacy/18-ft-basic-waterslide.jpg",
    imageAlt: "18' Basic Waterslide rental from Jumping Jax",
    ageRecommendation:
      "Ages 5+ with swimming comfort; adult supervision required near water landing areas.",
    setupRequirements: setupForCategory("water-slides"),
  },
  {
    id: "water-slides/22-ft-hurricane-waterslide",
    slug: "22-ft-hurricane-waterslide",
    categoryId: "water-slides",
    title: "22' Hurricane Waterslide",
    shortDescription:
      "22' Hurricane Waterslide - tall summer slide with a bigger thrill factor.",
    description:
      "Reserve 22' Hurricane Waterslide for your next South Carolina event. This taller water slide is a strong fit for birthdays, schools, churches, and summer gatherings that need a bigger splash. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
    startingPrice: 400,
    imageSrc: "/inflatables/waterslides/legacy/22-ft-hurricane-waterslide.jpg",
    imageAlt: "22' Hurricane Waterslide rental from Jumping Jax",
    ageRecommendation:
      "Ages 5+ with swimming comfort; adult supervision required near water landing areas.",
    setupRequirements: setupForCategory("water-slides"),
  },
  {
    id: "water-slides/22-ft-tropical-hurricane-waterslide",
    slug: "22-ft-tropical-hurricane-waterslide",
    categoryId: "water-slides",
    title: "22' Tropical Hurricane Waterslide",
    shortDescription:
      "22' Tropical Hurricane Waterslide - premium tall water slide with an extended lane.",
    description:
      "Reserve 22' Tropical Hurricane Waterslide for your next South Carolina event. This premium tall water slide brings bright tropical styling, big summer energy, and an extended lane for a longer ride. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
    startingPrice: 450,
    imageSrc: "/inflatables/waterslides/legacy/22-ft-tropical-hurricane-waterslide.jpg",
    imageAlt: "22' Tropical Hurricane Waterslide rental from Jumping Jax",
    ageRecommendation:
      "Ages 5+ with swimming comfort; adult supervision required near water landing areas.",
    setupRequirements: setupForCategory("water-slides"),
  },
  {
    id: "water-slides/double-lane-18ft-waterslide",
    slug: "double-lane-18ft-waterslide",
    categoryId: "water-slides",
    title: "Double Lane 18ft Waterslide",
    shortDescription:
      "Double Lane 18ft Waterslide - two lanes for side-by-side racing and splashdowns.",
    description:
      "Reserve Double Lane 18ft Waterslide for your next South Carolina event. Two slide lanes keep the line moving and add friendly racing energy for backyard parties and group events. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
    startingPrice: 450,
    imageSrc: "/inflatables/waterslides/legacy/double-lane-18ft-waterslide.jpg",
    imageAlt: "Double Lane 18ft Waterslide rental from Jumping Jax",
    ageRecommendation:
      "Ages 5+ with swimming comfort; adult supervision required near water landing areas.",
    setupRequirements: setupForCategory("water-slides"),
  },
  {
    id: "water-slides/double-splash-waterslide",
    slug: "double-splash-waterslide",
    categoryId: "water-slides",
    title: "Double Splash Waterslide",
    shortDescription:
      "Double Splash Waterslide - 15-foot compact water fun with a friendly price point.",
    description:
      "Reserve Double Splash Waterslide for your next South Carolina event. This 15-foot waterslide is a good fit when you want summer fun without the footprint of the tallest units. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
    startingPrice: 250,
    imageSrc: "/inflatables/waterslides/legacy/double-splash-waterslide.jpg",
    imageAlt: "Double Splash Waterslide rental from Jumping Jax",
    ageRecommendation:
      "Ages 5+ with swimming comfort; adult supervision required near water landing areas.",
    setupRequirements: setupForCategory("water-slides"),
  },
  {
    id: "water-slides/mini-tiki-plunge",
    slug: "mini-tiki-plunge",
    categoryId: "water-slides",
    title: "Mini Tiki Plunge",
    shortDescription:
      "Mini Tiki Plunge - 15-foot water slide option for younger guests.",
    description:
      "Reserve Mini Tiki Plunge for your next South Carolina event. This 15-foot waterslide option is friendly for younger kids and tighter spaces while still keeping the party cool. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
    startingPrice: 200,
    imageSrc: "/inflatables/waterslides/legacy/mini-tiki-plunge.jpg",
    imageAlt: "Mini Tiki Plunge rental from Jumping Jax",
    ageRecommendation:
      "Ages 4+ with active adult supervision near water landing areas.",
    setupRequirements: setupForCategory("water-slides"),
  },
  {
    id: "water-slides/mini-waterslide",
    slug: "mini-waterslide",
    categoryId: "water-slides",
    title: "Mini Waterslide",
    shortDescription:
      "Mini Waterslide - 12-foot splash option for younger parties and tighter yards.",
    description:
      "Reserve Mini Waterslide for your next South Carolina event. This compact 12-foot water slide is a good fit for younger children and smaller setup areas. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
    startingPrice: 175,
    imageSrc: "/inflatables/waterslides/legacy/mini-waterslide.jpg",
    imageAlt: "Mini Waterslide rental from Jumping Jax",
    ageRecommendation:
      "Ages 4+ with active adult supervision near water landing areas.",
    setupRequirements: setupForCategory("water-slides"),
  },
  {
    id: "water-slides/mini-waterslide-2",
    slug: "mini-waterslide-2",
    categoryId: "water-slides",
    title: "Mini Waterslide 2",
    shortDescription:
      "Mini Waterslide 2 - compact water slide for younger summer celebrations.",
    description:
      "Reserve Mini Waterslide 2 for your next South Carolina event. This compact water slide gives younger guests a fun way to cool off without requiring a large yard. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
    startingPrice: 175,
    imageSrc: "/inflatables/waterslides/legacy/mini-waterslide-2.jpg",
    imageAlt: "Mini Waterslide 2 rental from Jumping Jax",
    ageRecommendation:
      "Ages 4+ with active adult supervision near water landing areas.",
    setupRequirements: setupForCategory("water-slides"),
  },
  {
    id: "water-slides/purple-hurricane-18ft",
    slug: "purple-hurricane-18ft",
    categoryId: "water-slides",
    title: "Purple Hurricane 18ft",
    shortDescription:
      "Purple Hurricane 18ft - colorful water slide with a strong summer party look.",
    description:
      "Reserve Purple Hurricane 18ft for your next South Carolina event. This colorful 18-foot waterslide is a strong choice for birthdays, school events, and backyard summer parties. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
    startingPrice: 350,
    imageSrc: "/inflatables/waterslides/legacy/purple-hurricane-18ft.jpg",
    imageAlt: "Purple Hurricane 18ft waterslide rental from Jumping Jax",
    ageRecommendation:
      "Ages 5+ with swimming comfort; adult supervision required near water landing areas.",
    setupRequirements: setupForCategory("water-slides"),
  },
  {
    id: "water-slides/rampage-doublelane-waterslide",
    slug: "rampage-doublelane-waterslide",
    categoryId: "water-slides",
    title: "Rampage Doublelane Waterslide",
    shortDescription:
      "Rampage Doublelane Waterslide - 20-foot dual-lane racing waterslide.",
    description:
      "Reserve Rampage Doublelane Waterslide for your next South Carolina event. The Rampage features two 20-foot slide lanes and a curling ramp at the bottom for thrill-seeking guests who want to beat the heat. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
    startingPrice: 375,
    imageSrc: "/inflatables/waterslides/legacy/rampage-doublelane-waterslide.jpg",
    imageAlt: "Rampage Doublelane Waterslide rental from Jumping Jax",
    ageRecommendation:
      "Ages 5+ with swimming comfort; adult supervision required near water landing areas.",
    setupRequirements: setupForCategory("water-slides"),
  },
  {
    id: "water-slides/ruby-falls-waterslide-with-deep-pool",
    slug: "ruby-falls-waterslide-with-deep-pool",
    categoryId: "water-slides",
    title: "Ruby Falls Waterslide with Deep Pool",
    shortDescription:
      "Ruby Falls Waterslide with Deep Pool - 19-foot water slide ending in a deeper splash pool.",
    description:
      "Reserve Ruby Falls Waterslide with Deep Pool for your next South Carolina event. This 19-foot waterslide adds a bigger splash pool experience for hot summer celebrations. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
    startingPrice: 350,
    imageSrc: "/inflatables/waterslides/legacy/ruby-falls-waterslide-with-deep-pool.jpg",
    imageAlt: "Ruby Falls Waterslide with Deep Pool rental from Jumping Jax",
    ageRecommendation:
      "Ages 5+ with swimming comfort; adult supervision required near water landing areas.",
    setupRequirements: setupForCategory("water-slides"),
  },
];

const FOAM_PARTY_RENTALS: Rental[] = [
  {
    id: "foam-parties/foam-party",
    slug: "foam-party",
    categoryId: "foam-parties",
    title: "Foam Party",
    shortDescription:
      "Foam party packages with 30-minute, 1-hour, and 2-hour booking options.",
    description:
      "Book a Jumping Jax foam party as a standalone event or as an add-on with inflatables. Foam parties include the foam setup and operator time for the selected package, with delivery priced the same as rentals.",
    startingPrice: 200,
    imageSrc: "/inflatables/foam-parties/foam-parties.jpg",
    imageAlt: "Jumping Jax foam party setup",
    ageRecommendation:
      "All ages with adult supervision; guests should expect wet, slippery foam play.",
    setupRequirements: [
      "Recommended foam play area is about 30 ft x 30 ft, with safe drainage and permission for foam/water use.",
      "Foam party space must be completely cleared before setup: no toys, sticks, rocks, yard debris, trash, or dog poop. Guests will be rolling, sliding, and playing in this area.",
      "Standard 120V outlet within 50 ft and access to a water source or hose reach.",
      "Clear path for delivery and enough open space for guests to move safely.",
    ],
  },
];

const ACCESSORY_RENTALS: Rental[] = [
  {
    slug: "40in-helium-number-balloons",
    title: "40in Helium Number Balloons",
    startingPrice: 10,
    imageSrc: "/inflatables/accessories/40in-helium-number-balloons.jpg",
  },
  {
    slug: "6-ft-table",
    title: "6 Ft Table",
    startingPrice: 6,
    imageSrc: "/inflatables/accessories/6-ft-table.jpg",
  },
  {
    slug: "8-ft-table",
    title: "8 Ft Table",
    startingPrice: 8,
    imageSrc: "/inflatables/accessories/8-ft-table.jpg",
  },
  {
    slug: "chairs",
    title: "Chairs",
    startingPrice: 3,
    imageSrc: "/inflatables/accessories/chairs.jpg",
  },
  {
    slug: "cotton-candy",
    title: "Cotton Candy",
    startingPrice: 85,
    imageSrc: "/inflatables/accessories/cotton-candy.jpg",
  },
  {
    slug: "cotton-candy-birthday-package",
    title: "Cotton Candy Birthday Package",
    startingPrice: 30,
    imageSrc: "/inflatables/accessories/cotton-candy-birthday-package.jpg",
  },
  {
    slug: "dunk-tank",
    title: "Dunk Tank",
    startingPrice: 190,
    imageSrc: "/inflatables/accessories/dunk-tank.jpg",
  },
  {
    slug: "generator",
    title: "Generator",
    startingPrice: 100,
    imageSrc: "/inflatables/accessories/generator.jpg",
  },
  {
    slug: "helium-latex-balloons",
    title: "Helium Latex Balloons",
    startingPrice: 10,
    imageSrc: "/inflatables/accessories/helium-latex-balloons.jpg",
  },
  {
    slug: "inflatable-birthday-chair",
    title: "Inflatable Birthday Chair",
    startingPrice: 75,
    imageSrc: "/inflatables/accessories/inflatable-birthday-chair.jpg",
  },
  {
    slug: "popcorn-machine",
    title: "Popcorn Machine",
    startingPrice: 100,
    imageSrc: "/inflatables/accessories/popcorn-machine.jpg",
  },
  {
    slug: "sno-cone",
    title: "Sno Cone",
    startingPrice: 85,
    imageSrc: "/inflatables/accessories/sno-cone.jpg",
  },
].map((item): Rental => ({
  id: `accessories/${item.slug}`,
  slug: item.slug,
  categoryId: "accessories",
  title: item.title,
  shortDescription: `${item.title} - party accessory rental that pairs well with inflatables and foam parties.`,
  description: `Add ${item.title} to your Jumping Jax booking. Accessories can be rented with inflatables, foam parties, or other event packages, and Jumping Jax will confirm quantities and details after reviewing your request.`,
  startingPrice: item.startingPrice,
  imageSrc: item.imageSrc,
  imageAlt: `${item.title} rental from Jumping Jax`,
  ageRecommendation: "All ages with host supervision and normal event safety rules.",
  setupRequirements: setupForCategory("accessories"),
}));

const TITLE_OVERRIDES: Record<string, string> = {
  "dalmation-bounce": "Dalmatian Bounce House",
  "jumpingjax-basketball-shootout": "Jumping Jax Basketball Shootout",
  "human-whackamole": "Human Whac-A-Mole",
  "4-in-1-sports-game": "4-in-1 Sports Game",
  "candy-land-toddle-combo": "Candy Land Toddler Combo",
  combo1: "Combo Bounce & Slide",
};

const SHORT_DESCRIPTION_OVERRIDES: Record<string, string> = {
  "dalmation-bounce":
    "Dalmatian Bounce House - great for Paw Patrol themed parties and fireman themed parties.",
  "jumbo-castle-bouncer":
    "Jumbo Castle Bouncer - extra large bounce area for classic birthday party fun.",
  "candy-land-toddle-combo":
    "Candy Land Toddler Combo - dry unit only, recommended for children 5 and under.",
  "cars-combo":
    "Cars Combo - small bounce area, basketball goal, tunnel, obstacles, climb, and slide.",
  "castle-combo":
    "Castle Combo - dry unit only with a bounce area, twister spots, basketball goal, and outside slide.",
  "18-ft-tropical-double-lane-waterslide":
    "18 Ft Tropical Double Lane Waterslide - built for side-by-side racing.",
  "island-breeze-combo-waterslide":
    "Island Breeze Combo Waterslide - large bounce area, basketball goal, climb, and waterslide.",
  "pirate-waterslide":
    "Pirate Waterslide - 18-foot water slide with a splash pool at the end.",
  "princess-waterslide":
    "Princess Waterslide - 18-foot water slide for princess parties and girls-just-wanna-have-fun birthdays.",
  "18-ft-tropical-double-lane-slide":
    "18 Ft Tropical Double Lane Slide - side-by-side racing fun for dry events.",
  "30-ft-long-rock-climb-slide":
    "30 Ft Long Rock Climb Slide - enter the tunnel, climb the wall, and slide as you race your opponent.",
  "pirate-slide":
    "Pirate Slide - kids can use their imagination while playing on the pirate slide.",
  "criss-cross-course":
    "Criss Cross Course - race your opponent through crossover obstacles, climbs, and slides.",
  "grinch-whoville-mayhem":
    "Grinch Whoville Mayhem - great for holiday parties, Christmas, and Christmas in July.",
  "offshore-obstacle-course":
    "Offshore Obstacle Course - race-ready course that can be used wet or dry.",
  "toxic-course":
    "Toxic Course - race uphill through obstacles, climb to the steps, and slide down.",
  "4-in-1-sports-game":
    "4-in-1 Sports Game - includes baseball, football, basketball, and soccer.",
  "human-whackamole":
    "Human Whac-A-Mole - accommodates seven people at one time for fast group fun.",
  "jumpingjax-basketball-shootout":
    "Jumping Jax Basketball Shootout - eight goals to keep shooters moving.",
  "basketball-game": "Basketball Game - compete one on one.",
};

const DESCRIPTION_OVERRIDES: Record<string, string> = {
  "dalmation-bounce":
    "Reserve Dalmatian Bounce House for your next South Carolina event. This classic bounce house is great for Paw Patrol themed parties, fireman themed parties, and young guests who want a bright jump area. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "jumbo-castle-bouncer":
    "Reserve Jumbo Castle Bouncer for your next South Carolina event. The extra large bounce area gives kids more room to jump, play, and burn energy during birthday parties, school events, and family celebrations. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "candy-land-toddle-combo":
    "Reserve Candy Land Toddler Combo for your next South Carolina event. This dry unit is recommended for children 5 and under and gives younger guests a toddler-friendly bounce and slide experience. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "cars-combo":
    "Reserve Cars Combo for your next South Carolina event. This combo has a small bounce area with a basketball goal, a tunnel that goes under the slide, obstacles to go through, and then a climb and slide. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "castle-combo":
    "Reserve Castle Combo for your next South Carolina event. This dry unit has a bounce area with colored spots for twister play, a basketball goal, and a small climbing slide that exits on the outside. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "18-ft-tropical-double-lane-waterslide":
    "Reserve 18 Ft Tropical Double Lane Waterslide for your next South Carolina event. Two lanes make it perfect for side-by-side racing, keeping the line moving and the party energy high. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "island-breeze-combo-waterslide":
    "Reserve Island Breeze Combo Waterslide for your next South Carolina event. It has a large bounce area, a basketball goal, and a fun climb and waterslide for guests who want more than one way to play. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "pirate-waterslide":
    "Reserve Pirate Waterslide for your next South Carolina event. This 18-foot waterslide lets kids use their imagination while sliding into the splash pool at the end. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "princess-waterslide":
    "Reserve Princess Waterslide for your next South Carolina event. Treat her like a princess with this 18-foot waterslide made for bright birthdays, dress-up themes, and girls-just-wanna-have-fun parties. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "18-ft-tropical-double-lane-slide":
    "Reserve 18 Ft Tropical Double Lane Slide for your next South Carolina event. The dual-lane design adds side-by-side racing for dry events, school days, and backyard parties. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "30-ft-long-rock-climb-slide":
    "Reserve 30 Ft Long Rock Climb Slide for your next South Carolina event. Enter the tunnel, climb the wall, and slide as you race your opponent to the finish. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "pirate-slide":
    "Reserve Pirate Slide for your next South Carolina event. Kids can use their imagination while playing on the pirate slide, making it a strong fit for themed birthdays and dry events. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "criss-cross-course":
    "Reserve Criss Cross Course for your next South Carolina event. Race your opponent through the obstacles, cross over, climb to the top, cross over again, and slide down to see who can finish first. It is great for one-on-one competition, and our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "grinch-whoville-mayhem":
    "Reserve Grinch Whoville Mayhem for your next South Carolina event. This course is great for holiday parties, Christmas, and Christmas in July, and it can be used wet or dry. It is also great for one-on-one competition, and our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "offshore-obstacle-course":
    "Reserve Offshore Obstacle Course for your next South Carolina event. This course can be used wet or dry and is great for one-on-one competition, relays, schools, churches, and large parties. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "toxic-course":
    "Reserve Toxic Course for your next South Carolina event. Race your opponent through obstacles while running uphill to get to the steps, then slide down to the finish. It is great for one-on-one competition, and our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "4-in-1-sports-game":
    "Reserve 4-in-1 Sports Game for your next South Carolina event. This inflatable game includes baseball, football, basketball, and soccer so guests can rotate through multiple sports challenges. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "human-whackamole":
    "Reserve Human Whac-A-Mole for your next South Carolina event. This game can accommodate seven people at one time and keeps guests entertained with quick, silly group competition. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "jumpingjax-basketball-shootout":
    "Reserve Jumping Jax Basketball Shootout for your next South Carolina event. It has eight goals to shoot at, making it a high-capacity basketball challenge for schools, churches, birthdays, and festivals. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
  "basketball-game":
    "Reserve Basketball Game for your next South Carolina event. Compete one on one with a simple crowd-friendly yard game that pairs well with inflatables, foam parties, and concessions. Our crew handles delivery, inflation, and safety review so you can focus on your guests.",
};

const AGE_RECOMMENDATION_OVERRIDES: Record<string, string> = {
  "candy-land-toddle-combo":
    "Recommended for children 5 and under; adult supervision required.",
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
    combos: `${title} - large bounce area, basketball goal, and small climb and slide in one unit.`,
    "inflatable-games": `${title} — keeps guests active and rotating; great alongside a bounce or slide.`,
    "obstacle-courses": `${title} - great for one-on-one competition, relays, and timed runs.`,
    slides: `${title} — tall slide presence without water requirements; great for dry events and cooler days.`,
    "water-slides": `${title} — summer-ready water fun; hose and power placement confirmed before delivery.`,
    "yard-games": `${title} — pairs well with inflatables for festivals, churches, and backyard parties.`,
    "foam-parties": `${title} - bubble-filled foam fun for standalone parties or inflatable add-ons.`,
    accessories: `${title} - add-on rental that helps round out the party setup.`,
  };
  return templates[categoryId];
}

function longDescription(categoryId: RentalCategoryId, title: string): string {
  return `Reserve ${title} for your next South Carolina event. ${shortBlurb(categoryId, title)} Our crew handles delivery, inflation, and safety review so you can focus on your guests.`;
}

function shortDescriptionForRental(
  slug: string,
  categoryId: RentalCategoryId,
  title: string,
): string {
  return SHORT_DESCRIPTION_OVERRIDES[slug] ?? shortBlurb(categoryId, title);
}

function descriptionForRental(
  slug: string,
  categoryId: RentalCategoryId,
  title: string,
): string {
  return DESCRIPTION_OVERRIDES[slug] ?? longDescription(categoryId, title);
}

function ageRecommendationForRental(
  slug: string,
  categoryId: RentalCategoryId,
): string {
  return AGE_RECOMMENDATION_OVERRIDES[slug] ?? ageForCategory(categoryId);
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
    case "foam-parties":
      return "All ages with adult supervision; guests should expect wet, slippery foam play.";
    case "accessories":
      return "All ages with host supervision and normal event safety rules.";
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
  if (categoryId === "foam-parties") {
    return [
      "Level outdoor setup area with safe drainage and permission for foam/water use.",
      "Recommended foam play area is about 30 ft x 30 ft.",
      "Foam party space must be completely cleared before setup: no toys, sticks, rocks, yard debris, trash, or dog poop. Guests will be rolling, sliding, and playing in this area.",
      "Standard 120V outlet within 50 ft and access to a water source or hose reach.",
      "Clear path for delivery and enough open space for guests to move safely.",
    ];
  }
  if (categoryId === "accessories") {
    return [
      "Customer should confirm quantity needed in the booking notes or by phone.",
      "Tables, chairs, concessions, generators, and balloons require a clean, level setup area.",
      "Concession machines and generators may require power, fuel, supplies, or staff confirmation before final approval.",
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
  const list: Rental[] = [
    ...LEGACY_WATERSLIDE_RENTALS,
    ...FOAM_PARTY_RENTALS,
    ...ACCESSORY_RENTALS,
  ];

  for (const row of INFLATABLE_MANIFEST) {
    const categoryId = FOLDER_TO_CATEGORY_ID[row.categoryFolder];
    if (!categoryId) continue;

    const stem = fileStem(row.file);
    const slug = slugFromStem(stem);
    if (list.some((r) => r.slug === slug)) continue;
    const title = inferTitle(stem);
    const imageSrc = `/inflatables/${row.categoryFolder}/${row.file}`;

    list.push({
      id: `${categoryId}/${slug}`,
      slug,
      categoryId,
      title,
      shortDescription: shortDescriptionForRental(slug, categoryId, title),
      description: descriptionForRental(slug, categoryId, title),
      startingPrice: ITEM_STARTING_PRICE[slug] ?? DEFAULT_STARTING_PRICE[categoryId],
      imageSrc,
      imageAlt: `${title} inflatable rental from Jumping Jax`,
      ageRecommendation: ageRecommendationForRental(slug, categoryId),
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
  src: "/hero.jpg",
  alt: "A large Jumping Jax tropical waterslide set up outdoors",
} as const;

/** Rentals hub: high-intent categories first for conversion browsing. */
export const CATEGORY_BROWSE_ORDER: RentalCategoryId[] = [
  "water-slides",
  "foam-parties",
  "accessories",
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
  "foam-parties": "foam-party",
  accessories: "generator",
  "bounce-houses": "dream-castle",
  combos: "world-of-disney",
  slides: "30-ft-long-rock-climb-slide",
  "obstacle-courses": "offshore-obstacle-course",
  "inflatable-games": "human-whackamole",
  "yard-games": "basketball-game",
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

/**
 * Categories whose units are actual air-filled inflatables requiring blower
 * power at setup. Excludes foam parties, accessories (tables/chairs/
 * generators/concessions/balloons), and yard games (dunk tank, basketball
 * game) — none of those are inflatable units.
 */
const INFLATABLE_CATEGORY_IDS: ReadonlySet<RentalCategoryId> = new Set([
  "bounce-houses",
  "combos",
  "inflatable-games",
  "obstacle-courses",
  "slides",
  "water-slides",
]);

export function isInflatableRental(rental: Pick<Rental, "categoryId">): boolean {
  return INFLATABLE_CATEGORY_IDS.has(rental.categoryId);
}

export function isWaterslideRental(rental: Pick<Rental, "categoryId">): boolean {
  return rental.categoryId === "water-slides";
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
  const accessoryAddOns = [
    getRentalBySlug("generator"),
    getRentalBySlug("cotton-candy"),
    getRentalBySlug("popcorn-machine"),
  ].filter((r): r is Rental => Boolean(r));

  if (rental.slug === "foam-party") {
    return accessoryAddOns.slice(0, limit);
  }

  if (rental.categoryId === "accessories") {
    return RENTALS.filter(
      (r) => r.categoryId === "accessories" && r.slug !== rental.slug,
    ).slice(0, limit);
  }

  const sameCategory = RENTALS.filter(
    (r) => r.categoryId === rental.categoryId && r.slug !== rental.slug,
  );
  const foamParty = getRentalBySlug("foam-party");
  const suggestedAddOns = [
    ...(foamParty ? [foamParty] : []),
    ...accessoryAddOns,
    ...sameCategory,
  ];
  return suggestedAddOns.slice(0, limit);
}
