import Link from "next/link";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../../_components";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { GOOGLE_ADS_TAG_ID } from "@/lib/analytics/google-ads";
import { inflatableCampaignDraft as draft } from "@/lib/analytics/google-campaign";

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
    <p className="mt-5 text-sm text-slate-600">Account review recorded October 4, 2026. Google reporting is not connected to this dashboard. Open Google Ads or Search Console for current results.</p>
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-black">Google Ads · 477-299-0778</h2>
        <p className="mt-3 text-sm">September 4–October 3: 0 impressions, 0 clicks, $0 spend.</p>
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Launch blocker from the review: missing billing information. Legacy expanded text ads need replacement with responsive search ads using the Jumping Jax destination.</p>
        <a className={`${button} mt-4`} href="https://ads.google.com/aw/overview?ocid=225976512" target="_blank" rel="noopener noreferrer">Open Google Ads</a>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-black">Organic search</h2>
        <p className="mt-3 text-sm">Search Console 3-month view at review: 152 clicks, 4,290 impressions, 3.5% click rate, average position 8.6. Most clicks came from brand searches.</p>
        <p className="mt-3 text-sm">Google reported 53 invalid product snippets. Category lists now describe linked rental items; priced rental detail pages retain their offers. Google must crawl the updates before its report changes.</p>
        <a className={`${button} mt-4`} href="https://search.google.com/search-console?resource_id=https%3A%2F%2Fjumpingjaxllc.com%2F" target="_blank" rel="noopener noreferrer">Open Search Console</a>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
        <h2 className="text-xl font-black">Campaign preparation · 15% off inflatable rentals</h2>
        <p className="mt-3 text-sm">Offer: 15% off eligible inflatable rental prices. Delivery, mileage, accessories, yard games, foam parties and facility parties excluded. Customers claim the offer before requesting their rental.</p>
        <div className="mt-4 flex flex-wrap gap-3"><Link className={button} href="/offers/inflatables-15" target="_blank">Preview 15% offer</Link><a className={button} href="/sitemap.xml" target="_blank" rel="noopener noreferrer">View sitemap</a></div>
        <p className="mt-4 text-sm">Website tag: {GOOGLE_ADS_TAG_ID}. The rental conversion is sent after a request is saved successfully and uses its request ID to prevent duplicate counting. Phone clicks and facility requests are separate analytics events.</p>
        <p className="mt-3 text-sm font-bold text-amber-900">Prepared budget: ${draft.dailyBudget}/day. {draft.status}. Billing and Google account setup must be completed before launch.</p>
        <p className="mt-3 text-sm">{draft.network} · {draft.targeting}. {draft.bidding}.</p>
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
