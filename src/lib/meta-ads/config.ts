/** Marketing API version for paid-ad reads. Kept separate from OAuth Graph v21.0. */
export const META_MARKETING_API_VERSION = "v25.0" as const;

export const META_ADS_HTTP_TIMEOUT_MS = 25_000;
export const META_ADS_MAX_PAGES = 25;
export const META_ADS_PAGE_LIMIT = 100;
/** Hard ceiling for custom date ranges (inclusive calendar days). */
export const META_ADS_MAX_RANGE_DAYS = 366;

export const META_ADS_REQUIRED_SCOPE = "ads_read" as const;
export const META_ADS_BUSINESS_SCOPE = "business_management" as const;
export const META_ADS_REQUIRED_SCOPES = [
  META_ADS_REQUIRED_SCOPE,
  META_ADS_BUSINESS_SCOPE,
] as const;

export const META_ADS_GRAPH_BASE = `https://graph.facebook.com/${META_MARKETING_API_VERSION}`;

/** Default attribution window label shown in the UI (Meta account settings may differ). */
export const META_ADS_ATTRIBUTION_NOTE =
  "Metrics use the ad account attribution settings configured in Meta Ads Manager.";
