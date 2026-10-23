import type { SearchConsoleReport } from "@/lib/analytics/search-console-core";

export function SearchConsolePerformance({ report, canConnect }: { report: SearchConsoleReport; canConnect: boolean }) {
  const totals = report.totals;
  const metrics = [
    ["Organic clicks", totals?.clicks.toLocaleString("en-US")],
    ["Organic impressions", totals?.impressions.toLocaleString("en-US")],
    ["Search click rate", totals ? (totals.ctr === null ? "—" : `${totals.ctr.toFixed(2)}%`) : undefined],
    ["Average position", totals ? (totals.position === null ? "—" : totals.position.toFixed(1)) : undefined],
  ];
  return <section aria-label="Search Console performance" className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
    <h2 className="text-xl font-black">Organic search — Search Console</h2>
    <p className="mt-2 text-sm">{report.since} through {report.until} · Google’s Pacific reporting dates · Web search</p>
    <p className="mt-2 text-sm" role="status">{report.message}</p>
    {report.property ? <p className="mt-2 break-all text-xs text-slate-600">Property: {report.property}</p> : null}
    {report.fetchedAt ? <p className="mt-2 text-xs text-slate-600">Fetched {new Date(report.fetchedAt).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" })}</p> : null}
    {report.freshness?.warning ? <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{report.freshness.warning} Last refresh attempt: {new Date(report.freshness.lastAttemptAt).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" })}.</p> : null}
    <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map(([label, value]) => <div className="rounded-xl bg-slate-50 p-3" key={label}><dt className="text-xs font-bold text-slate-600">{label}</dt><dd className="mt-1 text-xl font-black">{value ?? "Unavailable"}</dd></div>)}</dl>
    <p className="mt-3 text-xs text-slate-600">Finalized organic search data can lag recent days. These are unpaid search results, separate from ad clicks and rental requests.</p>
    <h3 className="mt-5 font-bold">Submitted sitemaps</h3>
    {report.sitemaps ? report.sitemaps.length ? <ul className="mt-2 space-y-2">{report.sitemaps.map(sitemap => <li key={sitemap.path} className="break-all rounded-xl bg-slate-50 p-3 text-sm">
      <p className="font-bold">{sitemap.path}</p>
      <p>{sitemap.pending ? "Processing pending" : "Processing completed"} · Errors: {sitemap.errors} · Warnings: {sitemap.warnings}</p>
      <p>Last downloaded: {sitemap.lastDownloaded ? new Date(sitemap.lastDownloaded).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" }) : "Not reported"}</p>
    </li>)}</ul> : <p className="mt-2 text-sm">Google reports no submitted sitemaps for this property.</p> : <p className="mt-2 text-sm">{report.sitemapMessage || "Sitemap status unavailable until Search Console is connected."}</p>}
    {(report.status !== "connected" || report.freshness?.lastAttemptStatus === "reconnect" || report.freshness?.lastAttemptStatus === "permission_required") && canConnect ? <form method="post" action="/api/admin/ad-analytics/google/connect?service=search_console" className="mt-4"><button type="submit" className="rounded-full bg-sky-700 px-4 py-2 text-sm font-bold text-white">{report.status === "reconnect" || report.freshness?.lastAttemptStatus === "reconnect" ? "Reconnect Search Console" : "Connect Search Console"}</button></form> : null}
    <p className="mt-3 text-xs text-slate-600">Search Console uses a separate read-only Google authorization. Connect an account with access to jumpingjaxllc.com. The connection cannot edit your site or submit sitemaps.</p>
    <p className="mt-2 text-xs text-slate-600">Sitewide indexed-page totals and rich-result validation remain in Google Search Console; this report does not infer them from sitemap counts.</p>
    <a className="mt-3 inline-block text-sm font-bold text-sky-800 underline" href="https://search.google.com/search-console?resource_id=https%3A%2F%2Fjumpingjaxllc.com%2F" target="_blank" rel="noopener noreferrer">Open Search Console</a>
  </section>;
}
