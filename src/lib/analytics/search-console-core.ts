import { googleReportingDates, type GoogleReportingConfig } from "./google-reporting-core";

export const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
export const SEARCH_CONSOLE_COOKIE = "jjx-search-console-reporting";
const properties = ["https://jumpingjaxllc.com/", "sc-domain:jumpingjaxllc.com"] as const;
type Json = Record<string, unknown>;
export type SearchConsoleReport = {
  status: "connected" | "not_connected" | "reconnect" | "permission_required" | "unavailable";
  message: string;
  since: string; until: string; fetchedAt: string | null; property: string | null;
  totals: { clicks: number; impressions: number; ctr: number | null; position: number | null } | null;
  sitemaps: { path: string; lastDownloaded: string | null; pending: boolean; errors: number; warnings: number }[] | null;
  sitemapMessage: string | null;
};
function object(value: unknown): Json { return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {}; }
function number(value: unknown): number {
  const result = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  if (!Number.isFinite(result) || result < 0) throw new Error("Invalid report");
  return result;
}
class ReportError extends Error { constructor(public kind: SearchConsoleReport["status"]) { super(kind); } }
function httpError(status: number) { return new ReportError(status === 401 ? "reconnect" : status === 403 ? "permission_required" : "unavailable"); }

export async function fetchSearchConsoleReport(input: {
  config: GoogleReportingConfig; refreshToken: string; preset?: string; now?: Date; fetcher?: typeof fetch;
}): Promise<SearchConsoleReport> {
  const now = input.now || new Date();
  const dates = googleReportingDates(input.preset, now, "America/Los_Angeles");
  const base: SearchConsoleReport = {
    status: "not_connected", message: "Connect Search Console to load organic search performance.",
    since: dates.since, until: dates.until, fetchedAt: null, property: null, totals: null, sitemaps: null, sitemapMessage: null,
  };
  if (!input.config.oauthReady || !input.refreshToken) return base;
  const request = input.fetcher || fetch;
  try {
    const tokenResponse = await request("https://oauth2.googleapis.com/token", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(10_000), headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: input.config.clientId, client_secret: input.config.clientSecret, refresh_token: input.refreshToken, grant_type: "refresh_token" }),
    });
    const token = object(await tokenResponse.json());
    if (!tokenResponse.ok || typeof token.access_token !== "string") throw new ReportError(token.error === "invalid_grant" ? "reconnect" : "unavailable");
    if (typeof token.scope === "string" && !token.scope.split(" ").includes(SEARCH_CONSOLE_SCOPE)) throw new ReportError("reconnect");
    async function query(path: string, body?: Json) {
      const response = await request(`https://www.googleapis.com/webmasters/v3/${path}`, {
        method: body ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${token.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) throw httpError(response.status);
      const result: unknown = await response.json();
      if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Invalid report");
      return result as Json;
    }
    const sites = await query("sites");
    if (sites.siteEntry !== undefined && !Array.isArray(sites.siteEntry)) throw new Error("Invalid properties");
    const accessible = (sites.siteEntry as Json[] || []).map(object).filter(site => site.permissionLevel !== "siteUnverifiedUser");
    const property = properties.find(candidate => accessible.some(site => site.siteUrl === candidate));
    if (!property) throw new ReportError("permission_required");
    const path = `sites/${encodeURIComponent(property)}`;
    const [performanceResult, sitemapResult] = await Promise.allSettled([
      query(`${path}/searchAnalytics/query`, { startDate: dates.since, endDate: dates.until, type: "web", dataState: "final", rowLimit: 1 }),
      query(`${path}/sitemaps`),
    ]);
    if (performanceResult.status === "rejected") throw performanceResult.reason;
    const data = performanceResult.value;
    if (data.rows !== undefined && !Array.isArray(data.rows)) throw new Error("Invalid rows");
    const rows = data.rows as unknown[] || [];
    if (rows.length > 1) throw new Error("Invalid aggregate");
    const row = object(rows[0]);
    const clicks = rows.length ? number(row.clicks) : 0;
    const impressions = rows.length ? number(row.impressions) : 0;
    const ctr = impressions ? number(row.ctr) * 100 : null;
    if (ctr !== null && ctr > 100) throw new Error("Invalid rate");
    const position = impressions ? number(row.position) : null;
    let sitemaps: SearchConsoleReport["sitemaps"] = null;
    if (sitemapResult.status === "fulfilled") {
      const entries = sitemapResult.value.sitemap;
      if (entries === undefined || Array.isArray(entries)) {
        try {
          sitemaps = ((entries || []) as unknown[]).map(object).filter(entry => {
            try { const url = new URL(String(entry.path)); return url.protocol === "https:" && url.hostname === "jumpingjaxllc.com"; } catch { return false; }
          }).map(entry => ({ path: String(entry.path), lastDownloaded: typeof entry.lastDownloaded === "string" && Number.isFinite(Date.parse(entry.lastDownloaded)) ? entry.lastDownloaded : null,
            pending: entry.isPending === true, errors: number(entry.errors ?? 0), warnings: number(entry.warnings ?? 0) }));
        } catch { sitemaps = null; }
      }
    }
    return { ...base, status: "connected", message: "Search Console report fetched from Google. Finalized web-search data can lag recent days.",
      property, fetchedAt: now.toISOString(), totals: { clicks, impressions, ctr, position }, sitemaps,
      sitemapMessage: sitemaps === null ? "Sitemap status could not be loaded. Organic performance above is available." : null };
  } catch (error) {
    const status = error instanceof ReportError ? error.kind : "unavailable";
    return { ...base, status, message: status === "reconnect" ? "Reconnect Search Console to renew its read-only authorization."
      : status === "permission_required" ? "Search Console access is missing. Enable Search Console API in Google Cloud and connect an account with access to the Jumping Jax property."
      : "Search Console reporting is unavailable. Results have not been replaced with zeros." };
  }
}
