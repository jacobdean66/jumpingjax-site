import type { MetaAdsResolvedDateRange } from "./dates";
import { toMetaDatePresetParam } from "./dates";
import { metaAdsGraphGetAllPages, metaAdsGraphPost } from "./http-client";
import {
  emptyInsights,
  extractDestinationUrl,
  extractPageId,
  normalizeEntityStatus,
  normalizeInsightsRow,
  parseBudgetMinorUnits,
  zeroInsights,
} from "./normalize";
import type {
  MetaAdAccountSummary,
  MetaAdCreativeSummary,
  MetaAdRow,
  MetaAdSetRow,
  MetaAdsDailyPoint,
  MetaCampaignRow,
  NormalizedInsights,
} from "./types";
import type { MetaAdsSanitizedError } from "./errors";

const INSIGHT_FIELDS = [
  "spend",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "inline_link_clicks",
  "ctr",
  "cpc",
  "cpm",
  "actions",
  "cost_per_action_type",
  "date_start",
  "date_stop",
].join(",");

const CAMPAIGN_FIELDS = [
  "id",
  "name",
  "status",
  "effective_status",
  "configured_status",
  "objective",
  "daily_budget",
  "lifetime_budget",
  "start_time",
  "stop_time",
].join(",");

const ADSET_FIELDS = [
  "id",
  "name",
  "status",
  "effective_status",
  "configured_status",
  "campaign_id",
  "daily_budget",
  "lifetime_budget",
  "start_time",
  "end_time",
].join(",");

const AD_FIELDS = [
  "id",
  "name",
  "status",
  "effective_status",
  "configured_status",
  "campaign_id",
  "adset_id",
  "creative{id,thumbnail_url,effective_object_story_id,object_story_spec,link_url,object_url,instagram_actor_id}",
].join(",");

function actPath(accountId: string): string {
  const id = accountId.replace(/^act_/, "");
  return `act_${id}`;
}

function timeRangeParams(range: MetaAdsResolvedDateRange): Record<string, string> {
  const preset = toMetaDatePresetParam(range.preset);
  if (preset && range.preset !== "custom") {
    // Still pass explicit time_range for comparison stability except maximum.
    if (range.preset === "maximum") {
      return { date_preset: "maximum" };
    }
  }
  return {
    time_range: JSON.stringify({ since: range.since, until: range.until }),
  };
}

