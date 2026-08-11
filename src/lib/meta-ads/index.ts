export { META_MARKETING_API_VERSION, META_ADS_REQUIRED_SCOPE } from "./config";
export {
  resolveMetaAdsDateRange,
  META_ADS_DATE_PRESETS,
  type MetaAdsDatePreset,
  type MetaAdsResolvedDateRange,
} from "./dates";
export {
  loadMetaAdsDashboard,
  deltaLabel,
  recomputeDerivedFromCounts,
  buildSafeAdsManagerUrl,
} from "./dashboard-service";
export {
  formatMetricMoney,
  formatMetricCount,
  formatMetricRate,
  formatMetricDecimal,
  normalizeInsightsRow,
  normalizeActionResults,
  humanizeActionType,
  safeDivide,
  numberMetric,
  emptyInsights,
  zeroInsights,
} from "./normalize";
export { redactProviderText, mapMetaHttpFailure } from "./errors";
export type {
  MetaAdsDashboardViewModel,
  MetaAdsDashboardTotals,
  MetaCampaignRow,
  MetaAdSetRow,
  MetaAdRow,
  MetricValue,
} from "./types";
export { META_ADS_METRIC_GLOSSARY } from "./types";
