import type { SocialExecutionRunnerSupportedPlatform } from "../execution-runner/social-execution-runner-domain";
import {
  SOCIAL_EXECUTION_CORRELATION_ID_PATTERN,
  SOCIAL_EXECUTION_REFERENCE_ID_PATTERN,
} from "../execution-core/social-execution-core-invariants";
import {
  collectSimulatedRecordInvariantErrors,
  hasExecutionText,
  hasMatchingExecutionText,
  rejectForbiddenExecutionRecordKeys,
} from "../execution-core/social-execution-core-validation";

export const SOCIAL_EXECUTION_PLAN_VERSION = "d16-w15-v1" as const;

export const SOCIAL_EXECUTION_PLAN_SUMMARY_STATUSES = [
  "blocked",
  "planned",
  "validation_failed",
] as const;

export type SocialExecutionPlanSummaryStatus =
  (typeof SOCIAL_EXECUTION_PLAN_SUMMARY_STATUSES)[number];

export const SOCIAL_EXECUTION_PLAN_OPERATION_KINDS = [
  "dry_run_adapter_preflight",
  "dry_run_adapter_simulation",
] as const;

export type SocialExecutionPlanOperationKind =
  (typeof SOCIAL_EXECUTION_PLAN_OPERATION_KINDS)[number];

export const SOCIAL_EXECUTION_PLAN_VALIDATION_ERROR_CODES = [
  "plan_version_invalid",
  "execution_plan_id_required",
  "correlation_id_required",
  "authorization_id_required",
  "session_id_required",
  "attempt_ids_required",
  "publication_target_ids_required",
  "summary_status_invalid",
  "platform_invalid",
  "adapter_id_required",
  "execution_order_required",
  "expected_operations_required",
  "validation_summary_required",
  "planned_at_required",
  "sanitized_summary_required",
  "grants_execution_permission_forbidden",
  "proves_execution_forbidden",
  "simulated_only_required",
  "forbidden_key_detected",
] as const;

export type SocialExecutionPlanValidationErrorCode =
  (typeof SOCIAL_EXECUTION_PLAN_VALIDATION_ERROR_CODES)[number];

export type SocialExecutionPlanValidationError = Readonly<{
  code: SocialExecutionPlanValidationErrorCode;
  path: string;
  message: string;
}>;

export type SocialExecutionPlanValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly SocialExecutionPlanValidationError[] }
>;

