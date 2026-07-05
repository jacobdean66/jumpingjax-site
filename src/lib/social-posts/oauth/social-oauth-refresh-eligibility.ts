import {
  SOCIAL_OAUTH_TOKEN_LIFECYCLE_VERSION,
  type SocialOAuthTokenExpiryAssessment,
} from "./social-oauth-token-expiry-domain";
import type { SocialOAuthRuntimeConfig } from "./social-oauth-config";
import { isSocialOAuthConnectConfigured } from "./social-oauth-config";
import type { SocialCredentialLifecycleStateRecord } from "../credentials/social-credential-repository";
import type { SocialCredentialVaultRecordRow } from "../credentials/social-credential-repository";
import type { SocialOAuthSessionRow } from "./social-oauth-service";

export const SOCIAL_OAUTH_REFRESH_MODES = [
  "fb_exchange_token",
  "oauth_refresh_token",
  "none",
] as const;

export const SOCIAL_OAUTH_REFRESH_BLOCKING_REASONS = [
  "oauth_not_configured",
  "oauth_not_connected",
  "vault_key_missing",
  "credential_ref_missing",
  "vault_record_inactive",
  "lifecycle_phase_not_active",
  "token_expired_requires_reconnect",
  "refresh_token_unavailable",
  "refresh_mode_unavailable",
] as const;

export type SocialOAuthRefreshMode = (typeof SOCIAL_OAUTH_REFRESH_MODES)[number];

export type SocialOAuthRefreshBlockingReason =
  (typeof SOCIAL_OAUTH_REFRESH_BLOCKING_REASONS)[number];

export type SocialOAuthRefreshEligibility = Readonly<{
  lifecycleVersion: typeof SOCIAL_OAUTH_TOKEN_LIFECYCLE_VERSION;
  eligible: boolean;
  refreshMode: SocialOAuthRefreshMode;
  blockingReasons: readonly SocialOAuthRefreshBlockingReason[];
  advisoryReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  containsTokens: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export function evaluateMetaRefreshEligibility(input: {
  config: SocialOAuthRuntimeConfig;
  session: SocialOAuthSessionRow | null;
  vaultRecord: SocialCredentialVaultRecordRow | null;
  lifecycleState: SocialCredentialLifecycleStateRecord | null;
  expiryAssessment: SocialOAuthTokenExpiryAssessment;
  hasRefreshTokenInVault: boolean;
}): SocialOAuthRefreshEligibility {
  const blockingReasons: SocialOAuthRefreshBlockingReason[] = [];
  const advisoryReasons: string[] = [];

  if (!isSocialOAuthConnectConfigured(input.config)) {
    blockingReasons.push("oauth_not_configured");
  }
  if (!input.config.vaultMasterKey) {
    blockingReasons.push("vault_key_missing");
  }
  if (!input.session || input.session.lifecycle_state !== "connected") {
    blockingReasons.push("oauth_not_connected");
  }
  if (!input.session?.access_credential_ref_id?.trim()) {
    blockingReasons.push("credential_ref_missing");
  }

  const vaultActive =
    input.vaultRecord &&
    input.vaultRecord.lifecycle_phase === "active" &&
    input.vaultRecord.revoked_at === null &&
    input.vaultRecord.superseded_at === null;

  if (!vaultActive) {
    blockingReasons.push("vault_record_inactive");
  }

  if (
    input.lifecycleState &&
    input.lifecycleState.lifecycle_phase !== "active"
  ) {
    blockingReasons.push("lifecycle_phase_not_active");
  }

  if (input.expiryAssessment.expiryState === "expired") {
    blockingReasons.push("token_expired_requires_reconnect");
  }

  if (input.expiryAssessment.warningReasons.includes("token_expiring_soon")) {
    advisoryReasons.push("token_expiring_soon");
  }
  if (input.expiryAssessment.blockingReasons.includes("token_expiry_unknown")) {
    advisoryReasons.push("token_expiry_unknown");
  }

  let refreshMode: SocialOAuthRefreshMode = "none";
  if (input.hasRefreshTokenInVault) {
    refreshMode = "oauth_refresh_token";
  } else if (
    input.expiryAssessment.expiryState === "valid" ||
    input.expiryAssessment.expiryState === "expiring_soon"
  ) {
    refreshMode = "fb_exchange_token";
  } else {
    if (!blockingReasons.includes("token_expired_requires_reconnect")) {
      blockingReasons.push("refresh_mode_unavailable");
    }
  }

  if (refreshMode === "oauth_refresh_token" && !input.hasRefreshTokenInVault) {
    blockingReasons.push("refresh_token_unavailable");
    refreshMode = "none";
  }

  const eligible =
    blockingReasons.length === 0 &&
    refreshMode !== "none" &&
    input.expiryAssessment.expiryState !== "expired";

  return {
    lifecycleVersion: SOCIAL_OAUTH_TOKEN_LIFECYCLE_VERSION,
    eligible,
    refreshMode,
    blockingReasons,
    advisoryReasons,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    containsTokens: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}
