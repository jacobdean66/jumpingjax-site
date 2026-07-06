import type { SocialExecutionRunnerOutcomeStatus } from "../execution-runner/social-execution-runner-domain";

export const SOCIAL_EXECUTION_SESSION_VERSION = "d16-w12-v1" as const;

export const SOCIAL_EXECUTION_SESSION_SUMMARY_STATUSES = [
  "blocked",
  "simulated",
  "validation_failed",
] as const;

export type SocialExecutionSessionSummaryStatus =
  (typeof SOCIAL_EXECUTION_SESSION_SUMMARY_STATUSES)[number];

export const SOCIAL_EXECUTION_SESSION_VALIDATION_ERROR_CODES = [
  "session_version_invalid",
  "session_id_required",
  "correlation_id_required",
  "summary_status_invalid",
  "sanitized_summary_required",
  "transcript_ids_required",
  "attempt_ids_required",
  "grants_execution_permission_forbidden",
  "simulated_only_required",
  "forbidden_key_detected",
] as const;

export type SocialExecutionSessionValidationErrorCode =
  (typeof SOCIAL_EXECUTION_SESSION_VALIDATION_ERROR_CODES)[number];

export type SocialExecutionSessionValidationError = Readonly<{
  code: SocialExecutionSessionValidationErrorCode;
  path: string;
  message: string;
}>;

export type SocialExecutionSessionValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly SocialExecutionSessionValidationError[] }
>;

export type SocialExecutionSessionTimelineEntry = Readonly<{
  sequence: number;
  transcriptId: string;
  attemptId: string;
  outcomeStatus: SocialExecutionRunnerOutcomeStatus;
  recordedAt: string;
  sanitizedSummary: string;
}>;

export type SocialExecutionSessionRecord = Readonly<{
  sessionVersion: typeof SOCIAL_EXECUTION_SESSION_VERSION;
  sessionId: string;
  correlationId: string;
  transcriptIds: readonly string[];
  attemptIds: readonly string[];
  summaryStatus: SocialExecutionSessionSummaryStatus;
  sanitizedSummary: string;
  createdAt: string;
  completedAt: string;
  appendOnly: true;
  immutable: true;
  metadataOnly: true;
  simulatedOnly: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  provesExecution: false;
  usesNoNetwork: true;
  usesNoOAuth: true;
  usesNoCredentials: true;
  callsNoExternalApis: true;
}>;

export type SocialExecutionSessionAuditEventRecord = Readonly<{
  auditEventId: string;
  sessionId: string;
  correlationId: string | null;
  action: "create_session" | "session_orchestration_blocked" | "session_orchestration_completed";
  outcome: SocialExecutionSessionSummaryStatus | "created";
  sanitizedDetail: string;
  createdAt: string;
}>;

const SESSION_ID_PATTERN = /^exec-execution-session:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const CORRELATION_ID_PATTERN = /^corr:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const REFERENCE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

