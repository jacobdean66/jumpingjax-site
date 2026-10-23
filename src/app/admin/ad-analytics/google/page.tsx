import Link from "next/link";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../../_components";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { GOOGLE_ADS_TAG_ID, GOOGLE_ADS_RENTAL_DESTINATION } from "@/lib/analytics/google-ads";
import { inflatableCampaignDraft as draft, googleAdsSetupSnapshot as snapshot } from "@/lib/analytics/google-campaign";
import { loadGoogleAdsReport } from "@/lib/analytics/google-reporting";
import { googleReportingConfig } from "@/lib/analytics/google-reporting-core";
import { GOOGLE_ADS_CALLBACK_PATH, googleAdsCookieKey } from "@/lib/analytics/google-reporting-auth";
import { getCanonicalSiteUrl } from "@/lib/site-url";
import { GooglePerformance } from "./GooglePerformance";
import { SearchConsolePerformance } from "./SearchConsolePerformance";
import { loadSearchConsoleReport } from "@/lib/analytics/search-console";
import { sharedGoogleConnectionStatus } from "@/lib/analytics/shared-google-reporting";
import { GoogleReportAutoRefresh } from "./GoogleReportAutoRefresh";

export const dynamic = "force-dynamic";

const button = "inline-flex rounded-full bg-sky-700 px-4 py-2 text-sm font-bold text-white";

