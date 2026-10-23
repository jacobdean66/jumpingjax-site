import type { Metadata } from "next";
import { ClaimRentalPromotion } from "@/components/booking/RentalPromotion";
export const metadata: Metadata = {
  title: "Your Google discount",
  description:
    "Claim your personal 15% Google offer for an eligible inflatable rental or facility party.",
  alternates: { canonical: "/offers/inflatables-15" },
  robots: { index: false, follow: true },
};
export default async function GoogleDiscountPage({
  searchParams,
}: {
  searchParams?: Promise<{ kind?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="min-h-screen bg-[#071326] px-4 py-5 text-white">
      <article className="mx-auto max-w-xl rounded-3xl border border-cyan-300/25 bg-white/5 p-5 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wider text-cyan-200">
          Jumping Jax · Google offer
        </p>
        <h1 className="mt-3 text-3xl font-black">Save 15% on your booking</h1>
        <p className="mt-3 text-slate-200">
          Choose your booking type and save your personal code. Your discount
          stays attached to your rental or facility party booking.
        </p>
        <ClaimRentalPromotion
          initialKind={params?.kind === "facility" ? "facility" : "rental"}
        />
        <div className="mt-5 space-y-2 border-t border-white/20 pt-4 text-xs leading-5 text-slate-300">
          <p>
            <strong>Rentals:</strong> 15% off eligible bounce houses, combos and
            obstacle courses. Delivery, mileage, accessories and other services
            excluded.
          </p>
          <p>
            <strong>Facility parties:</strong> 15% off the base party package
            before tax. Add-ons excluded.
          </p>
          <p>
            One use per email for each offer type. No Open Play discount.
            Booking availability requires staff confirmation. No account signup
            needed.
          </p>
        </div>
      </article>
    </main>
  );
}
