import Image from "next/image";
import Link from "next/link";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  CATEGORY_BROWSE_ORDER,
  CATEGORY_COPY,
  HOMEPAGE_HERO_ASSET,
  homeFeaturedRentals,
  rentalDetailPath,
} from "@/data/rentals";

const FEATURED_IMAGE_SIZES =
  "(max-width: 768px) 94vw, (max-width: 1200px) 33vw, 400px";
const logoExists = existsSync(join(process.cwd(), "public", "logo.png"));

export default function Home() {
  const featured = homeFeaturedRentals();

  return (
    <main className="overflow-x-hidden bg-[#fff8e8] text-slate-950">
      {/* HERO — Next/Image for bandwidth-aware delivery + stable layout box */}
      <section className="relative flex min-h-[100svh] items-center justify-center px-4 py-20 sm:py-24">
        <div className="absolute inset-0">
          <Image
            src={HOMEPAGE_HERO_ASSET.src}
            alt={HOMEPAGE_HERO_ASSET.alt}
            fill
            priority
            fetchPriority="high"
            sizes="100vw"
            quality={82}
            className="object-cover object-center"
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-b from-sky-950/45 via-cyan-800/10 to-[#fff8e8]" />

        <div className="relative z-10 mx-auto max-w-5xl px-2 text-center text-white">
          <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-yellow-300 bg-white/95 p-3 text-center text-lg font-black leading-tight text-pink-600 shadow-xl shadow-sky-950/25 sm:h-36 sm:w-36 sm:text-2xl">
            {logoExists ? (
              <Image
                src="/logo.png"
                alt="Jumping Jax logo"
                width={128}
                height={128}
                priority
                className="h-full w-full object-contain"
              />
            ) : (
              <span>Jumping Jax</span>
            )}
          </div>
          <h1 className="mb-6 text-4xl font-black leading-tight tracking-tight drop-shadow-md sm:text-6xl md:text-7xl">
            Water Slide & Bounce House Rentals
          </h1>

          <p className="mx-auto mb-10 max-w-3xl text-pretty text-lg font-semibold leading-snug text-white drop-shadow sm:text-xl md:text-2xl">
            Bright, clean party rentals across Greenwood, Clinton, Abbeville &
            Edgefield areas.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
            <Link
              href="/rentals"
              className="inline-flex min-h-14 w-full max-w-[280px] items-center justify-center rounded-full bg-yellow-300 px-8 text-lg font-bold text-slate-950 shadow-lg shadow-sky-950/25 transition duration-200 hover:bg-yellow-200 hover:shadow-xl active:scale-[0.98] sm:min-h-[3.5rem]"
            >
              Inflatable Rentals
            </Link>

            <Link
              href="/facility-parties"
              className="inline-flex min-h-14 w-full max-w-[280px] items-center justify-center rounded-full border border-white/70 bg-white/90 px-8 text-lg font-bold text-pink-700 backdrop-blur transition duration-200 hover:bg-white active:scale-[0.98] sm:min-h-[3.5rem]"
            >
              Facility Party
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED — strongest SKUs first (see HOMEPAGE_FEATURED in data/rentals) */}
      <section className="bg-pink-50 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <span className="inline-flex rounded-full border border-pink-200 bg-pink-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-pink-800">
              Popular right now
            </span>
            <h2 className="mt-5 text-balance text-3xl font-black tracking-tight sm:text-5xl">
              Featured inflatables
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-7 text-slate-600 sm:text-lg">
              A few guest favorites to get you started—open any card for full specs
              and booking.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 md:gap-7 lg:gap-8">
            {featured.map((rental, index) => (
              <div
                key={rental.id}
                className="flex min-h-0 flex-col overflow-hidden rounded-2xl border-2 border-cyan-100 bg-white p-6 shadow-[0_14px_36px_rgba(236,72,153,0.16)] sm:p-7"
              >
                <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-2xl bg-slate-900">
                  <Image
                    src={rental.imageSrc}
                    alt={rental.imageAlt}
                    fill
                    priority={index === 0}
                    fetchPriority={index === 0 ? "high" : "low"}
                    sizes={FEATURED_IMAGE_SIZES}
                    quality={index === 0 ? 82 : 74}
                    className="object-cover object-center"
                  />
                </div>

                <h3 className="mt-5 line-clamp-2 min-h-[2.75rem] text-pretty text-xl font-bold leading-snug sm:text-2xl">
                  {rental.title}
                </h3>

                <p className="mt-3 line-clamp-3 min-h-[4rem] flex-1 text-pretty text-sm leading-relaxed text-slate-600 sm:text-base">
                  {rental.shortDescription}
                </p>

                <p className="mt-4 text-sm font-semibold text-pink-700">
                  From ${rental.startingPrice}
                </p>

                <Link
                  href={rentalDetailPath(rental)}
                  className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-cyan-500 px-6 text-center text-base font-bold text-white shadow-sm shadow-cyan-900/20 transition duration-200 hover:bg-cyan-600 active:scale-[0.99] sm:min-h-14"
                >
                  View details & book
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col items-center gap-4 border-t border-sky-100 pt-12 text-center sm:flex-row sm:justify-center sm:gap-6">
            <p className="max-w-md text-sm leading-relaxed text-slate-600">
              Want the full lineup? Browse by category—water slides, combos, dry
              slides, and more.
            </p>
            <Link
              href="/rentals"
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full border border-pink-200 bg-pink-100 px-8 py-3 text-base font-bold text-pink-800 transition hover:bg-pink-200"
            >
              Browse all categories
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-2 sm:gap-3">
            {CATEGORY_BROWSE_ORDER.slice(0, 5).map((id) => (
              <Link
                key={id}
                href={`/rentals/${id}`}
                className="rounded-full border border-cyan-100 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-cyan-800 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50 sm:text-sm"
              >
                {CATEGORY_COPY[id].title}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="bg-lime-100 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="mb-14 text-balance text-3xl font-black sm:text-5xl">
            Why Families Choose Jumping Jax
          </h2>

          <div className="grid gap-10 md:grid-cols-3 md:gap-8">
            <div>
              <h3 className="mb-3 text-2xl font-bold text-pink-700">
                Clean Equipment
              </h3>

              <p className="text-pretty text-slate-600">
                Every inflatable is cleaned and inspected before delivery.
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-2xl font-bold text-cyan-700">
                Reliable Delivery
              </h3>

              <p className="text-pretty text-slate-600">
                On-time setup and pickup across surrounding areas.
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-2xl font-bold text-lime-700">
                Easy Booking
              </h3>

              <p className="text-pretty text-slate-600">
                Fast communication and simple reservations through Facebook.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICE AREAS */}
      <section className="bg-cyan-100 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="mb-10 text-balance text-3xl font-black sm:text-5xl">
            Proudly Serving
          </h2>

          <div className="flex flex-wrap justify-center gap-3 text-lg sm:gap-4">
            <span className="rounded-full bg-pink-500 px-6 py-3 font-bold text-white">
              Greenwood
            </span>

            <span className="rounded-full bg-cyan-500 px-6 py-3 font-bold text-white">
              Clinton
            </span>

            <span className="rounded-full bg-lime-500 px-6 py-3 font-bold text-white">
              Abbeville
            </span>

            <span className="rounded-full bg-orange-500 px-6 py-3 font-bold text-white">
              Edgefield
            </span>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-yellow-300 px-4 py-24 text-center text-slate-950 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-6 text-balance text-4xl font-black sm:text-6xl">
            Ready To Book Your Event?
          </h2>

          <p className="mb-10 text-pretty text-lg font-medium sm:text-2xl">
            Reserve your inflatable rental today before dates fill up.
          </p>

          <Link
            href="/rentals"
            className="inline-flex min-h-14 items-center justify-center rounded-full bg-black px-10 py-4 text-xl font-bold text-white shadow-lg shadow-black/25 transition hover:bg-slate-900 active:scale-[0.98]"
          >
            Start Your Booking
          </Link>
        </div>
      </section>
    </main>
  );
}
