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
  return <main className="min-h-screen bg-[#071326] px-5 py-12 text-white">
    <article className="mx-auto max-w-3xl rounded-3xl border border-cyan-300/25 bg-white/5 p-6 sm:p-10">
      <p className="font-bold uppercase tracking-wider text-cyan-200">Jumping Jax · Greenwood, SC</p>
      <h1 className="mt-4 text-4xl font-black sm:text-5xl">15% off inflatable rentals</h1>
      <p className="mt-5 text-lg leading-relaxed text-slate-200">Claim this offer, choose your inflatable, and request your event date. Your eligible rental discount is calculated in your booking estimate.</p>
      <ClaimRentalPromotion />
      <h2 className="mt-9 text-xl font-bold">What’s included</h2>
      <p className="mt-3 leading-relaxed text-slate-300">Eligible bounce houses, bounce and slide combos, and inflatable obstacle courses.</p>
      <p className="mt-4 text-sm leading-relaxed text-slate-300">15% applies to eligible inflatable rental prices only. Delivery, mileage, accessories, yard games, foam parties, and facility parties are excluded. Availability and final delivery plans require staff confirmation. Claim the offer and complete your request in the same browser visit.</p>
      <p className="mt-6 text-sm"><Link href="/contact" className="text-cyan-200 underline">Contact Jumping Jax</Link> for help choosing your rental.</p>
    </article>
  </main>;
}