const FORBIDDEN_SESSION_KEYS = new Set([
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

export function deriveExecutionSessionSummaryStatus(
  outcomeStatuses: readonly SocialExecutionRunnerOutcomeStatus[],
): SocialExecutionSessionSummaryStatus {
  if (outcomeStatuses.length === 0) {
    return "blocked";
  }

  if (outcomeStatuses.some((status) => status === "validation_failed")) {
    return "validation_failed";
  }

  if (outcomeStatuses.some((status) => status === "blocked")) {
    return "blocked";
  }

  return "simulated";
}

export function buildExecutionSessionTimeline(
  entries: readonly Readonly<{
    transcriptId: string;
    attemptId: string;
    outcomeStatus: SocialExecutionRunnerOutcomeStatus;
    recordedAt: string;
    sanitizedSummary: string;
  }>[],
): readonly SocialExecutionSessionTimelineEntry[] {
  const sorted = [...entries].sort((left, right) => {
    const timeDelta = Date.parse(left.recordedAt) - Date.parse(right.recordedAt);
    if (timeDelta !== 0) {
      return timeDelta;
    }

    return left.transcriptId.localeCompare(right.transcriptId);
  });

  return sorted.map((entry, index) => ({
    sequence: index + 1,
    transcriptId: entry.transcriptId,
    attemptId: entry.attemptId,
    outcomeStatus: entry.outcomeStatus,
    recordedAt: entry.recordedAt,
    sanitizedSummary: entry.sanitizedSummary,
  }));
}

export function validateExecutionSessionRecord(
  record: unknown,
  pathPrefix = "session",
): SocialExecutionSessionValidationResult {
  const errors: SocialExecutionSessionValidationError[] = [];

  if (!record || typeof record !== "object") {
    return invalid("session_version_invalid", pathPrefix, "Execution session must be an object.");
  }

  const candidate = record as Record<string, unknown>;
  rejectForbiddenKeys(candidate, pathPrefix, errors);

  if (candidate.sessionVersion !== SOCIAL_EXECUTION_SESSION_VERSION) {
    errors.push({
      code: "session_version_invalid",
      path: `${pathPrefix}.sessionVersion`,
      message: "Execution session version is invalid.",
    });
  }

  if (!hasMatchingText(candidate.sessionId, SESSION_ID_PATTERN)) {
    errors.push({
      code: "session_id_required",
      path: `${pathPrefix}.sessionId`,
      message: "Execution session id is required.",
    });
  }

  if (!hasMatchingText(candidate.correlationId, CORRELATION_ID_PATTERN)) {
    errors.push({
      code: "correlation_id_required",
      path: `${pathPrefix}.correlationId`,
      message: "Execution session correlation id is required.",
    });
  }

  if (
    !SOCIAL_EXECUTION_SESSION_SUMMARY_STATUSES.includes(
      candidate.summaryStatus as SocialExecutionSessionSummaryStatus,
    )
  ) {
    errors.push({
      code: "summary_status_invalid",
      path: `${pathPrefix}.summaryStatus`,
      message: "Execution session summary status is invalid.",
    });
  }

  if (!hasText(candidate.sanitizedSummary)) {
    errors.push({
      code: "sanitized_summary_required",
      path: `${pathPrefix}.sanitizedSummary`,
      message: "Execution session sanitized summary is required.",
    });
  }

  if (!Array.isArray(candidate.transcriptIds) || candidate.transcriptIds.length === 0) {
    errors.push({
      code: "transcript_ids_required",
      path: `${pathPrefix}.transcriptIds`,
      message: "Execution session must reference at least one runner transcript.",
    });
  } else {
    for (const [index, transcriptId] of candidate.transcriptIds.entries()) {
      if (!hasMatchingText(transcriptId, REFERENCE_ID_PATTERN)) {
        errors.push({
          code: "transcript_ids_required",
          path: `${pathPrefix}.transcriptIds.${index}`,
          message: "Execution session transcript id format is invalid.",
        });
      }
    }
  }

  if (!Array.isArray(candidate.attemptIds) || candidate.attemptIds.length === 0) {
    errors.push({
      code: "attempt_ids_required",
      path: `${pathPrefix}.attemptIds`,
      message: "Execution session must reference at least one attempt id.",
    });
  } else {
    for (const [index, attemptId] of candidate.attemptIds.entries()) {
      if (!hasMatchingText(attemptId, REFERENCE_ID_PATTERN)) {
        errors.push({
          code: "attempt_ids_required",
          path: `${pathPrefix}.attemptIds.${index}`,
          message: "Execution session attempt id format is invalid.",
        });
      }
    }
  }

  if (candidate.grantsExecutionPermission !== false) {
    errors.push({
      code: "grants_execution_permission_forbidden",
      path: `${pathPrefix}.grantsExecutionPermission`,
      message: "Execution session must not grant execution permission.",
    });
  }

  if (candidate.simulatedOnly !== true) {
    errors.push({
      code: "simulated_only_required",
      path: `${pathPrefix}.simulatedOnly`,
      message: "Execution session must remain simulated only.",
    });
  }

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

export function detectForbiddenExecutionSessionState(input: unknown): Readonly<{
  forbidden: boolean;
  diagnostics: readonly SocialExecutionSessionValidationError[];
}> {
  const validation = validateExecutionSessionRecord(input, "session");
  return {
    forbidden: !validation.ok,
    diagnostics: validation.ok ? [] : validation.errors,
  };
}

function rejectForbiddenKeys(
  value: Record<string, unknown>,
  path: string,
  errors: SocialExecutionSessionValidationError[],
): void {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_SESSION_KEYS.has(key.toLowerCase())) {
      errors.push({
        code: "forbidden_key_detected",
        path: `${path}.${key}`,
        message: `Forbidden execution session key detected: ${key}.`,
      });
    }
  }
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasMatchingText(value: unknown, pattern: RegExp): value is string {
  return hasText(value) && pattern.test(value);
}

function invalid(
  code: SocialExecutionSessionValidationErrorCode,
  path: string,
  message: string,
): SocialExecutionSessionValidationResult {
  return { ok: false, errors: [{ code, path, message }] };
}