export type SocialExecutionPlanAdapterReference = Readonly<{
  adapterId: string;
  adapterKind: string;
  displayName: string;
  dryRunAvailable: boolean;
  identityOnly: true;
  metadataOnly: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialExecutionPlanStepRecord = Readonly<{
  sequence: number;
  attemptId: string;
  publicationTargetId: string;
  platform: SocialExecutionRunnerSupportedPlatform;
  adapterId: string;
  operationKind: SocialExecutionPlanOperationKind;
  sanitizedSummary: string;
  metadataOnly: true;
  simulatedOnly: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialExecutionPlanExpectedDryRunOperation = Readonly<{
  sequence: number;
  attemptId: string;
  adapterId: string;
  operationKind: SocialExecutionPlanOperationKind;
  sanitizedSummary: string;
  metadataOnly: true;
  simulatedOnly: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialExecutionPlanValidationSummary = Readonly<{
  planReady: boolean;
  sessionPreflightReady: boolean;
  runnerPreflightReadyCount: number;
  runnerPreflightBlockedCount: number;
  blockingCodes: readonly string[];
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialExecutionPlanRecord = Readonly<{
  planVersion: typeof SOCIAL_EXECUTION_PLAN_VERSION;
  executionPlanId: string;
  correlationId: string;
  authorizationId: string;
  sessionId: string;
  attemptIds: readonly string[];
  publicationTargetIds: readonly string[];
  platform: SocialExecutionRunnerSupportedPlatform;
  adapter: SocialExecutionPlanAdapterReference;
  executionOrder: readonly SocialExecutionPlanStepRecord[];
  expectedDryRunOperations: readonly SocialExecutionPlanExpectedDryRunOperation[];
  validationSummary: SocialExecutionPlanValidationSummary;
  summaryStatus: SocialExecutionPlanSummaryStatus;
  sanitizedSummary: string;
  plannedAt: string;
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

export type SocialExecutionPlanAuditEventRecord = Readonly<{
  auditEventId: string;
  executionPlanId: string;
  sessionId: string | null;
  authorizationId: string | null;
  correlationId: string | null;
  action: "append_plan" | "plan_validation_failed" | "plan_blocked";
  outcome: SocialExecutionPlanSummaryStatus | "created";
  sanitizedDetail: string;
  createdAt: string;
}>;

const EXECUTION_PLAN_ID_PATTERN = /^exec-execution-plan:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const SESSION_ID_PATTERN = /^exec-execution-session:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const REFERENCE_ID_PATTERN = SOCIAL_EXECUTION_REFERENCE_ID_PATTERN;
const CORRELATION_ID_PATTERN = SOCIAL_EXECUTION_CORRELATION_ID_PATTERN;

export function deriveExecutionPlanSummaryStatus(input: {
  planReady: boolean;
  validationFailed: boolean;
}): SocialExecutionPlanSummaryStatus {
  if (input.validationFailed) {
    return "validation_failed";
  }

  if (!input.planReady) {
    return "blocked";
  }

  return "planned";
}

export function buildExecutionPlanOrder(
  steps: readonly SocialExecutionPlanStepRecord[],
): readonly SocialExecutionPlanStepRecord[] {
  return [...steps].sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }

    return left.attemptId.localeCompare(right.attemptId);
  });
}

export function validateExecutionPlanRecord(
  record: unknown,
  pathPrefix = "plan",
): SocialExecutionPlanValidationResult {
  const errors: SocialExecutionPlanValidationError[] = [];

  if (!record || typeof record !== "object") {
    return invalid("plan_version_invalid", pathPrefix, "Execution plan must be an object.");
  }

  const candidate = record as Record<string, unknown>;
  rejectForbiddenExecutionRecordKeys(candidate, pathPrefix, errors, "execution plan");

  if (candidate.planVersion !== SOCIAL_EXECUTION_PLAN_VERSION) {
    errors.push({
      code: "plan_version_invalid",
      path: `${pathPrefix}.planVersion`,
      message: "Execution plan version is invalid.",
    });
  }

  if (!hasMatchingExecutionText(candidate.executionPlanId, EXECUTION_PLAN_ID_PATTERN)) {
    errors.push({
      code: "execution_plan_id_required",
      path: `${pathPrefix}.executionPlanId`,
      message: "Execution plan id is required.",
    });
  }

  if (!hasMatchingExecutionText(candidate.correlationId, CORRELATION_ID_PATTERN)) {
    errors.push({
      code: "correlation_id_required",
      path: `${pathPrefix}.correlationId`,
      message: "Execution plan correlation id is required.",
    });
  }

  if (!hasMatchingExecutionText(candidate.authorizationId, REFERENCE_ID_PATTERN)) {
    errors.push({
      code: "authorization_id_required",
      path: `${pathPrefix}.authorizationId`,
      message: "Execution plan authorization id is required.",
    });
  }

  if (!hasMatchingExecutionText(candidate.sessionId, SESSION_ID_PATTERN)) {
    errors.push({
      code: "session_id_required",
      path: `${pathPrefix}.sessionId`,
      message: "Execution plan session id is required.",
    });
  }

  if (!hasStringArray(candidate.attemptIds)) {
    errors.push({
      code: "attempt_ids_required",
      path: `${pathPrefix}.attemptIds`,
      message: "Execution plan attempt ids are required.",
    });
  }

  if (!hasStringArray(candidate.publicationTargetIds)) {
    errors.push({
      code: "publication_target_ids_required",
      path: `${pathPrefix}.publicationTargetIds`,
      message: "Execution plan publication target ids are required.",
    });
  }

  if (
    !SOCIAL_EXECUTION_PLAN_SUMMARY_STATUSES.includes(
      candidate.summaryStatus as SocialExecutionPlanSummaryStatus,
    )
  ) {
    errors.push({
      code: "summary_status_invalid",
      path: `${pathPrefix}.summaryStatus`,
      message: "Execution plan summary status is invalid.",
    });
  }

  if (
    typeof candidate.platform !== "string" ||
    !["facebook", "instagram"].includes(candidate.platform)
  ) {
    errors.push({
      code: "platform_invalid",
      path: `${pathPrefix}.platform`,
      message: "Execution plan platform must be facebook or instagram.",
    });
  }

  const adapter = candidate.adapter;
  if (!adapter || typeof adapter !== "object") {
    errors.push({
      code: "adapter_id_required",
      path: `${pathPrefix}.adapter`,
      message: "Execution plan adapter reference is required.",
    });
  } else {
    const adapterRecord = adapter as Record<string, unknown>;
    if (!hasExecutionText(adapterRecord.adapterId)) {
      errors.push({
        code: "adapter_id_required",
        path: `${pathPrefix}.adapter.adapterId`,
        message: "Execution plan adapter id is required.",
      });
    }
  }

  if (!Array.isArray(candidate.executionOrder) || candidate.executionOrder.length === 0) {
    errors.push({
      code: "execution_order_required",
      path: `${pathPrefix}.executionOrder`,
      message: "Execution plan execution order is required.",
    });
  }

  if (
    !Array.isArray(candidate.expectedDryRunOperations) ||
    candidate.expectedDryRunOperations.length === 0
  ) {
    errors.push({
      code: "expected_operations_required",
      path: `${pathPrefix}.expectedDryRunOperations`,
      message: "Execution plan expected dry-run operations are required.",
    });
  }

  if (!candidate.validationSummary || typeof candidate.validationSummary !== "object") {
    errors.push({
      code: "validation_summary_required",
      path: `${pathPrefix}.validationSummary`,
      message: "Execution plan validation summary is required.",
    });
  }

  if (!hasExecutionText(candidate.plannedAt)) {
    errors.push({
      code: "planned_at_required",
      path: `${pathPrefix}.plannedAt`,
      message: "Execution plan plannedAt timestamp is required.",
    });
  }

  if (!hasExecutionText(candidate.sanitizedSummary)) {
    errors.push({
      code: "sanitized_summary_required",
      path: `${pathPrefix}.sanitizedSummary`,
      message: "Execution plan sanitized summary is required.",
    });
  }

  collectSimulatedRecordInvariantErrors(
    candidate,
    pathPrefix,
    errors,
    "Execution plan",
    { requireProvesExecutionFalse: true },
  );

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

export function detectForbiddenExecutionPlanState(input: unknown): Readonly<{
  forbidden: boolean;
  diagnostics: readonly SocialExecutionPlanValidationError[];
}> {
  const validation = validateExecutionPlanRecord(input, "plan");
  return {
    forbidden: !validation.ok,
    diagnostics: validation.ok ? [] : validation.errors,
  };
}

function hasStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => hasExecutionText(item));
}

function invalid(
  code: SocialExecutionPlanValidationErrorCode,
  path: string,
  message: string,
): SocialExecutionPlanValidationResult {
  return { ok: false, errors: [{ code, path, message }] };
}
