import {
  buildExecutionAuthorizationIdentity,
  deriveExecutionAuthorizationState,
  type SocialExecutionAuthorizationDerivedState,
} from "./social-execution-authorization-domain";
import {
  deriveExecutionAuthorizationIntentState,
  type SocialExecutionAuthorizationIntentState,
} from "./social-execution-authorization-intent-domain";
import {
  deriveExecutionRuntimeSessionStatus,
  type SocialExecutionRuntimeSessionStatus,
} from "./social-execution-runtime-session-domain";
import type { SocialExecutionAuthorizationPersistenceSnapshot } from "./social-execution-authorization-store";

export const SOCIAL_EXECUTION_AUTHORIZATION_PREFLIGHT_VERSION = "d16-w10-v1" as const;

export const SOCIAL_EXECUTION_AUTHORIZATION_PREFLIGHT_BLOCKING_CODES = [
  "authorization_missing",
  "authorization_expired",
  "authorization_cancelled",
  "owner_approval_reference_missing",
  "owner_approval_verification_failed",
] as const;

export type SocialExecutionAuthorizationPreflightBlockingCode =
  (typeof SOCIAL_EXECUTION_AUTHORIZATION_PREFLIGHT_BLOCKING_CODES)[number];

export type SocialExecutionAuthorizationPreflightSummary = Readonly<{
  preflightVersion: typeof SOCIAL_EXECUTION_AUTHORIZATION_PREFLIGHT_VERSION;
  executionIntentId: string;
  publicationTargetId: string;
  authorizationIdentity: string;
  authorizationId: string | null;
  correlationId: string | null;
  sessionId: string | null;
  derivedAuthorizationState: SocialExecutionAuthorizationDerivedState;
  derivedIntentState: SocialExecutionAuthorizationIntentState | "missing";
  derivedSessionStatus: SocialExecutionRuntimeSessionStatus | "missing";
  authorizationValid: boolean;
  ownerApprovalId: string | null;
  ownerApprovalReferencePresent: boolean;
  ownerApprovalVerificationStatus:
    | "verified"
    | "not_verified"
    | "missing_reference"
    | "not_evaluated";
  ownerApprovalVerificationCode: string | null;
  preflightBlockingCodes: readonly SocialExecutionAuthorizationPreflightBlockingCode[];
  blockingReasons: readonly string[];
  couldRunLater: boolean;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export function evaluateExecutionAuthorizationPreflightForIntent(input: {
  executionIntentId: string | null;
  publicationTargetId: string | null;
  snapshot: SocialExecutionAuthorizationPersistenceSnapshot;
  now?: Date;
  ownerApprovalVerification?: Readonly<{
    status: "verified" | "not_verified" | "missing_reference";
    code: string | null;
  }> | null;
}): SocialExecutionAuthorizationPreflightSummary | null {
  if (!hasText(input.executionIntentId) || !hasText(input.publicationTargetId)) {
    return null;
  }

  const authorizationIdentity = buildExecutionAuthorizationIdentity({
    executionIntentId: input.executionIntentId,
    publicationTargetId: input.publicationTargetId,
  });

  const authorization =
    input.snapshot.authorizations.find(
      (record) => record.authorizationIdentity === authorizationIdentity,
    ) ?? null;
  const cancellation =
    authorization
      ? input.snapshot.cancellations.find(
          (record) => record.authorizationId === authorization.authorizationId,
        ) ?? null
      : null;
  const derivedAuthorizationState = deriveExecutionAuthorizationState({
    authorization,
    cancellation,
    now: input.now,
  });
  const intentRecords = input.snapshot.intents.filter(
    (record) =>
      record.executionIntentId === input.executionIntentId &&
      record.publicationTargetId === input.publicationTargetId,
  );
  const derivedIntentState = deriveExecutionAuthorizationIntentState({
    records: intentRecords,
    derivedAuthorizationState,
  });
  const session =
    authorization
      ? input.snapshot.sessions.find(
          (record) => record.authorizationId === authorization.authorizationId,
        ) ?? null
      : null;
  const derivedSessionStatus = deriveExecutionRuntimeSessionStatus({
    session,
    derivedAuthorizationState,
    now: input.now,
  });

  const preflightBlockingCodes: SocialExecutionAuthorizationPreflightBlockingCode[] = [
    ...blockingCodesForState(derivedAuthorizationState),
  ];
  const ownerApprovalId = authorization?.ownerApprovalId ?? null;
  const ownerApprovalReferencePresent = hasText(ownerApprovalId);
  const ownerApprovalVerificationStatus =
    input.ownerApprovalVerification?.status ??
    (authorization
      ? ownerApprovalReferencePresent
        ? "not_evaluated"
        : "missing_reference"
      : "not_evaluated");
  const ownerApprovalVerificationCode =
    input.ownerApprovalVerification?.code ??
    (authorization && !ownerApprovalReferencePresent
      ? "owner_approval_reference_missing"
      : null);

  if (authorization && !ownerApprovalReferencePresent) {
    preflightBlockingCodes.push("owner_approval_reference_missing");
  } else if (
    input.ownerApprovalVerification &&
    input.ownerApprovalVerification.status === "not_verified" &&
    input.ownerApprovalVerification.code
  ) {
    preflightBlockingCodes.push("owner_approval_verification_failed");
  }

  const authorizationValid =
    preflightBlockingCodes.length === 0 &&
    derivedAuthorizationState === "valid" &&
    (!authorization || ownerApprovalReferencePresent) &&
    (!input.ownerApprovalVerification ||
      input.ownerApprovalVerification.status === "verified");

  return {
    preflightVersion: SOCIAL_EXECUTION_AUTHORIZATION_PREFLIGHT_VERSION,
    executionIntentId: input.executionIntentId,
    publicationTargetId: input.publicationTargetId,
    authorizationIdentity,
    authorizationId: authorization?.authorizationId ?? null,
    correlationId: authorization?.correlationId ?? null,
    sessionId: session?.sessionId ?? null,
    derivedAuthorizationState,
    derivedIntentState,
    derivedSessionStatus,
    authorizationValid,
    ownerApprovalId,
    ownerApprovalReferencePresent,
    ownerApprovalVerificationStatus,
    ownerApprovalVerificationCode,
    preflightBlockingCodes,
    blockingReasons: [...preflightBlockingCodes],
    couldRunLater:
      derivedAuthorizationState === "expired" ||
      (derivedAuthorizationState === "missing" && preflightBlockingCodes.includes("authorization_missing")),
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function blockingCodesForState(
  state: SocialExecutionAuthorizationDerivedState,
): SocialExecutionAuthorizationPreflightBlockingCode[] {
  switch (state) {
    case "missing":
      return ["authorization_missing"];
    case "expired":
      return ["authorization_expired"];
    case "cancelled":
      return ["authorization_cancelled"];
    case "valid":
      return [];
  }
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
