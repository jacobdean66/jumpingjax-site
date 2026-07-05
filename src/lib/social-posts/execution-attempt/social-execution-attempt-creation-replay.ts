import {
  deriveExecutionAuthorizationState,
} from "../execution-authorization/social-execution-authorization-domain";
import {
  deriveExecutionRuntimeSessionStatus,
} from "../execution-authorization/social-execution-runtime-session-domain";
import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import { SOCIAL_EXECUTION_ATTEMPT_CREATION_SERVICE_VERSION } from "./social-execution-attempt-service";
import {
  buildExecutionAttemptIdentity,
} from "./social-execution-attempt-domain";
import {
  replaySocialExecutionAttempt,
  type SocialExecutionAttemptReplayProjection,
} from "./social-execution-attempt-replay";
import {
  EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT,
  loadSocialExecutionAttemptSnapshot,
  type SocialExecutionAttemptPersistenceSnapshot,
} from "./social-execution-attempt-store";

export const SOCIAL_EXECUTION_ATTEMPT_CREATION_REPLAY_VERSION =
  SOCIAL_EXECUTION_ATTEMPT_CREATION_SERVICE_VERSION;

export type SocialExecutionAttemptCreationReplayProjection = Readonly<{
  attemptId: string;
  attemptIdentity: string;
  authorizationId: string;
  sessionId: string;
  executionIntentId: string;
  publicationTargetId: string;
  correlationId: string;
  idempotencyKey: string;
  replayKey: string;
  attemptFingerprint: string;
  derivedLifecycleState: SocialExecutionAttemptReplayProjection["derivedLifecycleState"];
  createdAt: string;
  expiresAt: string;
  creationAuditEventId: string | null;
  creationOutcome: string | null;
  creationDetail: string | null;
}>;

export type SocialExecutionAttemptCreationReplaySummary = Readonly<{
  replayVersion: typeof SOCIAL_EXECUTION_ATTEMPT_CREATION_REPLAY_VERSION;
  createdAttemptCount: number;
  successfulCreationCount: number;
  failedCreationCount: number;
  lifecycleEventCount: number;
  auditEventCount: number;
}>;

export type SocialExecutionAttemptCreationReplayResult = Readonly<{
  replayVersion: typeof SOCIAL_EXECUTION_ATTEMPT_CREATION_REPLAY_VERSION;
  summary: SocialExecutionAttemptCreationReplaySummary;
  createdAttempts: readonly SocialExecutionAttemptCreationReplayProjection[];
  recentCreationAuditEvents: readonly {
    auditEventId: string;
    attemptId: string | null;
    attemptIdentity: string | null;
    correlationId: string | null;
    action: string;
    outcome: string;
    sanitizedDetail: string;
    createdAt: string;
  }[];
  lifecycleEvents: readonly {
    lifecycleEventId: string;
    attemptId: string;
    correlationId: string;
    lifecycleState: string;
    createdAt: string;
  }[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export async function replaySocialExecutionAttemptCreation(input: {
  attemptSnapshot?: SocialExecutionAttemptPersistenceSnapshot | null;
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
  now?: Date;
} = {}): Promise<SocialExecutionAttemptCreationReplayResult> {
  const attemptPersistence =
    input.attemptSnapshot ?? (await loadSocialExecutionAttemptSnapshot());
  const authorizationSnapshot = input.authorizationSnapshot;
  const now = input.now ?? new Date();

  const attemptReplay = await replaySocialExecutionAttempt({
    attemptSnapshot: attemptPersistence,
    authorizationSnapshot: authorizationSnapshot ?? undefined,
    now,
  });

  const creationAuditByAttemptId = new Map<
    string,
    (typeof attemptPersistence.auditEvents)[number]
  >();
  for (const event of attemptPersistence.auditEvents) {
    if (event.action !== "create_attempt" || !event.attempt_id) continue;
    const existing = creationAuditByAttemptId.get(event.attempt_id);
    if (!existing || event.created_at > existing.created_at) {
      creationAuditByAttemptId.set(event.attempt_id, event);
    }
  }

  const createdAttempts = attemptReplay.attempts.map((attempt) => {
    const audit = creationAuditByAttemptId.get(attempt.attemptId) ?? null;
    return {
      attemptId: attempt.attemptId,
      attemptIdentity: attempt.attemptIdentity,
      authorizationId: attempt.authorizationId,
      sessionId: attempt.sessionId,
      executionIntentId: attempt.executionIntentId,
      publicationTargetId: attempt.publicationTargetId,
      correlationId: attempt.correlationId,
      idempotencyKey: attempt.idempotencyKey,
      replayKey: attempt.replayKey,
      attemptFingerprint: attempt.attemptFingerprint,
      derivedLifecycleState: attempt.derivedLifecycleState,
      createdAt: attempt.createdAt,
      expiresAt: attempt.expiresAt,
      creationAuditEventId: audit?.audit_event_id ?? null,
      creationOutcome: audit?.outcome ?? null,
      creationDetail: audit?.sanitized_detail ?? null,
    } satisfies SocialExecutionAttemptCreationReplayProjection;
  });

  const creationAuditEvents = attemptPersistence.auditEvents.filter(
    (event) => event.action === "create_attempt" || event.action === "create_validation_failed",
  );

  return {
    replayVersion: SOCIAL_EXECUTION_ATTEMPT_CREATION_REPLAY_VERSION,
    summary: {
      replayVersion: SOCIAL_EXECUTION_ATTEMPT_CREATION_REPLAY_VERSION,
      createdAttemptCount: createdAttempts.length,
      successfulCreationCount: creationAuditEvents.filter(
        (event) => event.action === "create_attempt" && event.outcome === "success",
      ).length,
      failedCreationCount: creationAuditEvents.filter(
        (event) => event.outcome !== "success",
      ).length,
      lifecycleEventCount: attemptPersistence.lifecycleEvents.length,
      auditEventCount: creationAuditEvents.length,
    },
    createdAttempts,
    recentCreationAuditEvents: creationAuditEvents.slice(0, 20).map((event) => ({
      auditEventId: event.audit_event_id,
      attemptId: event.attempt_id,
      attemptIdentity: event.attempt_identity,
      correlationId: event.correlation_id,
      action: event.action,
      outcome: event.outcome,
      sanitizedDetail: event.sanitized_detail,
      createdAt: event.created_at,
    })),
    lifecycleEvents: attemptPersistence.lifecycleEvents.map((event) => ({
      lifecycleEventId: event.lifecycleEventId,
      attemptId: event.attemptId,
      correlationId: event.correlationId,
      lifecycleState: event.lifecycleState,
      createdAt: event.createdAt,
    })),
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

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
