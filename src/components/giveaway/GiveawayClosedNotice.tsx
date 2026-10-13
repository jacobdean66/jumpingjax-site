import Link from "next/link";
import { GIVEAWAY_CLOSED_MESSAGE, GIVEAWAY_PARTY_RSVP_URL } from "@/lib/giveaway/giveaway-campaigns";

export function GiveawayClosedNotice() {
  return (
    <section className="mx-auto max-w-3xl rounded-[2rem] border-4 border-cyan-200 bg-white p-6 text-center shadow-xl sm:p-9">
      <p className="inline-flex rounded-full bg-yellow-300 px-5 py-2 text-sm font-black uppercase text-slate-950">October giveaway closed</p>
      <h1 className="mt-5 text-3xl font-black text-slate-950 sm:text-5xl">Thank you for your nominations!</h1>
      <p className="mt-4 text-lg font-semibold text-slate-700">{GIVEAWAY_CLOSED_MESSAGE}</p>
      <div className="mt-6 rounded-2xl bg-orange-50 p-5">
        <h2 className="text-xl font-black text-orange-950">Keenan&apos;s Halloween costume party</h2>
        <p className="mt-2 font-bold text-slate-800">Saturday, October 31, 2026 · 2–3:30 PM</p>
        <p className="mt-2 text-slate-700">Every child nominated for this month&apos;s giveaway is invited for free admission and free sno cones. Come in costume for the costume contest!</p>
        <Link href={GIVEAWAY_PARTY_RSVP_URL} className="mt-5 inline-flex min-h-12 items-center rounded-full bg-cyan-700 px-6 py-3 font-black text-white hover:bg-cyan-800">Invited families: RSVP &amp; view guest list</Link>
      </div>
      <Link href="/nominees" className="mt-6 inline-flex min-h-11 items-center font-bold text-purple-700 underline">View all nominees</Link>
    </section>
  );
}
