import type { Metadata } from "next";
import Link from "next/link";
import { ClaimRentalPromotion } from "@/components/booking/RentalPromotion";

export const metadata: Metadata = {
  title: "15% Off Inflatable Rentals in Greenwood, SC",
  description: "Claim 15% off eligible Jumping Jax inflatable rentals through this Google Ads offer. Delivery and other services excluded.",
  alternates: { canonical: "/offers/inflatables-15" },
  robots: { index: false, follow: true },
};

export default function InflatableOfferPage() {
  return <main className="min-h-screen bg-[#071326] px-4 pb-12 pt-5 text-white sm:px-5 sm:pt-8">
    <article className="mx-auto max-w-3xl rounded-3xl border border-cyan-300/25 bg-white/5 p-5 sm:p-10">
      <p className="text-xs font-bold uppercase tracking-wider text-cyan-200 sm:text-base">Jumping Jax · Greenwood, SC</p>
      <h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">15% off inflatable rentals</h1>
      <p className="mt-4 text-base leading-relaxed text-slate-200 sm:text-lg">Claim this offer, choose your inflatable, and request your event date. Your eligible rental discount is calculated in your booking estimate.</p>
      <ClaimRentalPromotion />
      <div className="mt-5 rounded-xl border border-white/20 p-4 text-sm">
        <Link href="/visit" className="inline-flex min-h-11 items-center font-bold text-cyan-200 underline">Already booked, or visiting our facility? Choose your visit →</Link>
        <p className="mt-1 text-slate-300">Rental agreements and facility participant waivers have separate paths. This 15% offer is for eligible inflatable rentals only.</p>
      </div>
      <h2 className="mt-9 text-xl font-bold">What’s included</h2>
      <p className="mt-3 leading-relaxed text-slate-300">Eligible bounce houses, bounce and slide combos, and inflatable obstacle courses.</p>
      <p className="mt-4 text-sm leading-relaxed text-slate-300">15% applies to eligible inflatable rental prices only. Delivery, mileage, accessories, yard games, foam parties, and facility parties are excluded. Availability and final delivery plans require staff confirmation. Claim the offer to save it for this browser visit, or enter GOOGLE15 at rental checkout.</p>
      <p className="mt-6 text-sm"><Link href="/contact" className="text-cyan-200 underline">Contact Jumping Jax</Link> for help choosing your rental.</p>
    </article>
  </main>;
}
