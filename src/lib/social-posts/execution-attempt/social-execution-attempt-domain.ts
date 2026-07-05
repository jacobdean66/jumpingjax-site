import { SOCIAL_EXECUTION_AUTHORIZATION_VERSION } from "../execution-authorization/social-execution-authorization-domain";
import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import {
  deriveExecutionAuthorizationState,
} from "../execution-authorization/social-execution-authorization-domain";
import {
  deriveExecutionRuntimeSessionStatus,
} from "../execution-authorization/social-execution-runtime-session-domain";
import {
  buildExecutionAttemptFingerprint,
  buildExecutionAttemptIdempotencyKey,
  buildExecutionAttemptReplayKey,
  type SocialExecutionAttemptIdempotencyVocabulary,
  validateExecutionAttemptIdempotencyVocabulary,
} from "./social-execution-attempt-idempotency-domain";
import {
  deriveExecutionAttemptLifecycleState,
  type SocialExecutionAttemptLifecycleEventRecord,
  type SocialExecutionAttemptLifecycleState,
} from "./social-execution-attempt-lifecycle-domain";

export const SOCIAL_EXECUTION_ATTEMPT_VERSION = "d16-w6-v1" as const;

export const SOCIAL_EXECUTION_ATTEMPT_DERIVED_AWARENESS_STATUSES = [
  "no_attempt",
  "attempt_exists",
  "attempt_expired",
  "duplicate_attempt_detected",
] as const;

export type SocialExecutionAttemptDerivedAwarenessStatus =
  (typeof SOCIAL_EXECUTION_ATTEMPT_DERIVED_AWARENESS_STATUSES)[number];

export const SOCIAL_EXECUTION_ATTEMPT_VALIDATION_ERROR_CODES = [
  "attempt_version_invalid",
  "attempt_id_required",
  "attempt_identity_required",
  "attempt_identity_duplicate",
  "attempt_identity_invalid",
  "authorization_id_required",
  "authorization_missing",
  "session_id_required",
  "session_missing",
  "publication_target_id_required",
  "execution_intent_id_required",
  "correlation_id_required",
  "created_at_required",
  "created_at_invalid",
  "expires_at_required",
  "expires_at_invalid",
  "expires_at_before_created_at",
  "mutable_attempt_forbidden",
  "grants_execution_permission_forbidden",
  "reference_mismatch",
  "idempotency_invalid",
] as const;

export type SocialExecutionAttemptValidationErrorCode =
  (typeof SOCIAL_EXECUTION_ATTEMPT_VALIDATION_ERROR_CODES)[number];

export type SocialExecutionAttemptValidationError = Readonly<{
  code: SocialExecutionAttemptValidationErrorCode;
  path: string;
  message: string;
}>;

export type SocialExecutionAttemptValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly SocialExecutionAttemptValidationError[] }
>;

export type SocialExecutionAttemptRecord = Readonly<{
  attemptVersion: typeof SOCIAL_EXECUTION_ATTEMPT_VERSION;
  attemptId: string;
  attemptIdentity: string;
  authorizationId: string;
  sessionId: string;
  publicationTargetId: string;
  executionIntentId: string;
  correlationId: string;
  idempotencyKey: string;
  replayKey: string;
  attemptFingerprint: string;
  createdAt: string;
  expiresAt: string;
  appendOnly: true;
  immutable: true;
  metadataOnly: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  subordinateToAuthorization: true;
}>;

const ATTEMPT_ID_PATTERN = /^exec-attempt:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const REFERENCE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const CORRELATION_ID_PATTERN = /^corr:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

export function buildExecutionAttemptIdentity(input: {
  executionIntentId: string;
  publicationTargetId: string;
  authorizationId: string;
}): string {
  return `exec-attempt-id:${input.executionIntentId}:${input.publicationTargetId}:${input.authorizationId}`;
}

export function buildExecutionAttemptIdempotencyVocabulary(
  record: Pick<
    SocialExecutionAttemptRecord,
    | "attemptId"
    | "authorizationId"
    | "sessionId"
    | "publicationTargetId"
    | "executionIntentId"
    | "correlationId"
    | "idempotencyKey"
    | "replayKey"
    | "attemptFingerprint"
  >,
): SocialExecutionAttemptIdempotencyVocabulary {
  return {
    idempotencyVersion: SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
    idempotencyKey: record.idempotencyKey,
    replayKey: record.replayKey,
    attemptFingerprint: record.attemptFingerprint,
    correlationId: record.correlationId,
    deterministicOnly: true,
    distributedLockingForbidden: true,
    retryEngineForbidden: true,
    backgroundProcessingForbidden: true,
  };
}

