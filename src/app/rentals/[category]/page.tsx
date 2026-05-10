import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CATEGORY_COPY,
  CATEGORY_IDS,
  isCategoryId,
  rentalsInCategory,
} from "@/data/rentals";
import { RentalCard } from "@/components/rentals/RentalCard";

type Props = { params: Promise<{ category: string }> };

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
  const rentals = rentalsInCategory(category);

  return (
    <main className="min-h-screen scroll-smooth bg-[#071326] px-4 pb-20 pt-8 text-white sm:px-6 sm:pt-10 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <nav className="text-sm font-semibold text-slate-400">
          <Link href="/rentals" className="text-cyan-200 hover:text-cyan-100">
            Rentals
          </Link>
          <span className="mx-2 text-slate-600">/</span>
          <span className="text-slate-200">{copy.title}</span>
        </nav>

        <header className="mt-6 max-w-3xl">
          <span className="inline-flex rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
            {copy.title}
          </span>
          <h1 className="mt-4 text-balance text-3xl font-black tracking-tight sm:text-5xl">
            {copy.title}
          </h1>
          <p className="mt-4 text-pretty text-base leading-7 text-slate-300 sm:text-lg">
            {copy.blurb}
          </p>
        </header>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rentals.map((rental) => (
            <RentalCard key={rental.slug} rental={rental} />
          ))}
        </div>
      </section>
    </main>
  );
}
