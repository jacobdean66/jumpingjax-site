import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RelatedRentals } from "@/components/rentals/RelatedRentals";
import {
  CATEGORY_COPY,
  RENTALS,
  getRentalInCategory,
  isCategoryId,
} from "@/data/rentals";
import { BOOKING_HREF } from "@/lib/site";

type Props = { params: Promise<{ category: string; slug: string }> };

export function generateStaticParams() {
  return RENTALS.map((r) => ({
    category: r.categoryId,
    slug: r.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params;
  const rental = getRentalInCategory(category, slug);
  if (!rental) return { title: "Rental | Jumping Jax" };
  return {
    title: `${rental.title} | Jumping Jax`,
    description: rental.shortDescription,
  };
}

export default async function RentalDetailPage({ params }: Props) {
  const { category, slug } = await params;
  if (!isCategoryId(category)) notFound();

  const rental = getRentalInCategory(category, slug);
  if (!rental) notFound();

  const cat = CATEGORY_COPY[rental.categoryId];

  return (
    <main className="min-h-screen scroll-smooth bg-[#071326] px-4 pb-20 pt-8 text-white sm:px-6 sm:pt-10 lg:px-8">
      <article className="mx-auto max-w-4xl">
        <nav className="text-sm font-semibold text-slate-400">
          <Link href="/rentals" className="text-cyan-200 hover:text-cyan-100">
            Rentals
          </Link>
          <span className="mx-2 text-slate-600">/</span>
          <Link
            href={`/rentals/${rental.categoryId}`}
            className="text-cyan-200 hover:text-cyan-100"
          >
            {cat.title}
          </Link>
          <span className="mx-2 text-slate-600">/</span>
          <span className="text-slate-200">{rental.title}</span>
        </nav>

        <div className="relative mt-6 aspect-[16/10] w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:aspect-[21/9]">
          <Image
            src={rental.imageSrc}
            alt={rental.imageAlt}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 896px) 100vw, 896px"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#071326]/90 via-[#071326]/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
            <span className="inline-flex rounded-full border border-cyan-200/25 bg-cyan-300/15 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
              {cat.title}
            </span>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              {rental.title}
            </h1>
            <p className="mt-3 max-w-2xl text-pretty text-sm text-slate-200 sm:text-base">
              {rental.description}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <h2 className="text-sm font-black uppercase tracking-wide text-cyan-200">
              Pricing
            </h2>
            <p className="mt-3 text-3xl font-black text-white">
              From ${rental.startingPrice}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Final price depends on date, duration, and delivery. Message us for
              a tailored quote.
            </p>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <h2 className="text-sm font-black uppercase tracking-wide text-cyan-200">
              Dimensions
            </h2>
            <p className="mt-3 text-lg font-semibold text-white">
              {rental.dimensions}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              We confirm fit and anchoring plan before your event day.
            </p>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
          <h2 className="text-sm font-black uppercase tracking-wide text-cyan-200">
            Age recommendations
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-200">
            {rental.ageRecommendation}
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
          <h2 className="text-sm font-black uppercase tracking-wide text-cyan-200">
            Setup requirements
          </h2>
          <ul className="mt-4 list-inside list-disc space-y-2 text-slate-200 marker:text-cyan-400">
            {rental.setupRequirements.map((req) => (
              <li key={req} className="ps-1 leading-relaxed">
                {req}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <a
            href={BOOKING_HREF}
            className="inline-flex min-h-14 flex-1 items-center justify-center rounded-full bg-cyan-400 px-6 py-4 text-center text-lg font-bold text-black transition hover:bg-cyan-300 active:scale-[0.98] sm:text-xl"
          >
            Book this rental
          </a>
          <Link
            href={`/rentals/${rental.categoryId}`}
            className="inline-flex min-h-14 flex-1 items-center justify-center rounded-full border border-white/25 bg-white/5 px-6 py-4 text-center text-lg font-bold text-white transition hover:bg-white/10 active:scale-[0.98] sm:text-xl"
          >
            Back to {cat.title}
          </Link>
        </div>

        <RelatedRentals rental={rental} />
      </article>
    </main>
  );
}
