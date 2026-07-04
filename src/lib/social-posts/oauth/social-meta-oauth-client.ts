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
      body: new URLSearchParams({
        client_id: input.appId,
        client_secret: input.appSecret,
        redirect_uri: input.redirectUri,
        code: input.authorizationCode,
      }).toString(),
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
        message: error?.message ?? "Meta token exchange failed.",
      };
    }

    const tokenPayload = payload as SocialMetaOAuthTokenResponse;
    if (!tokenPayload.access_token?.trim()) {
      return {
        ok: false,
        errorCode: "missing_access_token",
        message: "Meta token exchange returned no access token.",
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
      message:
        error instanceof Error ? error.message : "Meta token exchange network error.",
    };
  }
}

export function redactMetaAccountId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "***";
  return `***${trimmed.slice(-4)}`;
}

export function validateMetaRedirectUri(
  redirectUri: string,
  config: SocialOAuthRuntimeConfig,
): boolean {
  return config.redirectUriAllowlist.includes(redirectUri);
}
