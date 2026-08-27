import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CATEGORY_COPY,
  CATEGORY_IDS,
  isCategoryId,
  type RentalCategoryId,
} from "@/data/rentals";
import { RentalCard } from "@/components/rentals/RentalCard";
import { loadWebsiteRentalsInCategory } from "@/lib/rentals/public-catalog";
import {
  createJsonLdScript,
  generateBreadcrumbSchema,
  generateItemListSchema,
  generateMetadata as buildPageMetadata,
  getCanonicalUrl,
} from "@/lib/metadata";

type Props = { params: Promise<{ category: string }> };

type CategorySeoCopy = {
  title: string;
  heading: string;
  description: string;
  intro: string;
  keywords: string[];
};

const CATEGORY_SEO_COPY: Record<RentalCategoryId, CategorySeoCopy> = {
  "bounce-houses": {
    title: "Bounce House Rentals in Greenwood, SC",
    heading: "Bounce House Rentals in Greenwood, SC",
    description:
      "Rent clean bounce houses from Jumping Jax for birthdays, schools, churches, and events in Greenwood, SC and nearby communities.",
    intro:
      "Choose a clean, colorful bounce house rental for your Greenwood-area birthday, school event, church gathering, or family celebration.",
    keywords: [
      "bounce house rentals Greenwood SC",
      "bounce house rental near me",
      "inflatable house rental",
    ],
  },
  combos: {
    title: "Bounce House & Slide Combo Rentals in Greenwood, SC",
    heading: "Bounce House & Slide Combo Rentals in Greenwood, SC",
    description:
      "Browse bounce house and slide combo rentals from Jumping Jax for parties and events in Greenwood, SC and nearby communities.",
    intro:
      "Get more ways to play in one inflatable with a bounce house and slide combo delivered around Greenwood, South Carolina.",
    keywords: [
      "bounce house with slide rental Greenwood SC",
      "inflatable combo rental",
      "bounce and slide rental near me",
    ],
  },
  "inflatable-games": {
    title: "Inflatable Game Rentals in Greenwood, SC",
    heading: "Inflatable Game Rentals in Greenwood, SC",
    description:
      "Rent interactive inflatable games from Jumping Jax for schools, churches, festivals, and parties around Greenwood, SC.",
    intro:
      "Keep guests moving and competing with interactive inflatable game rentals for Greenwood-area parties and group events.",
    keywords: [
      "inflatable game rentals Greenwood SC",
      "interactive inflatable rentals",
      "party game rentals near me",
    ],
  },
  "obstacle-courses": {
    title: "Inflatable Obstacle Course Rentals in Greenwood, SC",
    heading: "Inflatable Obstacle Course Rentals in Greenwood, SC",
    description:
      "Rent inflatable obstacle courses from Jumping Jax for field days, festivals, churches, schools, and events around Greenwood, SC.",
    intro:
      "Plan a race-ready event with an inflatable obstacle course rental delivered and set up across the Greenwood service area.",
    keywords: [
      "inflatable obstacle course rental Greenwood SC",
      "obstacle course rental",
      "inflatable obstacle course near me",
    ],
  },
  slides: {
    title: "Dry Slide Rentals in Greenwood, SC",
    heading: "Dry Slide Rentals in Greenwood, SC",
    description:
      "Rent large dry inflatable slides from Jumping Jax for parties, schools, churches, and events in Greenwood, SC.",
    intro:
      "Bring height, speed, and big-event energy to your celebration with a dry inflatable slide rental in Greenwood, South Carolina.",
    keywords: [
      "dry slide rentals Greenwood SC",
      "inflatable slide rental",
      "giant slide rental near me",
    ],
  },
  "water-slides": {
    title: "Water Slide Rentals in Greenwood, SC",
    heading: "Water Slide Rentals in Greenwood, SC",
    description:
      "Rent inflatable water slides from Jumping Jax for summer birthdays and events in Greenwood, SC and nearby communities.",
    intro:
      "Cool down your next party with an inflatable water slide rental delivered and professionally set up throughout the Greenwood area.",
    keywords: [
      "water slide rentals Greenwood SC",
      "water slide rental near me",
      "inflatable water slide rental",
    ],
  },
  "foam-parties": {
    title: "Foam Party Rentals in Greenwood, SC",
    heading: "Foam Party Rentals in Greenwood, SC",
    description:
      "Book a foam party rental from Jumping Jax for birthdays, schools, churches, and summer events in Greenwood, SC.",
    intro:
      "Turn your Greenwood-area celebration into a bubble-filled experience with a standalone foam party or an inflatable add-on.",
    keywords: [
      "foam party rental Greenwood SC",
      "foam party near me",
      "kids foam party",
    ],
  },
  accessories: {
    title: "Party Rental Accessories in Greenwood, SC",
    heading: "Party Rental Accessories in Greenwood, SC",
    description:
      "Add tables, chairs, generators, concessions, balloons, and other party rental accessories to your Greenwood, SC event.",
    intro:
      "Finish your event setup with practical party rental accessories delivered with your Jumping Jax reservation.",
    keywords: [
      "party rental accessories Greenwood SC",
      "party equipment rentals",
      "event accessories near me",
    ],
  },
  "yard-games": {
    title: "Yard Game Rentals in Greenwood, SC",
    heading: "Yard Game Rentals in Greenwood, SC",
    description:
      "Rent yard games from Jumping Jax for birthdays, company events, schools, and celebrations around Greenwood, SC.",
    intro:
      "Add easy, mixed-age entertainment to your event with yard game rentals available across the Greenwood service area.",
    keywords: [
      "yard game rentals Greenwood SC",
      "outdoor party game rentals",
      "event games near me",
    ],
  },
};