export function validateExecutionAttemptRecord(
  record: SocialExecutionAttemptRecord,
  context: Readonly<{
    existingAttemptIdentities?: ReadonlySet<string>;
    authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
  }> = {},
  path = "attempt",
): SocialExecutionAttemptValidationResult {
  const errors: SocialExecutionAttemptValidationError[] = [];
  const existingIdentities = context.existingAttemptIdentities ?? new Set();

  if (record.attemptVersion !== SOCIAL_EXECUTION_ATTEMPT_VERSION) {
    errors.push({
      code: "attempt_version_invalid",
      path: `${path}.attemptVersion`,
      message: "Execution attempt version is invalid.",
    });
  }

  requireText(record.attemptId, `${path}.attemptId`, "attempt_id_required", errors);
  if (record.attemptId && !ATTEMPT_ID_PATTERN.test(record.attemptId)) {
    errors.push({
      code: "attempt_id_required",
      path: `${path}.attemptId`,
      message: "Execution attempt id format is invalid.",
    });
  }

  requireText(record.attemptIdentity, `${path}.attemptIdentity`, "attempt_identity_required", errors);
  const expectedIdentity = buildExecutionAttemptIdentity({
    executionIntentId: record.executionIntentId,
    publicationTargetId: record.publicationTargetId,
    authorizationId: record.authorizationId,
  });
  if (record.attemptIdentity && record.attemptIdentity !== expectedIdentity) {
    errors.push({
      code: "attempt_identity_invalid",
      path: `${path}.attemptIdentity`,
      message: "Execution attempt identity must match execution intent, publication target, and authorization.",
    });
  }

  if (existingIdentities.has(record.attemptIdentity)) {
    errors.push({
      code: "attempt_identity_duplicate",
      path: `${path}.attemptIdentity`,
      message: "Execution attempt identity must remain unique.",
    });
  }

  requireReference(record.authorizationId, `${path}.authorizationId`, "authorization_id_required", errors);
  requireReference(record.sessionId, `${path}.sessionId`, "session_id_required", errors);
  requireReference(record.publicationTargetId, `${path}.publicationTargetId`, "publication_target_id_required", errors);
  requireReference(record.executionIntentId, `${path}.executionIntentId`, "execution_intent_id_required", errors);
  requireText(record.correlationId, `${path}.correlationId`, "correlation_id_required", errors);
  if (record.correlationId && !CORRELATION_ID_PATTERN.test(record.correlationId)) {
    errors.push({
      code: "correlation_id_required",
      path: `${path}.correlationId`,
      message: "Execution attempt correlation id format is invalid.",
    });
  }

  requireTimestamp(record.createdAt, `${path}.createdAt`, "created_at_required", "created_at_invalid", errors);
  requireTimestamp(record.expiresAt, `${path}.expiresAt`, "expires_at_required", "expires_at_invalid", errors);
  if (record.createdAt && record.expiresAt && Date.parse(record.expiresAt) <= Date.parse(record.createdAt)) {
    errors.push({
      code: "expires_at_before_created_at",
      path: `${path}.expiresAt`,
      message: "Execution attempt expiration must be after creation timestamp.",
    });
  }

  const expectedFingerprint = buildExecutionAttemptFingerprint({
    executionIntentId: record.executionIntentId,
    publicationTargetId: record.publicationTargetId,
    authorizationId: record.authorizationId,
    sessionId: record.sessionId,
    correlationId: record.correlationId,
  });
  const expectedIdempotencyKey = buildExecutionAttemptIdempotencyKey({
    executionIntentId: record.executionIntentId,
    publicationTargetId: record.publicationTargetId,
    authorizationId: record.authorizationId,
  });
  const expectedReplayKey = buildExecutionAttemptReplayKey({
    attemptId: record.attemptId,
    correlationId: record.correlationId,
  });

  if (record.idempotencyKey !== expectedIdempotencyKey) {
    errors.push({
      code: "idempotency_invalid",
      path: `${path}.idempotencyKey`,
      message: "Execution attempt idempotency key must match deterministic derivation.",
    });
  }

  if (record.replayKey !== expectedReplayKey) {
    errors.push({
      code: "idempotency_invalid",
      path: `${path}.replayKey`,
      message: "Execution attempt replay key must match deterministic derivation.",
    });
  }

  const idempotencyValidation = validateExecutionAttemptIdempotencyVocabulary(
    buildExecutionAttemptIdempotencyVocabulary(record),
    expectedFingerprint,
    `${path}.idempotency`,
  );
  if (!idempotencyValidation.ok) {
    for (const error of idempotencyValidation.errors) {
      errors.push({
        code: "idempotency_invalid",
        path: error.path,
        message: error.message,
      });
    }
  }

  if (!record.appendOnly || !record.immutable || !record.metadataOnly) {
    errors.push({
      code: "mutable_attempt_forbidden",
      path,
      message: "Execution attempt records must remain metadata-only, append-only, and immutable.",
    });
  }

  if (record.grantsExecutionPermission || !record.subordinateToAuthorization) {
    errors.push({
      code: "grants_execution_permission_forbidden",
      path,
      message: "Execution attempts must remain subordinate to authorization and must not grant execution permission.",
    });
  }

  if (context.authorizationSnapshot) {
    const authorization =
      context.authorizationSnapshot.authorizations.find(
        (item) => item.authorizationId === record.authorizationId,
      ) ?? null;
    if (!authorization) {
      errors.push({
        code: "authorization_missing",
        path: `${path}.authorizationId`,
        message: "Execution attempt requires a persisted authorization reference.",
      });
    } else {
      if (authorization.executionIntentId !== record.executionIntentId) {
        errors.push({
          code: "reference_mismatch",
          path: `${path}.executionIntentId`,
          message: "Execution attempt execution intent must match authorization reference.",
        });
      }
      if (authorization.publicationTargetId !== record.publicationTargetId) {
        errors.push({
          code: "reference_mismatch",
          path: `${path}.publicationTargetId`,
          message: "Execution attempt publication target must match authorization reference.",
        });
      }
      if (authorization.correlationId !== record.correlationId) {
        errors.push({
          code: "reference_mismatch",
          path: `${path}.correlationId`,
          message: "Execution attempt correlation id must match authorization reference.",
        });
      }
    }

    const session =
      context.authorizationSnapshot.sessions.find(
        (item) => item.sessionId === record.sessionId,
      ) ?? null;
    if (!session) {
      errors.push({
        code: "session_missing",
        path: `${path}.sessionId`,
        message: "Execution attempt requires a persisted runtime session reference.",
      });
    } else if (session.authorizationId !== record.authorizationId) {
      errors.push({
        code: "reference_mismatch",
        path: `${path}.sessionId`,
        message: "Execution attempt session must belong to the referenced authorization.",
      });
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [] };
}

export function deriveExecutionAttemptAwarenessStatus(input: {
  attempts: readonly SocialExecutionAttemptRecord[];
  duplicateDetected: boolean;
  derivedLifecycleState: SocialExecutionAttemptLifecycleState | "missing";
}): SocialExecutionAttemptDerivedAwarenessStatus {
  if (input.duplicateDetected) return "duplicate_attempt_detected";
  if (input.attempts.length === 0) return "no_attempt";
  if (input.derivedLifecycleState === "expired") return "attempt_expired";
  return "attempt_exists";
}

export function deriveExecutionAttemptStatus(input: {
  attempt: SocialExecutionAttemptRecord | null;
  lifecycleEvents: readonly SocialExecutionAttemptLifecycleEventRecord[];
  authorizationSnapshot: SocialExecutionAuthorizationPersistenceSnapshot;
  now?: Date;
}): SocialExecutionAttemptLifecycleState | "missing" {
  if (!input.attempt) return "missing";

  const authorization =
    input.authorizationSnapshot.authorizations.find(
      (record) => record.authorizationId === input.attempt!.authorizationId,
    ) ?? null;
  const cancellation =
    authorization
      ? input.authorizationSnapshot.cancellations.find(
          (record) => record.authorizationId === authorization.authorizationId,
        ) ?? null
      : null;
  const derivedAuthorizationState = deriveExecutionAuthorizationState({
    authorization,
    cancellation,
    now: input.now,
  });
  const session =
    input.authorizationSnapshot.sessions.find(
      (record) => record.sessionId === input.attempt!.sessionId,
    ) ?? null;
  const derivedSessionStatus = deriveExecutionRuntimeSessionStatus({
    session,
    derivedAuthorizationState,
    now: input.now,
  });

  return deriveExecutionAttemptLifecycleState({
    lifecycleEvents: input.lifecycleEvents,
    expiresAt: input.attempt.expiresAt,
    derivedAuthorizationState,
    derivedSessionStatus,
    now: input.now,
  });
}

function requireText(
  value: string,
  path: string,
  code: SocialExecutionAttemptValidationErrorCode,
  errors: SocialExecutionAttemptValidationError[],
): void {
  if (typeof value !== "string" || !value.trim()) {
    errors.push({ code, path, message: `${path} is required.` });
  }
}

function requireReference(
  value: string,
  path: string,
  code: SocialExecutionAttemptValidationErrorCode,
  errors: SocialExecutionAttemptValidationError[],
): void {
  requireText(value, path, code, errors);
  if (value && !REFERENCE_ID_PATTERN.test(value)) {
    errors.push({
      code,
      path,
      message: `${path} format is invalid.`,
    });
  }
}

function requireTimestamp(
  value: string,
  path: string,
  requiredCode: SocialExecutionAttemptValidationErrorCode,
  invalidCode: SocialExecutionAttemptValidationErrorCode,
  errors: SocialExecutionAttemptValidationError[],
): void {
  requireText(value, path, requiredCode, errors);
  if (value && Number.isNaN(Date.parse(value))) {
    errors.push({ code: invalidCode, path, message: `${path} must be a valid ISO timestamp.` });
  }
}
