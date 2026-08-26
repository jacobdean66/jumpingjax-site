import Image from "next/image";
import Link from "next/link";
import {
  CATEGORY_BROWSE_ORDER,
  CATEGORY_COPY,
  categoryPreviewRental,
} from "@/data/rentals";
import {
  DEFAULT_SITE_SETTINGS,
  loadSiteSettings,
} from "@/lib/admin/site-settings";
import { generateRentalsMetadata } from "@/lib/metadata";

const CATEGORY_CARD_IMAGE_SIZES =
  "(max-width: 640px) 94vw, (max-width: 1024px) 46vw, 360px";

export const dynamic = "force-dynamic";
export const metadata = generateRentalsMetadata();

export default async function RentalsPage() {
  let settings = DEFAULT_SITE_SETTINGS;
  try {
    settings = await loadSiteSettings();
  } catch {
    settings = DEFAULT_SITE_SETTINGS;
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-pink-50 px-4 pb-24 pt-8 text-slate-950 sm:px-6 sm:pt-10 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <header className="mx-auto max-w-3xl rounded-3xl border-2 border-yellow-200 bg-yellow-100 px-5 py-10 text-center shadow-[0_18px_48px_rgba(236,72,153,0.16)] sm:px-8">
          <span className="inline-flex rounded-full border border-pink-200 bg-pink-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-pink-800">
            Rentals
          </span>
          <h1 className="mt-5 text-balance text-4xl font-black tracking-tight sm:text-5xl">
            {settings.websiteText.rentalsTitle}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-600 sm:text-lg">
            {settings.websiteText.rentalsDescription}
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm font-semibold leading-6 text-slate-700 sm:text-base">
            Choose bounce houses, water slides, obstacle courses, foam parties,
            and party equipment for delivery in Greenwood, SC and nearby communities.
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
                className="group flex min-h-0 touch-manipulation flex-col overflow-hidden rounded-2xl border-2 border-cyan-100 bg-white shadow-[0_12px_36px_rgba(236,72,153,0.14)] outline-none ring-pink-300/0 transition duration-200 hover:-translate-y-0.5 hover:border-pink-300 hover:shadow-[0_18px_48px_rgba(6,182,212,0.18)] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-pink-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff8e8]"
              >
                <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-slate-900 sm:aspect-[5/3]">
                  {preview?.imageSrc ? (
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
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-pink-950/75 via-sky-950/10 to-transparent" />
                  <p className="absolute bottom-3 left-3 right-3 text-xs font-black uppercase tracking-[0.14em] text-white">
                    {copy.title}
                  </p>
                </div>

                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <h2 className="text-xl font-bold text-slate-950 transition group-hover:text-pink-700 sm:text-2xl">
                    {copy.title}
                  </h2>
                  <p className="mt-3 line-clamp-3 flex-1 text-pretty text-sm leading-relaxed text-slate-600">
                    {copy.blurb}
                  </p>
                  <span className="mt-5 inline-flex min-h-12 items-center text-sm font-bold text-cyan-700 underline decoration-yellow-300 underline-offset-4">
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
