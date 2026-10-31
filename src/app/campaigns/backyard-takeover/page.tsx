import Image from "next/image";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { BACKYARD_POSTER } from "@/lib/admin/backyard-takeover";
import { entriesAreOpen, entryReadiness } from "@/lib/admin/backyard-tracking";
import { loadBackyardCampaign } from "@/lib/admin/backyard-takeover-store";
import { loadBackyardSettings } from "@/lib/admin/backyard-tracking-store";
import { BackyardEntryForm } from "@/components/giveaway/BackyardEntryForm";
import { backyardTermsFingerprint } from "@/lib/admin/backyard-tracking-security";

export const dynamic = "force-dynamic";
export const metadata = { title: "Backyard Takeover | Jumping Jax", description: "This party has no chill. See the Jumping Jax Backyard Takeover contest in Greenwood, South Carolina." };
export default async function BackyardTakeoverLanding({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const params = await searchParams;
  const preview = params.preview === "1" && (await verifyAdminOwnerAccess()).ok;
  try {
    const [campaign, settings] = await Promise.all([loadBackyardCampaign(), loadBackyardSettings()]);
    const open = entriesAreOpen(campaign, settings);
    const detailsReady = entryReadiness(campaign,settings).length === 0;
    const showDetails = preview || (detailsReady && campaign.status !== "draft");
    const date = (value: string) => new Date(value).toLocaleString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    const notice = campaign.status === "closed" || (settings.closesAt && Date.now() >= Date.parse(settings.closesAt)) ? { title: "Entries have closed.", message: "Thank you for sharing your backyard party ideas. Watch for the winner announcement." }
      : campaign.status === "paused" ? { title: "Entries are paused.", message: "Please check back here for updates from Jumping Jax." }
      : campaign.status === "published" && detailsReady && Date.now() < Date.parse(settings.opensAt) ? { title: "The takeover is almost here.", message: `Entries open ${date(settings.opensAt)}. Come back then to submit your backyard.` } : undefined;
    return <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6"><div className="mx-auto max-w-6xl">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Jumping Jax · Greenwood, SC</p>
      <h1 className="mt-4 max-w-4xl text-5xl font-black uppercase leading-none sm:text-7xl">This party has <span className="text-yellow-300">no chill.</span></h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-200">A giant duck. A Jeep full of ducks. One spectacular backyard party idea.</p>
      {(open || preview) && <a href="#enter" className="mt-5 inline-flex min-h-12 items-center rounded-full bg-yellow-300 px-6 py-3 font-black text-slate-950">Enter my backyard →</a>}
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div><Image src={BACKYARD_POSTER} alt="Jumping Jax Backyard Takeover poster with a giant duck, a duck-filled Jeep and an inflatable parade." width={1122} height={1402} loading="eager" sizes="(max-width:1023px) 100vw, 550px" className="h-auto w-full rounded-3xl" /><p className="mt-3 text-xs leading-relaxed text-slate-300">Illustrated concept. The Jeep and UFO are artwork, not part of the rental prize.</p></div>
        <div className="grid gap-5">
          {showDetails && <section className="rounded-3xl border border-cyan-500/40 bg-slate-900 p-6"><p className="text-sm font-black uppercase text-cyan-300">The Backyard Takeover prize</p><p className="mt-3 whitespace-pre-wrap text-lg font-bold">{campaign.prize}</p><p className="mt-3 text-sm">Eligible area: {settings.eligibleArea}</p>{settings.retailValue && <p className="mt-2 text-sm">Prize retail value: ${settings.retailValue}</p>}{settings.closesAt && <p className="mt-2 text-sm">Entries close: {date(settings.closesAt)}</p>}{settings.announcesOn && <p className="mt-2 text-sm">Winner announcement: {settings.announcesOn}</p>}</section>}
          <BackyardEntryForm open={open} preview={preview} eligibleArea={settings.eligibleArea} termsVersion={backyardTermsFingerprint(campaign, settings)} conversionDestination={settings.googleConversionDestination} notice={notice} />
        </div>
      </div>
      {showDetails && <section id="rules" className="mt-8 rounded-3xl bg-white p-6 text-slate-950 sm:p-8"><h2 className="text-2xl font-black">Official contest rules</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{campaign.rules}</p></section>}
    </div></main>;
  } catch { return <main className="min-h-screen bg-slate-950 px-4 py-20 text-white"><div className="mx-auto max-w-xl"><h1 className="text-4xl font-black">Backyard Takeover</h1><p className="mt-5 leading-relaxed">Contest details are temporarily unavailable. Please check back shortly.</p></div></main>; }
}
