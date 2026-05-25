import Image from "next/image";
import Link from "next/link";
import {
  CATEGORY_BROWSE_ORDER,
  CATEGORY_COPY,
  HOMEPAGE_HERO_ASSET,
  homeFeaturedRentals,
  rentalDetailPath,
} from "@/data/rentals";

const FEATURED_IMAGE_SIZES =
  "(max-width: 768px) 94vw, (max-width: 1200px) 33vw, 400px";

export default function Home() {
  const featured = homeFeaturedRentals();

  return (
    <main className="overflow-x-hidden bg-[#071326] text-white">
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

        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/80" />

        <div className="relative z-10 mx-auto max-w-5xl px-2 text-center">
          <h1 className="mb-6 text-4xl font-black leading-tight tracking-tight sm:text-6xl md:text-7xl">
            Jumping Jax
          </h1>

          <p className="mx-auto mb-10 max-w-3xl text-pretty text-lg leading-snug text-cyan-100/95 sm:text-xl md:text-2xl">
            Premium Water Slide & Bounce House Rentals Across Greenwood,
            Clinton, Abbeville & Edgefield Areas
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
            <Link
              href="/rentals"
              className="inline-flex min-h-14 w-full max-w-[280px] items-center justify-center rounded-full bg-cyan-400 px-8 text-lg font-bold text-black shadow-lg shadow-black/30 transition duration-200 hover:bg-cyan-300 hover:shadow-xl active:scale-[0.98] sm:min-h-[3.5rem]"
            >
              Inflatable Rentals
            </Link>

            <Link
              href="/facility-parties"
              className="inline-flex min-h-14 w-full max-w-[280px] items-center justify-center rounded-full border border-white/35 bg-white/10 px-8 text-lg font-bold text-white backdrop-blur transition duration-200 hover:bg-white/20 active:scale-[0.98] sm:min-h-[3.5rem]"
            >
              Facility Party
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED — strongest SKUs first (see HOMEPAGE_FEATURED in data/rentals) */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <span className="inline-flex rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
              Popular right now
            </span>
            <h2 className="mt-5 text-balance text-3xl font-black tracking-tight sm:text-5xl">
              Featured inflatables
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-7 text-slate-300 sm:text-lg">
              A few guest favorites to get you started—open any card for full specs
              and booking.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 md:gap-7 lg:gap-8">
            {featured.map((rental, index) => (
              <div
                key={rental.id}
                className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.28)] backdrop-blur sm:p-7"
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

                <p className="mt-3 line-clamp-3 min-h-[4rem] flex-1 text-pretty text-sm leading-relaxed text-white/75 sm:text-base">
                  {rental.shortDescription}
                </p>

                <p className="mt-4 text-sm font-semibold text-cyan-200">
                  From ${rental.startingPrice}
                </p>

                <Link
                  href={rentalDetailPath(rental)}
                  className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-cyan-400 px-6 text-center text-base font-bold text-black shadow-sm shadow-black/25 transition duration-200 hover:bg-cyan-300 active:scale-[0.99] sm:min-h-14"
                >
                  View details & book
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col items-center gap-4 border-t border-white/10 pt-12 text-center sm:flex-row sm:justify-center sm:gap-6">
            <p className="max-w-md text-sm leading-relaxed text-slate-400">
              Want the full lineup? Browse by category—water slides, combos, dry
              slides, and more.
            </p>
            <Link
              href="/rentals"
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-400/10 px-8 py-3 text-base font-bold text-cyan-100 transition hover:border-cyan-300/70 hover:bg-cyan-400/15"
            >
              Browse all categories
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-2 sm:gap-3">
            {CATEGORY_BROWSE_ORDER.slice(0, 5).map((id) => (
              <Link
                key={id}
                href={`/rentals/${id}`}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-200 transition hover:border-cyan-300/40 hover:bg-white/10 sm:text-sm"
              >
                {CATEGORY_COPY[id].title}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="bg-white/5 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="mb-14 text-balance text-3xl font-black sm:text-5xl">
            Why Families Choose Jumping Jax
          </h2>

          <div className="grid gap-10 md:grid-cols-3 md:gap-8">
            <div>
              <h3 className="mb-3 text-2xl font-bold text-cyan-300">
                Clean Equipment
              </h3>

              <p className="text-pretty text-white/70">
                Every inflatable is cleaned and inspected before delivery.
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-2xl font-bold text-cyan-300">
                Reliable Delivery
              </h3>

              <p className="text-pretty text-white/70">
                On-time setup and pickup across surrounding areas.
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-2xl font-bold text-cyan-300">
                Easy Booking
              </h3>

              <p className="text-pretty text-white/70">
                Fast communication and simple reservations through Facebook.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICE AREAS */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="mb-10 text-balance text-3xl font-black sm:text-5xl">
            Proudly Serving
          </h2>

          <div className="flex flex-wrap justify-center gap-3 text-lg sm:gap-4">
            <span className="rounded-full bg-cyan-400 px-6 py-3 font-bold text-black">
              Greenwood
            </span>

            <span className="rounded-full bg-cyan-400 px-6 py-3 font-bold text-black">
              Clinton
            </span>

            <span className="rounded-full bg-cyan-400 px-6 py-3 font-bold text-black">
              Abbeville
            </span>

            <span className="rounded-full bg-cyan-400 px-6 py-3 font-bold text-black">
              Edgefield
            </span>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-cyan-400 px-4 py-24 text-center text-black sm:px-6">
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
