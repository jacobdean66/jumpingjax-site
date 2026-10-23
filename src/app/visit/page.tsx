import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Your visit | Jumping Jax",
  description: "Choose inflatable rentals or a visit to our Greenwood facility.",
  robots: { index: false, follow: true },
};

export default function VisitPage() {
  return <main className="min-h-screen bg-[#071326] px-4 py-6 text-white">
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-black uppercase tracking-widest text-cyan-200">Jumping Jax · Your visit</p>
      <h1 className="mt-3 text-3xl font-black sm:text-5xl">How are you joining the fun?</h1>
      <p className="mt-3 text-slate-200">Choose your visit to find the right booking and paperwork.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/visit/rentals" className="rounded-3xl border border-cyan-300/40 bg-cyan-300/10 p-6 focus-visible:outline-2 focus-visible:outline-cyan-300">
          <h2 className="text-2xl font-black">Inflatable rentals</h2>
          <p className="mt-3 text-sm leading-6 text-slate-200">Rent an inflatable for your event. Find your rental offer and agreement instructions.</p>
          <span className="mt-5 inline-block font-black text-cyan-200">Continue to rentals →</span>
        </Link>
        <Link href="/visit/facility" className="rounded-3xl border border-pink-300/40 bg-pink-300/10 p-6 focus-visible:outline-2 focus-visible:outline-pink-300">
          <h2 className="text-2xl font-black">Visit our facility</h2>
          <p className="mt-3 text-sm leading-6 text-slate-200">Open Play or a party at Jumping Jax. Complete participant waivers and prepare for check-in.</p>
          <span className="mt-5 inline-block font-black text-pink-200">Continue to facility visits →</span>
        </Link>
      </div>
      <p className="mt-6 text-sm text-slate-300">The Google 15% offer applies to eligible inflatable rentals. Facility visits and parties have separate pricing.</p>
    </div>
  </main>;
}
