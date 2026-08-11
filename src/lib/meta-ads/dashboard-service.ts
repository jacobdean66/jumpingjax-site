import {
  isSocialOAuthConnectConfigured,
  resolveSocialOAuthRuntimeConfig,
} from "../social-posts/oauth/social-oauth-config";
import {
  resolveMetaAdsDateRange,
  type MetaAdsResolvedDateRange,
} from "./dates";
import { sanitizedError, type MetaAdsSanitizedError } from "./errors";
import {
  buildSafeAdsManagerUrl,
  fetchAdHierarchyWithInsights,
  fetchAuthorizedAdAccounts,
} from "./marketing-api";
import {
  emptyInsights,
  metricNumber,
  numberMetric,
  safeDivide,
  sumMetrics,
} from "./normalize";
import {
  checkMetaAdsReadPermission,
  missingAdsReadError,
} from "./permissions";
import { resolveMetaAdsAccessToken } from "./token-resolver";
import {
  META_ADS_METRIC_GLOSSARY,
  type MetaAdsDashboardTotals,
  type MetaAdsDashboardViewModel,
  type NormalizedInsights,
} from "./types";

const RECONNECT_PATH =
  "/admin/social-posts/publication-execution#meta-oauth";

function totalsFromInsights(
  insights: NormalizedInsights,
  activeCampaignCount: number,
): MetaAdsDashboardTotals {
  return {
    spend: insights.spend,
    impressions: insights.impressions,
    reach: insights.reach,
    frequency: insights.frequency,
    clicks: insights.clicks,
    linkClicks: insights.linkClicks,
    landingPageViews: insights.landingPageViews,
    ctr: insights.ctr,
    cpc: insights.cpc,
    cpm: insights.cpm,
    costPerLandingPageView: insights.costPerLandingPageView,
    activeCampaignCount,
    results: insights.results,
  };
}

function emptyTotals(): MetaAdsDashboardTotals {
  return totalsFromInsights(emptyInsights(), 0);
}

function baseConnection(publicationTargetId: string | null) {
  return {
    configured: isSocialOAuthConnectConfigured(resolveSocialOAuthRuntimeConfig()),
    hasConnectedSession: Boolean(publicationTargetId),
    hasAdsRead: null as boolean | null,
    publicationTargetId,
    reconnectPath: RECONNECT_PATH,
  };
}

function emptyView(input: {
  freshness: MetaAdsDashboardViewModel["freshness"];
  message: string;
  dateRange: MetaAdsResolvedDateRange;
  errors?: readonly MetaAdsSanitizedError[];
  connection?: MetaAdsDashboardViewModel["connection"];
}): MetaAdsDashboardViewModel {
  return {
    generatedAt: new Date().toISOString(),
    freshness: input.freshness,
    message: input.message,
    connection: input.connection ?? baseConnection(null),
    accounts: [],
    selectedAccountId: null,
    dateRange: input.dateRange,
    statusFilter: null,
    totals: emptyTotals(),
    comparisonTotals: null,
    campaigns: [],
    daily: [],
    metricGlossary: META_ADS_METRIC_GLOSSARY,
    errors: input.errors ?? [],
  };
}

export type LoadMetaAdsDashboardInput = Readonly<{
  accountId?: string | null;
  preset?: string | null;
  since?: string | null;
  until?: string | null;
  status?: string | null;
  campaignId?: string | null;
  fetchImpl?: typeof fetch;
  now?: Date;
}>;

