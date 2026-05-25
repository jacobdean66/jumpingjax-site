import Image from "next/image";
import Link from "next/link";
import type { Rental } from "@/data/rentals";
import { rentalDetailPath } from "@/data/rentals";
import { RentalCardCartActions } from "@/components/booking/RentalBookingPanel";

/** Default `sizes` for 3-col grids inside max-w-6xl (mobile-first bandwidth). */
const DEFAULT_CARD_SIZES =
  "(max-width: 640px) 94vw, (max-width: 1024px) 46vw, (max-width: 1280px) 32vw, 380px";

type Props = {
  rental: Rental;
  /** First tiles in a grid: eager load to improve LCP (detail hero sets its own priority). */
  imagePriority?: boolean;
  /** Override responsive `sizes` when the card sits in a different layout. */
  imageSizes?: string;
  /** Show cart actions below the card (detail-page related rentals). */
  showCartActions?: boolean;
  /** Where "Keep shopping" goes when item is already in cart. */
  keepShoppingHref?: string;
};

export function RentalCard({
  rental,
  imagePriority = false,
  imageSizes = DEFAULT_CARD_SIZES,
  showCartActions = false,
  keepShoppingHref = "/rentals",
}: Props) {
  const href = rentalDetailPath(rental);

  return (
    <article className="h-full min-w-0">
      <Link
        href={href}
        className="group flex h-full touch-manipulation flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.28)] outline-none ring-cyan-300/0 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.07] hover:shadow-[0_16px_48px_rgba(0,0,0,0.38)] active:scale-[0.99] active:brightness-[0.97] focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071326]"
      >
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-slate-900">
          <Image
            src={rental.imageSrc}
            alt={rental.imageAlt}
            fill
            priority={imagePriority}
            fetchPriority={imagePriority ? "high" : "low"}
            sizes={imageSizes}
            quality={imagePriority ? 82 : 72}
            className="object-cover object-center transition duration-300 ease-out group-hover:scale-[1.03]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#071326]/85 via-[#071326]/10 to-transparent" />
          <p className="absolute bottom-3 left-3 right-3 text-xs font-semibold uppercase tracking-wide text-cyan-100/95">
            From ${rental.startingPrice}
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-4 sm:gap-3 sm:p-5">
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 min-h-[2.75rem] text-pretty text-lg font-bold leading-snug text-white transition group-hover:text-cyan-200 sm:min-h-[3.25rem] sm:text-xl">
              {rental.title}
            </h2>
            <p className="mt-2 line-clamp-4 min-h-[5.25rem] text-pretty text-sm leading-relaxed text-slate-300 sm:min-h-[5.5rem]">
              {rental.shortDescription}
            </p>
          </div>

          <div className="mt-auto border-t border-white/10 pt-3 sm:pt-3.5">
            <span
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-cyan-400 px-4 py-3.5 text-center text-base font-bold text-black shadow-sm shadow-black/20 transition group-hover:bg-cyan-300 sm:min-h-14 sm:text-lg"
              role="presentation"
            >
              View details
            </span>
          </div>
        </div>
      </Link>
      {showCartActions && (
        <RentalCardCartActions
          rental_item={rental.slug}
          rental_name={rental.title}
          keepShoppingHref={keepShoppingHref}
        />
      )}
    </article>
  );
}
