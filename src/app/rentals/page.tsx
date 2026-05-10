import Link from "next/link";
import { CATEGORY_COPY, CATEGORY_IDS, type RentalCategoryId } from "@/data/rentals";

const CATEGORY_ORDER: RentalCategoryId[] = [...CATEGORY_IDS];

export default function RentalsPage() {
  return (
    <main className="min-h-screen bg-[#071326] px-4 pb-16 pt-8 text-white sm:px-6 sm:pt-10 lg:px-8">
      <section className="mx-auto max-w-5xl">
        <div className="text-center">
          <span className="inline-flex rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
            Rentals
          </span>
          <h1 className="mt-5 text-balance text-4xl font-black tracking-tight sm:text-5xl">
            Browse Jumping Jax Rentals
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-300 sm:text-lg">
            Explore popular inflatables and event favorites. Choose your unit and
            reserve your date with our team.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORY_ORDER.map((id) => {
            const copy = CATEGORY_COPY[id];
            return (
              <Link
                key={id}
                href={`/rentals/${id}`}
                className="group touch-manipulation rounded-2xl border border-white/10 bg-white/5 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.07] active:scale-[0.98]"
              >
                <h2 className="text-xl font-bold text-cyan-300 transition group-hover:text-cyan-200">
                  {copy.title}
                </h2>
                <p className="mt-2 text-sm text-slate-300">{copy.blurb}</p>
                <p className="mt-4 inline-flex min-h-12 items-center text-sm font-bold text-cyan-100 underline decoration-cyan-400/50 underline-offset-4">
                  View category →
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
