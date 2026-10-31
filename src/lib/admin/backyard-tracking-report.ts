import "server-only";
import { loadBackyardCampaign } from "./backyard-takeover-store";
import { loadBackyardFunnel, loadBackyardSettings } from "./backyard-tracking-store";
import { TRACKING_PERIODS, type BackyardTrackingReport, type PlatformTraffic, type TrackingPeriod } from "./backyard-tracking";
import { googleReportingDates } from "@/lib/analytics/google-reporting-core";
import { loadSharedGoogleCampaignTraffic } from "@/lib/analytics/shared-google-reporting";
import { loadMetaAdsDashboard } from "@/lib/meta-ads";

function emptyPlatform(name: string, linked = false): PlatformTraffic {
  return { state: linked ? "unavailable" : "not_linked", name, clicks: null, impressions: null, spend: null, currency: "USD", fetchedAt: null,
    message: linked ? "Ad performance is temporarily unavailable. Open the analytics page to check the connection." : "Link this campaign after the ad has been created. No platform clicks are being reported yet." };
}
async function googleTraffic(id: string, period: TrackingPeriod): Promise<PlatformTraffic> {
  if (!id) return emptyPlatform("Google Ads");
  try {
    const data = await loadSharedGoogleCampaignTraffic(id, period);
    if (data.campaignId !== id || data.status !== "connected" || !data.totals) return { ...emptyPlatform("Google Ads", true), message: data.message };
    return { state: "connected", name: data.campaign?.name ?? "Google Ads", clicks: data.totals.clicks, impressions: data.totals.impressions,
      spend: data.totals.spend, currency: data.currency, fetchedAt: data.fetchedAt, message: data.freshness?.warning ?? data.message };
  } catch { return emptyPlatform("Google Ads", true); }
}
async function metaTraffic(id: string, since: string, until: string): Promise<PlatformTraffic> {
  if (!id) return emptyPlatform("Meta Ads");
  try {
    const data = await loadMetaAdsDashboard({ campaignId: id, since, until });
    const row = data.campaigns.find(campaign => campaign.id === id);
    if (!row || row.insights.linkClicks.kind !== "number") return { ...emptyPlatform("Meta Ads", true), message: data.message || "The linked Meta campaign could not be found in the connected account." };
    return { state: "connected", name: row.name, clicks: row.insights.linkClicks.value,
      impressions: row.insights.impressions.kind === "number" ? row.insights.impressions.value : null,
      spend: row.insights.spend.kind === "number" ? row.insights.spend.value : null,
      currency: data.accounts.find(account => account.id === data.selectedAccountId)?.currency ?? "USD", fetchedAt: data.generatedAt,
      message: data.message || "Meta-reported link clicks. These are separate from recorded website visits." };
  } catch { return emptyPlatform("Meta Ads", true); }
}

export async function loadBackyardTrackingReport(input?: string): Promise<BackyardTrackingReport> {
  const period: TrackingPeriod = TRACKING_PERIODS.includes(input as TrackingPeriod) ? input as TrackingPeriod : "last_30d";
  const { since, until } = googleReportingDates(period);
  const base: BackyardTrackingReport = { available: false, message: "Website tracking is temporarily unavailable. Counts have not been replaced with zeros.", period, since, until,
    fetchedAt: new Date().toISOString(), funnel: null, google: emptyPlatform("Google Ads", true), meta: emptyPlatform("Meta Ads", true) };
  try {
    const [campaign, settings] = await Promise.all([loadBackyardCampaign(), loadBackyardSettings()]);
    const [funnel, google, meta] = await Promise.allSettled([loadBackyardFunnel(since, until), googleTraffic(settings.googleCampaignId, period), metaTraffic(campaign.metaCampaignId, since, until)]);
    return { ...base, available: funnel.status === "fulfilled", message: funnel.status === "fulfilled" ? "Recorded website activity. Link previews, known bots, owner previews and supported tracking opt-outs are excluded. Public entries count only after they are saved." : base.message,
      funnel: funnel.status === "fulfilled" ? funnel.value : null,
      google: google.status === "fulfilled" ? google.value : emptyPlatform("Google Ads", true), meta: meta.status === "fulfilled" ? meta.value : emptyPlatform("Meta Ads", true) };
  } catch { return base; }
}
