import type { SocialPublicationExecutionAdapterPlatform } from "../social-publication-execution-adapter";
import type { SocialPublicationExecutionDryRunAdapterSimulation } from "../social-publication-execution-adapter-dry-run";

export const SOCIAL_EXECUTION_RUNNER_VERSION = "d16-w11-v1" as const;

export const SOCIAL_EXECUTION_RUNNER_OUTCOME_STATUSES = [
  "blocked",
  "simulated",
  "validation_failed",
] as const;

export type SocialExecutionRunnerOutcomeStatus =
  (typeof SOCIAL_EXECUTION_RUNNER_OUTCOME_STATUSES)[number];

export const SOCIAL_EXECUTION_RUNNER_SUPPORTED_PLATFORMS = [
  "facebook",
  "instagram",
] as const satisfies readonly SocialPublicationExecutionAdapterPlatform[];

export type SocialExecutionRunnerSupportedPlatform =
  (typeof SOCIAL_EXECUTION_RUNNER_SUPPORTED_PLATFORMS)[number];

export const SOCIAL_EXECUTION_RUNNER_VALIDATION_ERROR_CODES = [
  "runner_version_invalid",
  "transcript_id_required",
  "attempt_id_required",
  "correlation_id_required",
  "outcome_status_invalid",
  "platform_invalid",
  "sanitized_summary_required",
  "grants_execution_permission_forbidden",
  "proves_execution_forbidden",
  "simulated_only_required",
  "forbidden_key_detected",
] as const;

export type SocialExecutionRunnerValidationErrorCode =
  (typeof SOCIAL_EXECUTION_RUNNER_VALIDATION_ERROR_CODES)[number];

export type SocialExecutionRunnerValidationError = Readonly<{
  code: SocialExecutionRunnerValidationErrorCode;
  path: string;
  message: string;
}>;

export type SocialExecutionRunnerValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly SocialExecutionRunnerValidationError[] }
>;

export type SocialExecutionRunnerTranscriptRecord = Readonly<{
  runnerVersion: typeof SOCIAL_EXECUTION_RUNNER_VERSION;
  transcriptId: string;
  attemptId: string;
  authorizationId: string;
  executionIntentId: string;
  publicationTargetId: string;
  correlationId: string;
  platform: SocialExecutionRunnerSupportedPlatform;
  outcomeStatus: SocialExecutionRunnerOutcomeStatus;
  sanitizedSummary: string;
  simulation: SocialPublicationExecutionDryRunAdapterSimulation | null;
  blockingCodes: readonly string[];
  recordedAt: string;
  appendOnly: true;
  immutable: true;
  metadataOnly: true;
  simulatedOnly: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  provesExecution: false;
  persistsNothing: false;
  usesNoNetwork: true;
  usesNoOAuth: true;
  usesNoCredentials: true;
  callsNoExternalApis: true;
}>;

export type SocialExecutionRunnerAuditEventRecord = Readonly<{
  auditEventId: string;
  transcriptId: string | null;
  attemptId: string | null;
  correlationId: string | null;
  action: "append_transcript" | "runner_validation_failed" | "runner_blocked";
  outcome: "success" | "blocked" | "validation_failed";
  sanitizedDetail: string;
  createdAt: string;
}>;

const TRANSCRIPT_ID_PATTERN = /^exec-runner-transcript:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const REFERENCE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const CORRELATION_ID_PATTERN = /^corr:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

