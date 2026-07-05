import { createServiceRoleClient, isSupabaseServiceConfigured } from "../../supabase/admin";
import { loadSocialCredentialSnapshot } from "../credentials/social-credential-store";
import type { SocialCredentialVaultRecordRow } from "../credentials/social-credential-repository";
import {
  exchangeMetaLongLivedAccessToken,
  refreshMetaOAuthAccessToken,
} from "./social-meta-oauth-client";
import {
  decryptOAuthSecret,
  hydrateOAuthEnvelope,
} from "./social-oauth-credential-envelope";
import {
  isSocialOAuthConnectConfigured,
  resolveSocialOAuthRuntimeConfig,
  type SocialOAuthRuntimeConfig,
} from "./social-oauth-config";
import { evaluateMetaRefreshEligibility } from "./social-oauth-refresh-eligibility";
import { assessTokenExpiry } from "./social-oauth-token-expiry-domain";
import {
  validateMetaTokenRefreshResult,
  validateRefreshEligibilityBeforeExchange,
} from "./social-oauth-token-refresh-validation";
import {
  loadConnectedMetaOAuthSession,
  loadMetaAccessTokenForPublicationTarget,
} from "./social-oauth-token-loader";
import { rotateMetaAccessTokenInVault } from "./social-oauth-vault-rotation";

export const SOCIAL_OAUTH_TOKEN_REFRESH_SERVICE_VERSION = "d16-w3-v1" as const;

export type SocialOAuthTokenRefreshResult = Readonly<
  | {
      ok: true;
      publicationTargetId: string;
      sessionId: string;
      accessCredentialRefId: string;
      refreshCredentialRefId: string | null;
      lifecycleStateId: string;
      supersededCredentialRefId: string;
      refreshMode: "fb_exchange_token" | "oauth_refresh_token";
    }
  | { ok: false; code: string; message: string }
>;