export async function fetchAuthorizedAdAccounts(input: {
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<
  Readonly<
    | { ok: true; accounts: readonly MetaAdAccountSummary[] }
    | { ok: false; error: MetaAdsSanitizedError }
  >
> {
  const result = await metaAdsGraphGetAllPages<{
    id?: string;
    account_id?: string;
    name?: string;
    currency?: string;
    timezone_name?: string;
    account_status?: number;
    business?: Readonly<{ name?: string }>;
  }>({
    path: "me/adaccounts",
    accessToken: input.accessToken,
    fetchImpl: input.fetchImpl,
    searchParams: {
      fields:
        "id,account_id,name,currency,timezone_name,account_status,business{name}",
    },
  });

  if (!result.ok) return result;

  const accounts = result.data
    .map((row) => {
      const accountId = (row.account_id ?? row.id?.replace(/^act_/, "") ?? "").trim();
      const id = (row.id ?? (accountId ? `act_${accountId}` : "")).trim();
      if (!accountId || !id) return null;
      return {
        id,
        accountId,
        name: row.name?.trim() || `Ad account ${accountId}`,
        currency: row.currency?.trim() || "USD",
        timezoneName: row.timezone_name?.trim() || null,
        accountStatus: typeof row.account_status === "number" ? row.account_status : null,
        businessName: row.business?.name?.trim() || null,
      } satisfies MetaAdAccountSummary;
    })
    .filter((row): row is MetaAdAccountSummary => row !== null);

  return { ok: true, accounts };
}

async function fetchInsightsByObject(input: {
  accessToken: string;
  accountId: string;
  level: "account" | "campaign" | "adset" | "ad";
  range: MetaAdsResolvedDateRange;
  timeIncrement?: string;
  fetchImpl?: typeof fetch;
}): Promise<
  Readonly<
    | { ok: true; byId: Map<string, NormalizedInsights>; rows: readonly Record<string, unknown>[] }
    | { ok: false; error: MetaAdsSanitizedError }
  >
> {
  const result = await metaAdsGraphGetAllPages<Record<string, unknown>>({
    path: `${actPath(input.accountId)}/insights`,
    accessToken: input.accessToken,
    fetchImpl: input.fetchImpl,
    searchParams: {
      fields:
        input.level === "account"
          ? INSIGHT_FIELDS
          : `${INSIGHT_FIELDS},campaign_id,adset_id,ad_id`,
      level: input.level === "account" ? undefined : input.level,
      time_increment: input.timeIncrement,
      ...timeRangeParams(input.range),
    },
  });

  if (!result.ok) return result;

  const byId = new Map<string, NormalizedInsights>();
  for (const row of result.data) {
    const insights = normalizeInsightsRow(row as never);
    if (input.level === "account") {
      byId.set("account", insights);
      continue;
    }
    const key =
      input.level === "campaign"
        ? String(row.campaign_id ?? row.campaignId ?? "")
        : input.level === "adset"
          ? String(row.adset_id ?? row.adsetId ?? "")
          : String(row.ad_id ?? row.adId ?? "");
    if (key) byId.set(key, insights);
  }

  return { ok: true, byId, rows: result.data };
}

function creativeSummary(raw: unknown): MetaAdCreativeSummary {
  if (!raw || typeof raw !== "object") {
    return {
      creativeId: null,
      thumbnailUrl: null,
      previewPermalink: null,
      destinationUrl: null,
      pageId: null,
      pageName: null,
      instagramActorId: null,
    };
  }
  const c = raw as Record<string, unknown>;
  const storyId =
    typeof c.effective_object_story_id === "string"
      ? c.effective_object_story_id.trim()
      : "";
  const previewPermalink = storyId
    ? `https://www.facebook.com/${storyId}`
    : null;
  return {
    creativeId: typeof c.id === "string" ? c.id : null,
    thumbnailUrl: typeof c.thumbnail_url === "string" ? c.thumbnail_url : null,
    previewPermalink,
    destinationUrl: extractDestinationUrl(c),
    pageId: extractPageId(c),
    pageName: null,
    instagramActorId:
      typeof c.instagram_actor_id === "string" ? c.instagram_actor_id : null,
  };
}

export async function fetchAdHierarchyWithInsights(input: {
  accessToken: string;
  accountId: string;
  range: MetaAdsResolvedDateRange;
  comparisonRange: MetaAdsResolvedDateRange;
  statusFilter?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<
  Readonly<
    | {
        ok: true;
        campaigns: readonly MetaCampaignRow[];
        accountInsights: NormalizedInsights;
        comparisonAccountInsights: NormalizedInsights | null;
        daily: readonly MetaAdsDailyPoint[];
        warnings: readonly MetaAdsSanitizedError[];
      }
    | { ok: false; error: MetaAdsSanitizedError }
  >
> {
  const warnings: MetaAdsSanitizedError[] = [];
  const fetchImpl = input.fetchImpl;

  const [campaignsRes, adsetsRes, adsRes, accountInsightsRes, comparisonRes, dailyRes, campaignInsightsRes, adsetInsightsRes, adInsightsRes] =
    await Promise.all([
      metaAdsGraphGetAllPages<Record<string, unknown>>({
        path: `${actPath(input.accountId)}/campaigns`,
        accessToken: input.accessToken,
        fetchImpl,
        searchParams: {
          fields: CAMPAIGN_FIELDS,
        },
      }),
      metaAdsGraphGetAllPages<Record<string, unknown>>({
        path: `${actPath(input.accountId)}/adsets`,
        accessToken: input.accessToken,
        fetchImpl,
        searchParams: {
          fields: ADSET_FIELDS,
        },
      }),
      metaAdsGraphGetAllPages<Record<string, unknown>>({
        path: `${actPath(input.accountId)}/ads`,
        accessToken: input.accessToken,
        fetchImpl,
        searchParams: {
          fields: AD_FIELDS,
        },
      }),
      fetchInsightsByObject({
        accessToken: input.accessToken,
        accountId: input.accountId,
        level: "account",
        range: input.range,
        fetchImpl,
      }),
      fetchInsightsByObject({
        accessToken: input.accessToken,
        accountId: input.accountId,
        level: "account",
        range: input.comparisonRange,
        fetchImpl,
      }),
      fetchInsightsByObject({
        accessToken: input.accessToken,
        accountId: input.accountId,
        level: "account",
        range: input.range,
        timeIncrement: "1",
        fetchImpl,
      }),
      fetchInsightsByObject({
        accessToken: input.accessToken,
        accountId: input.accountId,
        level: "campaign",
        range: input.range,
        fetchImpl,
      }),
      fetchInsightsByObject({
        accessToken: input.accessToken,
        accountId: input.accountId,
        level: "adset",
        range: input.range,
        fetchImpl,
      }),
      fetchInsightsByObject({
        accessToken: input.accessToken,
        accountId: input.accountId,
        level: "ad",
        range: input.range,
        fetchImpl,
      }),
    ]);

  if (!campaignsRes.ok) return campaignsRes;
  if (!adsetsRes.ok) return adsetsRes;
  if (!adsRes.ok) return adsRes;
  if (!accountInsightsRes.ok) return accountInsightsRes;

  if (!comparisonRes.ok) warnings.push(comparisonRes.error);
  if (!dailyRes.ok) warnings.push(dailyRes.error);
  if (!campaignInsightsRes.ok) warnings.push(campaignInsightsRes.error);
  if (!adsetInsightsRes.ok) warnings.push(adsetInsightsRes.error);
  if (!adInsightsRes.ok) warnings.push(adInsightsRes.error);

  const campaignInsights = campaignInsightsRes.ok
    ? campaignInsightsRes.byId
    : new Map<string, NormalizedInsights>();
  const adsetInsights = adsetInsightsRes.ok
    ? adsetInsightsRes.byId
    : new Map<string, NormalizedInsights>();
  const adInsights = adInsightsRes.ok
    ? adInsightsRes.byId
    : new Map<string, NormalizedInsights>();

  const statusFilter = input.statusFilter?.trim().toUpperCase() || null;

  const adsByAdset = new Map<string, MetaAdRow[]>();
  for (const row of adsRes.data) {
    const id = String(row.id ?? "");
    const adsetId = String(row.adset_id ?? "");
    const campaignId = String(row.campaign_id ?? "");
    if (!id || !adsetId) continue;
    const effectiveStatus = normalizeEntityStatus(
      String(row.effective_status ?? row.status ?? ""),
    );
    if (statusFilter && statusFilter !== "ALL" && effectiveStatus !== statusFilter) {
      continue;
    }
    const ad: MetaAdRow = {
      id,
      name: String(row.name ?? id),
      status: normalizeEntityStatus(String(row.status ?? "")),
      effectiveStatus,
      configuredStatus:
        typeof row.configured_status === "string" ? row.configured_status : null,
      dailyBudget: { kind: "unavailable" },
      lifetimeBudget: { kind: "unavailable" },
      startTime: null,
      stopTime: null,
      insights: adInsights.get(id) ?? emptyInsights(),
      comparison: null,
      campaignId,
      adsetId,
      creative: creativeSummary(row.creative),
    };
    const list = adsByAdset.get(adsetId) ?? [];
    list.push(ad);
    adsByAdset.set(adsetId, list);
  }

  const adsetsByCampaign = new Map<string, MetaAdSetRow[]>();
  for (const row of adsetsRes.data) {
    const id = String(row.id ?? "");
    const campaignId = String(row.campaign_id ?? "");
    if (!id || !campaignId) continue;
    const effectiveStatus = normalizeEntityStatus(
      String(row.effective_status ?? row.status ?? ""),
    );
    if (statusFilter && statusFilter !== "ALL" && effectiveStatus !== statusFilter) {
      // Keep ad set if it has matching child ads.
      if (!(adsByAdset.get(id)?.length)) continue;
    }
    const adset: MetaAdSetRow = {
      id,
      name: String(row.name ?? id),
      status: normalizeEntityStatus(String(row.status ?? "")),
      effectiveStatus,
      configuredStatus:
        typeof row.configured_status === "string" ? row.configured_status : null,
      dailyBudget: parseBudgetMinorUnits(row.daily_budget as string | number | null),
      lifetimeBudget: parseBudgetMinorUnits(
        row.lifetime_budget as string | number | null,
      ),
      startTime: typeof row.start_time === "string" ? row.start_time : null,
      stopTime: typeof row.end_time === "string" ? row.end_time : null,
      insights: adsetInsights.get(id) ?? emptyInsights(),
      comparison: null,
      campaignId,
      ads: adsByAdset.get(id) ?? [],
    };
    const list = adsetsByCampaign.get(campaignId) ?? [];
    list.push(adset);
    adsetsByCampaign.set(campaignId, list);
  }

  const campaigns: MetaCampaignRow[] = [];
  for (const row of campaignsRes.data) {
    const id = String(row.id ?? "");
    if (!id) continue;
    const effectiveStatus = normalizeEntityStatus(
      String(row.effective_status ?? row.status ?? ""),
    );
    const adsets = adsetsByCampaign.get(id) ?? [];
    if (
      statusFilter &&
      statusFilter !== "ALL" &&
      effectiveStatus !== statusFilter &&
      adsets.length === 0
    ) {
      continue;
    }
    campaigns.push({
      id,
      name: String(row.name ?? id),
      status: normalizeEntityStatus(String(row.status ?? "")),
      effectiveStatus,
      configuredStatus:
        typeof row.configured_status === "string" ? row.configured_status : null,
      dailyBudget: parseBudgetMinorUnits(row.daily_budget as string | number | null),
      lifetimeBudget: parseBudgetMinorUnits(
        row.lifetime_budget as string | number | null,
      ),
      startTime: typeof row.start_time === "string" ? row.start_time : null,
      stopTime: typeof row.stop_time === "string" ? row.stop_time : null,
      insights: campaignInsights.get(id) ?? emptyInsights(),
      comparison: null,
      objective: typeof row.objective === "string" ? row.objective : null,
      adsets,
    });
  }

  const accountInsights =
    accountInsightsRes.byId.get("account") ??
    zeroInsights(input.range.since, input.range.until);

  const comparisonAccountInsights = comparisonRes.ok
    ? (comparisonRes.byId.get("account") ??
      zeroInsights(
        input.comparisonRange.since,
        input.comparisonRange.until,
      ))
    : null;

  const daily: MetaAdsDailyPoint[] = [];
  if (dailyRes.ok) {
    for (const row of dailyRes.rows) {
      const insights = normalizeInsightsRow(row as never);
      daily.push({
        date: insights.dateStart ?? "",
        spend: insights.spend,
        landingPageViews: insights.landingPageViews,
        linkClicks: insights.linkClicks,
        impressions: insights.impressions,
      });
    }
    daily.sort((a, b) => a.date.localeCompare(b.date));
  }

  return {
    ok: true,
    campaigns,
    accountInsights,
    comparisonAccountInsights,
    daily,
    warnings,
  };
}

/** Ads Manager account entry point (read-only deep link for operators). */
export function buildSafeAdsManagerUrl(accountId: string): string {
  const act = accountId.replace(/^act_/, "");
  return `https://www.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(act)}`;
}

export async function pauseMetaAd(input: {
  accessToken: string;
  adId: string;
  fetchImpl?: typeof fetch;
}): Promise<
  Readonly<
    | { ok: true; adId: string }
    | { ok: false; error: MetaAdsSanitizedError }
  >
> {
  const adId = input.adId.trim();
  if (!/^\d{6,}$/.test(adId)) {
    return {
      ok: false,
      error: {
        code: "provider_error",
        message: "Invalid Meta ad id.",
        freshness: "unavailable",
      },
    };
  }

  const result = await metaAdsGraphPost<{ success?: boolean }>({
    path: adId,
    accessToken: input.accessToken,
    fetchImpl: input.fetchImpl,
    bodyParams: {
      status: "PAUSED",
    },
  });

  if (!result.ok) return result;

  return { ok: true, adId };
}

export async function probeAccountAllowed(input: {
  accessToken: string;
  accountId: string;
  allowlist: readonly string[];
}): Promise<boolean> {
  const normalized = input.accountId.replace(/^act_/, "");
  return input.allowlist.some(
    (id) => id.replace(/^act_/, "") === normalized,
  );
}
