import {
  deriveExecutionAuthorizationState,
} from "../execution-authorization/social-execution-authorization-domain";
import {
  deriveExecutionRuntimeSessionStatus,
} from "../execution-authorization/social-execution-runtime-session-domain";
import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import {
  buildExecutionAttemptIdentity,
} from "./social-execution-attempt-domain";
import {
  EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT,
  type SocialExecutionAttemptPersistenceSnapshot,
} from "./social-execution-attempt-store";

export const SOCIAL_EXECUTION_ATTEMPT_CREATION_PREFLIGHT_VERSION = "d16-w7-v1" as const;

export function evaluateExecutionAttemptCreationAvailability(input: {
  executionIntentId: string | null;
  publicationTargetId: string | null;
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
  attemptSnapshot?: SocialExecutionAttemptPersistenceSnapshot;
  now?: Date;
}): Readonly<{
  attemptCreationAvailable: boolean;
  duplicateAttempt: boolean;
  authorizationUnavailable: boolean;
  sessionUnavailable: boolean;
  creationBlockingCodes: readonly string[];
}> {
  if (!hasText(input.executionIntentId) || !hasText(input.publicationTargetId)) {
    return {
      attemptCreationAvailable: false,
      duplicateAttempt: false,
      authorizationUnavailable: true,
      sessionUnavailable: true,
      creationBlockingCodes: [],
    };
  }

  const authorizationSnapshot = input.authorizationSnapshot;
  const attemptSnapshot = input.attemptSnapshot ?? EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT;
  const now = input.now ?? new Date();

  const authorization =
    authorizationSnapshot?.authorizations.find(
      (record) =>
        record.executionIntentId === input.executionIntentId &&
        record.publicationTargetId === input.publicationTargetId,
    ) ?? null;
  const cancellation =
    authorization && authorizationSnapshot
      ? authorizationSnapshot.cancellations.find(
          (record) => record.authorizationId === authorization.authorizationId,
        ) ?? null
      : null;
  const derivedAuthorizationState = deriveExecutionAuthorizationState({
    authorization,
    cancellation,
    now,
  });
  const authorizationUnavailable = derivedAuthorizationState !== "valid";

  const session =
    authorization && authorizationSnapshot
      ? authorizationSnapshot.sessions.find(
          (record) => record.authorizationId === authorization.authorizationId,
        ) ?? null
      : null;
  const derivedSessionStatus = deriveExecutionRuntimeSessionStatus({
    session,
    derivedAuthorizationState,
    now,
  });
  const sessionUnavailable = derivedSessionStatus !== "active";

  const attemptIdentity = authorization
    ? buildExecutionAttemptIdentity({
        executionIntentId: input.executionIntentId,
        publicationTargetId: input.publicationTargetId,
        authorizationId: authorization.authorizationId,
      })
    : null;

  const duplicateAttempt =
    attemptIdentity !== null &&
    attemptSnapshot.attempts.some((record) => record.attemptIdentity === attemptIdentity);

  const attemptCreationAvailable =
    !authorizationUnavailable && !sessionUnavailable && !duplicateAttempt;

  const creationBlockingCodes = duplicateAttempt ? (["duplicate_attempt"] as const) : [];

  return {
    attemptCreationAvailable,
    duplicateAttempt,
    authorizationUnavailable,
    sessionUnavailable,
    creationBlockingCodes,
  };
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
