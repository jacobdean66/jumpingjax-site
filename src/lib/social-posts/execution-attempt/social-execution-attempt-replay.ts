import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import {
  SOCIAL_EXECUTION_ATTEMPT_VERSION,
  buildExecutionAttemptIdentity,
  buildExecutionAttemptIdempotencyVocabulary,
  deriveExecutionAttemptAwarenessStatus,
  deriveExecutionAttemptStatus,
  validateExecutionAttemptRecord,
} from "./social-execution-attempt-domain";
import {
  detectExecutionAttemptDuplicates,
  validateExecutionAttemptIdempotencyVocabulary,
  buildExecutionAttemptFingerprint,
} from "./social-execution-attempt-idempotency-domain";
import {
  validateExecutionAttemptLifecycleEventRecord,
  validateExecutionAttemptLifecycleSequence,
} from "./social-execution-attempt-lifecycle-domain";
import {
  EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT,
  loadSocialExecutionAttemptSnapshot,
  type SocialExecutionAttemptPersistenceSnapshot,
} from "./social-execution-attempt-store";

export const SOCIAL_EXECUTION_ATTEMPT_REPLAY_VERSION = SOCIAL_EXECUTION_ATTEMPT_VERSION;

export type SocialExecutionAttemptReplayProjection = Readonly<{
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
  derivedLifecycleState: ReturnType<typeof deriveExecutionAttemptStatus>;
  derivedAwarenessStatus: ReturnType<typeof deriveExecutionAttemptAwarenessStatus>;
  createdAt: string;
  expiresAt: string;
}>;

export type SocialExecutionAttemptReplaySummary = Readonly<{
  replayVersion: typeof SOCIAL_EXECUTION_ATTEMPT_REPLAY_VERSION;
  attemptCount: number;
  activeAttemptCount: number;
  expiredAttemptCount: number;
  cancelledAttemptCount: number;
  supersededAttemptCount: number;
  duplicateDetected: boolean;
  lifecycleEventCount: number;
  auditEventCount: number;
}>;

export type SocialExecutionAttemptReplayDiagnostic = Readonly<{
  code: string;
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
}>;