export async function loadMetaAdsDashboard(
  input: LoadMetaAdsDashboardInput = {},
): Promise<MetaAdsDashboardViewModel> {
  const dateResolved = resolveMetaAdsDateRange({
    preset: input.preset,
    since: input.since,
    until: input.until,
    now: input.now,
  });

  if (!dateResolved.ok) {
    const fallback = resolveMetaAdsDateRange({ preset: "last_7d", now: input.now });
    const range = fallback.ok
      ? fallback.range
      : ({
          preset: "last_7d",
          since: "1970-01-01",
          until: "1970-01-01",
          comparisonSince: "1970-01-01",
          comparisonUntil: "1970-01-01",
          label: "Invalid",
          dayCount: 1,
        } as MetaAdsResolvedDateRange);
    return emptyView({
      freshness: "unavailable",
      message: dateResolved.error.message,
      dateRange: range,
      errors: [dateResolved.error],
    });
  }

  const dateRange = dateResolved.range;
  const comparisonRange: MetaAdsResolvedDateRange = {
    ...dateRange,
    preset: "custom",
    since: dateRange.comparisonSince,
    until: dateRange.comparisonUntil,
    label: "Previous period",
  };

  if (!isSocialOAuthConnectConfigured()) {
    return emptyView({
      freshness: "misconfigured",
      message:
        "Meta OAuth is not configured. Set META_OAUTH_ENABLED, META_APP_ID, META_APP_SECRET, CREDENTIAL_VAULT_MASTER_KEY, and OAUTH_ENABLED before using ad analytics.",
      dateRange,
      errors: [
        sanitizedError(
          "misconfigured",
          "Meta OAuth runtime configuration is incomplete.",
          "misconfigured",
        ),
      ],
    });
  }

  const tokenResult = await resolveMetaAdsAccessToken();
  if (!tokenResult.ok) {
    return emptyView({
      freshness: tokenResult.error.freshness,
      message: tokenResult.error.message,
      dateRange,
      errors: [tokenResult.error],
      connection: {
        ...baseConnection(null),
        hasConnectedSession: false,
        hasAdsRead: false,
      },
    });
  }

  const permission = await checkMetaAdsReadPermission({
    accessToken: tokenResult.accessToken,
    fetchImpl: input.fetchImpl,
  });

  if (!permission.ok) {
    return emptyView({
      freshness: permission.error.freshness,
      message: permission.error.message,
      dateRange,
      errors: [permission.error],
      connection: {
        ...baseConnection(tokenResult.publicationTargetId),
        hasAdsRead: false,
      },
    });
  }

  const accountsResult = await fetchAuthorizedAdAccounts({
    accessToken: tokenResult.accessToken,
    fetchImpl: input.fetchImpl,
  });

  if (!accountsResult.ok) {
    const blocked =
      accountsResult.error.code === "permission_missing" ||
      !permission.hasAdsRead;
    const error = blocked ? missingAdsReadError() : accountsResult.error;
    return emptyView({
      freshness: error.freshness,
      message: error.message,
      dateRange,
      errors: [error],
      connection: {
        ...baseConnection(tokenResult.publicationTargetId),
        hasAdsRead: false,
      },
    });
  }

  const accounts = accountsResult.accounts;
  if (accounts.length === 0) {
    return {
      ...emptyView({
        freshness: "empty",
        message:
          "No Meta ad accounts are visible to this connection. Confirm Business Manager access, then refresh.",
        dateRange,
        connection: {
          ...baseConnection(tokenResult.publicationTargetId),
          hasAdsRead: true,
        },
      }),
      accounts,
    };
  }

  const requested = (input.accountId ?? "").trim();
  let selected = accounts[0]!;
  if (requested) {
    const match = accounts.find(
      (account) =>
        account.id === requested ||
        account.accountId === requested.replace(/^act_/, "") ||
        account.id === `act_${requested.replace(/^act_/, "")}`,
    );
    if (!match) {
      return {
        ...emptyView({
          freshness: "unavailable",
          message: "That ad account is not authorized for this Meta connection.",
          dateRange,
          errors: [
            sanitizedError(
              "invalid_account",
              "Unauthorized or unknown ad account id.",
              "unavailable",
            ),
          ],
          connection: {
            ...baseConnection(tokenResult.publicationTargetId),
            hasAdsRead: true,
          },
        }),
        accounts,
      };
    }
    selected = match;
  }

  const hierarchy = await fetchAdHierarchyWithInsights({
    accessToken: tokenResult.accessToken,
    accountId: selected.accountId,
    range: dateRange,
    comparisonRange,
    statusFilter: input.status ?? null,
    fetchImpl: input.fetchImpl,
  });

  if (!hierarchy.ok) {
    return {
      ...emptyView({
        freshness: hierarchy.error.freshness,
        message: hierarchy.error.message,
        dateRange,
        errors: [hierarchy.error],
        connection: {
          ...baseConnection(tokenResult.publicationTargetId),
          hasAdsRead: true,
        },
      }),
      accounts,
      selectedAccountId: selected.id,
    };
  }

  let campaigns = hierarchy.campaigns;
  const campaignFilter = input.campaignId?.trim();
  if (campaignFilter) {
    campaigns = campaigns.filter((campaign) => campaign.id === campaignFilter);
  }

  const activeCampaignCount = campaigns.filter(
    (campaign) => campaign.effectiveStatus === "ACTIVE",
  ).length;

  const accountInsights = hierarchy.accountInsights;
  // When filtering to one campaign, recompute visible totals from that campaign.
  const totalsInsights =
    campaignFilter && campaigns[0]
      ? campaigns[0].insights
      : accountInsights;

  const comparisonTotals = hierarchy.comparisonAccountInsights
    ? totalsFromInsights(hierarchy.comparisonAccountInsights, activeCampaignCount)
    : null;

  const freshness =
    hierarchy.warnings.length > 0 ? ("stale" as const) : ("fresh" as const);

  return {
    generatedAt: new Date().toISOString(),
    freshness,
    message:
      hierarchy.warnings.length > 0
        ? "Some Meta reads partially failed; totals may be incomplete."
        : campaigns.length === 0
          ? "No campaigns matched these filters."
          : null,
    connection: {
      ...baseConnection(tokenResult.publicationTargetId),
      hasAdsRead: true,
    },
    accounts,
    selectedAccountId: selected.id,
    dateRange,
    statusFilter: input.status?.trim().toUpperCase() || null,
    totals: totalsFromInsights(totalsInsights, activeCampaignCount),
    comparisonTotals,
    campaigns,
    daily: hierarchy.daily,
    metricGlossary: META_ADS_METRIC_GLOSSARY,
    errors: hierarchy.warnings,
  };
}

export function deltaLabel(
  current: MetaAdsDashboardTotals["spend"],
  previous: MetaAdsDashboardTotals["spend"] | undefined,
): string | null {
  const a = metricNumber(current);
  const b = previous ? metricNumber(previous) : null;
  if (a === null || b === null) return null;
  if (b === 0) return a === 0 ? "0%" : "new";
  const pct = ((a - b) / Math.abs(b)) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}% vs prior`;
}

export function recomputeDerivedFromCounts(input: {
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  linkClicks: number | null;
  landingPageViews: number | null;
}): Pick<
  NormalizedInsights,
  "ctr" | "cpc" | "cpm" | "frequency" | "costPerLandingPageView"
> {
  return {
    ctr: safeDivide(input.linkClicks, input.impressions),
    cpc: safeDivide(input.spend, input.linkClicks),
    cpm: safeDivide(
      input.spend !== null && input.impressions !== null
        ? input.spend * 1000
        : null,
      input.impressions,
    ),
    frequency: safeDivide(input.impressions, input.reach),
    costPerLandingPageView: safeDivide(input.spend, input.landingPageViews),
  };
}

export { buildSafeAdsManagerUrl, numberMetric, sumMetrics };
