import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { campaignIssues, entriesOpen, PARTY_PITCH_PATH } from "@/lib/party-pitch/model";
import { loadPitchCampaign } from "@/lib/party-pitch/store";
import { BACKYARD_POSTER } from "@/lib/admin/backyard-takeover";
import { BACKYARD_LANDING_PATH, entriesAreOpen } from "@/lib/admin/backyard-tracking";
import { loadBackyardCampaign } from "@/lib/admin/backyard-takeover-store";
import { loadBackyardSettings } from "@/lib/admin/backyard-tracking-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Giveaways & Promotions",
  description: "See current Jumping Jax giveaways, promotions, and community campaigns.",
  alternates: { canonical: "/ads" },
};

export default async function AdsPage() {
  const [partyPitch, backyard] = await Promise.all([
    loadPitchCampaign().catch(() => null),
    Promise.all([loadBackyardCampaign(), loadBackyardSettings()]).then(([campaign, settings]) => ({ campaign, settings })).catch(() => null),
  ]);
  const showPartyPitch = partyPitch && partyPitch.status !== "draft" && campaignIssues(partyPitch).length === 0;
  const showBackyard = backyard && entriesAreOpen(backyard.campaign, backyard.settings);
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

        {showBackyard ? <section className="mt-10 overflow-hidden rounded-[2rem] border-4 border-cyan-200 bg-white shadow-xl">
          <div className="grid items-center gap-6 p-6 sm:p-9 md:grid-cols-[minmax(0,1fr)_15rem]">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-cyan-800">{backyard.settings.monthly ? "Monthly giveaway" : "Giveaway"} · Enter free</p>
              <h2 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">Win a Backyard Takeover.</h2>
              <p className="mt-4 font-semibold leading-relaxed text-slate-700">{backyard.campaign.prize}</p>
              <p className="mt-3 text-sm font-semibold text-slate-600">{backyard.settings.monthly ? "One entry per customer each month. " : ""}Eligibility and official rules are on the entry page.</p>
              <Link href={BACKYARD_LANDING_PATH} className="mt-6 inline-flex min-h-12 items-center rounded-full bg-orange-500 px-6 py-3 font-black text-slate-950 shadow-[0_5px_0_#c2410c] transition hover:bg-orange-400">Enter the giveaway</Link>
            </div>
            <Image src={BACKYARD_POSTER} alt="Backyard Takeover poster with a giant duck, a Jeep full of rubber ducks and inflatables" width={1122} height={1402} sizes="(max-width: 767px) 240px, 240px" className="mx-auto h-auto w-full max-w-60 rounded-2xl" />
          </div>
        </section> : null}

        {showPartyPitch ? <section className="mt-10 rounded-[2rem] border-4 border-purple-200 bg-white p-6 shadow-xl sm:p-9">
          <p className="text-xs font-black uppercase tracking-widest text-fuchsia-700">The Most Ridiculous Party Pitch in Greenwood</p>
          <h2 className="mt-3 text-3xl font-black text-purple-950 sm:text-4xl">Good friends. Great party. Ridiculous reason.</h2>
          <p className="mt-4 font-semibold text-slate-700">Retire the recliner. Graduate the dog. Get your people together.</p>
          <Link href={PARTY_PITCH_PATH} className="mt-6 inline-block rounded-full bg-purple-800 px-6 py-3 font-black text-white">{partyPitch && entriesOpen(partyPitch) ? "Pitch my party" : "View contest details"}</Link>
        </section> : null}

        <section className="mt-10 overflow-hidden rounded-[2rem] border-4 border-pink-200 bg-white shadow-2xl">
          <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
            <div className="p-6 sm:p-9">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-pink-600">October giveaway closed</p>
              <h2 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">Thank you for your nominations!</h2>
              <p className="mt-4 font-semibold leading-relaxed text-slate-700">
                October&apos;s nominations are closed and the winner has been selected. Thank you to everyone who took part!
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
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
                <p className="mt-3 text-4xl font-black leading-none">Winner selected.<br />Let&apos;s celebrate!</p>
                <p className="mt-4 text-sm font-bold text-slate-200">Nominations are closed</p>
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
