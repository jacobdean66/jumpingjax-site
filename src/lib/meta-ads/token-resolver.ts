import { createServiceRoleClient, isSupabaseServiceConfigured } from "../supabase/admin";
import {
  META_AD_ANALYTICS_OAUTH_TARGET_ID,
  intentRequestsAdsRead,
  isSocialOAuthConnectConfigured,
  resolveSocialOAuthRuntimeConfig,
} from "../social-posts/oauth/social-oauth-config";
import { loadMetaAccessTokenForPublicationTarget } from "../social-posts/oauth/social-oauth-token-loader";
import { sanitizedError, type MetaAdsSanitizedError } from "./errors";

export type MetaAdsTokenResolution = Readonly<
  | {
      ok: true;
      accessToken: string;
      publicationTargetId: string;
      sessionId: string;
    }
  | { ok: false; error: MetaAdsSanitizedError }
>;

/**
 * Resolve a Meta user access token from the latest connected analytics OAuth session.
 * Requires an intent that requested ads_read and ignores awaiting_callback rows.
 */
export async function resolveMetaAdsAccessToken(): Promise<MetaAdsTokenResolution> {
  const config = resolveSocialOAuthRuntimeConfig();
  if (!isSocialOAuthConnectConfigured(config)) {
    return {
      ok: false,
      error: sanitizedError(
        "misconfigured",
        "Meta OAuth is not fully configured (app id/secret, vault key, or OAuth flags).",
        "misconfigured",
      ),
    };
  }

  if (!isSupabaseServiceConfigured()) {
    return {
      ok: false,
      error: sanitizedError(
        "misconfigured",
        "Supabase service role is not configured for OAuth session lookup.",
        "misconfigured",
      ),
    };
  }

  const client = createServiceRoleClient();
  const { data, error } = await client
    .from("social_oauth_sessions")
    .select("publication_target_id, session_id, intent_id, lifecycle_state")
    .eq("provider", "meta")
    .eq("lifecycle_state", "connected")
    .eq("publication_target_id", META_AD_ANALYTICS_OAUTH_TARGET_ID)
    .order("updated_at", { ascending: false })
    .limit(5);

  if (error) {
    return {
      ok: false,
      error: sanitizedError(
        "token_unavailable",
        "Meta analytics session lookup failed.",
        "unavailable",
      ),
    };
  }

  const sessions = data ?? [];
  if (sessions.length === 0) {
    return {
      ok: false,
      error: sanitizedError(
        "oauth_session_missing",
        "No connected Meta analytics session found. Use Connect Meta for Analytics on this page.",
        "unavailable",
      ),
    };
  }

  for (const session of sessions) {
    const intentId = String(session.intent_id ?? "");
    if (!intentId) continue;
    const { data: intent } = await client
      .from("social_oauth_authorization_intents")
      .select("scopes")
      .eq("intent_id", intentId)
      .maybeSingle();
    const scopes = (intent?.scopes as string[] | null) ?? [];
    if (!intentRequestsAdsRead(scopes)) continue;

    const tokenResult = await loadMetaAccessTokenForPublicationTarget({
      publicationTargetId: META_AD_ANALYTICS_OAUTH_TARGET_ID,
      config,
    });

    if (!tokenResult.ok) {
      const freshness =
        tokenResult.code === "vault_key_missing" ||
        tokenResult.code === "storage_unavailable"
          ? "misconfigured"
          : "token_expired";
      return {
        ok: false,
        error: sanitizedError(
          tokenResult.code === "oauth_session_not_connected"
            ? "oauth_session_missing"
            : "token_unavailable",
          tokenResult.message,
          freshness,
        ),
      };
    }

    return {
      ok: true,
      accessToken: tokenResult.accessToken,
      publicationTargetId: META_AD_ANALYTICS_OAUTH_TARGET_ID,
      sessionId: tokenResult.sessionId,
    };
  }

  return {
    ok: false,
    error: sanitizedError(
      "permission_missing",
      "Connected Meta session is missing ads_read. Reconnect Meta for Analytics.",
      "permission_blocked",
    ),
  };
}
