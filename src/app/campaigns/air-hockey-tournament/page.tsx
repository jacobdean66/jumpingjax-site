import Link from "next/link";
import { formatEventDate, formatEventTime, loadAirHockeyCampaignEvent } from "@/lib/admin/air-hockey-campaign";
import { AirHockeySignupForm } from "./AirHockeySignupForm";

export const dynamic = "force-dynamic";

export default async function AirHockeyTournamentPage() {
  const event = await loadAirHockeyCampaignEvent().catch((error) => { console.error("[campaigns] air hockey page load failed", error); return null; });
  const isOpen = event?.status === "published";
  const dateLabel = formatEventDate(event?.eventDate ?? null);
  const timeLabel = formatEventTime(event?.startTime ?? null, event?.endTime ?? null);
  const spotsLabel = event?.signupCapacity != null ? `${Math.max(0, event.signupCapacity - event.signupCount)} spots left` : "Limited spots";
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="border-b border-white/10 bg-slate-900 px-4 py-4"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4"><Link href="/" className="text-2xl font-black">Jumping Jax</Link><Link href="/" className="rounded-full border border-white/20 px-4 py-2 text-sm font-black text-white">Main site</Link></div></section>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_420px] lg:py-16">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-sky-300">Arcade Tournament</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-black leading-none md:text-7xl">Air Hockey Tournament</h1>
          <p className="mt-5 max-w-2xl text-xl font-semibold leading-relaxed text-slate-200">{event?.offerText ?? "Play the tournament, then play on the inflatables while you wait for your next match."}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">{[["Date", dateLabel], ["Time", timeLabel], ["Entry", event?.signupPrice ?? "Price TBD"]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/10 p-4"><p className="text-xs font-black uppercase text-slate-300">{label}</p><p className="mt-2 text-lg font-black">{value}</p></div>)}</div>
          <section className="mt-8 rounded-2xl border border-sky-300/30 bg-sky-400/10 p-5"><h2 className="text-2xl font-black">Tournament while they play</h2><p className="mt-3 text-base font-semibold leading-relaxed text-slate-200">Players can rotate through matches while the rest of the family uses the inflatable play area. Final age groups, prizes, and bracket timing will be confirmed before the event goes live.</p></section>
        </div>
        <aside className="rounded-3xl border border-white/10 bg-white p-5 text-slate-950 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">Sign Up</p><h2 className="mt-2 text-3xl font-black">Get on the list</h2></div><span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black uppercase text-white">{spotsLabel}</span></div><p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">{event?.shortDescription ?? "A family-friendly air hockey tournament at Jumping Jax with inflatables available while players wait."}</p><div className="mt-5"><AirHockeySignupForm isOpen={isOpen} /></div>{event?.rulesText ? <p className="mt-4 text-xs font-semibold leading-relaxed text-slate-500">{event.rulesText}</p> : null}</aside>
      </section>
    </main>
  );
}
