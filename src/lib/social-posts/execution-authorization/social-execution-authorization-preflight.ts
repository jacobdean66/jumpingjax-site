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

export const SOCIAL_EXECUTION_AUTHORIZATION_PREFLIGHT_VERSION = "d16-w5-v1" as const;

export const SOCIAL_EXECUTION_AUTHORIZATION_PREFLIGHT_BLOCKING_CODES = [
  "authorization_missing",
  "authorization_expired",
  "authorization_cancelled",
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

  const preflightBlockingCodes = blockingCodesForState(derivedAuthorizationState);
  const authorizationValid = preflightBlockingCodes.length === 0;

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
