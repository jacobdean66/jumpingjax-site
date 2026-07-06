import {
  SOCIAL_EXECUTION_SESSION_SUMMARY_STATUSES,
  SOCIAL_EXECUTION_SESSION_VERSION,
  type SocialExecutionSessionSummaryStatus,
} from "./social-execution-session-domain";

export const SOCIAL_EXECUTION_SESSION_PERSISTENCE_VERSION = "d16-w13-v1" as const;

export const SOCIAL_EXECUTION_SESSION_ROW_ACTIONS = [
  "create_session",
  "session_orchestration_blocked",
  "session_orchestration_completed",
] as const;

export const SOCIAL_EXECUTION_SESSION_ROW_OUTCOMES = [
  "blocked",
  "simulated",
  "validation_failed",
  "created",
] as const;

export type SocialExecutionSessionRowAction =
  (typeof SOCIAL_EXECUTION_SESSION_ROW_ACTIONS)[number];

export type SocialExecutionSessionRowOutcome =
  (typeof SOCIAL_EXECUTION_SESSION_ROW_OUTCOMES)[number];

export const SOCIAL_EXECUTION_SESSION_ROW_VALIDATION_ERROR_CODES = [
  "session_id_required",
  "session_version_invalid",
  "correlation_id_required",
  "summary_status_invalid",
  "sanitized_summary_required",
  "transcript_ids_invalid",
  "attempt_ids_invalid",
  "timestamp_invalid",
  "audit_event_id_required",
  "action_invalid",
  "outcome_invalid",
  "forbidden_key_detected",
] as const;

export type SocialExecutionSessionRowValidationErrorCode =
  (typeof SOCIAL_EXECUTION_SESSION_ROW_VALIDATION_ERROR_CODES)[number];

export type SocialExecutionSessionRowValidationError = Readonly<{
  code: SocialExecutionSessionRowValidationErrorCode;
  path: string;
  message: string;
}>;

export type SocialExecutionSessionRowValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly SocialExecutionSessionRowValidationError[] }
>;

export type SocialExecutionSessionRow = Readonly<{
  session_id: string;
  session_version: string;
  correlation_id: string;
  summary_status: string;
  sanitized_summary: string;
  transcript_ids: readonly string[];
  attempt_ids: readonly string[];
  created_at: string;
  completed_at: string;
}>;

export type SocialExecutionSessionAuditEventRow = Readonly<{
  audit_event_id: string;
  session_id: string;
  correlation_id: string | null;
  action: string;
  outcome: string;
  sanitized_detail: string;
  created_at: string;
}>;

const SESSION_ID_PATTERN = /^exec-execution-session:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const CORRELATION_ID_PATTERN = /^corr:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const REFERENCE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

const FORBIDDEN_ROW_KEYS = new Set([
  "fetch",
  "http",
  "publish",
  "execute",
  "credential",
  "token",
  "oauth",
  "vault",
  "worker",
  "queue",
  "cron",
  "retry",
]);

