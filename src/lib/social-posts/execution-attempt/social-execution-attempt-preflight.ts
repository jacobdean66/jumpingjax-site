import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import {
  SOCIAL_EXECUTION_ATTEMPT_VERSION,
  type SocialExecutionAttemptDerivedAwarenessStatus,
} from "./social-execution-attempt-domain";
import { detectExecutionAttemptDuplicates } from "./social-execution-attempt-idempotency-domain";
import { evaluateExecutionAttemptCreationAvailability } from "./social-execution-attempt-creation-preflight";
import {
  replaySocialExecutionAttemptForIntent,
  type SocialExecutionAttemptReplayProjection,
} from "./social-execution-attempt-replay";
import type { SocialExecutionAttemptPersistenceSnapshot } from "./social-execution-attempt-store";
import { EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT } from "./social-execution-attempt-store";

export const SOCIAL_EXECUTION_ATTEMPT_PREFLIGHT_VERSION = SOCIAL_EXECUTION_ATTEMPT_VERSION;

export type SocialExecutionAttemptPreflightSummary = Readonly<{
  preflightVersion: typeof SOCIAL_EXECUTION_ATTEMPT_PREFLIGHT_VERSION;
  executionIntentId: string;
  publicationTargetId: string;
  derivedAwarenessStatus: SocialExecutionAttemptDerivedAwarenessStatus;
  attemptCount: number;
  attemptId: string | null;
  authorizationId: string | null;
  sessionId: string | null;
  correlationId: string | null;
  idempotencyKey: string | null;
  replayKey: string | null;
  attemptFingerprint: string | null;
  derivedLifecycleState: SocialExecutionAttemptReplayProjection["derivedLifecycleState"];
  duplicateDetected: boolean;
  attemptCreationAvailable: boolean;
  duplicateAttempt: boolean;
  authorizationUnavailable: boolean;
  sessionUnavailable: boolean;
  creationBlockingCodes: readonly string[];
  informationalOnly: true;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export function evaluateExecutionAttemptPreflightForIntent(input: {
  executionIntentId: string | null;
  publicationTargetId: string | null;
  attemptSnapshot?: SocialExecutionAttemptPersistenceSnapshot;
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
  now?: Date;
}): SocialExecutionAttemptPreflightSummary | null {
  if (!hasText(input.executionIntentId) || !hasText(input.publicationTargetId)) {
    return null;
  }

  const attemptSnapshot = input.attemptSnapshot ?? EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT;
  const duplicateDetection = detectExecutionAttemptDuplicates(attemptSnapshot.attempts);
  const replay = replaySocialExecutionAttemptForIntent({
    executionIntentId: input.executionIntentId,
    publicationTargetId: input.publicationTargetId,
    attemptSnapshot,
    authorizationSnapshot: input.authorizationSnapshot,
    now: input.now,
  });

  const primaryAttempt = replay.attempts[0] ?? null;
  const creationAvailability = evaluateExecutionAttemptCreationAvailability({
    executionIntentId: input.executionIntentId,
    publicationTargetId: input.publicationTargetId,
    authorizationSnapshot: input.authorizationSnapshot,
    attemptSnapshot,
    now: input.now,
  });

  return {
    preflightVersion: SOCIAL_EXECUTION_ATTEMPT_PREFLIGHT_VERSION,
    executionIntentId: input.executionIntentId,
    publicationTargetId: input.publicationTargetId,
    derivedAwarenessStatus: replay.derivedAwarenessStatus,
    attemptCount: replay.attempts.length,
    attemptId: primaryAttempt?.attemptId ?? null,
    authorizationId: primaryAttempt?.authorizationId ?? null,
    sessionId: primaryAttempt?.sessionId ?? null,
    correlationId: primaryAttempt?.correlationId ?? null,
    idempotencyKey: primaryAttempt?.idempotencyKey ?? null,
    replayKey: primaryAttempt?.replayKey ?? null,
    attemptFingerprint: primaryAttempt?.attemptFingerprint ?? null,
    derivedLifecycleState: primaryAttempt?.derivedLifecycleState ?? "missing",
    duplicateDetected: duplicateDetection.hasDuplicates,
    attemptCreationAvailable: creationAvailability.attemptCreationAvailable,
    duplicateAttempt: creationAvailability.duplicateAttempt,
    authorizationUnavailable: creationAvailability.authorizationUnavailable,
    sessionUnavailable: creationAvailability.sessionUnavailable,
    creationBlockingCodes: creationAvailability.creationBlockingCodes,
    informationalOnly: true,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
