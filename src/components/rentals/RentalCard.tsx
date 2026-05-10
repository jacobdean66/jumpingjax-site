import Image from "next/image";
import Link from "next/link";
import type { Rental } from "@/data/rentals";
import { rentalDetailPath } from "@/data/rentals";

type Props = {
  rental: Rental;
};

export function RentalCard({ rental }: Props) {
  const href = rentalDetailPath(rental);

  return (
    <article className="h-full">
      <Link
        href={href}
        className="group flex h-full touch-manipulation flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[0.07] active:scale-[0.98] active:brightness-95"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-900/80">
          <Image
            src={rental.imageSrc}
            alt={rental.imageAlt}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#071326]/80 via-transparent to-transparent" />
          <p className="absolute bottom-3 left-3 right-3 text-xs font-semibold uppercase tracking-wide text-cyan-100/90">
            From ${rental.startingPrice}
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-bold text-white transition group-hover:text-cyan-200 sm:text-xl">
              {rental.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {rental.shortDescription}
            </p>
          </div>

          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Dimensions:{" "}
            <span className="font-semibold normal-case text-slate-200">
              {rental.dimensions}
            </span>
          </p>

          <div className="mt-auto pt-1">
            <span
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-cyan-400 px-4 py-3 text-center text-base font-bold text-black transition group-hover:bg-cyan-300 sm:min-h-14 sm:text-lg"
              role="presentation"
            >
              Reserve / Book
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
