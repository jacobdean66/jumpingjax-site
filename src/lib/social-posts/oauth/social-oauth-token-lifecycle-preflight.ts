import type { SocialCredentialPersistenceModel } from "../credentials/social-credential-repository";
import {
  assessTokenExpiry,
  type SocialOAuthTokenExpiryState,
} from "./social-oauth-token-expiry-domain";

export const SOCIAL_OAUTH_TOKEN_LIFECYCLE_PREFLIGHT_VERSION = "d16-w4-v1" as const;

export const SOCIAL_OAUTH_TOKEN_LIFECYCLE_PREFLIGHT_BLOCKING_CODES = [
  "token_expired",
  "token_expiring_soon",
  "token_unknown",
] as const;

export type SocialOAuthTokenLifecyclePreflightBlockingCode =
  (typeof SOCIAL_OAUTH_TOKEN_LIFECYCLE_PREFLIGHT_BLOCKING_CODES)[number];

export type SocialOAuthTokenLifecyclePreflightSummary = Readonly<{
  preflightVersion: typeof SOCIAL_OAUTH_TOKEN_LIFECYCLE_PREFLIGHT_VERSION;
  publicationTargetId: string;
  provider: "meta";
  credentialRefId: string | null;
  expiryState: SocialOAuthTokenExpiryState;
  expiresAt: string | null;
  preflightBlockingCodes: readonly SocialOAuthTokenLifecyclePreflightBlockingCode[];
  blocksExecutionEligibility: boolean;
  couldRunLater: boolean;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  containsTokens: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export function evaluateTokenLifecyclePreflightForPublicationTarget(input: {
  publicationTargetId: string | null;
  credentialModel: SocialCredentialPersistenceModel;
  now?: Date;
}): SocialOAuthTokenLifecyclePreflightSummary | null {
  if (!input.publicationTargetId?.trim()) {
    return null;
  }

  const publicationTargetId = input.publicationTargetId.trim();
  const activeVaultRecord =
    input.credentialModel.vault_records.find(
      (record) =>
        record.provider === "meta" &&
        record.credential_kind === "oauth_token_ref" &&
        record.publication_target_id === publicationTargetId &&
        record.lifecycle_phase === "active" &&
        record.revoked_at === null &&
        record.superseded_at === null,
    ) ?? null;

  if (!activeVaultRecord) {
    return null;
  }

  const lifecycleState =
    input.credentialModel.lifecycle_states.find(
      (state) =>
        state.provider === "meta" &&
        state.credential_ref_id === activeVaultRecord.credential_ref_id,
    ) ?? null;

  const expiryAssessment = assessTokenExpiry({
    expiresAt: lifecycleState?.expires_at ?? null,
    issuedAt: lifecycleState?.issued_at ?? null,
    now: input.now,
  });

  const preflightBlockingCodes = mapExpiryToPreflightBlockingCodes(expiryAssessment.expiryState);
  const blocksExecutionEligibility = preflightBlockingCodes.length > 0;
  const couldRunLater = preflightBlockingCodes.every((code) => code === "token_expiring_soon");

  return {
    preflightVersion: SOCIAL_OAUTH_TOKEN_LIFECYCLE_PREFLIGHT_VERSION,
    publicationTargetId,
    provider: "meta",
    credentialRefId: activeVaultRecord.credential_ref_id,
    expiryState: expiryAssessment.expiryState,
    expiresAt: lifecycleState?.expires_at ?? null,
    preflightBlockingCodes,
    blocksExecutionEligibility,
    couldRunLater,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    containsTokens: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function mapExpiryToPreflightBlockingCodes(
  expiryState: SocialOAuthTokenExpiryState,
): readonly SocialOAuthTokenLifecyclePreflightBlockingCode[] {
  switch (expiryState) {
    case "expired":
      return ["token_expired"];
    case "expiring_soon":
      return ["token_expiring_soon"];
    case "unknown":
      return ["token_unknown"];
    case "valid":
      return [];
  }
}
