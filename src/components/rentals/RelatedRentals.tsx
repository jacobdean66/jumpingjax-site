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
    <section
      id="related-rentals"
      className="mt-14 scroll-mt-24 border-t border-white/10 pt-12"
    >
      <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
        Related rentals
      </h2>
      <p className="mt-2 max-w-2xl text-slate-300">
        Tap Add to cart on any unit, or open a card for full details.
      </p>
      <div className="mt-8 grid gap-6 pb-28 sm:grid-cols-2 sm:pb-32 lg:grid-cols-3">
        {items.map((r) => (
          <RentalCard
            key={r.id}
            rental={r}
            showCartActions
            keepShoppingHref={`/rentals/${rental.categoryId}`}
          />
        ))}
      </div>
    </section>
  );
}
