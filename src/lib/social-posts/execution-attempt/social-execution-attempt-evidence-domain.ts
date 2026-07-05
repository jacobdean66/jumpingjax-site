import { SOCIAL_EXECUTION_ATTEMPT_VERSION } from "./social-execution-attempt-domain";

export const SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION = "d16-w8-v1" as const;

export const SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_KINDS = [
  "state_transition_evidence",
  "authorization_linkage_evidence",
  "correlation_evidence",
  "lifecycle_alignment_evidence",
  "operator_note",
  "none",
] as const;

export const SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_ACTORS = [
  "system",
  "owner",
  "admin",
  "test",
] as const;

export const SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_SOURCES = [
  "execution_attempt_evidence_domain",
  "manual_admin",
  "test",
] as const;

export const SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VALIDATION_ERROR_CODES = [
  "evidence_version_invalid",
  "evidence_id_required",
  "evidence_id_invalid",
  "attempt_id_required",
  "attempt_id_invalid",
  "correlation_id_required",
  "correlation_id_invalid",
  "evidence_kind_unknown",
  "transition_id_invalid",
  "sanitized_summary_required",
  "evidence_payload_invalid",
  "recorded_at_required",
  "recorded_at_invalid",
  "recorded_by_actor_invalid",
  "recorded_source_invalid",
  "mutable_evidence_forbidden",
  "secret_forbidden",
  "proves_execution_forbidden",
  "grants_execution_permission_forbidden",
] as const;

export type SocialExecutionAttemptEvidenceKind =
  (typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_KINDS)[number];

export type SocialExecutionAttemptEvidenceActor =
  (typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_ACTORS)[number];

export type SocialExecutionAttemptEvidenceSource =
  (typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_SOURCES)[number];

export type SocialExecutionAttemptEvidenceValidationErrorCode =
  (typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VALIDATION_ERROR_CODES)[number];

export type SocialExecutionAttemptEvidenceJsonPrimitive = string | number | boolean | null;

export type SocialExecutionAttemptEvidenceJsonValue =
  | SocialExecutionAttemptEvidenceJsonPrimitive
  | readonly SocialExecutionAttemptEvidenceJsonValue[]
  | { readonly [key: string]: SocialExecutionAttemptEvidenceJsonValue };

export type SocialExecutionAttemptEvidenceJsonObject = Readonly<{
  [key: string]: SocialExecutionAttemptEvidenceJsonValue;
}>;

export type SocialExecutionAttemptEvidenceValidationError = Readonly<{
  code: SocialExecutionAttemptEvidenceValidationErrorCode;
  path: string;
  message: string;
}>;

export type SocialExecutionAttemptEvidenceValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly SocialExecutionAttemptEvidenceValidationError[] }
>;

