import { randomUUID } from "node:crypto";

import {
  buildExecutionAuthorizationIdentity,
  deriveExecutionAuthorizationState,
} from "../execution-authorization/social-execution-authorization-domain";
import {
  deriveExecutionRuntimeSessionStatus,
} from "../execution-authorization/social-execution-runtime-session-domain";
import {
  loadSocialExecutionAuthorizationSnapshot,
} from "../execution-authorization/social-execution-authorization-store";
import {
  SOCIAL_EXECUTION_ATTEMPT_VERSION,
  buildExecutionAttemptIdentity,
  validateExecutionAttemptRecord,
  type SocialExecutionAttemptRecord,
} from "./social-execution-attempt-domain";
import {
  buildExecutionAttemptFingerprint,
  buildExecutionAttemptIdempotencyKey,
  buildExecutionAttemptReplayKey,
} from "./social-execution-attempt-idempotency-domain";
import {
  SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_VERSION,
  validateExecutionAttemptLifecycleEventRecord,
  type SocialExecutionAttemptLifecycleEventRecord,
} from "./social-execution-attempt-lifecycle-domain";
import { validateExecutionAttemptRequest } from "./social-execution-attempt-request";
import {
  appendSocialExecutionAttemptAuditEvent,
  appendSocialExecutionAttemptLifecycleEvent,
  appendSocialExecutionAttemptRecord,
  isSocialExecutionAttemptStoreConfigured,
  loadSocialExecutionAttemptSnapshot,
} from "./social-execution-attempt-store";

export const SOCIAL_EXECUTION_ATTEMPT_CREATION_SERVICE_VERSION = "d16-w7-v1" as const;

export type SocialExecutionAttemptCreationServiceResult = Readonly<
  | {
      ok: true;
      attemptId: string;
      attemptIdentity: string;
      authorizationId: string;
      sessionId: string;
      correlationId: string;
      idempotencyKey: string;
      replayKey: string;
      attemptFingerprint: string;
    }
  | { ok: false; code: string; message: string }
>;

export function createExecutionAttemptId(): string {
  return `exec-attempt:${randomUUID()}`;
}

export function createExecutionAttemptLifecycleEventId(): string {
  return `exec-attempt-lifecycle:${randomUUID()}`;
}

export function createExecutionAttemptAuditEventId(): string {
  return `exec-attempt-audit:${randomUUID()}`;
}