export default async function GoogleAdsSeoPage({ searchParams }: { searchParams?: Promise<{ preset?: string; google_ads?: string; search_console?: string; shared?: string; refresh?: string; refresh_all?: string }> }) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const params = await searchParams || {};
  const [report, searchReport, shared] = await Promise.all([loadGoogleAdsReport(params.preset || "today", params.refresh === "1"), loadSearchConsoleReport(params.preset || "last_30d", params.refresh === "1"), sharedGoogleConnectionStatus()]);
  const canConnect = googleReportingConfig(process.env).oauthReady && Boolean(googleAdsCookieKey(process.env));
  const connectionMessages: Record<string, string> = {
    configuration_required: "Google reporting connection needs server configuration before authorization can start.",
    invalid_state: "That connection attempt expired or belonged to another session. Start a new connection below.",
    cancelled: "Google connection was cancelled. No reporting permission was saved.",
    authorization_failed: "Google did not complete reporting authorization. Try connecting again.",
    connected: "Google authorization was saved securely for shared owner reporting. Reporting access is checked below.",
  };
  return <AdminShell>
    <GoogleReportAutoRefresh />
    <AdminHeader eyebrow="Owner Tools" title="Google Ads & SEO">
      <AdminNav token="" role={auth.role} active="ad-analytics" />
    </AdminHeader>
    <nav aria-label="Advertising channels" className="mt-5 flex gap-3 text-sm font-bold">
      <Link href="/admin/ad-analytics" className="rounded-full border border-slate-300 px-4 py-2">Meta Ads</Link>
      <span className="rounded-full bg-slate-950 px-4 py-2 text-white">Google Ads &amp; SEO</span>
    </nav>
    <section aria-label="Shared Google reporting" className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-black">Google reporting across your devices</h2>
      <p className="mt-2 text-sm">Google Ads: {shared.ads ? "Shared connection active" : "Shared connection not enabled"} · Search Console: {shared.search_console ? "Shared connection active" : "Shared connection not enabled"}.</p>
      <p className="mt-2 text-sm">Shared reports refresh automatically three times daily, even when this page is closed. Opening a report also refreshes data more than five minutes old. Each report shows the time Google was last checked; Google can publish results later.</p>
      <div className="mt-3 flex flex-wrap gap-4">{(["ads", "search_console"] as const).filter(service => shared[service]).map(service => <form key={service} method="post" action={`/api/admin/ad-analytics/google/disconnect?service=${service}`}><button type="submit" className="text-xs font-bold text-slate-600 underline">Disconnect {service === "ads" ? "Google Ads" : "Search Console"} reporting</button></form>)}</div>
      {shared.ads || shared.search_console ? <form method="post" action="/api/admin/ad-analytics/google/refresh" className="mt-3"><button className={button} type="submit">Refresh all shared reports</button></form> : null}
      {params.refresh_all ? <p role="status" className="mt-3 text-sm">{params.refresh_all === "complete" ? "All six shared reports refreshed successfully: Today, Last 7 days, and Last 30 days for Google Ads and Search Console." : "Some shared reports could not refresh. Check the connection and report warnings below; last successful reports were retained."}</p> : null}
      {!shared.ads || !shared.search_console ? <form method="post" action="/api/admin/ad-analytics/google/share" className="mt-3"><button className={button} type="submit">Enable shared reports from this browser</button><p className="mt-2 text-xs text-slate-600">Use the browser already connected to Karen’s accounts. Existing reporting authorizations are saved encrypted on the server for owner access across devices and scheduled updates, until disconnected or revoked.</p></form> : null}
      {params.shared === "incomplete" ? <p role="alert" className="mt-3 text-sm font-bold text-amber-900">Some reporting connections could not be shared. Use the connected browser, or connect the missing service below.</p> : null}
    </section>
    <p className="mt-5 text-sm text-slate-600">Today’s paid-ad numbers appear by default. Organic search initially shows the last 30 days because finalized SEO data can lag. Each report states its own dates. The campaign setup record below was manually verified {snapshot.recordedDate}.</p>
    <form className="mt-5 flex flex-wrap items-end gap-3" method="get">
      <label className="text-sm font-bold">Reporting period<select name="preset" defaultValue={report.preset} className="ml-3 rounded-lg border border-slate-300 p-2"><option value="last_7d">Last 7 days</option><option value="last_30d">Last 30 days</option><option value="today">Today</option></select></label>
      <input type="hidden" name="refresh" value="1" />
      <button className={button} type="submit">Refresh performance</button>
    </form>
    <GooglePerformance report={report} />
    {params.search_console && connectionMessages[params.search_console] ? <p className="mt-4 rounded-xl bg-sky-50 p-3 text-sm" role="status">Search Console: {connectionMessages[params.search_console]}</p> : null}
    <SearchConsolePerformance report={searchReport} canConnect={canConnect} />
    {params.google_ads && connectionMessages[params.google_ads] ? <p className="mt-4 rounded-xl bg-sky-50 p-3 text-sm" role="status">{connectionMessages[params.google_ads]}</p> : null}
    {report.status !== "connected" || report.freshness?.lastAttemptStatus === "reconnect" || report.freshness?.lastAttemptStatus === "permission_required" ? <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-black">Connect Google reporting</h2>
      <p className="mt-2 text-sm">Sign in as Karen and authorize Google Ads reporting. This dashboard only reads the replacement account and its rental campaign. Google’s consent screen uses its standard Ads permission, which also covers editing; this reporting connection has no campaign editing controls.</p>
      {canConnect ? <form method="post" action="/api/admin/ad-analytics/google/connect"><button className={`${button} mt-4`} type="submit">{report.status === "reconnect" ? "Reconnect Google Ads" : "Connect Google Ads"}</button></form> : <p className="mt-4 text-sm font-bold text-amber-900">Reporting authorization is not configured on this deployment yet. Campaign setup and website conversion tracking are recorded below.</p>}
      <p className="mt-3 text-xs text-slate-600">Authorization is stored encrypted on the server for owner reporting across devices and automatic updates. It is separate from the Google Calendar connection and remains active until disconnected or revoked.</p>
      <details className="mt-4 text-sm"><summary className="cursor-pointer font-bold">Connection setup details</summary>
        <p className="mt-2">Enable Google Ads API and production reporting access in the Google Cloud project that owns the OAuth client. Register this production redirect URI: <code>{getCanonicalSiteUrl()}{GOOGLE_ADS_CALLBACK_PATH}</code>.</p>
        <p className="mt-2">The server uses GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET, or the existing GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Reporting encryption uses GOOGLE_ADS_COOKIE_SECRET, ADMIN_SESSION_SECRET, or the server’s existing Supabase service key. Keep all secrets in hosting settings. Shared credentials and report snapshots use private server storage.</p>
        <a className="mt-2 inline-block font-bold text-sky-800" href="https://console.cloud.google.com/apis/library/googleads.googleapis.com" target="_blank" rel="noopener noreferrer">Open Google Ads API setup</a>
        <p className="mt-2">For organic reporting, enable Search Console API in the same Google Cloud project. Search Console uses the same registered callback and separate read-only authorization.</p>
        <a className="mt-2 inline-block font-bold text-sky-800" href="https://console.cloud.google.com/apis/library/searchconsole.googleapis.com" target="_blank" rel="noopener noreferrer">Open Search Console API setup</a>
      </details>
    </section> : null}
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-black">Replacement Google Ads account</h2>
        <p className="mt-3 break-all text-sm">Owner account: {snapshot.ownerEmail}</p>
        <p className="mt-3 text-sm">Public customer ID: {snapshot.publicCustomerId ?? "Pending verification"}. Last manually checked campaign status: {snapshot.liveCampaignStatus}.</p>
        <p className="mt-3 text-sm">Previous account {snapshot.oldCustomerId}: {snapshot.oldAccountStatus}. Campaign ID: 24386017082. Website conversion: Rental request saved (7823548968).</p>
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Last setup checks — Location: {snapshot.locationStatus}. Billing: {snapshot.billingStatus}. Advertiser verification: {snapshot.advertiserVerificationStatus}. These are not a live billing feed.</p>
        <a className={`${button} mt-4`} href={`https://ads.google.com/aw/overview?ocid=${snapshot.replacementInternalId}&campaignId=24386017082`} target="_blank" rel="noopener noreferrer">Open rental campaign in Google Ads</a>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-black">Historical SEO checks</h2>
        <p className="mt-3 text-sm">Historical Search Console snapshot from October 4, 2026: 152 clicks, 4,290 impressions, 3.5% click rate, average position 8.6 over three months. Most clicks came from brand searches.</p>
        <p className="mt-3 text-sm">The later Search Console review on October 21 showed 35 indexed pages, 85 not indexed, a successful sitemap read on October 20, and one remaining product-snippet error on the foam category. The live foam category was checked October 22 and now uses a linked item list rather than Product markup. Google must recrawl it before that report clears.</p>
        <p className="mt-3 text-sm">The promotion landing page intentionally uses noindex, follow and is excluded from the organic sitemap. Rental pages remain available for indexing. Google must crawl published repairs before its reports update.</p>
        <a className={`${button} mt-4`} href="https://search.google.com/search-console?resource_id=https%3A%2F%2Fjumpingjaxllc.com%2F" target="_blank" rel="noopener noreferrer">Open Search Console</a>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
        <h2 className="text-xl font-black">{draft.name}</h2>
        <p className="mt-3 text-sm">Offer: 15% off eligible bounce houses, bounce and slide combos, and inflatable obstacle courses. Delivery, mileage, accessories, yard games, foam parties and facility parties excluded. Customers claim the offer and request their event date; Jumping Jax confirms availability and delivery plans.</p>
        <div className="mt-4 flex flex-wrap gap-3"><Link className={button} href="/offers/inflatables-15" target="_blank">Preview 15% offer</Link><a className={button} href="/sitemap.xml" target="_blank" rel="noopener noreferrer">View sitemap</a></div>
        <p className="mt-4 text-sm">Website Ads tag: {GOOGLE_ADS_TAG_ID ?? "Disabled pending verified replacement tag"}. Rental-request destination: {GOOGLE_ADS_RENTAL_DESTINATION ?? "Pending verified conversion ID and label"}. The closed account’s destination has been retired. GA4 lead analytics remain active.</p>
        <p className="mt-3 text-sm">The deployed Ads conversion is configured to fire only after a rental request is successfully saved, using the request ID and browser duplicate guards. Offer views, discount clicks, phone clicks, and facility requests do not count as completed rental requests.</p>
        <p className="mt-3 text-sm font-bold text-amber-900">Authorized average daily budget: ${draft.dailyBudget}/day. Last setup record: {draft.status}.</p>
        <p className="mt-3 text-sm">Approved settings: Search · {draft.network} · Search partners off · Display Network off · {draft.language} · {draft.targeting}. {draft.bidding}.</p>
        <p className="mt-3 text-sm">AI Max, text customization, and final URL expansion off. Display path: {draft.displayPaths.join(" / ")}. Check for duplicate enabled campaigns before activation.</p>
        <h3 className="mt-5 font-black">Prepared ad headlines</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{draft.headlines.map(line => <li key={line}>{line}</li>)}</ul>
        <h3 className="mt-5 font-black">Prepared ad descriptions</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{draft.descriptions.map(line => <li key={line}>{line}</li>)}</ul>
        <h3 className="mt-5 font-black">Keywords</h3>
        <p className="mt-2 text-sm">Phrase: {draft.phraseKeywords.map(word => `“${word}”`).join(", ")}</p>
        <p className="mt-2 text-sm">Exact: {draft.exactKeywords.map(word => `[${word}]`).join(", ")}</p>
        <p className="mt-2 text-sm">Exclude: {draft.negativeKeywords.join(", ")}</p>
        <p className="mt-3 break-all text-xs text-slate-600">Destination: {draft.finalUrl}</p>
      </section>
    </div>
  </AdminShell>;
}
