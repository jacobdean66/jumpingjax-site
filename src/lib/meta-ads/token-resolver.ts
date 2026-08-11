import { createServiceRoleClient, isSupabaseServiceConfigured } from "../supabase/admin";
import {
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
 * Resolve a Meta user access token from the latest connected OAuth session.
 * Reuses the encrypted vault loader — never reads vault rows in UI code.
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
    .select("publication_target_id, session_id")
    .eq("provider", "meta")
    .eq("lifecycle_state", "connected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.publication_target_id) {
    return {
      ok: false,
      error: sanitizedError(
        "oauth_session_missing",
        "No connected Meta OAuth session found. Connect Meta from Social Posts → Publication execution.",
        "unavailable",
      ),
    };
  }

  const tokenResult = await loadMetaAccessTokenForPublicationTarget({
    publicationTargetId: String(data.publication_target_id),
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
    publicationTargetId: String(data.publication_target_id),
    sessionId: tokenResult.sessionId,
  };
}
