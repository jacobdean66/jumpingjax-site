import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { GiveawayNominationForm } from "@/components/giveaway/GiveawayNominationForm";

export const metadata: Metadata = {
  title: "Free Party Giveaway Nomination",
  description: "Nominate a child for the 2026 Jumping Jax Free Party Giveaway.",
  robots: { index: false, follow: false },
};

export default function NominatePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#cffafe_0,#fff8e8_44%,#fce7f3_100%)] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <Image src="/logo.png" alt="Jumping Jax Inflatable Rentals and Parties" width={430} height={220} priority className="mx-auto h-auto w-full max-w-sm" />
          <p className="mt-5 inline-flex rotate-[-1deg] rounded-full bg-yellow-300 px-5 py-2 text-sm font-black uppercase tracking-wider text-slate-950 shadow-[0_5px_0_#f59e0b]">One winner • Entries close August 30</p>
          <h1 className="mt-7 text-4xl font-black leading-[0.95] text-slate-950 sm:text-6xl">Nominate a child to win a <span className="text-pink-500">FREE PARTY!</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold text-slate-700">Choose a September birthday celebration or a back-to-school party at Jumping Jax in Greenwood.</p>
          <Link
            href="/nominees"
            className="mt-6 inline-flex rounded-full border-2 border-pink-300 bg-white px-5 py-3 text-sm font-black uppercase tracking-wide text-pink-700 shadow-[0_5px_0_#fbcfe8] transition hover:-translate-y-0.5 hover:bg-pink-50"
          >
            View all nominees
          </Link>
        </div>

        <section className="my-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {["Public or private party", "Up to 20 children", "Drinks included", "Balloons included", "Plates and cutlery", "Themed tablecloths"].map((item) => (
            <div key={item} className="rounded-2xl border-2 border-white bg-white/80 px-4 py-3 text-center font-black text-slate-800 shadow-md">✓ {item}</div>
          ))}
        </section>

        <GiveawayNominationForm />

        <section className="mt-8 rounded-3xl bg-slate-950 p-6 text-sm text-slate-200 sm:p-8">
          <h2 className="text-xl font-black text-white">Giveaway details</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            <li>• Nominations close August 30, 2026 at 11:59 p.m. Eastern.</li>
            <li>• One winner will be drawn on August 31, 2026.</li>
            <li>• Prize: one public or private party at Jumping Jax for up to 20 children.</li>
            <li>• Choose a September birthday or back-to-school party.</li>
            <li>• Drinks, balloons, plates, cutlery, and themed tablecloths are included.</li>
            <li>• The winner chooses the party date, subject to availability.</li>
            <li>• Parent or legal guardian approval is required before redemption.</li>
            <li>• No purchase necessary.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
