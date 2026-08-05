import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CATEGORY_COPY,
  CATEGORY_IDS,
  isCategoryId,
} from "@/data/rentals";
import { RentalCard } from "@/components/rentals/RentalCard";
import { loadWebsiteRentalsInCategory } from "@/lib/rentals/public-catalog";

type Props = { params: Promise<{ category: string }> };

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return CATEGORY_IDS.map((category) => ({ category }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  if (!isCategoryId(category)) return { title: "Rentals | Jumping Jax" };
  const copy = CATEGORY_COPY[category];
  return {
    title: `${copy.title} | Jumping Jax Rentals`,
    description: copy.blurb,
  };
}

export default async function RentalCategoryPage({ params }: Props) {
  const { category } = await params;
  if (!isCategoryId(category)) notFound();

  const copy = CATEGORY_COPY[category];
  const rentals = await loadWebsiteRentalsInCategory(category);

  return (
    <main className="min-h-screen scroll-smooth overflow-x-hidden bg-cyan-50 px-4 pb-24 pt-8 text-slate-950 sm:px-6 sm:pt-10 lg:px-8">
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
            {copy.title}
          </h1>
          <p className="mt-4 text-pretty text-base leading-7 text-slate-600 sm:text-lg">
            {copy.blurb}
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
      </section>
    </main>
  );
}
