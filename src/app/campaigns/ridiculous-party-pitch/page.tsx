import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { campaignIssues, campaignMessage, entriesOpen, formatPitchDate, PARTY_PITCH_PATH, PARTY_PITCH_TITLE } from "@/lib/party-pitch/model";
import { loadPitchCampaign } from "@/lib/party-pitch/store";
import { PitchForm } from "./PitchForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: PARTY_PITCH_TITLE,
  description: "Good friends. Great party. Ridiculous reason. Discover Jumping Jax's ridiculous party pitch contest in Greenwood, South Carolina.",
  alternates: { canonical: PARTY_PITCH_PATH },
};

export default async function PartyPitchPage() {
  let config: Awaited<ReturnType<typeof loadPitchCampaign>> | null = null;
  try { config = await loadPitchCampaign(); } catch { /* Fail closed; no entries accepted without confirmed settings. */ }
  const open = config ? entriesOpen(config) : false;
  const showRules = config && config.status !== "draft" && campaignIssues(config).length === 0;
  return <main className="min-h-screen bg-[#fffbed] px-4 py-10 text-purple-950 sm:px-6 sm:py-14">
    <div className="mx-auto max-w-6xl">
      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-fuchsia-700">Jumping Jax presents</p>
          <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">{PARTY_PITCH_TITLE}</h1>
          <p className="mt-6 text-4xl font-black leading-[1.05] sm:text-6xl">Good friends.<br /><span className="text-teal-700">Great party.</span><br />Ridiculous reason.</p>
          <p className="mt-5 max-w-lg text-lg font-semibold leading-relaxed">Retire the recliner. Graduate the dog. Get your people together.</p>
          {open ? <a href="#entry" className="mt-6 inline-block rounded-full bg-purple-800 px-7 py-3 font-black text-white">Pitch my party</a> : <p className="mt-6 rounded-2xl border border-purple-200 bg-white p-5 font-bold" role="status">{config ? campaignMessage(config) : "Contest details are temporarily unavailable. Please check back shortly."}</p>}
        </div>
        <div className="relative aspect-[1.2] overflow-hidden rounded-[2rem] border-4 border-white shadow-xl">
          <Image src="/images/campaigns/ridiculous-party-pitch.png" alt="A ridiculous backyard coronation for a retired recliner, with a dog at a podium, corgi guards, and a tiny squirrel band." width={1734} height={907} sizes="(max-width: 1024px) 160vw, 850px" priority className="absolute left-0 top-0 h-full w-auto max-w-none" />
        </div>
      </section>
      <section className="mt-10 grid gap-4 md:grid-cols-3" aria-label="Example party ideas">
        {[["The Recliner Retirement Reception", "After years of supporting the family, it deserves a proper send-off."], ["The Dog's Graduation", "An impressive academic career in occasionally coming when called."], ["The Minivan Farewell Tour", "Celebrating 240,000 miles and an unidentified French fry collection."]].map(([title, detail]) => <div key={title} className="rounded-2xl border border-purple-100 bg-white p-5"><p className="text-xs font-bold uppercase text-fuchsia-700">Example pitch</p><h2 className="mt-2 text-lg font-black">{title}</h2><p className="mt-2 text-sm leading-relaxed">{detail}</p></div>)}
      </section>
      {showRules && config ? <section className="mt-10 rounded-3xl border-2 border-teal-200 bg-white p-6 sm:p-9">
        <h2 className="text-2xl font-black">One judged winner. One party rental package.</h2>
        <p className="mt-3 whitespace-pre-wrap leading-relaxed">{config.prize}</p>
        <p className="mt-3 font-semibold">The winner chooses the party date.</p>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="font-black">Maximum prize value</dt><dd>${Number(config.retailValue).toFixed(2)}</dd></div><div><dt className="font-black">Eligible area</dt><dd>{config.eligibleArea}</dd></div><div><dt className="font-black">Entry window</dt><dd>{formatPitchDate(config.opensOn)}–{formatPitchDate(config.closesOn)}. Closes at 11:59 p.m. Eastern.</dd></div><div><dt className="font-black">Winner announcement</dt><dd>{formatPitchDate(config.announcesOn)}</dd></div></dl>
        <p className="mt-5 text-sm font-semibold">Free to enter. No purchase necessary. Adults 18+. One entry per email. Entries are judged under the Award Rules; this is not a random drawing.</p>
      </section> : null}
      {open ? <section id="entry" className="mt-10 scroll-mt-6"><PitchForm /></section> : null}
      {showRules && config ? <section id="award-rules" className="mt-10 scroll-mt-6 rounded-3xl border border-purple-100 bg-white p-6 sm:p-9"><h2 className="text-2xl font-black">Award Rules</h2><p className="mt-3 text-sm font-bold">Sponsored by Jumping Jax LLC, Greenwood, South Carolina.</p><div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{config.rules}</div></section> : null}
      <section className="mt-10 text-center"><h2 className="text-2xl font-black">Already have a reason to celebrate?</h2><p className="mt-3">You can plan your party any time.</p><Link href="/rentals" className="mt-4 inline-block rounded-full border-2 border-purple-700 px-6 py-3 font-black">Explore party rentals</Link></section>
    </div>
  </main>;
}
