import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Your facility visit | Jumping Jax", robots: { index: false, follow: true } };

export default function FacilityVisitPage() {
  return <main className="min-h-screen bg-[#071326] px-4 py-6 text-white"><div className="mx-auto max-w-3xl">
    <Link href="/visit" className="inline-flex min-h-11 items-center text-sm font-bold text-pink-200 underline">← Choose a different visit</Link>
    <h1 className="mt-3 text-3xl font-black">Your facility visit</h1>
    <p className="mt-3 text-slate-200">Open Play and parties at 559 Beaudrot Rd, Greenwood, SC.</p>
    <section className="mt-5 rounded-3xl border border-pink-300/30 bg-white/5 p-5 sm:p-7">
      <h2 className="text-xl font-black">Open Play</h2>
      <p className="mt-3 text-slate-200">Complete a participant waiver before arrival. Already signed? Give the front desk the signer’s name so they can check the waiver and everyone visiting today.</p>
      <Link href="/waiver" className="mt-5 inline-flex min-h-12 items-center rounded-full bg-pink-300 px-6 py-3 font-black text-slate-950">Complete participant waiver →</Link>
    </section>
    <section className="mt-5 rounded-3xl border border-white/20 p-5 sm:p-7">
      <h2 className="text-xl font-black">Coming to a party?</h2>
      <p className="mt-3 text-slate-200">Use the link or QR code on your party invitation to RSVP for that party. Complete the participant waiver if needed, then check in at the front desk when you arrive.</p>
      <Link href="/facility-parties" className="mt-4 inline-flex min-h-11 items-center font-bold text-pink-200 underline">Planning your own party? View facility parties</Link>
    </section>
    <p className="mt-5 text-sm text-slate-300">Signing a waiver does not check you in or pay for admission. The Google 15% rental code does not apply to facility admission or parties.</p>
  </div></main>;
}