const FORBIDDEN_TRANSCRIPT_KEYS = new Set([
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

export function isSocialExecutionRunnerSupportedPlatform(
  platform: string,
): platform is SocialExecutionRunnerSupportedPlatform {
  return (SOCIAL_EXECUTION_RUNNER_SUPPORTED_PLATFORMS as readonly string[]).includes(platform);
}

export function validateExecutionRunnerTranscriptRecord(
  record: unknown,
  pathPrefix = "transcript",
): SocialExecutionRunnerValidationResult {
  const errors: SocialExecutionRunnerValidationError[] = [];

  if (!record || typeof record !== "object") {
    return invalid("runner_version_invalid", pathPrefix, "Runner transcript must be an object.");
  }

  const candidate = record as Record<string, unknown>;
  rejectForbiddenKeys(candidate, pathPrefix, errors);

  if (candidate.runnerVersion !== SOCIAL_EXECUTION_RUNNER_VERSION) {
    errors.push({
      code: "runner_version_invalid",
      path: `${pathPrefix}.runnerVersion`,
      message: "Runner transcript version is invalid.",
    });
  }

  if (!hasMatchingText(candidate.transcriptId, TRANSCRIPT_ID_PATTERN)) {
    errors.push({
      code: "transcript_id_required",
      path: `${pathPrefix}.transcriptId`,
      message: "Runner transcript id is required.",
    });
  }

  if (!hasMatchingText(candidate.attemptId, REFERENCE_ID_PATTERN)) {
    errors.push({
      code: "attempt_id_required",
      path: `${pathPrefix}.attemptId`,
      message: "Runner transcript attempt id is required.",
    });
  }

  if (!hasMatchingText(candidate.correlationId, CORRELATION_ID_PATTERN)) {
    errors.push({
      code: "correlation_id_required",
      path: `${pathPrefix}.correlationId`,
      message: "Runner transcript correlation id is required.",
    });
  }

  if (
    !SOCIAL_EXECUTION_RUNNER_OUTCOME_STATUSES.includes(
      candidate.outcomeStatus as SocialExecutionRunnerOutcomeStatus,
    )
  ) {
    errors.push({
      code: "outcome_status_invalid",
      path: `${pathPrefix}.outcomeStatus`,
      message: "Runner transcript outcome status is invalid.",
    });
  }

  if (
    typeof candidate.platform !== "string" ||
    !isSocialExecutionRunnerSupportedPlatform(candidate.platform)
  ) {
    errors.push({
      code: "platform_invalid",
      path: `${pathPrefix}.platform`,
      message: "Runner transcript platform must be facebook or instagram.",
    });
  }

  if (!hasText(candidate.sanitizedSummary)) {
    errors.push({
      code: "sanitized_summary_required",
      path: `${pathPrefix}.sanitizedSummary`,
      message: "Runner transcript sanitized summary is required.",
    });
  }

  if (candidate.grantsExecutionPermission !== false) {
    errors.push({
      code: "grants_execution_permission_forbidden",
      path: `${pathPrefix}.grantsExecutionPermission`,
      message: "Runner transcript must not grant execution permission.",
    });
  }

  if (candidate.provesExecution !== false) {
    errors.push({
      code: "proves_execution_forbidden",
      path: `${pathPrefix}.provesExecution`,
      message: "Runner transcript must not prove execution.",
    });
  }

  if (candidate.simulatedOnly !== true) {
    errors.push({
      code: "simulated_only_required",
      path: `${pathPrefix}.simulatedOnly`,
      message: "Runner transcript must remain simulated only.",
    });
  }

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

export function detectForbiddenExecutionRunnerState(input: unknown): Readonly<{
  forbidden: boolean;
  diagnostics: readonly SocialExecutionRunnerValidationError[];
}> {
  const validation = validateExecutionRunnerTranscriptRecord(input, "runner");
  return {
    forbidden: !validation.ok,
    diagnostics: validation.ok ? [] : validation.errors,
  };
}

function rejectForbiddenKeys(
  value: Record<string, unknown>,
  path: string,
  errors: SocialExecutionRunnerValidationError[],
): void {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_TRANSCRIPT_KEYS.has(key.toLowerCase())) {
      errors.push({
        code: "forbidden_key_detected",
        path: `${path}.${key}`,
        message: `Forbidden runner transcript key detected: ${key}.`,
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
  code: SocialExecutionRunnerValidationErrorCode,
  path: string,
  message: string,
): SocialExecutionRunnerValidationResult {
  return { ok: false, errors: [{ code, path, message }] };
}
