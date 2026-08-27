import Link from "next/link";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "../_components";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  buildSafeAdsManagerUrl,
  loadMetaAdsDashboard,
  META_ADS_DATE_PRESETS,
} from "@/lib/meta-ads";
import { AdAnalyticsClient } from "./AdAnalyticsClient";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  account_id?: string;
  preset?: string;
  since?: string;
  until?: string;
  status?: string;
  campaign_id?: string;
  oauth?: string;
  oauth_message?: string;
  oauth_error?: string;
}>;

function freshnessTone(freshness: string): string {
  if (freshness === "fresh") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (freshness === "stale") return "border-amber-200 bg-amber-50 text-amber-950";
  if (freshness === "permission_blocked" || freshness === "token_expired") {
    return "border-rose-200 bg-rose-50 text-rose-950";
  }
  if (freshness === "rate_limited") return "border-orange-200 bg-orange-50 text-orange-950";
  if (freshness === "misconfigured") return "border-violet-200 bg-violet-50 text-violet-950";
  return "border-slate-200 bg-slate-50 text-slate-800";
}

export default async function AdminAdAnalyticsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return <AdminAuthError reason={auth.reason} />;
  }

  const params = (await searchParams) ?? {};
  const dashboard = await loadMetaAdsDashboard({
    accountId: params.account_id,
    preset: params.preset,
    since: params.since,
    until: params.until,
    status: params.status,
    campaignId: params.campaign_id,
  });

  const adsManagerUrl = dashboard.selectedAccountId
    ? buildSafeAdsManagerUrl(dashboard.selectedAccountId)
    : null;

  const selectedAccount = dashboard.accounts.find(
    (account) => account.id === dashboard.selectedAccountId,
  );

  return (
    <AdminShell>
      <AdminHeader eyebrow="Owner Tools" title="Ad Analytics">
        <AdminNav token="" role={auth.role} active="ad-analytics" />
      </AdminHeader>

      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">
        Manage Meta ads for Jumping Jax. Use Stop beside an ad to pause it.
      </p>

      <div
        className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${freshnessTone(dashboard.freshness)}`}
        role="status"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Data status: <span className="font-black uppercase">{dashboard.freshness.replaceAll("_", " ")}</span>
            {" · "}
            Last refreshed {new Date(dashboard.generatedAt).toLocaleString()}
          </p>
          <form action="/api/admin/ad-analytics/oauth/connect" method="post">
            <button
              type="submit"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white hover:bg-sky-700 sm:w-auto"
            >
              Reconnect Meta for Analytics
            </button>
          </form>
        </div>
        {dashboard.message ? <p className="mt-1">{dashboard.message}</p> : null}
        {dashboard.errors.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {dashboard.errors.map((error) => (
              <li key={`${error.code}-${error.message}`}>{error.message}</li>
            ))}
          </ul>
        ) : null}
        {(dashboard.freshness === "permission_blocked" ||
          dashboard.freshness === "token_expired" ||
          dashboard.freshness === "unavailable" ||
          dashboard.freshness === "misconfigured" ||
          dashboard.connection.hasRequiredScopes === false ||
          dashboard.connection.hasAdsRead === false ||
          dashboard.connection.hasAdsManagement === false ||
          dashboard.connection.hasBusinessManagement === false ||
          !dashboard.connection.hasConnectedSession) && (
          <p className="mt-3 rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm font-semibold">
            Reconnect Meta to load ads and show Stop buttons.
          </p>
        )}
        {params.oauth ? (
          <p className="mt-2">
            Meta connect status:{" "}
            <span className="font-black uppercase">
              {params.oauth.replaceAll("_", " ")}
            </span>
            {params.oauth_message ? ` — ${params.oauth_message}` : null}
            {params.oauth_error ? ` (${params.oauth_error})` : null}
          </p>
        ) : null}
      </div>

      <form className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <label className="text-sm font-bold text-slate-700 lg:col-span-2">
          Ad account
          <select
            name="account_id"
            defaultValue={dashboard.selectedAccountId ?? ""}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          >
            {dashboard.accounts.length === 0 ? (
              <option value="">No accounts</option>
            ) : (
              dashboard.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.accountId})
                </option>
              ))
            )}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">
          Date preset
          <select
            name="preset"
            defaultValue={dashboard.dateRange.preset}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          >
            {META_ADS_DATE_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {preset === "last_7d"
                  ? "Last 7 days"
                  : preset === "last_14d"
                    ? "Last 14 days"
                    : preset === "last_30d"
                      ? "Last 30 days"
                      : preset === "maximum"
                        ? "Lifetime (Meta max)"
                        : preset === "today"
                          ? "Today"
                          : "Custom"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">
          Since
          <input
            type="date"
            name="since"
            defaultValue={dashboard.dateRange.since}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Until
          <input
            type="date"
            name="until"
            defaultValue={dashboard.dateRange.until}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Status
          <select
            name="status"
            defaultValue={dashboard.statusFilter ?? "ALL"}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          >
            {[
              "ALL",
              "ACTIVE",
              "PAUSED",
              "PENDING_REVIEW",
              "DISAPPROVED",
              "IN_PROCESS",
              "WITH_ISSUES",
              "ARCHIVED",
              "COMPLETED",
            ].map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        </div>
        <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <summary className="cursor-pointer text-sm font-black text-slate-800">
            Advanced filter
          </summary>
          <label className="mt-3 block text-sm font-bold text-slate-700">
            Campaign ID
            <input
              name="campaign_id"
              defaultValue={params.campaign_id ?? ""}
              placeholder="Optional campaign id"
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
            />
          </label>
        </details>
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
          >
            Apply filters
          </button>
          <Link
            href="/admin/ad-analytics"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 hover:bg-slate-50"
          >
            Reset / refresh
          </Link>
        </div>
      </form>

      {selectedAccount ? (
        <p className="mt-3 text-xs font-semibold text-slate-500">
          Account timezone: {selectedAccount.timezoneName ?? "unknown"} · Currency{" "}
          {selectedAccount.currency}
          {selectedAccount.businessName
            ? ` · ${selectedAccount.businessName}`
            : ""}
        </p>
      ) : null}

      <AdAnalyticsClient initial={dashboard} adsManagerUrl={adsManagerUrl} />
    </AdminShell>
  );
}