export function validateSocialExecutionSessionRow(
  row: unknown,
  pathPrefix = "row",
): SocialExecutionSessionRowValidationResult {
  const errors: SocialExecutionSessionRowValidationError[] = [];

  if (!row || typeof row !== "object") {
    return invalid("session_id_required", pathPrefix, "Execution session row must be an object.");
  }

  const candidate = row as Record<string, unknown>;
  rejectForbiddenKeys(candidate, pathPrefix, errors);

  if (!hasMatchingText(candidate.session_id, SESSION_ID_PATTERN)) {
    errors.push({
      code: "session_id_required",
      path: `${pathPrefix}.session_id`,
      message: "Execution session row id is required.",
    });
  }

  if (candidate.session_version !== SOCIAL_EXECUTION_SESSION_VERSION) {
    errors.push({
      code: "session_version_invalid",
      path: `${pathPrefix}.session_version`,
      message: "Execution session row version is invalid.",
    });
  }

  if (!hasMatchingText(candidate.correlation_id, CORRELATION_ID_PATTERN)) {
    errors.push({
      code: "correlation_id_required",
      path: `${pathPrefix}.correlation_id`,
      message: "Execution session row correlation id is required.",
    });
  }

  if (
    !SOCIAL_EXECUTION_SESSION_SUMMARY_STATUSES.includes(
      candidate.summary_status as SocialExecutionSessionSummaryStatus,
    )
  ) {
    errors.push({
      code: "summary_status_invalid",
      path: `${pathPrefix}.summary_status`,
      message: "Execution session row summary status is invalid.",
    });
  }

  if (!hasText(candidate.sanitized_summary)) {
    errors.push({
      code: "sanitized_summary_required",
      path: `${pathPrefix}.sanitized_summary`,
      message: "Execution session row sanitized summary is required.",
    });
  }

  validateReferenceIdArray(candidate.transcript_ids, `${pathPrefix}.transcript_ids`, errors);
  validateReferenceIdArray(candidate.attempt_ids, `${pathPrefix}.attempt_ids`, errors);
  requireTimestamp(candidate.created_at, `${pathPrefix}.created_at`, errors);
  requireTimestamp(candidate.completed_at, `${pathPrefix}.completed_at`, errors);

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

export function validateSocialExecutionSessionAuditEventRow(
  row: unknown,
  pathPrefix = "auditRow",
): SocialExecutionSessionRowValidationResult {
  const errors: SocialExecutionSessionRowValidationError[] = [];

  if (!row || typeof row !== "object") {
    return invalid("audit_event_id_required", pathPrefix, "Execution session audit row must be an object.");
  }

  const candidate = row as Record<string, unknown>;
  rejectForbiddenKeys(candidate, pathPrefix, errors);

  if (!hasMatchingText(candidate.audit_event_id, REFERENCE_ID_PATTERN)) {
    errors.push({
      code: "audit_event_id_required",
      path: `${pathPrefix}.audit_event_id`,
      message: "Execution session audit event id is required.",
    });
  }

  if (!hasMatchingText(candidate.session_id, SESSION_ID_PATTERN)) {
    errors.push({
      code: "session_id_required",
      path: `${pathPrefix}.session_id`,
      message: "Execution session audit row session id is required.",
    });
  }

  if (
    candidate.correlation_id !== null &&
    candidate.correlation_id !== undefined &&
    !hasMatchingText(candidate.correlation_id, CORRELATION_ID_PATTERN)
  ) {
    errors.push({
      code: "correlation_id_required",
      path: `${pathPrefix}.correlation_id`,
      message: "Execution session audit row correlation id is invalid.",
    });
  }

  if (
    !SOCIAL_EXECUTION_SESSION_ROW_ACTIONS.includes(
      candidate.action as SocialExecutionSessionRowAction,
    )
  ) {
    errors.push({
      code: "action_invalid",
      path: `${pathPrefix}.action`,
      message: "Execution session audit row action is invalid.",
    });
  }

  if (
    !SOCIAL_EXECUTION_SESSION_ROW_OUTCOMES.includes(
      candidate.outcome as SocialExecutionSessionRowOutcome,
    )
  ) {
    errors.push({
      code: "outcome_invalid",
      path: `${pathPrefix}.outcome`,
      message: "Execution session audit row outcome is invalid.",
    });
  }

  if (!hasText(candidate.sanitized_detail)) {
    errors.push({
      code: "sanitized_summary_required",
      path: `${pathPrefix}.sanitized_detail`,
      message: "Execution session audit row sanitized detail is required.",
    });
  }

  requireTimestamp(candidate.created_at, `${pathPrefix}.created_at`, errors);

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

function validateReferenceIdArray(
  value: unknown,
  path: string,
  errors: SocialExecutionSessionRowValidationError[],
): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({
      code: path.endsWith("transcript_ids") ? "transcript_ids_invalid" : "attempt_ids_invalid",
      path,
      message: `${path} must be a non-empty string array.`,
    });
    return;
  }

  for (const [index, item] of value.entries()) {
    if (!hasMatchingText(item, REFERENCE_ID_PATTERN)) {
      errors.push({
        code: path.endsWith("transcript_ids") ? "transcript_ids_invalid" : "attempt_ids_invalid",
        path: `${path}.${index}`,
        message: `${path}.${index} format is invalid.`,
      });
    }
  }
}

function rejectForbiddenKeys(
  value: Record<string, unknown>,
  path: string,
  errors: SocialExecutionSessionRowValidationError[],
): void {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_ROW_KEYS.has(key.toLowerCase())) {
      errors.push({
        code: "forbidden_key_detected",
        path: `${path}.${key}`,
        message: `Forbidden execution session row key detected: ${key}.`,
      });
    }
  }
}

function requireTimestamp(
  value: unknown,
  path: string,
  errors: SocialExecutionSessionRowValidationError[],
): void {
  if (!hasText(value) || Number.isNaN(Date.parse(value))) {
    errors.push({
      code: "timestamp_invalid",
      path,
      message: `${path} must be a valid ISO timestamp.`,
    });
  }
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasMatchingText(value: unknown, pattern: RegExp): value is string {
  return hasText(value) && pattern.test(value);
}

function invalid(
  code: SocialExecutionSessionRowValidationErrorCode,
  path: string,
  message: string,
): SocialExecutionSessionRowValidationResult {
  return { ok: false, errors: [{ code, path, message }] };
}
