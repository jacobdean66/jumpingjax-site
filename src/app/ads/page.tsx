import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Giveaways & Promotions",
  description: "See current Jumping Jax giveaways, promotions, and community campaigns.",
};

export default function AdsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e9d5ff_0,#fff8e8_45%,#cffafe_100%)] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="text-center">
          <p className="inline-flex rotate-[-1deg] rounded-full bg-purple-200 px-5 py-2 text-sm font-black uppercase tracking-wider text-purple-950 shadow-[0_5px_0_#c084fc]">
            Jumping Jax Ads
          </p>
          <h1 className="mt-7 text-4xl font-black leading-[0.95] text-slate-950 sm:text-6xl">
            Giveaways, deals &amp; <span className="text-purple-600">big fun</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold text-slate-700">
            Find our current promotions and community campaigns in one place.
          </p>
        </header>

        <section className="mt-10 overflow-hidden rounded-[2rem] border-4 border-pink-200 bg-white shadow-2xl">
          <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
            <div className="p-6 sm:p-9">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-pink-600">Current giveaway</p>
              <h2 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">Win a free party!</h2>
              <p className="mt-4 font-semibold leading-relaxed text-slate-700">
                Nominate a child for a September birthday celebration or a back-to-school party at Jumping Jax in Greenwood.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/nominate"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-orange-500 px-6 py-3 text-center text-sm font-black uppercase tracking-wide text-white shadow-[0_6px_0_#c2410c] transition hover:-translate-y-0.5 hover:bg-orange-400"
                >
                  Nominate a child
                </Link>
                <Link
                  href="/nominees"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-pink-300 bg-pink-50 px-6 py-3 text-center text-sm font-black uppercase tracking-wide text-pink-800 transition hover:-translate-y-0.5 hover:bg-pink-100"
                >
                  View all nominees
                </Link>
              </div>
            </div>

            <div className="flex min-h-64 items-center justify-center bg-[linear-gradient(135deg,#f9a8d4_0%,#facc15_48%,#67e8f9_100%)] p-8 text-center">
              <div className="rotate-2 rounded-[2rem] border-4 border-white bg-slate-950 px-7 py-9 text-white shadow-xl">
                <p className="text-sm font-black uppercase tracking-[0.16em] text-yellow-300">2026 Giveaway</p>
                <p className="mt-3 text-4xl font-black leading-none">One winner.<br />One free party.</p>
                <p className="mt-4 text-sm font-bold text-slate-200">Entries close August 30</p>
              </div>
            </div>
          </div>
        </section>

        <p className="mt-8 text-center text-sm font-semibold text-slate-600">
          More Jumping Jax promotions will be added here as they launch.
        </p>
      </div>
    </main>
  );
}
