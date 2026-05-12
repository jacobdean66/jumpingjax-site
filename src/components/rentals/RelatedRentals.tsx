import type { Rental } from "@/data/rentals";
import { relatedRentals } from "@/data/rentals";
import { RentalCard } from "./RentalCard";

type Props = {
  rental: Rental;
};

export function RelatedRentals({ rental }: Props) {
  const items = relatedRentals(rental, 3);
  if (items.length === 0) return null;

  return (
    <section className="mt-14 border-t border-white/10 pt-12 scroll-mt-24">
      <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
        Related rentals
      </h2>
      <p className="mt-2 max-w-2xl text-slate-300">
        More options in this category. Tap a card for full details and booking.
      </p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => (
          <RentalCard key={r.id} rental={r} />
        ))}
      </div>
    </section>
  );
}