export type SocialExecutionAttemptReplayResult = Readonly<{
  replayVersion: typeof SOCIAL_EXECUTION_ATTEMPT_REPLAY_VERSION;
  summary: SocialExecutionAttemptReplaySummary;
  attempts: readonly SocialExecutionAttemptReplayProjection[];
  lifecycleEvents: readonly {
    lifecycleEventId: string;
    attemptId: string;
    correlationId: string;
    lifecycleState: string;
    createdAt: string;
  }[];
  duplicateDetection: ReturnType<typeof detectExecutionAttemptDuplicates>;
  recentAuditEvents: readonly {
    auditEventId: string;
    attemptId: string | null;
    correlationId: string | null;
    action: string;
    outcome: string;
    sanitizedDetail: string;
    createdAt: string;
  }[];
  diagnostics: readonly SocialExecutionAttemptReplayDiagnostic[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export async function replaySocialExecutionAttempt(input: {
  attemptSnapshot?: SocialExecutionAttemptPersistenceSnapshot | null;
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
  now?: Date;
} = {}): Promise<SocialExecutionAttemptReplayResult> {
  const attemptPersistence =
    input.attemptSnapshot ?? (await loadSocialExecutionAttemptSnapshot());
  const authorizationSnapshot = input.authorizationSnapshot ?? null;
  const now = input.now ?? new Date();
  const diagnostics: SocialExecutionAttemptReplayDiagnostic[] = [];

  const duplicateDetection = detectExecutionAttemptDuplicates(attemptPersistence.attempts);
  if (duplicateDetection.hasDuplicates) {
    diagnostics.push({
      code: "duplicate_attempt_detected",
      severity: "error",
      path: "attempts.duplicates",
      message: "Duplicate execution attempt identifiers or idempotency keys detected.",
    });
  }

  for (const [index, attempt] of attemptPersistence.attempts.entries()) {
    const validation = validateExecutionAttemptRecord(
      attempt,
      {
        existingAttemptIdentities: new Set(
          attemptPersistence.attempts
            .filter((_, itemIndex) => itemIndex < index)
            .map((record) => record.attemptIdentity),
        ),
        authorizationSnapshot: authorizationSnapshot ?? undefined,
      },
      `attempts.${index}`,
    );
    if (!validation.ok) {
      for (const error of validation.errors) {
        diagnostics.push({
          code: error.code,
          severity: "error",
          path: error.path,
          message: error.message,
        });
      }
    }

    const idempotencyValidation = validateExecutionAttemptIdempotencyVocabulary(
      buildExecutionAttemptIdempotencyVocabulary(attempt),
      buildExecutionAttemptFingerprint({
        executionIntentId: attempt.executionIntentId,
        publicationTargetId: attempt.publicationTargetId,
        authorizationId: attempt.authorizationId,
        sessionId: attempt.sessionId,
        correlationId: attempt.correlationId,
      }),
      `attempts.${index}.idempotency`,
    );
    if (!idempotencyValidation.ok) {
      for (const error of idempotencyValidation.errors) {
        diagnostics.push({
          code: error.code,
          severity: "error",
          path: error.path,
          message: error.message,
        });
      }
    }
  }

  for (const [index, event] of attemptPersistence.lifecycleEvents.entries()) {
    const validation = validateExecutionAttemptLifecycleEventRecord(event, `lifecycleEvents.${index}`);
    if (!validation.ok) {
      for (const error of validation.errors) {
        diagnostics.push({
          code: error.code,
          severity: "error",
          path: error.path,
          message: error.message,
        });
      }
    }
  }

  const lifecycleByAttempt = new Map<string, (typeof attemptPersistence.lifecycleEvents)[number][]>();
  for (const event of attemptPersistence.lifecycleEvents) {
    const current = lifecycleByAttempt.get(event.attemptId) ?? [];
    current.push(event);
    lifecycleByAttempt.set(event.attemptId, current);
  }

  for (const [attemptId, events] of lifecycleByAttempt.entries()) {
    for (const error of validateExecutionAttemptLifecycleSequence(events)) {
      diagnostics.push({
        code: error.code,
        severity: "error",
        path: `lifecycleEvents.${attemptId}`,
        message: error.message,
      });
    }
  }

  const attempts = attemptPersistence.attempts.map((attempt) => {
    const lifecycleEvents = lifecycleByAttempt.get(attempt.attemptId) ?? [];
    const derivedLifecycleState = authorizationSnapshot
      ? deriveExecutionAttemptStatus({
          attempt,
          lifecycleEvents,
          authorizationSnapshot,
          now,
        })
      : lifecycleEvents.length > 0
        ? [...lifecycleEvents].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
            ?.lifecycleState ?? "missing"
        : "missing";

    const derivedAwarenessStatus = deriveExecutionAttemptAwarenessStatus({
      attempts: [attempt],
      duplicateDetected: duplicateDetection.hasDuplicates,
      derivedLifecycleState,
    });

    diagnostics.push({
      code: `attempt_${derivedAwarenessStatus}`,
      severity: derivedAwarenessStatus === "duplicate_attempt_detected" ? "error" : "info",
      path: `d16.w6.attempt.${attempt.attemptIdentity}`,
      message: `Execution attempt awareness status is ${derivedAwarenessStatus} for ${attempt.attemptIdentity}.`,
    });

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
      derivedLifecycleState,
      derivedAwarenessStatus,
      createdAt: attempt.createdAt,
      expiresAt: attempt.expiresAt,
    } satisfies SocialExecutionAttemptReplayProjection;
  });

  const summary: SocialExecutionAttemptReplaySummary = {
    replayVersion: SOCIAL_EXECUTION_ATTEMPT_REPLAY_VERSION,
    attemptCount: attempts.length,
    activeAttemptCount: attempts.filter(
      (record) =>
        record.derivedLifecycleState === "created" || record.derivedLifecycleState === "prepared",
    ).length,
    expiredAttemptCount: attempts.filter((record) => record.derivedLifecycleState === "expired").length,
    cancelledAttemptCount: attempts.filter((record) => record.derivedLifecycleState === "cancelled").length,
    supersededAttemptCount: attempts.filter((record) => record.derivedLifecycleState === "superseded").length,
    duplicateDetected: duplicateDetection.hasDuplicates,
    lifecycleEventCount: attemptPersistence.lifecycleEvents.length,
    auditEventCount: attemptPersistence.auditEvents.length,
  };

  return {
    replayVersion: SOCIAL_EXECUTION_ATTEMPT_REPLAY_VERSION,
    summary,
    attempts,
    lifecycleEvents: attemptPersistence.lifecycleEvents.map((event) => ({
      lifecycleEventId: event.lifecycleEventId,
      attemptId: event.attemptId,
      correlationId: event.correlationId,
      lifecycleState: event.lifecycleState,
      createdAt: event.createdAt,
    })),
    duplicateDetection,
    recentAuditEvents: attemptPersistence.auditEvents.slice(0, 20).map((event) => ({
      auditEventId: event.audit_event_id,
      attemptId: event.attempt_id,
      correlationId: event.correlation_id,
      action: event.action,
      outcome: event.outcome,
      sanitizedDetail: event.sanitized_detail,
      createdAt: event.created_at,
    })),
    diagnostics,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

export function replaySocialExecutionAttemptByCorrelationId(
  correlationId: string,
  attemptSnapshot: SocialExecutionAttemptPersistenceSnapshot = EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT,
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot,
  now: Date = new Date(),
): Readonly<{
  correlationId: string;
  attempts: readonly SocialExecutionAttemptReplayProjection[];
  lifecycleEvents: readonly SocialExecutionAttemptReplayResult["lifecycleEvents"][number][];
}> {
  const duplicateDetection = detectExecutionAttemptDuplicates(attemptSnapshot.attempts);
  const matchingAttempts = attemptSnapshot.attempts.filter(
    (record) => record.correlationId === correlationId,
  );

  const attempts = matchingAttempts.map((attempt) => {
    const lifecycleEvents = attemptSnapshot.lifecycleEvents.filter(
      (event) => event.attemptId === attempt.attemptId,
    );
    const derivedLifecycleState = authorizationSnapshot
      ? deriveExecutionAttemptStatus({
          attempt,
          lifecycleEvents,
          authorizationSnapshot,
          now,
        })
      : lifecycleEvents.length > 0
        ? [...lifecycleEvents].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
            ?.lifecycleState ?? "missing"
        : "missing";

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
      derivedLifecycleState,
      derivedAwarenessStatus: deriveExecutionAttemptAwarenessStatus({
        attempts: [attempt],
        duplicateDetected: duplicateDetection.hasDuplicates,
        derivedLifecycleState,
      }),
      createdAt: attempt.createdAt,
      expiresAt: attempt.expiresAt,
    };
  });

  const lifecycleEvents = attemptSnapshot.lifecycleEvents.filter(
    (event) => event.correlationId === correlationId,
  );

  return {
    correlationId,
    attempts,
    lifecycleEvents: lifecycleEvents.map((event) => ({
      lifecycleEventId: event.lifecycleEventId,
      attemptId: event.attemptId,
      correlationId: event.correlationId,
      lifecycleState: event.lifecycleState,
      createdAt: event.createdAt,
    })),
  };
}

export function replaySocialExecutionAttemptByAuthorizationId(
  authorizationId: string,
  attemptSnapshot: SocialExecutionAttemptPersistenceSnapshot = EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT,
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot,
  now: Date = new Date(),
): Readonly<{
  authorizationId: string;
  attempts: readonly SocialExecutionAttemptReplayProjection[];
}> {
  const duplicateDetection = detectExecutionAttemptDuplicates(attemptSnapshot.attempts);
  const matchingAttempts = attemptSnapshot.attempts.filter(
    (record) => record.authorizationId === authorizationId,
  );

  return {
    authorizationId,
    attempts: matchingAttempts.map((attempt) => {
      const lifecycleEvents = attemptSnapshot.lifecycleEvents.filter(
        (event) => event.attemptId === attempt.attemptId,
      );
      const derivedLifecycleState = authorizationSnapshot
        ? deriveExecutionAttemptStatus({
            attempt,
            lifecycleEvents,
            authorizationSnapshot,
            now,
          })
        : lifecycleEvents.length > 0
          ? [...lifecycleEvents].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
              ?.lifecycleState ?? "missing"
          : "missing";

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
        derivedLifecycleState,
        derivedAwarenessStatus: deriveExecutionAttemptAwarenessStatus({
          attempts: [attempt],
          duplicateDetected: duplicateDetection.hasDuplicates,
          derivedLifecycleState,
        }),
        createdAt: attempt.createdAt,
        expiresAt: attempt.expiresAt,
      };
    }),
  };
}

export function replaySocialExecutionAttemptForIntent(input: {
  executionIntentId: string;
  publicationTargetId: string;
  attemptSnapshot?: SocialExecutionAttemptPersistenceSnapshot;
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
  now?: Date;
}): Readonly<{
  attemptIdentity: string;
  attempts: readonly SocialExecutionAttemptReplayProjection[];
  derivedAwarenessStatus: ReturnType<typeof deriveExecutionAttemptAwarenessStatus>;
}> {
  const attemptSnapshot = input.attemptSnapshot ?? EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT;
  const authorizationSnapshot = input.authorizationSnapshot;
  const now = input.now ?? new Date();
  const duplicateDetection = detectExecutionAttemptDuplicates(attemptSnapshot.attempts);

  const authorization =
    authorizationSnapshot?.authorizations.find(
      (record) =>
        record.executionIntentId === input.executionIntentId &&
        record.publicationTargetId === input.publicationTargetId,
    ) ?? null;

  const attemptIdentity = authorization
    ? buildExecutionAttemptIdentity({
        executionIntentId: input.executionIntentId,
        publicationTargetId: input.publicationTargetId,
        authorizationId: authorization.authorizationId,
      })
    : buildExecutionAttemptIdentity({
        executionIntentId: input.executionIntentId,
        publicationTargetId: input.publicationTargetId,
        authorizationId: "missing-authorization",
      });

  const matchingAttempts = attemptSnapshot.attempts.filter(
    (record) =>
      record.executionIntentId === input.executionIntentId &&
      record.publicationTargetId === input.publicationTargetId,
  );

  const attempts = matchingAttempts.map((attempt) => {
    const lifecycleEvents = attemptSnapshot.lifecycleEvents.filter(
      (event) => event.attemptId === attempt.attemptId,
    );
    const derivedLifecycleState = authorizationSnapshot
      ? deriveExecutionAttemptStatus({
          attempt,
          lifecycleEvents,
          authorizationSnapshot,
          now,
        })
      : "missing";

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
      derivedLifecycleState,
      derivedAwarenessStatus: deriveExecutionAttemptAwarenessStatus({
        attempts: [attempt],
        duplicateDetected: duplicateDetection.hasDuplicates,
        derivedLifecycleState,
      }),
      createdAt: attempt.createdAt,
      expiresAt: attempt.expiresAt,
    };
  });

  const primaryLifecycleState =
    attempts[0]?.derivedLifecycleState ?? ("missing" as const);

  return {
    attemptIdentity,
    attempts,
    derivedAwarenessStatus: deriveExecutionAttemptAwarenessStatus({
      attempts: matchingAttempts,
      duplicateDetected: duplicateDetection.hasDuplicates,
      derivedLifecycleState: primaryLifecycleState,
    }),
  };
}
