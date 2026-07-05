import { SOCIAL_EXECUTION_AUTHORIZATION_VERSION } from "../execution-authorization/social-execution-authorization-domain";

export const SOCIAL_EXECUTION_ATTEMPT_IDEMPOTENCY_VERSION =
  SOCIAL_EXECUTION_AUTHORIZATION_VERSION;

export const SOCIAL_EXECUTION_ATTEMPT_IDEMPOTENCY_VALIDATION_ERROR_CODES = [
  "idempotency_version_invalid",
  "idempotency_key_required",
  "idempotency_key_invalid",
  "replay_key_required",
  "replay_key_invalid",
  "attempt_fingerprint_required",
  "attempt_fingerprint_invalid",
  "attempt_fingerprint_mismatch",
  "duplicate_idempotency_key",
  "duplicate_replay_key",
  "duplicate_attempt_fingerprint",
  "correlation_linkage_required",
  "correlation_linkage_invalid",
] as const;

export type SocialExecutionAttemptIdempotencyValidationErrorCode =
  (typeof SOCIAL_EXECUTION_ATTEMPT_IDEMPOTENCY_VALIDATION_ERROR_CODES)[number];

export type SocialExecutionAttemptIdempotencyValidationError = Readonly<{
  code: SocialExecutionAttemptIdempotencyValidationErrorCode;
  path: string;
  message: string;
}>;

export type SocialExecutionAttemptIdempotencyValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly SocialExecutionAttemptIdempotencyValidationError[] }
>;

export type SocialExecutionAttemptIdempotencyVocabulary = Readonly<{
  idempotencyVersion: typeof SOCIAL_EXECUTION_ATTEMPT_IDEMPOTENCY_VERSION;
  idempotencyKey: string;
  replayKey: string;
  attemptFingerprint: string;
  correlationId: string;
  deterministicOnly: true;
  distributedLockingForbidden: true;
  retryEngineForbidden: true;
  backgroundProcessingForbidden: true;
}>;

export type SocialExecutionAttemptDuplicateDetectionModel = Readonly<{
  duplicateIdempotencyKeys: readonly string[];
  duplicateReplayKeys: readonly string[];
  duplicateAttemptFingerprints: readonly string[];
  duplicateAttemptIds: readonly string[];
  hasDuplicates: boolean;
  computedOnly: true;
  readOnly: true;
}>;

const IDEMPOTENCY_KEY_PATTERN = /^idempotency:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const REPLAY_KEY_PATTERN = /^replay:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const FINGERPRINT_PATTERN = /^fingerprint:[a-f0-9]{64}$/;
const CORRELATION_ID_PATTERN = /^corr:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

export function buildExecutionAttemptFingerprint(input: {
  executionIntentId: string;
  publicationTargetId: string;
  authorizationId: string;
  sessionId: string;
  correlationId: string;
}): string {
  const payload = [
    input.executionIntentId,
    input.publicationTargetId,
    input.authorizationId,
    input.sessionId,
    input.correlationId,
  ].join("|");

  let hash = 0;
  for (let index = 0; index < payload.length; index += 1) {
    hash = (hash * 31 + payload.charCodeAt(index)) >>> 0;
  }

  const normalized = payload
    .split("")
    .reduce((accumulator, character) => {
      const next = (accumulator.charCodeAt(0) * 31 + character.charCodeAt(0)) & 0xffffffff;
      return String.fromCharCode(next);
    }, "\0")
    .split("")
    .map((_, index) => {
      const code = (hash + index * 17 + payload.charCodeAt(index % payload.length)) & 0xff;
      return code.toString(16).padStart(2, "0");
    })
    .join("")
    .padEnd(64, "0")
    .slice(0, 64);

  return `fingerprint:${normalized}`;
}

export function buildExecutionAttemptIdempotencyKey(input: {
  executionIntentId: string;
  publicationTargetId: string;
  authorizationId: string;
}): string {
  return `idempotency:${input.executionIntentId}:${input.publicationTargetId}:${input.authorizationId}`;
}

