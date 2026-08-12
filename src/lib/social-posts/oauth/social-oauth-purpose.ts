/** Stable sentinel target id for analytics-only Meta OAuth sessions (not a Page publish target). */
export const META_AD_ANALYTICS_OAUTH_TARGET_ID = "ad-analytics" as const;

export const SOCIAL_META_OAUTH_PURPOSES = ["publication", "ad_analytics"] as const;
export type SocialMetaOAuthPurpose = (typeof SOCIAL_META_OAUTH_PURPOSES)[number];

export const META_OAUTH_PURPOSE_COOKIE = "jj_meta_oauth_purpose" as const;

export const SOCIAL_META_PUBLICATION_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
] as const;

/** Read-only Marketing API reporting + Business Manager account discovery. */
export const SOCIAL_META_AD_ANALYTICS_OAUTH_SCOPES = [
  "ads_read",
  "business_management",
] as const;

/** @deprecated Prefer SOCIAL_META_PUBLICATION_OAUTH_SCOPES for publication connects. */
export const SOCIAL_META_OAUTH_SCOPES = SOCIAL_META_PUBLICATION_OAUTH_SCOPES;

export type SocialMetaPublicationOAuthScope =
  (typeof SOCIAL_META_PUBLICATION_OAUTH_SCOPES)[number];
export type SocialMetaAdAnalyticsOAuthScope =
  (typeof SOCIAL_META_AD_ANALYTICS_OAUTH_SCOPES)[number];
export type SocialMetaOAuthScope =
  | SocialMetaPublicationOAuthScope
  | SocialMetaAdAnalyticsOAuthScope;

export const SOCIAL_META_PUBLICATION_SCOPE_SET = new Set<string>(
  SOCIAL_META_PUBLICATION_OAUTH_SCOPES,
);
export const SOCIAL_META_AD_ANALYTICS_SCOPE_SET = new Set<string>(
  SOCIAL_META_AD_ANALYTICS_OAUTH_SCOPES,
);

export function isSocialMetaOAuthPurpose(
  value: string | null | undefined,
): value is SocialMetaOAuthPurpose {
  return (
    value === "publication" || value === "ad_analytics"
  );
}

export function scopesForOAuthPurpose(
  purpose: SocialMetaOAuthPurpose,
): readonly SocialMetaOAuthScope[] {
  return purpose === "ad_analytics"
    ? SOCIAL_META_AD_ANALYTICS_OAUTH_SCOPES
    : SOCIAL_META_PUBLICATION_OAUTH_SCOPES;
}

export function resolveOAuthPurposeFromIntent(input: {
  publicationTargetId: string;
  scopes: readonly string[];
}): SocialMetaOAuthPurpose {
  if (input.publicationTargetId === META_AD_ANALYTICS_OAUTH_TARGET_ID) {
    return "ad_analytics";
  }
  const hasAdsRead = input.scopes.includes("ads_read");
  const hasPublishing = input.scopes.some(
    (scope) =>
      scope === "pages_manage_posts" ||
      scope === "instagram_content_publish",
  );
  if (hasAdsRead && !hasPublishing) return "ad_analytics";
  return "publication";
}

export function oauthReturnPathForPurpose(
  purpose: SocialMetaOAuthPurpose,
  query: string,
): string {
  const base =
    purpose === "ad_analytics"
      ? "/admin/ad-analytics"
      : "/admin/social-posts/publication-execution";
  return query ? `${base}?${query}` : base;
}

export function isAllowlistedOAuthReturnPath(pathWithQuery: string): boolean {
  try {
    const url = new URL(pathWithQuery, "https://jumpingjaxllc.com");
    return (
      url.pathname === "/admin/ad-analytics" ||
      url.pathname === "/admin/social-posts/publication-execution"
    );
  } catch {
    return false;
  }
}

export function intentRequestsAdsRead(scopes: readonly string[]): boolean {
  return scopes.includes("ads_read");
}

export function intentRequestsBusinessManagement(
  scopes: readonly string[],
): boolean {
  return scopes.includes("business_management");
}

/** True when an intent requested the full analytics scope contract. */
export function intentRequestsAnalyticsScopes(
  scopes: readonly string[],
): boolean {
  return (
    intentRequestsAdsRead(scopes) && intentRequestsBusinessManagement(scopes)
  );
}

export function intentRequestsPublishingScopes(scopes: readonly string[]): boolean {
  return scopes.some(
    (scope) =>
      scope === "pages_manage_posts" ||
      scope === "instagram_content_publish" ||
      scope === "pages_show_list" ||
      scope === "instagram_basic",
  );
}