export type SocialExecutionAttemptEvidenceRecord = Readonly<{
  evidenceVersion: typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION;
  evidenceId: string;
  attemptId: string;
  correlationId: string;
  transitionId: string | null;
  evidenceKind: SocialExecutionAttemptEvidenceKind;
  sanitizedSummary: string;
  evidencePayload: SocialExecutionAttemptEvidenceJsonObject;
  recordedAt: string;
  recordedByActor: SocialExecutionAttemptEvidenceActor;
  recordedSource: SocialExecutionAttemptEvidenceSource;
  appendOnly: true;
  immutable: true;
  metadataOnly: true;
  containsSecrets: false;
  provesExecution: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

const EVIDENCE_ID_PATTERN = /^exec-attempt-evidence:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const ATTEMPT_ID_PATTERN = /^exec-attempt:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const CORRELATION_ID_PATTERN = /^corr:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const TRANSITION_ID_PATTERN = /^exec-attempt-transition:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

export function buildExecutionAttemptEvidenceId(seed: string): string {
  return `exec-attempt-evidence:${seed}`;
}

export function validateExecutionAttemptEvidenceRecord(
  record: SocialExecutionAttemptEvidenceRecord,
  path = "evidence",
): SocialExecutionAttemptEvidenceValidationResult {
  const errors: SocialExecutionAttemptEvidenceValidationError[] = [];

  if (record.evidenceVersion !== SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION) {
    errors.push({
      code: "evidence_version_invalid",
      path: `${path}.evidenceVersion`,
      message: "Execution attempt evidence version is invalid.",
    });
  }

  requireText(record.evidenceId, `${path}.evidenceId`, "evidence_id_required", errors);
  if (record.evidenceId && !EVIDENCE_ID_PATTERN.test(record.evidenceId)) {
    errors.push({
      code: "evidence_id_invalid",
      path: `${path}.evidenceId`,
      message: "Execution attempt evidence id format is invalid.",
    });
  }

  requireText(record.attemptId, `${path}.attemptId`, "attempt_id_required", errors);
  if (record.attemptId && !ATTEMPT_ID_PATTERN.test(record.attemptId)) {
    errors.push({
      code: "attempt_id_invalid",
      path: `${path}.attemptId`,
      message: "Execution attempt id format is invalid.",
    });
  }

  requireText(record.correlationId, `${path}.correlationId`, "correlation_id_required", errors);
  if (record.correlationId && !CORRELATION_ID_PATTERN.test(record.correlationId)) {
    errors.push({
      code: "correlation_id_invalid",
      path: `${path}.correlationId`,
      message: "Execution attempt correlation id format is invalid.",
    });
  }

  if (!SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_KINDS.includes(record.evidenceKind)) {
    errors.push({
      code: "evidence_kind_unknown",
      path: `${path}.evidenceKind`,
      message: "Execution attempt evidence kind is not recognized.",
    });
  }

  if (record.transitionId !== null && !TRANSITION_ID_PATTERN.test(record.transitionId)) {
    errors.push({
      code: "transition_id_invalid",
      path: `${path}.transitionId`,
      message: "Execution attempt transition id format is invalid.",
    });
  }

  requireText(record.sanitizedSummary, `${path}.sanitizedSummary`, "sanitized_summary_required", errors);
  if (!isSafeEvidencePayload(record.evidencePayload)) {
    errors.push({
      code: "evidence_payload_invalid",
      path: `${path}.evidencePayload`,
      message: "Execution attempt evidence payload must remain sanitized metadata.",
    });
  }

  requireTimestamp(record.recordedAt, `${path}.recordedAt`, errors);

  if (!SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_ACTORS.includes(record.recordedByActor)) {
    errors.push({
      code: "recorded_by_actor_invalid",
      path: `${path}.recordedByActor`,
      message: "Execution attempt evidence actor is invalid.",
    });
  }

  if (!SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_SOURCES.includes(record.recordedSource)) {
    errors.push({
      code: "recorded_source_invalid",
      path: `${path}.recordedSource`,
      message: "Execution attempt evidence source is invalid.",
    });
  }

  if (!record.appendOnly || !record.immutable || !record.metadataOnly) {
    errors.push({
      code: "mutable_evidence_forbidden",
      path,
      message: "Execution attempt evidence must remain metadata-only, append-only, and immutable.",
    });
  }

  if (record.containsSecrets) {
    errors.push({
      code: "secret_forbidden",
      path,
      message: "Execution attempt evidence must not contain secrets.",
    });
  }

  if (record.provesExecution || record.grantsExecutionPermission) {
    errors.push({
      code: "proves_execution_forbidden",
      path,
      message: "Execution attempt evidence must not prove or grant execution.",
    });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [] };
}

export function isExecutionAttemptEvidenceSubordinateToAttemptVersion(
  attemptVersion: typeof SOCIAL_EXECUTION_ATTEMPT_VERSION,
): boolean {
  return attemptVersion === SOCIAL_EXECUTION_ATTEMPT_VERSION;
}

function requireText(
  value: string,
  path: string,
  code: SocialExecutionAttemptEvidenceValidationErrorCode,
  errors: SocialExecutionAttemptEvidenceValidationError[],
): void {
  if (typeof value !== "string" || !value.trim()) {
    errors.push({ code, path, message: `${path} is required.` });
  }
}

function requireTimestamp(
  value: string,
  path: string,
  errors: SocialExecutionAttemptEvidenceValidationError[],
): void {
  requireText(value, path, "recorded_at_required", errors);
  if (value && Number.isNaN(Date.parse(value))) {
    errors.push({
      code: "recorded_at_invalid",
      path,
      message: `${path} must be a valid ISO timestamp.`,
    });
  }
}

function isSafeEvidencePayload(value: SocialExecutionAttemptEvidenceJsonObject): boolean {
  return isSafeJsonValue(value);
}

function isSafeJsonValue(value: SocialExecutionAttemptEvidenceJsonValue): boolean {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((item) => isSafeJsonValue(item));
  }
  return Object.values(value).every((item) => isSafeJsonValue(item));
}
