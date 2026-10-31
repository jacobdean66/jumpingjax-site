// Reporting only. No caller-provided customer IDs, GAQL, or mutation endpoints.
import type { ReportFreshness } from "./shared-google-core";
export const GOOGLE_REPORTING_CUSTOMER_ID = "7151399909";
export const GOOGLE_REPORTING_CAMPAIGN_ID = "24386017082";
export const GOOGLE_REPORTING_CONVERSION_ID = "7823548968";
export const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
export const GOOGLE_REPORTING_PRESETS = ["last_7d", "last_30d", "today"] as const;
type Preset = typeof GOOGLE_REPORTING_PRESETS[number];
type Env = Record<string, string | undefined>;
type Json = Record<string, unknown>;
export type GoogleReportingConfig = { clientId: string; clientSecret: string; loginCustomerId: string; oauthReady: boolean };
export type GoogleAdsReport = {
  freshness?: ReportFreshness;
  status: "connected" | "not_connected" | "reconnect" | "permission_required" | "unavailable";
  message: string;
  fetchedAt: string | null;
  preset: Preset;
  since: string;
  until: string;
  customerId: string;
  campaignId: string;
  campaign: { name: string; status: string; dailyBudget: number | null } | null;
  currency: string;
  timeZone: string;
  totals: { impressions: number; clicks: number; spend: number; savedRentalRequests: number; ctr: number | null; costPerRentalRequest: number | null } | null;
};

