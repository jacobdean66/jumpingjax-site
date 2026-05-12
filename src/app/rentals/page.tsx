import Image from "next/image";
import Link from "next/link";
import {
  CATEGORY_BROWSE_ORDER,
  CATEGORY_COPY,
  categoryPreviewRental,
} from "@/data/rentals";

const CATEGORY_CARD_IMAGE_SIZES =
  "(max-width: 640px) 94vw, (max-width: 1024px) 46vw, 360px";

export default function RentalsPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#071326] px-4 pb-24 pt-8 text-white sm:px-6 sm:pt-10 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <header className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
            Rentals
          </span>
          <h1 className="mt-5 text-balance text-4xl font-black tracking-tight sm:text-5xl">
            Browse Jumping Jax Rentals
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-300 sm:text-lg">
            Pick a category, compare units, then open any card for full details and
            booking.
          </p>
        </header>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 sm:gap-7 lg:grid-cols-3 lg:gap-8">
          {CATEGORY_BROWSE_ORDER.map((id, index) => {
            const copy = CATEGORY_COPY[id];
            const preview = categoryPreviewRental(id);
            return (
              <Link
                key={id}
                href={`/rentals/${id}`}
                className="group flex min-h-0 touch-manipulation flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.28)] outline-none ring-cyan-300/0 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.07] hover:shadow-[0_16px_48px_rgba(0,0,0,0.38)] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071326]"
              >
                <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-slate-900 sm:aspect-[5/3]">
                  {preview ? (
                    <Image
                      src={preview.imageSrc}
                      alt={`${copy.title} — preview photo`}
                      fill
                      priority={index < 2}
                      fetchPriority={index < 2 ? "high" : "low"}
                      sizes={CATEGORY_CARD_IMAGE_SIZES}
                      quality={index < 2 ? 78 : 70}
                      className="object-cover object-center transition duration-300 ease-out group-hover:scale-[1.03]"
                    />
                  ) : null}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#071326]/90 via-transparent to-transparent" />
                  <p className="absolute bottom-3 left-3 right-3 text-xs font-black uppercase tracking-[0.14em] text-cyan-100/95">
                    {copy.title}
                  </p>
                </div>

                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <h2 className="text-xl font-bold text-white transition group-hover:text-cyan-200 sm:text-2xl">
                    {copy.title}
                  </h2>
                  <p className="mt-3 line-clamp-3 flex-1 text-pretty text-sm leading-relaxed text-slate-300">
                    {copy.blurb}
                  </p>
                  <span className="mt-5 inline-flex min-h-12 items-center text-sm font-bold text-cyan-100 underline decoration-cyan-400/50 underline-offset-4">
                    View units →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
