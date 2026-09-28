import type { Metadata } from "next";

import { GiveawayNominationForm } from "@/components/giveaway/GiveawayNominationForm";

export const metadata: Metadata = {
  title: "Free Party Giveaway Nomination",
  description: "Nominate a child for the 2026 Jumping Jax Free Party Giveaway.",
  robots: { index: false, follow: false },
};

export default function NominatePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#cffafe_0,#fff8e8_44%,#fce7f3_100%)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <p className="inline-flex rounded-full bg-yellow-300 px-4 py-2 text-xs font-black uppercase text-slate-950 shadow-[0_4px_0_#f59e0b] sm:text-sm">Winner chosen October 15 at 9:00 a.m.</p>
          <h1 className="mt-5 text-3xl font-black leading-tight text-slate-950 sm:text-5xl">Nominate a child for a <span className="text-pink-500">free Halloween costume party</span></h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-semibold text-slate-700 sm:text-lg">Choose a public or private party on any day of Halloween weekend. Guests wear their own costumes, and Halloween candy is included.</p>
          <a
            href="#nomination-form"
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-orange-500 px-7 py-3 text-base font-black uppercase text-white shadow-[0_6px_0_#c2410c] transition hover:-translate-y-0.5 hover:bg-orange-400"
          >
            Start nomination ↓
          </a>
        </div>

        <div className="mt-7">
          <GiveawayNominationForm />
        </div>

        <section aria-label="Prize highlights" className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {["Public or private", "Any day Halloween weekend", "Up to 20 children", "Candy included", "Drinks and balloons", "Party supplies"].map((item) => (
            <div key={item} className="rounded-lg border-2 border-white bg-white/85 px-3 py-2 text-center text-sm font-black text-slate-800 shadow-sm">{item}</div>
          ))}
        </section>

        <section className="mt-8 rounded-3xl bg-slate-950 p-6 text-sm text-slate-200 sm:p-8">
          <h2 className="text-xl font-black text-white">Giveaway details</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            <li>• Nominations close October 15, 2026 at 9:00 a.m. Eastern.</li>
            <li>• One winner will be chosen October 15, 2026 at 9:00 a.m. Eastern.</li>
            <li>• Prize: one public or private Halloween costume party at Jumping Jax for up to 20 children.</li>
            <li>• The winner may choose any day of Halloween weekend, subject to availability.</li>
            <li>• The child and guests wear their own costumes. Costumes are encouraged, not required.</li>
            <li>• Halloween candy, drinks, balloons, plates, cutlery, and themed tablecloths are included.</li>
            <li>• Parent or legal guardian approval is required before redemption.</li>
            <li>• No purchase necessary.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