export function googleReportingConfig(env: Env): GoogleReportingConfig {
  const clientId = (env.GOOGLE_ADS_CLIENT_ID || env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (env.GOOGLE_ADS_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET || "").trim();
  const loginCustomerId = (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replaceAll("-", "").trim();
  return { clientId, clientSecret, loginCustomerId, oauthReady: Boolean(clientId && clientSecret) };
}

export function googleReportingDates(preset: string | undefined, now = new Date(), timeZone = "America/New_York") {
  const selected: Preset = GOOGLE_REPORTING_PRESETS.includes(preset as Preset) ? preset as Preset : "last_30d";
  const until = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const date = new Date(`${until}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (selected === "last_30d" ? 29 : selected === "last_7d" ? 6 : 0));
  return { preset: selected, since: date.toISOString().slice(0, 10), until };
}

function object(value: unknown): Json { return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {}; }
function amount(value: unknown): number {
  const number = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number) || number < 0) throw new Error("invalid_report");
  return number;
}
function measure(value: unknown): number { return value == null ? 0 : amount(value); }
class ReportingError extends Error { constructor(public kind: GoogleAdsReport["status"]) { super(kind); } }
function providerError(status: number, body: unknown): ReportingError {
  // Inspect provider error codes only. Never forward raw responses, tokens, or credential-bearing request details.
  const error = object(object(body).error);
  const details = Array.isArray(error.details) ? error.details : [];
  const codes = details.flatMap(detail => {
    const item = object(detail);
    return [item.reason, ...(Array.isArray(item.errors) ? item.errors.map(entry => JSON.stringify(object(entry).errorCode || {})) : [])];
  }).filter(value => typeof value === "string").join(" ");
  if (status === 401 || codes.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")) return new ReportingError("reconnect");
  return new ReportingError(status === 403 ? "permission_required" : "unavailable");
}

export async function fetchGoogleAdsReport(input: {
  config: GoogleReportingConfig; refreshToken: string; preset?: string; now?: Date; fetcher?: typeof fetch;
  campaignId?: string; trafficOnly?: boolean;
}): Promise<GoogleAdsReport> {
  const now = input.now || new Date();
  const campaignId = input.campaignId ?? GOOGLE_REPORTING_CAMPAIGN_ID;
  const base: GoogleAdsReport = {
    status: "not_connected", message: "Connect Karen’s Google Ads account to load performance. No live results have been fetched.",
    fetchedAt: null, ...googleReportingDates(input.preset, now), customerId: GOOGLE_REPORTING_CUSTOMER_ID,
    campaignId, campaign: null, currency: "USD", timeZone: "America/New_York", totals: null,
  };
  if (!/^\d{1,20}$/.test(campaignId) || BigInt(campaignId) > BigInt("9223372036854775807")) return { ...base, status: "unavailable", message: "The saved campaign ID is invalid." };
  if (!input.config.oauthReady || !input.refreshToken) return base;
  if (input.config.loginCustomerId && !/^\d{10}$/.test(input.config.loginCustomerId)) return { ...base, status: "unavailable", message: "The reporting account configuration needs attention." };
  const request = input.fetcher || fetch;
  try {
    const tokenResponse = await request("https://oauth2.googleapis.com/token", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: input.config.clientId, client_secret: input.config.clientSecret, refresh_token: input.refreshToken, grant_type: "refresh_token" }),
    });
    const token = object(await tokenResponse.json());
    if (!tokenResponse.ok || typeof token.access_token !== "string") throw new ReportingError(token.error === "invalid_grant" ? "reconnect" : "unavailable");
    if (typeof token.scope === "string" && !token.scope.split(" ").includes(GOOGLE_ADS_SCOPE)) throw new ReportingError("reconnect");
    const headers: Record<string, string> = { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" };
    if (input.config.loginCustomerId) headers["login-customer-id"] = input.config.loginCustomerId;
    async function query(gaql: string): Promise<Json[]> {
      const response = await request(`https://googleads.googleapis.com/v26/customers/${GOOGLE_REPORTING_CUSTOMER_ID}/googleAds:searchStream`, {
        method: "POST", headers, body: JSON.stringify({ query: gaql }), cache: "no-store", signal: AbortSignal.timeout(15_000),
      });
      const data: unknown = await response.json();
      if (!response.ok) throw providerError(response.status, data);
      if (!Array.isArray(data)) throw new Error("invalid_report");
      return data.flatMap(batch => {
        const result = object(batch).results;
        if (result != null && !Array.isArray(result)) throw new Error("invalid_report");
        return (result as unknown[] | undefined || []).map(object);
      });
    }
    const accountRows = await query("SELECT customer.id, customer.currency_code, customer.time_zone FROM customer LIMIT 1");
    const account = object(accountRows[0]?.customer);
    if (String(account.id) !== GOOGLE_REPORTING_CUSTOMER_ID || typeof account.currencyCode !== "string" || typeof account.timeZone !== "string") throw new Error("invalid_account");
    const dates = googleReportingDates(input.preset, now, account.timeZone);
    const campaignRows = await query(`SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros FROM campaign WHERE campaign.id = ${campaignId}`);
    const row = campaignRows[0];
    const campaign = object(row?.campaign);
    if (String(campaign.id) !== campaignId || typeof campaign.name !== "string" || typeof campaign.status !== "string") throw new Error("missing_campaign");
    const filter = `campaign.id = ${campaignId} AND segments.date BETWEEN '${dates.since}' AND '${dates.until}'`;
    const [traffic, leads] = await Promise.all([
      query(`SELECT metrics.impressions, metrics.clicks, metrics.cost_micros FROM campaign WHERE ${filter}`),
      input.trafficOnly ? Promise.resolve([]) : query(`SELECT segments.conversion_action, metrics.conversions FROM campaign WHERE ${filter} AND segments.conversion_action = 'customers/${GOOGLE_REPORTING_CUSTOMER_ID}/conversionActions/${GOOGLE_REPORTING_CONVERSION_ID}'`),
    ]);
    const impressions = traffic.reduce((sum, entry) => sum + measure(object(entry.metrics).impressions), 0);
    const clicks = traffic.reduce((sum, entry) => sum + measure(object(entry.metrics).clicks), 0);
    const spend = traffic.reduce((sum, entry) => sum + measure(object(entry.metrics).costMicros) / 1_000_000, 0);
    const savedRentalRequests = leads.reduce((sum, entry) => sum + measure(object(entry.metrics).conversions), 0);
    return { ...base, ...dates, status: "connected", message: "Live Google Ads report. Recent attribution can change; zero results mean Google returned no activity for this period.",
      fetchedAt: new Date().toISOString(), currency: account.currencyCode, timeZone: account.timeZone,
      campaign: { name: campaign.name, status: campaign.status, dailyBudget: object(row?.campaignBudget).amountMicros == null ? null : amount(object(row?.campaignBudget).amountMicros) / 1_000_000 },
      totals: { impressions, clicks, spend, savedRentalRequests, ctr: impressions ? clicks / impressions * 100 : null, costPerRentalRequest: savedRentalRequests ? spend / savedRentalRequests : null },
    };
  } catch (error) {
    const status = error instanceof ReportingError ? error.kind : "unavailable";
    return { ...base, status, message: status === "reconnect" ? "Reconnect Google Ads to renew reporting authorization." : status === "permission_required" ? "Google denied reporting access. Check account access and production API access for the connected Google Cloud project." : "Google Ads reporting is unavailable. Results have not been replaced with zeros; try refreshing later." };
  }
}
