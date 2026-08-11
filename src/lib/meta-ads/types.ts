export type MetricValue = Readonly<
  | { kind: "number"; value: number }
  | { kind: "unavailable" }
>;

export type NamedActionResult = Readonly<{
  actionType: string;
  label: string;
  count: number;
  cost: MetricValue;
}>;

export type NormalizedInsights = Readonly<{
  spend: MetricValue;
  impressions: MetricValue;
  reach: MetricValue;
  frequency: MetricValue;
  clicks: MetricValue;
  linkClicks: MetricValue;
  landingPageViews: MetricValue;
  ctr: MetricValue;
  cpc: MetricValue;
  cpm: MetricValue;
  costPerLandingPageView: MetricValue;
  results: readonly NamedActionResult[];
  dateStart: string | null;
  dateStop: string | null;
}>;

export type MetaAdEntityStatus =
  | "ACTIVE"
  | "PAUSED"
  | "DELETED"
  | "ARCHIVED"
  | "PENDING_REVIEW"
  | "DISAPPROVED"
  | "PREAPPROVED"
  | "PENDING_BILLING_INFO"
  | "CAMPAIGN_PAUSED"
  | "ADSET_PAUSED"
  | "IN_PROCESS"
  | "WITH_ISSUES"
  | "COMPLETED"
  | "UNKNOWN";

export type MetaAdAccountSummary = Readonly<{
  id: string;
  accountId: string;
  name: string;
  currency: string;
  timezoneName: string | null;
  accountStatus: number | null;
  businessName: string | null;
}>;

export type MetaAdCreativeSummary = Readonly<{
  creativeId: string | null;
  thumbnailUrl: string | null;
  previewPermalink: string | null;
  destinationUrl: string | null;
  pageId: string | null;
  pageName: string | null;
  instagramActorId: string | null;
}>;

export type MetaAdEntityMetrics = Readonly<{
  id: string;
  name: string;
  status: MetaAdEntityStatus;
  effectiveStatus: MetaAdEntityStatus;
  configuredStatus: string | null;
  dailyBudget: MetricValue;
  lifetimeBudget: MetricValue;
  startTime: string | null;
  stopTime: string | null;
  insights: NormalizedInsights;
  comparison: NormalizedInsights | null;
}>;

export type MetaAdRow = MetaAdEntityMetrics &
  Readonly<{
    campaignId: string;
    adsetId: string;
    creative: MetaAdCreativeSummary;
  }>;

export type MetaAdSetRow = MetaAdEntityMetrics &
  Readonly<{
    campaignId: string;
    ads: readonly MetaAdRow[];
  }>;

export type MetaCampaignRow = MetaAdEntityMetrics &
  Readonly<{
    objective: string | null;
    adsets: readonly MetaAdSetRow[];
  }>;

export type MetaAdsDailyPoint = Readonly<{
  date: string;
  spend: MetricValue;
  landingPageViews: MetricValue;
  linkClicks: MetricValue;
  impressions: MetricValue;
}>;

export type MetaAdsDashboardTotals = Readonly<{
  spend: MetricValue;
  impressions: MetricValue;
  reach: MetricValue;
  frequency: MetricValue;
  clicks: MetricValue;
  linkClicks: MetricValue;
  landingPageViews: MetricValue;
  ctr: MetricValue;
  cpc: MetricValue;
  cpm: MetricValue;
  costPerLandingPageView: MetricValue;
  activeCampaignCount: number;
  results: readonly NamedActionResult[];
}>;

export type MetaAdsConnectionState = Readonly<{
  configured: boolean;
  hasConnectedSession: boolean;
  hasAdsRead: boolean | null;
  publicationTargetId: string | null;
  reconnectPath: string;
}>;

export type MetaAdsDashboardViewModel = Readonly<{
  generatedAt: string;
  freshness: import("./errors").MetaAdsFreshness;
  message: string | null;
  connection: MetaAdsConnectionState;
  accounts: readonly MetaAdAccountSummary[];
  selectedAccountId: string | null;
  dateRange: import("./dates").MetaAdsResolvedDateRange;
  statusFilter: string | null;
  totals: MetaAdsDashboardTotals;
  comparisonTotals: MetaAdsDashboardTotals | null;
  campaigns: readonly MetaCampaignRow[];
  daily: readonly MetaAdsDailyPoint[];
  metricGlossary: readonly Readonly<{ term: string; meaning: string }>[];
  errors: readonly import("./errors").MetaAdsSanitizedError[];
}>;

export const META_ADS_METRIC_GLOSSARY = [
  {
    term: "CTR",
    meaning:
      "Click-through rate: link clicks divided by impressions, shown as a percentage.",
  },
  {
    term: "CPC",
    meaning: "Cost per click: spend divided by link clicks when clicks exist.",
  },
  {
    term: "CPM",
    meaning: "Cost per 1,000 impressions: (spend / impressions) × 1,000.",
  },
  {
    term: "Frequency",
    meaning:
      "Average times each person saw the ads: impressions divided by reach.",
  },
  {
    term: "Cost per landing-page view",
    meaning:
      "Spend divided by landing-page views when Meta reports that action.",
  },
] as const;
