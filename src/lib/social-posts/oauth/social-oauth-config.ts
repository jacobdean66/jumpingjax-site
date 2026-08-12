export const SOCIAL_META_OAUTH_VERSION = "d16-w1-v1" as const;

export {
  META_AD_ANALYTICS_OAUTH_TARGET_ID,
  META_OAUTH_PURPOSE_COOKIE,
  SOCIAL_META_AD_ANALYTICS_OAUTH_SCOPES,
  SOCIAL_META_OAUTH_PURPOSES,
  SOCIAL_META_OAUTH_SCOPES,
  SOCIAL_META_PUBLICATION_OAUTH_SCOPES,
  intentRequestsAdsRead,
  intentRequestsAnalyticsScopes,
  intentRequestsBusinessManagement,
  intentRequestsPublishingScopes,
  isAllowlistedOAuthReturnPath,
  isSocialMetaOAuthPurpose,
  oauthReturnPathForPurpose,
  resolveOAuthPurposeFromIntent,
  scopesForOAuthPurpose,
  type SocialMetaAdAnalyticsOAuthScope,
  type SocialMetaOAuthPurpose,
  type SocialMetaOAuthScope,
  type SocialMetaPublicationOAuthScope,
} from "./social-oauth-purpose";

export const SOCIAL_OAUTH_INTENT_TTL_MS = 10 * 60 * 1000;

export type SocialOAuthRuntimeConfig = Readonly<{
  oauthEnabled: boolean;
  metaOAuthEnabled: boolean;
  metaAppId: string | null;
  metaAppSecret: string | null;
  vaultMasterKey: Buffer | null;
  callbackRedirectBaseUrl: string | null;
  redirectUriAllowlist: readonly string[];
}>;

function readBooleanEnv(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return defaultValue;
  return raw.trim().toLowerCase() === "true";
}

function readVaultMasterKey(): Buffer | null {
  const raw = process.env.CREDENTIAL_VAULT_MASTER_KEY?.trim();
  if (!raw) return null;
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== 32) return null;
  return decoded;
}

function resolveSiteBaseUrl(): string | null {
  const explicit =
    process.env.OAUTH_REDIRECT_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!explicit) return null;
  if (explicit.startsWith("http://") || explicit.startsWith("https://")) {
    return explicit.replace(/\/$/, "");
  }
  return `https://${explicit.replace(/\/$/, "")}`;
}

export function resolveSocialOAuthRuntimeConfig(): SocialOAuthRuntimeConfig {
  const callbackRedirectBaseUrl = resolveSiteBaseUrl();
  const callbackUri = callbackRedirectBaseUrl
    ? `${callbackRedirectBaseUrl}/api/admin/social-oauth/callback`
    : null;
  const allowlist = callbackUri ? [callbackUri] : [];

  return {
    oauthEnabled: readBooleanEnv("OAUTH_ENABLED", false),
    metaOAuthEnabled: readBooleanEnv("META_OAUTH_ENABLED", false),
    metaAppId: process.env.META_APP_ID?.trim() || null,
    metaAppSecret: process.env.META_APP_SECRET?.trim() || null,
    vaultMasterKey: readVaultMasterKey(),
    callbackRedirectBaseUrl,
    redirectUriAllowlist: allowlist,
  };
}

export function isSocialOAuthConnectConfigured(
  config: SocialOAuthRuntimeConfig = resolveSocialOAuthRuntimeConfig(),
): boolean {
  return Boolean(
    config.oauthEnabled &&
      config.metaOAuthEnabled &&
      config.metaAppId &&
      config.metaAppSecret &&
      config.vaultMasterKey &&
      config.redirectUriAllowlist.length > 0,
  );
}

export function buildMetaOAuthCallbackUri(
  config: SocialOAuthRuntimeConfig = resolveSocialOAuthRuntimeConfig(),
): string | null {
  return config.redirectUriAllowlist[0] ?? null;
}
