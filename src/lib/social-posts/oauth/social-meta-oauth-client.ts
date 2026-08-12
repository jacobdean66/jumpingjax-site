import { createHash } from "node:crypto";
import {
  SOCIAL_META_OAUTH_SCOPES,
  type SocialMetaOAuthScope,
  type SocialOAuthRuntimeConfig,
} from "./social-oauth-config";

export const SOCIAL_META_OAUTH_GRAPH_VERSION = "v21.0" as const;

export type SocialMetaOAuthTokenResponse = Readonly<{
  access_token: string;
  token_type?: string;
  expires_in?: number;
}>;

export type SocialMetaOAuthExchangeResult = Readonly<
  | {
      ok: true;
      accessToken: string;
      expiresInSeconds: number | null;
      tokenType: string | null;
    }
  | {
      ok: false;
      errorCode: string;
      message: string;
    }
>;

export function buildMetaAuthorizeUrl(input: {
  appId: string;
  redirectUri: string;
  oauthState: string;
  scopes?: readonly SocialMetaOAuthScope[];
}): string {
  const url = new URL(
    `https://www.facebook.com/${SOCIAL_META_OAUTH_GRAPH_VERSION}/dialog/oauth`,
  );
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.oauthState);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", (input.scopes ?? SOCIAL_META_OAUTH_SCOPES).join(","));
  return url.toString();
}

export async function exchangeMetaAuthorizationCode(input: {
  appId: string;
  appSecret: string;
  redirectUri: string;
  authorizationCode: string;
  fetchImpl?: typeof fetch;
}): Promise<SocialMetaOAuthExchangeResult> {
  return exchangeMetaAccessToken({
    appId: input.appId,
    appSecret: input.appSecret,
    body: new URLSearchParams({
      client_id: input.appId,
      client_secret: input.appSecret,
      redirect_uri: input.redirectUri,
      code: input.authorizationCode,
    }),
    fetchImpl: input.fetchImpl,
    missingTokenCode: "missing_access_token",
    missingTokenMessage: "Meta token exchange returned no access token.",
    failureMessage: "Meta token exchange failed.",
    networkMessage: "Meta token exchange network error.",
  });
}

export async function exchangeMetaLongLivedAccessToken(input: {
  appId: string;
  appSecret: string;
  currentAccessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<SocialMetaOAuthExchangeResult> {
  return exchangeMetaAccessToken({
    appId: input.appId,
    appSecret: input.appSecret,
    body: new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: input.appId,
      client_secret: input.appSecret,
      fb_exchange_token: input.currentAccessToken,
    }),
    fetchImpl: input.fetchImpl,
    missingTokenCode: "missing_access_token",
    missingTokenMessage: "Meta long-lived token exchange returned no access token.",
    failureMessage: "Meta long-lived token exchange failed.",
    networkMessage: "Meta long-lived token exchange network error.",
  });
}

export async function refreshMetaOAuthAccessToken(input: {
  appId: string;
  appSecret: string;
  refreshToken: string;
  fetchImpl?: typeof fetch;
}): Promise<SocialMetaOAuthExchangeResult> {
  return exchangeMetaAccessToken({
    appId: input.appId,
    appSecret: input.appSecret,
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: input.appId,
      client_secret: input.appSecret,
      refresh_token: input.refreshToken,
    }),
    fetchImpl: input.fetchImpl,
    missingTokenCode: "missing_access_token",
    missingTokenMessage: "Meta refresh token exchange returned no access token.",
    failureMessage: "Meta refresh token exchange failed.",
    networkMessage: "Meta refresh token exchange network error.",
  });
}

async function exchangeMetaAccessToken(input: {
  appId: string;
  appSecret: string;
  body: URLSearchParams;
  fetchImpl?: typeof fetch;
  missingTokenCode: string;
  missingTokenMessage: string;
  failureMessage: string;
  networkMessage: string;
}): Promise<SocialMetaOAuthExchangeResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = new URL(
    `https://graph.facebook.com/${SOCIAL_META_OAUTH_GRAPH_VERSION}/oauth/access_token`,
  );

  try {
    const response = await fetchImpl(url.toString(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: input.body.toString(),
      cache: "no-store",
    });
    const payload = (await response.json()) as
      | SocialMetaOAuthTokenResponse
      | { error?: { message?: string; type?: string; code?: number } };

    if (!response.ok || "error" in payload) {
      const error = "error" in payload ? payload.error : undefined;
      return {
        ok: false,
        errorCode: error?.type ?? "provider_error",
        message: error?.message ?? input.failureMessage,
      };
    }

    const tokenPayload = payload as SocialMetaOAuthTokenResponse;
    if (!tokenPayload.access_token?.trim()) {
      return {
        ok: false,
        errorCode: input.missingTokenCode,
        message: input.missingTokenMessage,
      };
    }

    return {
      ok: true,
      accessToken: tokenPayload.access_token,
      expiresInSeconds:
        typeof tokenPayload.expires_in === "number" ? tokenPayload.expires_in : null,
      tokenType: tokenPayload.token_type ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      errorCode: "network_error",
      message: error instanceof Error ? error.message : input.networkMessage,
    };
  }
}

export function redactMetaAccountId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "***";
  return `***${trimmed.slice(-4)}`;
}

/**
 * Non-colliding server-side vault identity for a Meta Page.
 * Uses a full SHA-256 of the Page ID (not last-4 redaction) so distinct pages
 * never share an account_ref_id. Digest is not a secret and is safe in vault metadata.
 */
export function buildMetaPageVaultAccountRefId(pageId: string): string {
  const normalized = pageId.trim();
  const digest = createHash("sha256")
    .update(`meta-page-vault-v1:${normalized}`)
    .digest("hex");
  return `meta-page:${digest}`;
}

/** Stable provider_account_id including full page id (server-only identity). */
export function buildMetaPageVaultProviderAccountId(
  publicationTargetId: string,
  pageId: string,
): string {
  return `meta-page-account:${publicationTargetId.trim()}:${pageId.trim()}`;
}

export function validateMetaRedirectUri(
  redirectUri: string,
  config: SocialOAuthRuntimeConfig,
): boolean {
  return config.redirectUriAllowlist.includes(redirectUri);
}