export async function refreshMetaOAuthTokenForPublicationTarget(input: {
  publicationTargetId: string;
  adminActorId: string;
  config?: SocialOAuthRuntimeConfig;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<SocialOAuthTokenRefreshResult> {
  const config = input.config ?? resolveSocialOAuthRuntimeConfig();
  if (!isSocialOAuthConnectConfigured(config)) {
    return {
      ok: false,
      code: "oauth_not_configured",
      message: "Meta OAuth connect is not configured or disabled.",
    };
  }

  if (!isSupabaseServiceConfigured()) {
    return {
      ok: false,
      code: "storage_unavailable",
      message: "OAuth session storage is not configured.",
    };
  }

  const sessionResult = await loadConnectedMetaOAuthSession(input.publicationTargetId);
  if (!sessionResult.ok) {
    return sessionResult;
  }

  const snapshotResult = await loadSocialCredentialSnapshot();
  if (!snapshotResult.ok) {
    return {
      ok: false,
      code: "credential_snapshot_unavailable",
      message: snapshotResult.error.message,
    };
  }

  const session = sessionResult.session;
  const credentialRefId = session.access_credential_ref_id;
  if (!credentialRefId?.trim()) {
    return {
      ok: false,
      code: "credential_ref_missing",
      message: "Connected OAuth session is missing an access credential reference.",
    };
  }

  const vaultRecord =
    snapshotResult.value.vault_records.find(
      (record) =>
        record.credential_ref_id === credentialRefId &&
        record.provider === "meta" &&
        record.lifecycle_phase === "active" &&
        record.revoked_at === null &&
        record.superseded_at === null,
    ) ?? null;

  const lifecycleState =
    snapshotResult.value.lifecycle_states.find(
      (state) => state.credential_ref_id === credentialRefId && state.provider === "meta",
    ) ?? null;

  const expiryAssessment = assessTokenExpiry({
    expiresAt: lifecycleState?.expires_at ?? null,
    issuedAt: lifecycleState?.issued_at ?? null,
    now: input.now,
  });

  const refreshRefId = session.refresh_credential_ref_id;
  const refreshVaultRecord = refreshRefId
    ? snapshotResult.value.vault_records.find(
        (record) =>
          record.credential_ref_id === refreshRefId &&
          record.credential_kind === "oauth_refresh_ref" &&
          record.lifecycle_phase === "active",
      ) ?? null
    : null;

  const eligibility = evaluateMetaRefreshEligibility({
    config,
    session,
    vaultRecord,
    lifecycleState,
    expiryAssessment,
    hasRefreshTokenInVault: Boolean(refreshVaultRecord?.encrypted_payload_ref?.trim()),
  });

  const eligibilityValidation = validateRefreshEligibilityBeforeExchange(eligibility);
  if (!eligibilityValidation.ok) {
    return eligibilityValidation;
  }

  if (!vaultRecord) {
    return {
      ok: false,
      code: "vault_record_missing",
      message: "Active Meta vault record could not be resolved for refresh.",
    };
  }

  const tokenLoad = await loadMetaAccessTokenForPublicationTarget({
    publicationTargetId: input.publicationTargetId,
    config,
  });
  if (!tokenLoad.ok) {
    return tokenLoad;
  }

  let exchangeResult;
  if (eligibility.refreshMode === "oauth_refresh_token") {
    if (!config.vaultMasterKey || !refreshVaultRecord?.encrypted_payload_ref?.trim()) {
      return {
        ok: false,
        code: "refresh_token_unavailable",
        message: "Refresh token reference is not available in the vault.",
      };
    }
    let refreshToken: string;
    try {
      refreshToken = decryptOAuthSecret(
        hydrateOAuthEnvelope(refreshVaultRecord.encrypted_payload_ref),
        config.vaultMasterKey,
      );
    } catch {
      return {
        ok: false,
        code: "refresh_token_decrypt_failed",
        message: "Stored refresh token could not be decrypted.",
      };
    }
    if (!refreshToken.trim()) {
      return {
        ok: false,
        code: "refresh_token_decrypt_empty",
        message: "Decrypted refresh token was empty.",
      };
    }

    exchangeResult = await refreshMetaOAuthAccessToken({
      appId: config.metaAppId!,
      appSecret: config.metaAppSecret!,
      refreshToken,
      fetchImpl: input.fetchImpl,
    });
  } else {
    exchangeResult = await exchangeMetaLongLivedAccessToken({
      appId: config.metaAppId!,
      appSecret: config.metaAppSecret!,
      currentAccessToken: tokenLoad.accessToken,
      fetchImpl: input.fetchImpl,
    });
  }

  const refreshValidation = validateMetaTokenRefreshResult(exchangeResult);
  if (!refreshValidation.ok) {
    return refreshValidation;
  }
  if (!exchangeResult.ok) {
    return {
      ok: false,
      code: "refresh_exchange_failed",
      message: "Meta token refresh exchange failed after validation.",
    };
  }

  const rotation = await rotateMetaAccessTokenInVault({
    publicationTargetId: input.publicationTargetId,
    priorAccessCredentialRefId:
      credentialRefId as SocialCredentialVaultRecordRow["credential_ref_id"],
    priorVaultRecord: vaultRecord,
    priorLifecycleState: lifecycleState,
    newAccessToken: exchangeResult.accessToken,
    expiresInSeconds: refreshValidation.expiresInSeconds,
    adminActorId: input.adminActorId,
    config,
  });

  if (!rotation.ok) {
    return rotation;
  }

  const client = createServiceRoleClient();
  const { error: sessionUpdateError } = await client
    .from("social_oauth_sessions")
    .update({
      access_credential_ref_id: rotation.accessCredentialRefId,
      refresh_credential_ref_id: rotation.refreshCredentialRefId,
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", session.session_id);

  if (sessionUpdateError) {
    return {
      ok: false,
      code: "session_update_failed",
      message: sessionUpdateError.message,
    };
  }

  return {
    ok: true,
    publicationTargetId: input.publicationTargetId,
    sessionId: session.session_id,
    accessCredentialRefId: rotation.accessCredentialRefId,
    refreshCredentialRefId: rotation.refreshCredentialRefId,
    lifecycleStateId: rotation.lifecycleStateId,
    supersededCredentialRefId: rotation.supersededCredentialRefId,
    refreshMode: eligibility.refreshMode as "fb_exchange_token" | "oauth_refresh_token",
  };
}
