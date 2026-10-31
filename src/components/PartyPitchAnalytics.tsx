import Link from "next/link";
import { loadPitchCampaign, listPitchEntries } from "@/lib/party-pitch/store";
import { PARTY_PITCH_AD_URL, summarizePitchEntries } from "@/lib/party-pitch/analytics";
import { googleReportingDates, type GoogleAdsReport } from "@/lib/analytics/google-reporting-core";
import { loadSharedGoogleCampaignTraffic } from "@/lib/analytics/shared-google-reporting";

export async function PartyPitchAnalytics({ preset }: { preset?: string }) {
  const dates = googleReportingDates(preset || "last_30d");
  try {
    const [config, entries] = await Promise.all([loadPitchCampaign(), listPitchEntries()]);
    const summary = summarizePitchEntries(entries, dates.since, dates.until);
    const campaignId = config.googleCampaignId || "";
    let google: GoogleAdsReport | null = null;
    if (/^\d{1,19}$/.test(campaignId)) {
      try { google = await loadSharedGoogleCampaignTraffic(campaignId, dates.preset); } catch { /* Show unavailable, never invented zeros. */ }
    }
    const traffic = google?.status === "connected" && google.campaignId === campaignId ? google.totals : null;
    const number = (value: number | undefined | null) => value == null ? "—" : value.toLocaleString("en-US");
    const money = (value: number | undefined | null) => value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: google?.currency || "USD" }).format(value);
    const googleUrl = campaignId ? `https://ads.google.com/aw/overview?ocid=8586212544&campaignId=${encodeURIComponent(campaignId)}` : "https://ads.google.com/";
    return <section id="party-pitch-analytics" aria-label="Party Pitch ad analytics" className="mt-6 rounded-2xl border-2 border-purple-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest text-purple-800">Ridiculous Party Pitch</p><h2 className="mt-1 text-2xl font-black">Poster ad &amp; applications</h2><p className="mt-2 text-sm text-slate-600">{dates.since} through {dates.until} · applications use Eastern Time; Google results use {google?.timeZone || "the ad account timezone"}.</p></div><div className="flex flex-wrap gap-3 text-sm font-bold"><Link href="/admin/party-pitches" className="text-purple-800 underline">Review all applicants</Link><Link href="/admin/ad-analytics/google#party-pitch-analytics" className="text-purple-800 underline">Google ad analytics</Link><a href={googleUrl} target="_blank" rel="noopener noreferrer" className="text-purple-800 underline">Open Google Ads</a></div></div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">{[["Saved applications", number(summary.entries)], ["Shortlisted", number(summary.shortlisted)], ["Google impressions", number(traffic?.impressions)], ["Google clicks", number(traffic?.clicks)], ["Google spend", money(traffic?.spend)]].map(([label, value]) => <div key={label} className="rounded-xl bg-purple-50 p-4"><p className="text-xs font-bold text-slate-600">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}</div>
      <p className="mt-4 text-sm text-slate-600">Applications count only after saving successfully. Repeat submissions count once. Source labels come from the entry link and are not proof of Google-attributed conversions. Rental-request conversions are reported separately.</p>
      <p role="status" className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">{!campaignId ? "The Display ad is awaiting completion and budget approval. Link its published Google campaign ID in Contest setup to load impressions, clicks and spend. No ad delivery is claimed here." : google ? `${google.campaign?.name || "Google campaign"}: ${google.campaign?.status || google.status}. ${google.freshness?.warning || google.message}` : "Google campaign reporting is unavailable. Missing data is shown as a dash."}{google?.fetchedAt ? ` Last fetched ${new Date(google.fetchedAt).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" })}.` : ""}</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2"><div><h3 className="font-black">Saved applications by source</h3>{summary.sources.length ? <table className="mt-2 w-full text-left text-sm"><thead><tr><th className="py-2">Source</th><th className="py-2 text-right">Applications</th></tr></thead><tbody>{summary.sources.map(row => <tr key={row.channel}><td className="border-t py-2">{row.channel}</td><td className="border-t py-2 text-right">{row.entries}</td></tr>)}</tbody></table> : <p className="mt-2 text-sm text-slate-600">No saved applications in this period.</p>}</div><div><h3 className="font-black">Recent application days</h3>{summary.daily.length ? <ul className="mt-2 text-sm">{summary.daily.slice(0, 7).map(row => <li key={row.date} className="flex justify-between border-b py-2"><span>{row.date}</span><span>{row.entries}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Application totals will appear here as entries arrive.</p>}</div></div>
      <details className="mt-5 text-sm"><summary className="cursor-pointer font-bold">Poster &amp; tracked destination</summary><img src="/images/campaigns/party-pitch-display-580x400.jpg" width={580} height={400} alt="Ridiculous Party Pitch poster featuring a crowned recliner, graduate dog and royal corgis" className="mt-3 h-auto max-w-full rounded-xl" /><p className="mt-3">Use this destination for the Display poster so applications are labeled Google Display:</p><code className="mt-2 block break-all rounded-lg bg-slate-50 p-3 text-xs">{PARTY_PITCH_AD_URL}</code><Link href="/campaigns/ridiculous-party-pitch" className="mt-3 inline-block font-bold text-purple-800 underline">Open entry page</Link></details>
    </section>;
  } catch {
    return <section id="party-pitch-analytics" className="mt-6 rounded-2xl border border-rose-200 bg-white p-5" role="alert"><h2 className="text-xl font-black">Party Pitch analytics could not be loaded</h2><p className="mt-2 text-sm">Refresh to try again. Unavailable counts have not been replaced with zeros.</p><Link href="/admin/party-pitches" className="mt-3 inline-block font-bold text-purple-800 underline">Open applicants dashboard</Link></section>;
  }
}
