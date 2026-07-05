import { loadSocialCredentialSnapshot } from "../credentials/social-credential-store";
import {
  isSocialOAuthConnectConfigured,
  resolveSocialOAuthRuntimeConfig,
} from "./social-oauth-config";
import { loadSocialOAuthPersistenceSnapshot } from "./social-oauth-service";
import { evaluateMetaRefreshEligibility } from "./social-oauth-refresh-eligibility";
import {
  SOCIAL_OAUTH_TOKEN_LIFECYCLE_VERSION,
  assessTokenExpiry,
  type SocialOAuthTokenExpiryAssessment,
} from "./social-oauth-token-expiry-domain";
import type { SocialOAuthRefreshEligibility } from "./social-oauth-refresh-eligibility";

export const SOCIAL_OAUTH_TOKEN_LIFECYCLE_REPLAY_VERSION =
  SOCIAL_OAUTH_TOKEN_LIFECYCLE_VERSION;

export type SocialOAuthTokenLifecycleStatus = Readonly<{
  publicationTargetId: string;
  provider: "meta";
  sessionId: string | null;
  connected: boolean;
  accessCredentialRefId: string | null;
  refreshCredentialRefId: string | null;
  lifecyclePhase: string | null;
  expiresAt: string | null;
  lastRotatedAt: string | null;
  expiryAssessment: SocialOAuthTokenExpiryAssessment;
  refreshEligibility: SocialOAuthRefreshEligibility;
  tokenBlockingReasons: readonly string[];
}>;

export type SocialOAuthTokenLifecycleReplaySummary = Readonly<{
  replayVersion: typeof SOCIAL_OAUTH_TOKEN_LIFECYCLE_REPLAY_VERSION;
  oauthConfigured: boolean;
  connectedSessionCount: number;
  validTokenCount: number;
  expiringSoonCount: number;
  expiredTokenCount: number;
  unknownExpiryCount: number;
  refreshEligibleCount: number;
  refreshBlockedCount: number;
  lifecycleAuditRotateCount: number;
}>;

export type SocialOAuthTokenLifecycleReplayDiagnostic = Readonly<{
  code: string;
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
}>;

