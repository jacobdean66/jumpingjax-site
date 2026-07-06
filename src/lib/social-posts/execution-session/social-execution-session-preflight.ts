import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import type { SocialExecutionAttemptEvidencePersistenceSnapshot } from "../execution-attempt/social-execution-attempt-evidence-store";
import type { SocialExecutionAttemptPersistenceSnapshot } from "../execution-attempt/social-execution-attempt-store";
import { EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT } from "../execution-attempt/social-execution-attempt-store";
import type { PublicationTargetDefinition } from "../social-publication-targets";
import { SOCIAL_EXECUTION_SESSION_VERSION } from "./social-execution-session-domain";

export const SOCIAL_EXECUTION_SESSION_PREFLIGHT_VERSION = SOCIAL_EXECUTION_SESSION_VERSION;

export const SOCIAL_EXECUTION_SESSION_PREFLIGHT_BLOCKING_CODES = [
  "attempt_ids_missing",
  "attempt_ids_duplicate",
  "attempt_not_found",
  "correlation_id_mismatch",
  "publication_target_missing",
] as const;

export type SocialExecutionSessionPreflightBlockingCode =
  (typeof SOCIAL_EXECUTION_SESSION_PREFLIGHT_BLOCKING_CODES)[number];

export type SocialExecutionSessionPreflightSummary = Readonly<{
  preflightVersion: typeof SOCIAL_EXECUTION_SESSION_PREFLIGHT_VERSION;
  attemptIds: readonly string[];
  correlationId: string | null;
  sessionOrchestrationReady: boolean;
  preflightBlockingCodes: readonly SocialExecutionSessionPreflightBlockingCode[];
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export function evaluateExecutionSessionPreflight(input: {
  attemptIds: readonly string[];
  attemptSnapshot?: SocialExecutionAttemptPersistenceSnapshot;
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
  evidenceSnapshot?: SocialExecutionAttemptEvidencePersistenceSnapshot;
  publicationTarget?: PublicationTargetDefinition | null;
}): SocialExecutionSessionPreflightSummary {
  const attemptSnapshot = input.attemptSnapshot ?? EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT;
  const preflightBlockingCodes: SocialExecutionSessionPreflightBlockingCode[] = [];
  const blockingReasons: string[] = [];

  const normalizedAttemptIds = input.attemptIds.map((attemptId) => attemptId.trim()).filter(hasText);

  if (normalizedAttemptIds.length === 0) {
    preflightBlockingCodes.push("attempt_ids_missing");
    blockingReasons.push("At least one execution attempt id is required for session orchestration.");
  }

  const uniqueAttemptIds = new Set(normalizedAttemptIds);
  if (uniqueAttemptIds.size !== normalizedAttemptIds.length) {
    preflightBlockingCodes.push("attempt_ids_duplicate");
    blockingReasons.push("Execution session attempt ids must be unique.");
  }

  const resolvedAttempts = normalizedAttemptIds.map(
    (attemptId) => attemptSnapshot.attempts.find((record) => record.attemptId === attemptId) ?? null,
  );

  if (resolvedAttempts.some((attempt) => attempt === null)) {
    preflightBlockingCodes.push("attempt_not_found");
    blockingReasons.push("One or more execution attempts were not found in the attempt snapshot.");
  }

  const foundAttempts = resolvedAttempts.filter((attempt): attempt is NonNullable<typeof attempt> => attempt !== null);
  const correlationIds = new Set(foundAttempts.map((attempt) => attempt.correlationId));
  if (correlationIds.size > 1) {
    preflightBlockingCodes.push("correlation_id_mismatch");
    blockingReasons.push("All execution attempts in a session must share the same correlation id.");
  }

  if (!input.publicationTarget) {
    preflightBlockingCodes.push("publication_target_missing");
    blockingReasons.push("Publication target is missing.");
  }

  return {
    preflightVersion: SOCIAL_EXECUTION_SESSION_PREFLIGHT_VERSION,
    attemptIds: normalizedAttemptIds,
    correlationId: foundAttempts[0]?.correlationId ?? null,
    sessionOrchestrationReady: preflightBlockingCodes.length === 0,
    preflightBlockingCodes,
    blockingReasons,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function hasText(value: string): value is string {
  return value.trim().length > 0;
}
