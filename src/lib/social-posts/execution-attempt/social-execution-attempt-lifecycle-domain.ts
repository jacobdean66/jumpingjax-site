import {
  SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
  type SocialExecutionAuthorizationDerivedState,
} from "../execution-authorization/social-execution-authorization-domain";
import type { SocialExecutionRuntimeSessionStatus } from "../execution-authorization/social-execution-runtime-session-domain";

export const SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_VERSION =
  SOCIAL_EXECUTION_AUTHORIZATION_VERSION;

export const SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_STATES = [
  "created",
  "prepared",
  "expired",
  "cancelled",
  "superseded",
] as const;

export const SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_VALIDATION_ERROR_CODES = [
  "lifecycle_version_invalid",
  "lifecycle_event_id_required",
  "attempt_id_required",
  "lifecycle_state_required",
  "lifecycle_state_unknown",
  "lifecycle_state_transition_invalid",
  "created_at_required",
  "created_at_invalid",
  "mutable_lifecycle_forbidden",
  "grants_execution_permission_forbidden",
  "correlation_id_required",
] as const;

export type SocialExecutionAttemptLifecycleState =
  (typeof SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_STATES)[number];

export type SocialExecutionAttemptLifecycleValidationErrorCode =
  (typeof SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_VALIDATION_ERROR_CODES)[number];

export type SocialExecutionAttemptLifecycleValidationError = Readonly<{
  code: SocialExecutionAttemptLifecycleValidationErrorCode;
  path: string;
  message: string;
}>;

export type SocialExecutionAttemptLifecycleValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly SocialExecutionAttemptLifecycleValidationError[] }
>;

export type SocialExecutionAttemptLifecycleEventRecord = Readonly<{
  lifecycleVersion: typeof SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_VERSION;
  lifecycleEventId: string;
  attemptId: string;
  correlationId: string;
  lifecycleState: SocialExecutionAttemptLifecycleState;
  createdAt: string;
  appendOnly: true;
  immutable: true;
  metadataOnly: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

const LIFECYCLE_EVENT_ID_PATTERN = /^exec-attempt-lifecycle:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const ATTEMPT_ID_PATTERN = /^exec-attempt:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

const LIFECYCLE_TRANSITIONS: Record<
  SocialExecutionAttemptLifecycleState,
  readonly SocialExecutionAttemptLifecycleState[]
> = {
  created: ["prepared", "expired", "cancelled", "superseded"],
  prepared: ["expired", "cancelled", "superseded"],
  expired: [],
  cancelled: [],
  superseded: [],
};

export function validateExecutionAttemptLifecycleEventRecord(
  record: SocialExecutionAttemptLifecycleEventRecord,
  path = "lifecycle",
): SocialExecutionAttemptLifecycleValidationResult {
  const errors: SocialExecutionAttemptLifecycleValidationError[] = [];

  if (record.lifecycleVersion !== SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_VERSION) {
    errors.push({
      code: "lifecycle_version_invalid",
      path: `${path}.lifecycleVersion`,
      message: "Execution attempt lifecycle version is invalid.",
    });
  }

  requireText(record.lifecycleEventId, `${path}.lifecycleEventId`, "lifecycle_event_id_required", errors);
  if (record.lifecycleEventId && !LIFECYCLE_EVENT_ID_PATTERN.test(record.lifecycleEventId)) {
    errors.push({
      code: "lifecycle_event_id_required",
      path: `${path}.lifecycleEventId`,
      message: "Execution attempt lifecycle event id format is invalid.",
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

  requireText(record.correlationId, `${path}.correlationId`, "correlation_id_required", errors);

  if (!SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_STATES.includes(record.lifecycleState)) {
    errors.push({
      code: "lifecycle_state_unknown",
      path: `${path}.lifecycleState`,
      message: "Execution attempt lifecycle state is not recognized.",
    });
  }

  requireTimestamp(record.createdAt, `${path}.createdAt`, errors);

  if (!record.appendOnly || !record.immutable || !record.metadataOnly) {
    errors.push({
      code: "mutable_lifecycle_forbidden",
      path,
      message: "Execution attempt lifecycle records must remain metadata-only, append-only, and immutable.",
    });
  }

  if (record.grantsExecutionPermission) {
    errors.push({
      code: "grants_execution_permission_forbidden",
      path,
      message: "Execution attempt lifecycle records must not grant execution permission.",
    });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [] };
}

export function isValidExecutionAttemptLifecycleTransition(
  from: SocialExecutionAttemptLifecycleState,
  to: SocialExecutionAttemptLifecycleState,
): boolean {
  return (LIFECYCLE_TRANSITIONS[from] ?? []).includes(to);
}

export function validateExecutionAttemptLifecycleSequence(
  events: readonly SocialExecutionAttemptLifecycleEventRecord[],
): SocialExecutionAttemptLifecycleValidationError[] {
  const errors: SocialExecutionAttemptLifecycleValidationError[] = [];
  const ordered = [...events].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (!isValidExecutionAttemptLifecycleTransition(previous.lifecycleState, current.lifecycleState)) {
      errors.push({
        code: "lifecycle_state_transition_invalid",
        path: `lifecycle.${index}.lifecycleState`,
        message: `Invalid execution attempt lifecycle transition from ${previous.lifecycleState} to ${current.lifecycleState}.`,
      });
    }
  }

  if (ordered.length > 0 && ordered[0]?.lifecycleState !== "created") {
    errors.push({
      code: "lifecycle_state_transition_invalid",
      path: "lifecycle.0.lifecycleState",
      message: "Execution attempt lifecycle history must begin with created state.",
    });
  }

  return errors;
}

export function deriveExecutionAttemptLifecycleState(input: {
  lifecycleEvents: readonly SocialExecutionAttemptLifecycleEventRecord[];
  expiresAt: string;
  derivedAuthorizationState: SocialExecutionAuthorizationDerivedState;
  derivedSessionStatus: SocialExecutionRuntimeSessionStatus | "missing";
  now?: Date;
}): SocialExecutionAttemptLifecycleState | "missing" {
  if (input.lifecycleEvents.length === 0) return "missing";

  const ordered = [...input.lifecycleEvents].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  const latest = ordered[0];

  if (latest.lifecycleState === "cancelled" || latest.lifecycleState === "superseded") {
    return latest.lifecycleState;
  }

  if (
    input.derivedAuthorizationState === "cancelled" ||
    input.derivedAuthorizationState === "expired" ||
    input.derivedSessionStatus === "expired" ||
    input.derivedSessionStatus === "cancelled"
  ) {
    if (latest.lifecycleState === "prepared") return "cancelled";
    return "expired";
  }

  const nowMs = (input.now ?? new Date()).getTime();
  if (Date.parse(input.expiresAt) <= nowMs) {
    return "expired";
  }

  return latest.lifecycleState;
}

function requireText(
  value: string,
  path: string,
  code: SocialExecutionAttemptLifecycleValidationErrorCode,
  errors: SocialExecutionAttemptLifecycleValidationError[],
): void {
  if (typeof value !== "string" || !value.trim()) {
    errors.push({ code, path, message: `${path} is required.` });
  }
}

function requireTimestamp(
  value: string,
  path: string,
  errors: SocialExecutionAttemptLifecycleValidationError[],
): void {
  requireText(value, path, "created_at_required", errors);
  if (value && Number.isNaN(Date.parse(value))) {
    errors.push({
      code: "created_at_invalid",
      path,
      message: `${path} must be a valid ISO timestamp.`,
    });
  }
}