export type SocialOAuthTokenLifecycleReplayResult = Readonly<{
  replayVersion: typeof SOCIAL_OAUTH_TOKEN_LIFECYCLE_REPLAY_VERSION;
  summary: SocialOAuthTokenLifecycleReplaySummary;
  lifecycleStatuses: readonly SocialOAuthTokenLifecycleStatus[];
  diagnostics: readonly SocialOAuthTokenLifecycleReplayDiagnostic[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export async function replaySocialOAuthTokenLifecycle(
  now: Date = new Date(),
): Promise<SocialOAuthTokenLifecycleReplayResult> {
  const config = resolveSocialOAuthRuntimeConfig();
  const [oauthSnapshot, credentialSnapshot] = await Promise.all([
    loadSocialOAuthPersistenceSnapshot(),
    loadSocialCredentialSnapshot(),
  ]);

  const diagnostics: SocialOAuthTokenLifecycleReplayDiagnostic[] = [];
  if (!isSocialOAuthConnectConfigured(config)) {
    diagnostics.push({
      code: "oauth_not_configured",
      severity: "warning",
      path: "d16.w3.oauth.runtime",
      message: "Meta OAuth connect is not fully configured for token lifecycle diagnostics.",
    });
  }

  const lifecycleStatuses: SocialOAuthTokenLifecycleStatus[] = [];
  const connectedSessions = oauthSnapshot.sessions.filter(
    (session) => session.provider === "meta" && session.lifecycle_state === "connected",
  );

  for (const session of connectedSessions) {
    const credentialRefId = session.access_credential_ref_id;
    const vaultRecord =
      credentialSnapshot.ok && credentialRefId
        ? credentialSnapshot.value.vault_records.find(
            (record) =>
              record.credential_ref_id === credentialRefId &&
              record.provider === "meta",
          ) ?? null
        : null;

    const lifecycleState =
      credentialSnapshot.ok && credentialRefId
        ? credentialSnapshot.value.lifecycle_states.find(
            (state) => state.credential_ref_id === credentialRefId && state.provider === "meta",
          ) ?? null
        : null;

    const refreshRefId = session.refresh_credential_ref_id;
    const refreshVaultRecord =
      credentialSnapshot.ok && refreshRefId
        ? credentialSnapshot.value.vault_records.find(
            (record) =>
              record.credential_ref_id === refreshRefId &&
              record.credential_kind === "oauth_refresh_ref",
          ) ?? null
        : null;

    const expiryAssessment = assessTokenExpiry({
      expiresAt: lifecycleState?.expires_at ?? null,
      issuedAt: lifecycleState?.issued_at ?? null,
      now,
    });

    const refreshEligibility = evaluateMetaRefreshEligibility({
      config,
      session,
      vaultRecord,
      lifecycleState,
      expiryAssessment,
      hasRefreshTokenInVault: Boolean(refreshVaultRecord?.encrypted_payload_ref?.trim()),
    });

    const tokenBlockingReasons = [
      ...expiryAssessment.blockingReasons,
      ...refreshEligibility.blockingReasons,
    ];

    if (expiryAssessment.expiryState === "expired") {
      diagnostics.push({
        code: "token_expired",
        severity: "error",
        path: `d16.w3.lifecycle.${session.publication_target_id}`,
        message: `Meta access token is expired for publication target ${session.publication_target_id}. Reconnect required.`,
      });
    } else if (expiryAssessment.expiryState === "expiring_soon") {
      diagnostics.push({
        code: "token_expiring_soon",
        severity: "warning",
        path: `d16.w3.lifecycle.${session.publication_target_id}`,
        message: `Meta access token is expiring soon for publication target ${session.publication_target_id}.`,
      });
    } else if (expiryAssessment.expiryState === "unknown") {
      diagnostics.push({
        code: "token_expiry_unknown",
        severity: "warning",
        path: `d16.w3.lifecycle.${session.publication_target_id}`,
        message: `Meta access token expiry is unknown for publication target ${session.publication_target_id}.`,
      });
    }

    if (refreshEligibility.eligible) {
      diagnostics.push({
        code: "refresh_eligible",
        severity: "info",
        path: `d16.w3.refresh.${session.publication_target_id}`,
        message: `Controlled refresh is eligible via ${refreshEligibility.refreshMode} for ${session.publication_target_id}.`,
      });
    } else if (refreshEligibility.blockingReasons.length > 0) {
      diagnostics.push({
        code: "refresh_blocked",
        severity: "warning",
        path: `d16.w3.refresh.${session.publication_target_id}`,
        message: `Controlled refresh blocked for ${session.publication_target_id}: ${refreshEligibility.blockingReasons.join(", ")}.`,
      });
    }

    lifecycleStatuses.push({
      publicationTargetId: session.publication_target_id,
      provider: "meta",
      sessionId: session.session_id,
      connected: true,
      accessCredentialRefId: credentialRefId,
      refreshCredentialRefId: refreshRefId,
      lifecyclePhase: lifecycleState?.lifecycle_phase ?? vaultRecord?.lifecycle_phase ?? null,
      expiresAt: lifecycleState?.expires_at ?? null,
      lastRotatedAt: lifecycleState?.last_rotated_at ?? null,
      expiryAssessment,
      refreshEligibility,
      tokenBlockingReasons,
    });
  }

  const lifecycleAuditRotateCount =
    credentialSnapshot.ok
      ? credentialSnapshot.value.audit_events.filter(
          (event) =>
            event.action === "rotate" &&
            event.sanitized_detail.startsWith("meta_oauth_refresh"),
        ).length
      : 0;

  const summary: SocialOAuthTokenLifecycleReplaySummary = {
    replayVersion: SOCIAL_OAUTH_TOKEN_LIFECYCLE_REPLAY_VERSION,
    oauthConfigured: isSocialOAuthConnectConfigured(config),
    connectedSessionCount: connectedSessions.length,
    validTokenCount: lifecycleStatuses.filter(
      (status) => status.expiryAssessment.expiryState === "valid",
    ).length,
    expiringSoonCount: lifecycleStatuses.filter(
      (status) => status.expiryAssessment.expiryState === "expiring_soon",
    ).length,
    expiredTokenCount: lifecycleStatuses.filter(
      (status) => status.expiryAssessment.expiryState === "expired",
    ).length,
    unknownExpiryCount: lifecycleStatuses.filter(
      (status) => status.expiryAssessment.expiryState === "unknown",
    ).length,
    refreshEligibleCount: lifecycleStatuses.filter((status) => status.refreshEligibility.eligible)
      .length,
    refreshBlockedCount: lifecycleStatuses.filter((status) => !status.refreshEligibility.eligible)
      .length,
    lifecycleAuditRotateCount,
  };

  return {
    replayVersion: SOCIAL_OAUTH_TOKEN_LIFECYCLE_REPLAY_VERSION,
    summary,
    lifecycleStatuses,
    diagnostics,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}
