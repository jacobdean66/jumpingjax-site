import type { SavedGoogleOffer } from "@/lib/analytics/customer-offer-store";
export function GoogleOfferCard({
  offer,
  kind,
}: {
  offer?: SavedGoogleOffer;
  kind: "rental" | "facility";
}) {
  if (!offer) return null;
  return (
    <aside
      aria-label="Saved Google discount"
      className="my-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950"
    >
      <p className="font-black">
        Google offer · 15% off{" "}
        {kind === "facility"
          ? "base party package"
          : "eligible inflatable rentals"}
      </p>
      <p className="mt-1 break-all">Code: {offer.code}</p>
      <p className="mt-1 font-bold">
        Savings already included: ${offer.discount.toFixed(2)} ·{" "}
        {offer.status === "reserved"
          ? "Reserved for this booking"
          : offer.status === "redeemed"
            ? "Used on this booking"
            : "Released after cancellation / decline"}
      </p>
      <p className="mt-1">
        {kind === "facility"
          ? "Applied before tax. Add-ons excluded."
          : "Delivery and other excluded services are not discounted."}{" "}
        Do not apply a second discount.
      </p>
    </aside>
  );
}
