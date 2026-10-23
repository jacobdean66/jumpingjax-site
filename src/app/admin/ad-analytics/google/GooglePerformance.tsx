import Link from "next/link";
import type { GoogleAdsReport } from "@/lib/analytics/google-reporting-core";

export function GooglePerformance({ report, compact = false }: { report: GoogleAdsReport; compact?: boolean }) {
  const number = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: report.currency });
  return <section aria-label="Google Ads performance" className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-black">{report.preset === "today" ? "Today — Google Ads" : "Google Ads performance"}</h2>
      <Link href="/admin/ad-analytics/google" className="text-sm font-bold text-sky-800">{compact ? "Open Google Ads report" : "Reset / refresh report"}</Link>
    </div>
    <p className="mt-2 text-sm">Account 715-139-9909 · Inflatable Rentals – 15% Off</p>
    <p className="mt-1 text-xs text-slate-600">Google reporting period: {report.since} through {report.until}</p>
    <nav aria-label="Google Ads reporting period" className="mt-3 flex flex-wrap gap-3 text-sm font-bold">{[["today", "Today"], ["last_7d", "Last 7 days"], ["last_30d", "Last 30 days"]].map(([preset, label]) => <Link key={preset} href={`/admin/ad-analytics/google?preset=${preset}`} aria-current={report.preset === preset ? "page" : undefined} className="rounded-full border border-slate-300 px-3 py-1 aria-[current=page]:bg-sky-100">{label}</Link>)}</nav>
    <p role="status" className={`mt-3 rounded-xl p-3 text-sm ${report.status === "connected" ? "bg-emerald-50 text-emerald-950" : "bg-amber-50 text-amber-950"}`}>{report.message}</p>
    {report.fetchedAt ? <p className="mt-2 text-xs text-slate-600">Fetched {new Date(report.fetchedAt).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" })} · {report.since} through {report.until} · Account timezone: {report.timeZone}</p> : null}
    {report.freshness?.warning ? <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{report.freshness.warning} Last refresh attempt: {new Date(report.freshness.lastAttemptAt).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" })}. <Link className="font-bold underline" href="/admin/ad-analytics/google">Check reporting connection</Link></p> : null}
    {report.campaign ? <p className="mt-3 text-sm font-bold">{report.campaign.name} · {report.campaign.status.replaceAll("_", " ")}{report.campaign.dailyBudget !== null ? ` · ${money(report.campaign.dailyBudget)} average daily budget` : ""}</p> : null}
    <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[
        ["Spend", report.totals ? money(report.totals.spend) : "Unavailable"],
        ["Clicks", report.totals ? number(report.totals.clicks) : "Unavailable"],
        ["Impressions", report.totals ? number(report.totals.impressions) : "Unavailable"],
        ["Saved rental requests", report.totals ? number(report.totals.savedRentalRequests) : "Unavailable"],
      ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><dt className="text-sm text-slate-600">{label}</dt><dd className="mt-1 text-2xl font-black">{value}</dd></div>)}
    </dl>
    {report.totals ? <p className="mt-3 text-sm">Click rate: {report.totals.ctr === null ? "—" : `${number(report.totals.ctr)}%`} · Cost per saved rental request: {report.totals.costPerRentalRequest === null ? "—" : money(report.totals.costPerRentalRequest)}</p> : null}
    <p className="mt-3 text-xs text-slate-600">Rental leads use Google’s attribution for the “Rental request saved” action. Requests are not paid bookings or revenue. The report reads data and cannot change campaigns or budgets.</p>
    {report.preset === "today" ? <p className="mt-2 text-xs text-slate-600">Today follows the Google Ads account’s timezone. Google reporting can lag, and today’s totals can change as clicks and conversions are processed.</p> : null}
  </section>;
}
