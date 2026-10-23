import type { Metadata } from "next";
import Link from "next/link";
import { RentalPromotionNotice } from "@/components/booking/RentalPromotion";

export const metadata: Metadata = { title: "Your rental", robots: { index: false, follow: true } };

export default function RentalVisitPage() {
  return <main className="min-h-screen bg-[#071326] px-4 py-6 text-white"><div className="mx-auto max-w-3xl">
    <Link href="/visit" className="inline-flex min-h-11 items-center text-sm font-bold text-cyan-200 underline">← Choose a different visit</Link>
    <h1 className="mt-3 text-3xl font-black">Your inflatable rental</h1>
    <div className="mt-5"><RentalPromotionNotice dark /></div>
    <section className="rounded-3xl border border-cyan-300/30 bg-white/5 p-5 sm:p-7">
      <h2 className="text-xl font-black">Choose your rental</h2>
      <p className="mt-3 text-slate-200">Choose an inflatable and event date. Any eligible offer appears as a dollar saving in your estimate and rental agreement before you submit.</p>
      <Link href="/rentals#rental-categories" className="mt-5 inline-flex min-h-12 items-center rounded-full bg-cyan-300 px-6 py-3 font-black text-slate-950">Go to website &amp; choose my rental →</Link>
      <Link href="/offers/inflatables-15" className="mt-4 block w-fit text-sm font-bold text-cyan-200 underline">View the Google 15% rental offer</Link>
    </section>
    <section className="mt-5 rounded-3xl border border-white/20 p-5 sm:p-7">
      <h2 className="text-xl font-black">Already requested a rental?</h2>
      <p className="mt-3 text-slate-200">Use the private agreement link sent by Jumping Jax. It contains your booking details and agreed pricing. Staff can find your request by name and event date.</p>
      <p className="mt-3 text-sm text-slate-300">Your request still needs staff confirmation. A facility participant waiver does not replace your rental agreement.</p>
      <a href="tel:8649331420" className="mt-4 inline-flex min-h-11 items-center font-bold text-cyan-200 underline">Need your agreement link? Call 864-933-1420</a>
    </section>
  </div></main>;
}
