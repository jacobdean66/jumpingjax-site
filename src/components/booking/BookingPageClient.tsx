"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CATEGORY_COPY, getRentalBySlug } from "@/data/rentals";
import { useBookingStore } from "@/store/bookingStore";
import { RentalBookingPanel } from "./RentalBookingPanel";

export function BookingPageClient() {
  const rentalId = useBookingStore((s) => s.rentalId);

  const rental = useMemo(
    () => (rentalId ? getRentalBySlug(rentalId) : undefined),
    [rentalId],
  );

  if (!rentalId?.trim() || !rental) {
    return (
      <main className="min-h-screen scroll-smooth bg-[#071326] px-4 pb-8 pt-8 text-white sm:px-6 sm:pt-10 lg:px-8">
        <article className="mx-auto max-w-2xl pb-28 sm:pb-32">
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Choose a rental first
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
            Pick an inflatable from the catalog and tap{" "}
            <span className="font-bold text-cyan-200">Reserve</span> to start a
            booking. Your selection is not set yet.
          </p>
          <Link
            href="/rentals"
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-cyan-400 px-6 text-base font-bold text-black transition hover:bg-cyan-300"
          >
            Browse rentals
          </Link>
        </article>
      </main>
    );
  }

  const cat = CATEGORY_COPY[rental.categoryId];

  return (
    <main className="min-h-screen scroll-smooth bg-[#071326] px-4 pb-8 pt-8 text-white sm:px-6 sm:pt-10 lg:px-8">
      <article className="mx-auto max-w-4xl pb-28 sm:pb-32">
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

        <div className="mt-10">
          <RentalBookingPanel
            rental_item={rental.slug}
            rentalTitle={rental.title}
            startingPrice={rental.startingPrice}
            initialUnavailableYmds={[]}
            availabilityLoadError={null}
          />
        </div>
      </article>
    </main>
  );
}