export async function createExecutionAttemptForOwner(input: {
  authorizationId: unknown;
  executionIntentId: unknown;
  publicationTargetId: unknown;
  adminActorId: string;
  now?: Date;
}): Promise<SocialExecutionAttemptCreationServiceResult> {
  const validation = validateExecutionAttemptRequest({
    authorizationId: input.authorizationId,
    executionIntentId: input.executionIntentId,
    publicationTargetId: input.publicationTargetId,
  });

  if (!validation.ok) {
    await appendCreationAuditEvent({
      attemptId: null,
      attemptIdentity: null,
      correlationId: null,
      action: "create_validation_failed",
      outcome: "validation_failed",
      sanitizedDetail: validation.code,
      createdAt: new Date().toISOString(),
    });

    return { ok: false, code: validation.code, message: validation.message };
  }

  if (!isSocialExecutionAttemptStoreConfigured()) {
    return {
      ok: false,
      code: "storage_unavailable",
      message: "Execution attempt storage is not configured.",
    };
  }

  const now = input.now ?? new Date();
  const nowIso = now.toISOString();

  const authorizationSnapshot = await loadSocialExecutionAuthorizationSnapshot();
  const authorization =
    authorizationSnapshot.authorizations.find(
      (record) => record.authorizationId === validation.authorizationId,
    ) ?? null;

  if (!authorization) {
    await appendCreationAuditEvent({
      attemptId: null,
      attemptIdentity: buildExecutionAttemptIdentity({
        executionIntentId: validation.executionIntentId,
        publicationTargetId: validation.publicationTargetId,
        authorizationId: validation.authorizationId,
      }),
      correlationId: null,
      action: "create_validation_failed",
      outcome: "not_found",
      sanitizedDetail: "authorization_not_found",
      createdAt: nowIso,
    });

    return {
      ok: false,
      code: "authorization_not_found",
      message: "Execution authorization could not be found for attempt creation.",
    };
  }

  const cancellation =
    authorizationSnapshot.cancellations.find(
      (record) => record.authorizationId === authorization.authorizationId,
    ) ?? null;
  const derivedAuthorizationState = deriveExecutionAuthorizationState({
    authorization,
    cancellation,
    now,
  });

  if (derivedAuthorizationState !== "valid") {
    await appendCreationAuditEvent({
      attemptId: null,
      attemptIdentity: authorization.authorizationIdentity,
      correlationId: authorization.correlationId,
      action: "create_validation_failed",
      outcome: "validation_failed",
      sanitizedDetail: `authorization_${derivedAuthorizationState}`,
      createdAt: nowIso,
    });

    return {
      ok: false,
      code: "authorization_unavailable",
      message: `Execution authorization is ${derivedAuthorizationState} and cannot create an attempt.`,
    };
  }

  if (
    authorization.executionIntentId !== validation.executionIntentId ||
    authorization.publicationTargetId !== validation.publicationTargetId
  ) {
    await appendCreationAuditEvent({
      attemptId: null,
      attemptIdentity: authorization.authorizationIdentity,
      correlationId: authorization.correlationId,
      action: "create_validation_failed",
      outcome: "validation_failed",
      sanitizedDetail: "authorization_reference_mismatch",
      createdAt: nowIso,
    });

    return {
      ok: false,
      code: "authorization_reference_mismatch",
      message: "Execution intent and publication target must match the authorization record.",
    };
  }

  const expectedAuthorizationIdentity = buildExecutionAuthorizationIdentity({
    executionIntentId: validation.executionIntentId,
    publicationTargetId: validation.publicationTargetId,
  });
  if (authorization.authorizationIdentity !== expectedAuthorizationIdentity) {
    return {
      ok: false,
      code: "authorization_identity_invalid",
      message: "Execution authorization identity does not match the requested intent and target.",
    };
  }

  const session =
    authorizationSnapshot.sessions.find(
      (record) => record.authorizationId === authorization.authorizationId,
    ) ?? null;

  if (!session) {
    await appendCreationAuditEvent({
      attemptId: null,
      attemptIdentity: authorization.authorizationIdentity,
      correlationId: authorization.correlationId,
      action: "create_validation_failed",
      outcome: "validation_failed",
      sanitizedDetail: "session_missing",
      createdAt: nowIso,
    });

    return {
      ok: false,
      code: "session_unavailable",
      message: "Runtime session is missing for execution attempt creation.",
    };
  }

  const derivedSessionStatus = deriveExecutionRuntimeSessionStatus({
    session,
    derivedAuthorizationState,
    now,
  });

  if (derivedSessionStatus !== "active") {
    await appendCreationAuditEvent({
      attemptId: null,
      attemptIdentity: authorization.authorizationIdentity,
      correlationId: session.correlationId,
      action: "create_validation_failed",
      outcome: "validation_failed",
      sanitizedDetail: `session_${derivedSessionStatus}`,
      createdAt: nowIso,
    });

    return {
      ok: false,
      code: "session_unavailable",
      message: `Runtime session is ${derivedSessionStatus} and cannot create an attempt.`,
    };
  }

  const attemptSnapshot = await loadSocialExecutionAttemptSnapshot();
  const attemptIdentity = buildExecutionAttemptIdentity({
    executionIntentId: validation.executionIntentId,
    publicationTargetId: validation.publicationTargetId,
    authorizationId: validation.authorizationId,
  });

  if (attemptSnapshot.attempts.some((record) => record.attemptIdentity === attemptIdentity)) {
    await appendCreationAuditEvent({
      attemptId: null,
      attemptIdentity,
      correlationId: session.correlationId,
      action: "create_validation_failed",
      outcome: "duplicate_identity",
      sanitizedDetail: "duplicate_attempt",
      createdAt: nowIso,
    });

    return {
      ok: false,
      code: "duplicate_attempt",
      message: "An execution attempt already exists for this authorization.",
    };
  }

  const idempotencyKey = buildExecutionAttemptIdempotencyKey({
    executionIntentId: validation.executionIntentId,
    publicationTargetId: validation.publicationTargetId,
    authorizationId: validation.authorizationId,
  });

  if (attemptSnapshot.attempts.some((record) => record.idempotencyKey === idempotencyKey)) {
    await appendCreationAuditEvent({
      attemptId: null,
      attemptIdentity,
      correlationId: session.correlationId,
      action: "create_validation_failed",
      outcome: "duplicate_identity",
      sanitizedDetail: "duplicate_idempotency_key",
      createdAt: nowIso,
    });

    return {
      ok: false,
      code: "duplicate_attempt",
      message: "An execution attempt with this idempotency key already exists.",
    };
  }

  const attemptId = createExecutionAttemptId();
  const correlationId = session.correlationId;
  const replayKey = buildExecutionAttemptReplayKey({ attemptId, correlationId });
  const attemptFingerprint = buildExecutionAttemptFingerprint({
    executionIntentId: validation.executionIntentId,
    publicationTargetId: validation.publicationTargetId,
    authorizationId: validation.authorizationId,
    sessionId: session.sessionId,
    correlationId,
  });

  const attempt: SocialExecutionAttemptRecord = {
    attemptVersion: SOCIAL_EXECUTION_ATTEMPT_VERSION,
    attemptId,
    attemptIdentity,
    authorizationId: validation.authorizationId,
    sessionId: session.sessionId,
    publicationTargetId: validation.publicationTargetId,
    executionIntentId: validation.executionIntentId,
    correlationId,
    idempotencyKey,
    replayKey,
    attemptFingerprint,
    createdAt: nowIso,
    expiresAt: session.expiresAt,
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    subordinateToAuthorization: true,
  };

  const lifecycleEvent: SocialExecutionAttemptLifecycleEventRecord = {
    lifecycleVersion: SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_VERSION,
    lifecycleEventId: createExecutionAttemptLifecycleEventId(),
    attemptId,
    correlationId,
    lifecycleState: "created",
    createdAt: nowIso,
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };

  const attemptValidation = validateExecutionAttemptRecord(attempt, {
    authorizationSnapshot,
  });
  if (!attemptValidation.ok) {
    return {
      ok: false,
      code: attemptValidation.errors[0]?.code ?? "validation_failed",
      message: attemptValidation.errors[0]?.message ?? "Execution attempt validation failed.",
    };
  }

  const lifecycleValidation = validateExecutionAttemptLifecycleEventRecord(lifecycleEvent);
  if (!lifecycleValidation.ok) {
    return {
      ok: false,
      code: lifecycleValidation.errors[0]?.code ?? "validation_failed",
      message: lifecycleValidation.errors[0]?.message ?? "Execution attempt lifecycle validation failed.",
    };
  }

  try {
    await appendSocialExecutionAttemptRecord(attempt);
    await appendSocialExecutionAttemptLifecycleEvent(lifecycleEvent);
    await appendCreationAuditEvent({
      attemptId,
      attemptIdentity,
      correlationId,
      action: "create_attempt",
      outcome: "success",
      sanitizedDetail: "execution_attempt_created",
      createdAt: nowIso,
    });
  } catch (error) {
    await appendCreationAuditEvent({
      attemptId,
      attemptIdentity,
      correlationId,
      action: "create_attempt",
      outcome: "storage_error",
      sanitizedDetail: "execution_attempt_storage_error",
      createdAt: nowIso,
    }).catch(() => undefined);

    return {
      ok: false,
      code: "storage_error",
      message: error instanceof Error ? error.message : "Execution attempt storage failed.",
    };
  }

  return {
    ok: true,
    attemptId,
    attemptIdentity,
    authorizationId: validation.authorizationId,
    sessionId: session.sessionId,
    correlationId,
    idempotencyKey,
    replayKey,
    attemptFingerprint,
  };
}

async function appendCreationAuditEvent(input: {
  attemptId: string | null;
  attemptIdentity: string | null;
  correlationId: string | null;
  action: "create_attempt" | "create_validation_failed";
  outcome: "success" | "validation_failed" | "duplicate_identity" | "not_found" | "storage_error";
  sanitizedDetail: string;
  createdAt: string;
}): Promise<void> {
  await appendSocialExecutionAttemptAuditEvent({
    audit_event_id: createExecutionAttemptAuditEventId(),
    attempt_id: input.attemptId,
    attempt_identity: input.attemptIdentity,
    correlation_id: input.correlationId,
    action: input.action,
    outcome: input.outcome,
    sanitized_detail: input.sanitizedDetail,
    created_at: input.createdAt,
  }).catch(() => undefined);
}
