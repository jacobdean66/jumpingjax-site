import Link from "next/link";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../../_components";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { GOOGLE_ADS_TAG_ID, GOOGLE_ADS_RENTAL_DESTINATION } from "@/lib/analytics/google-ads";
import { inflatableCampaignDraft as draft, googleAdsSetupSnapshot as snapshot } from "@/lib/analytics/google-campaign";

export const dynamic = "force-dynamic";

const button = "inline-flex rounded-full bg-sky-700 px-4 py-2 text-sm font-bold text-white";

export default async function GoogleAdsSeoPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  return <AdminShell>
    <AdminHeader eyebrow="Owner Tools" title="Google Ads & SEO">
      <AdminNav token="" role={auth.role} active="ad-analytics" />
    </AdminHeader>
    <nav aria-label="Advertising channels" className="mt-5 flex gap-3 text-sm font-bold">
      <Link href="/admin/ad-analytics" className="rounded-full border border-slate-300 px-4 py-2">Meta Ads</Link>
      <span className="rounded-full bg-slate-950 px-4 py-2 text-white">Google Ads &amp; SEO</span>
    </nav>
    <p className="mt-5 text-sm text-slate-600">Manual setup snapshot recorded {snapshot.recordedDate}. This dashboard has no live Google Ads or Search Console connection. Approved campaign settings below still need verification in Google Ads.</p>
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-black">Replacement Google Ads account</h2>
        <p className="mt-3 break-all text-sm">Owner account to verify: {snapshot.ownerEmail}</p>
        <p className="mt-3 text-sm">Public customer ID: {snapshot.publicCustomerId ?? "Pending verification"}. Live campaign status: {snapshot.liveCampaignStatus}. Current impressions, clicks, spend, and conversions are unavailable.</p>
        <p className="mt-3 text-sm">Previous account {snapshot.oldCustomerId}: {snapshot.oldAccountStatus}. Continue the existing replacement account and Search draft.</p>
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Location: {snapshot.locationStatus}. Billing: {snapshot.billingStatus}. Advertiser verification: {snapshot.advertiserVerificationStatus}. Replacement rental-request conversion tracking must be configured before activation.</p>
        <a className={`${button} mt-4`} href={`https://ads.google.com/aw/overview?ocid=${snapshot.replacementInternalId}`} target="_blank" rel="noopener noreferrer">Continue replacement Google Ads account</a>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-black">Organic search</h2>
        <p className="mt-3 text-sm">Historical Search Console snapshot from October 4, 2026: 152 clicks, 4,290 impressions, 3.5% click rate, average position 8.6 over three months. Most clicks came from brand searches.</p>
        <p className="mt-3 text-sm">That review reported 53 invalid product snippets. Production checks on October 6 confirm category lists use linked items and priced rental detail pages retain offers. The promotions hub canonical has also been corrected to /ads. Sitemap pages and inspected legacy redirects work. Current Search Console indexing and validation results still need verification.</p>
        <p className="mt-3 text-sm">The promotion landing page intentionally uses noindex, follow and is excluded from the organic sitemap. Rental pages remain available for indexing. Google must crawl published repairs before its reports update.</p>
        <a className={`${button} mt-4`} href="https://search.google.com/search-console?resource_id=https%3A%2F%2Fjumpingjaxllc.com%2F" target="_blank" rel="noopener noreferrer">Open Search Console</a>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
        <h2 className="text-xl font-black">{draft.name}</h2>
        <p className="mt-3 text-sm">Offer: 15% off eligible bounce houses, bounce and slide combos, and inflatable obstacle courses. Delivery, mileage, accessories, yard games, foam parties and facility parties excluded. Customers claim the offer and request their event date; Jumping Jax confirms availability and delivery plans.</p>
        <div className="mt-4 flex flex-wrap gap-3"><Link className={button} href="/offers/inflatables-15" target="_blank">Preview 15% offer</Link><a className={button} href="/sitemap.xml" target="_blank" rel="noopener noreferrer">View sitemap</a></div>
        <p className="mt-4 text-sm">Website Ads tag: {GOOGLE_ADS_TAG_ID ?? "Disabled pending verified replacement tag"}. Rental-request destination: {GOOGLE_ADS_RENTAL_DESTINATION ?? "Pending verified conversion ID and label"}. The closed account’s destination has been retired. GA4 lead analytics remain active.</p>
        <p className="mt-3 text-sm">When configured, Ads conversions fire only after a rental request is successfully saved, using the request ID and browser duplicate guards. Offer views, discount clicks, phone clicks, and facility requests do not count as completed rental requests.</p>
        <p className="mt-3 text-sm font-bold text-amber-900">Authorized average daily budget: ${draft.dailyBudget}/day. {draft.status}. Saved budget and all launch requirements must be verified in Google Ads.</p>
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