const POPULAR_LOCAL_LINKS = [
  { href: "/rentals/bounce-houses", label: "Bounce house rentals" },
  { href: "/rentals/water-slides", label: "Water slide rentals" },
  { href: "/rentals/foam-parties", label: "Foam party rentals" },
  { href: "/facility-parties", label: "Kids' birthday party venue" },
] as const;

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return CATEGORY_IDS.map((category) => ({ category }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  if (!isCategoryId(category)) return { title: "Rentals | Jumping Jax" };
  const seo = CATEGORY_SEO_COPY[category];
  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    canonicalUrl: getCanonicalUrl(`/rentals/${category}`),
    keywords: seo.keywords,
  });
}

export default async function RentalCategoryPage({ params }: Props) {
  const { category } = await params;
  if (!isCategoryId(category)) notFound();

  const copy = CATEGORY_COPY[category];
  const seo = CATEGORY_SEO_COPY[category];
  const rentals = await loadWebsiteRentalsInCategory(category);
  const categoryPath = `/rentals/${category}`;

  return (
    <main className="min-h-screen scroll-smooth overflow-x-hidden bg-cyan-50 px-4 pb-24 pt-8 text-slate-950 sm:px-6 sm:pt-10 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={createJsonLdScript([
          generateBreadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Rentals", path: "/rentals" },
            { name: copy.title, path: categoryPath },
          ]),
          generateItemListSchema(
            `${copy.title} rentals in Greenwood, SC`,
            copy.blurb,
            categoryPath,
            rentals.map((rental) => ({
              name: rental.title,
              path: `/rentals/${rental.categoryId}/${rental.slug}`,
              image: rental.imageSrc,
            })),
          ),
        ])}
      />
      <section className="mx-auto max-w-6xl">
        <nav
          className="text-sm font-semibold text-slate-500"
          aria-label="Breadcrumb"
        >
          <Link
            href="/rentals"
            className="text-pink-700 underline-offset-2 hover:text-pink-900 hover:underline"
          >
            Rentals
          </Link>
          <span className="mx-2 text-slate-600" aria-hidden>
            /
          </span>
          <span className="text-slate-700">{copy.title}</span>
        </nav>

        <header className="mt-8 max-w-3xl rounded-3xl border-2 border-pink-200 bg-white px-5 py-8 shadow-[0_14px_36px_rgba(6,182,212,0.14)] sm:px-8">
          <span className="inline-flex rounded-full border border-pink-200 bg-pink-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-pink-800">
            {copy.title}
          </span>
          <h1 className="mt-4 text-balance text-3xl font-black tracking-tight sm:text-5xl">
            {seo.heading}
          </h1>
          <p className="mt-4 text-pretty text-base leading-7 text-slate-600 sm:text-lg">
            {copy.blurb}
          </p>
          <p className="mt-3 text-pretty text-sm font-semibold leading-6 text-slate-700 sm:text-base">
            {seo.intro}
          </p>
          <p className="mt-4 text-sm font-medium text-slate-500">
            {rentals.length} {rentals.length === 1 ? "unit" : "units"} available ·
            tap a card for details & booking
          </p>
        </header>

        <div className="mt-12 grid auto-rows-fr gap-7 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3 lg:gap-9">
          {rentals.map((rental, index) => (
            <RentalCard
              key={rental.id}
              rental={rental}
              imagePriority={index < 2}
            />
          ))}
        </div>

        <aside className="mt-14 rounded-3xl border-2 border-cyan-200 bg-white px-5 py-8 shadow-[0_14px_36px_rgba(6,182,212,0.12)] sm:px-8">
          <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            More party options around Greenwood
          </h2>
          <p className="mt-3 max-w-3xl text-pretty leading-7 text-slate-600">
            Compare popular Jumping Jax rentals and indoor party options, then
            choose the setup that fits your date, guest ages, and event space.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {POPULAR_LOCAL_LINKS.filter(
              (link) => link.href !== `/rentals/${category}`,
            ).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-full border border-pink-200 bg-pink-50 px-4 py-2 text-sm font-bold text-pink-800 transition hover:border-pink-300 hover:bg-pink-100"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