export function buildExecutionAttemptReplayKey(input: {
  attemptId: string;
  correlationId: string;
}): string {
  return `replay:${input.attemptId}:${input.correlationId}`;
}

export function validateExecutionAttemptIdempotencyVocabulary(
  vocabulary: SocialExecutionAttemptIdempotencyVocabulary,
  expectedFingerprint?: string,
  path = "idempotency",
): SocialExecutionAttemptIdempotencyValidationResult {
  const errors: SocialExecutionAttemptIdempotencyValidationError[] = [];

  if (vocabulary.idempotencyVersion !== SOCIAL_EXECUTION_ATTEMPT_IDEMPOTENCY_VERSION) {
    errors.push({
      code: "idempotency_version_invalid",
      path: `${path}.idempotencyVersion`,
      message: "Execution attempt idempotency version is invalid.",
    });
  }

  requirePattern(
    vocabulary.idempotencyKey,
    `${path}.idempotencyKey`,
    "idempotency_key_required",
    "idempotency_key_invalid",
    IDEMPOTENCY_KEY_PATTERN,
    errors,
  );
  requirePattern(
    vocabulary.replayKey,
    `${path}.replayKey`,
    "replay_key_required",
    "replay_key_invalid",
    REPLAY_KEY_PATTERN,
    errors,
  );
  requirePattern(
    vocabulary.attemptFingerprint,
    `${path}.attemptFingerprint`,
    "attempt_fingerprint_required",
    "attempt_fingerprint_invalid",
    FINGERPRINT_PATTERN,
    errors,
  );
  requirePattern(
    vocabulary.correlationId,
    `${path}.correlationId`,
    "correlation_linkage_required",
    "correlation_linkage_invalid",
    CORRELATION_ID_PATTERN,
    errors,
  );

  if (
    expectedFingerprint &&
    vocabulary.attemptFingerprint &&
    vocabulary.attemptFingerprint !== expectedFingerprint
  ) {
    errors.push({
      code: "attempt_fingerprint_mismatch",
      path: `${path}.attemptFingerprint`,
      message: "Execution attempt fingerprint must match deterministic fingerprint derivation.",
    });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [] };
}

export function detectExecutionAttemptDuplicates(
  attempts: readonly Readonly<{
    attemptId: string;
    idempotencyKey: string;
    replayKey: string;
    attemptFingerprint: string;
  }>[],
): SocialExecutionAttemptDuplicateDetectionModel {
  const duplicateIdempotencyKeys = findDuplicateValues(attempts.map((record) => record.idempotencyKey));
  const duplicateReplayKeys = findDuplicateValues(attempts.map((record) => record.replayKey));
  const duplicateAttemptFingerprints = findDuplicateValues(
    attempts.map((record) => record.attemptFingerprint),
  );
  const duplicateAttemptIds = findDuplicateValues(attempts.map((record) => record.attemptId));

  return {
    duplicateIdempotencyKeys,
    duplicateReplayKeys,
    duplicateAttemptFingerprints,
    duplicateAttemptIds,
    hasDuplicates:
      duplicateIdempotencyKeys.length > 0 ||
      duplicateReplayKeys.length > 0 ||
      duplicateAttemptFingerprints.length > 0 ||
      duplicateAttemptIds.length > 0,
    computedOnly: true,
    readOnly: true,
  };
}

function findDuplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  }

  return [...duplicates].sort((left, right) => left.localeCompare(right));
}

function requirePattern(
  value: string,
  path: string,
  requiredCode: SocialExecutionAttemptIdempotencyValidationErrorCode,
  invalidCode: SocialExecutionAttemptIdempotencyValidationErrorCode,
  pattern: RegExp,
  errors: SocialExecutionAttemptIdempotencyValidationError[],
): void {
  if (typeof value !== "string" || !value.trim()) {
    errors.push({ code: requiredCode, path, message: `${path} is required.` });
    return;
  }

  if (!pattern.test(value)) {
    errors.push({ code: invalidCode, path, message: `${path} format is invalid.` });
  }
}
