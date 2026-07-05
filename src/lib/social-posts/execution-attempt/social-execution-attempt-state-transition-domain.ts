import { SOCIAL_EXECUTION_ATTEMPT_VERSION } from "./social-execution-attempt-domain";
import {
  SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_STATES,
  type SocialExecutionAttemptLifecycleState,
} from "./social-execution-attempt-lifecycle-domain";

export const SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VERSION = "d16-w8-v1" as const;

export const SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_KINDS = [
  "attempt_created",
  "attempt_prepared",
  "attempt_expired",
  "attempt_cancelled",
  "attempt_superseded",
  "authorization_subordinate_expiry",
  "session_subordinate_expiry",
  "evidence_aligned",
  "operator_noted",
] as const;

export const SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VALIDATION_ERROR_CODES = [
  "transition_version_invalid",
  "transition_id_required",
  "transition_id_invalid",
  "attempt_id_required",
  "attempt_id_invalid",
  "correlation_id_required",
  "correlation_id_invalid",
  "transition_kind_unknown",
  "from_state_unknown",
  "to_state_unknown",
  "transition_invalid",
  "evidence_id_invalid",
  "created_at_required",
  "created_at_invalid",
  "mutable_transition_forbidden",
  "grants_execution_permission_forbidden",
] as const;

export type SocialExecutionAttemptStateTransitionKind =
  (typeof SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_KINDS)[number];

export type SocialExecutionAttemptStateTransitionEndpoint =
  | SocialExecutionAttemptLifecycleState
  | "missing";

export type SocialExecutionAttemptStateTransitionValidationErrorCode =
  (typeof SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VALIDATION_ERROR_CODES)[number];

export type SocialExecutionAttemptStateTransitionValidationError = Readonly<{
  code: SocialExecutionAttemptStateTransitionValidationErrorCode;
  path: string;
  message: string;
}>;

export type SocialExecutionAttemptStateTransitionValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly SocialExecutionAttemptStateTransitionValidationError[] }
>;

export type SocialExecutionAttemptStateTransitionRecord = Readonly<{
  transitionVersion: typeof SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VERSION;
  transitionId: string;
  attemptId: string;
  correlationId: string;
  fromState: SocialExecutionAttemptStateTransitionEndpoint;
  toState: SocialExecutionAttemptLifecycleState;
  transitionKind: SocialExecutionAttemptStateTransitionKind;
  evidenceId: string | null;
  createdAt: string;
  appendOnly: true;
  immutable: true;
  metadataOnly: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

const TRANSITION_ID_PATTERN = /^exec-attempt-transition:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const ATTEMPT_ID_PATTERN = /^exec-attempt:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const CORRELATION_ID_PATTERN = /^corr:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const EVIDENCE_ID_PATTERN = /^exec-attempt-evidence:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

const ALLOWED_TRANSITIONS: Record<
  SocialExecutionAttemptStateTransitionEndpoint,
  readonly SocialExecutionAttemptLifecycleState[]
> = {
  missing: ["created"],
  created: ["prepared", "expired", "cancelled", "superseded"],
  prepared: ["expired", "cancelled", "superseded"],
  expired: [],
  cancelled: [],
  superseded: [],
};

const TRANSITION_KIND_TARGETS: Record<
  SocialExecutionAttemptStateTransitionKind,
  SocialExecutionAttemptLifecycleState
> = {
  attempt_created: "created",
  attempt_prepared: "prepared",
  attempt_expired: "expired",
  attempt_cancelled: "cancelled",
  attempt_superseded: "superseded",
  authorization_subordinate_expiry: "expired",
  session_subordinate_expiry: "expired",
  evidence_aligned: "prepared",
  operator_noted: "created",
};

export function buildExecutionAttemptStateTransitionId(seed: string): string {
  return `exec-attempt-transition:${seed}`;
}

export function isValidExecutionAttemptStateTransition(
  from: SocialExecutionAttemptStateTransitionEndpoint,
  to: SocialExecutionAttemptLifecycleState,
): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function validateExecutionAttemptStateTransitionRecord(
  record: SocialExecutionAttemptStateTransitionRecord,
  path = "transition",
): SocialExecutionAttemptStateTransitionValidationResult {
  const errors: SocialExecutionAttemptStateTransitionValidationError[] = [];

  if (record.transitionVersion !== SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VERSION) {
    errors.push({
      code: "transition_version_invalid",
      path: `${path}.transitionVersion`,
      message: "Execution attempt state transition version is invalid.",
    });
  }

  requireText(record.transitionId, `${path}.transitionId`, "transition_id_required", errors);
  if (record.transitionId && !TRANSITION_ID_PATTERN.test(record.transitionId)) {
    errors.push({
      code: "transition_id_invalid",
      path: `${path}.transitionId`,
      message: "Execution attempt state transition id format is invalid.",
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

  if (!SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_KINDS.includes(record.transitionKind)) {
    errors.push({
      code: "transition_kind_unknown",
      path: `${path}.transitionKind`,
      message: "Execution attempt state transition kind is not recognized.",
    });
  }

  if (
    record.fromState !== "missing" &&
    !SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_STATES.includes(record.fromState)
  ) {
    errors.push({
      code: "from_state_unknown",
      path: `${path}.fromState`,
      message: "Execution attempt state transition from-state is not recognized.",
    });
  }

  if (!SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_STATES.includes(record.toState)) {
    errors.push({
      code: "to_state_unknown",
      path: `${path}.toState`,
      message: "Execution attempt state transition to-state is not recognized.",
    });
  }

  if (!isValidExecutionAttemptStateTransition(record.fromState, record.toState)) {
    errors.push({
      code: "transition_invalid",
      path: `${path}.toState`,
      message: `Invalid execution attempt state transition from ${record.fromState} to ${record.toState}.`,
    });
  }

  if (record.evidenceId !== null && !EVIDENCE_ID_PATTERN.test(record.evidenceId)) {
    errors.push({
      code: "evidence_id_invalid",
      path: `${path}.evidenceId`,
      message: "Execution attempt evidence id format is invalid.",
    });
  }

  requireTimestamp(record.createdAt, `${path}.createdAt`, errors);

  if (!record.appendOnly || !record.immutable || !record.metadataOnly) {
    errors.push({
      code: "mutable_transition_forbidden",
      path,
      message: "Execution attempt state transitions must remain metadata-only, append-only, and immutable.",
    });
  }

  if (record.grantsExecutionPermission) {
    errors.push({
      code: "grants_execution_permission_forbidden",
      path,
      message: "Execution attempt state transitions must not grant execution permission.",
    });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [] };
}

export function validateExecutionAttemptStateTransitionSequence(
  transitions: readonly SocialExecutionAttemptStateTransitionRecord[],
): SocialExecutionAttemptStateTransitionValidationError[] {
  const errors: SocialExecutionAttemptStateTransitionValidationError[] = [];
  const ordered = [...transitions].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (!isValidExecutionAttemptStateTransition(previous.toState, current.toState)) {
      errors.push({
        code: "transition_invalid",
        path: `transitions.${index}.toState`,
        message: `Invalid execution attempt state transition sequence from ${previous.toState} to ${current.toState}.`,
      });
    }
  }

  if (ordered.length > 0 && ordered[0]?.fromState !== "missing") {
    errors.push({
      code: "transition_invalid",
      path: "transitions.0.fromState",
      message: "Execution attempt state transition history must begin from missing state.",
    });
  }

  return errors;
}

export function resolveTransitionKindTargetState(
  kind: SocialExecutionAttemptStateTransitionKind,
): SocialExecutionAttemptLifecycleState {
  return TRANSITION_KIND_TARGETS[kind];
}

export function isExecutionAttemptStateTransitionSubordinateToAttemptVersion(
  attemptVersion: typeof SOCIAL_EXECUTION_ATTEMPT_VERSION,
): boolean {
  return attemptVersion === SOCIAL_EXECUTION_ATTEMPT_VERSION;
}

function requireText(
  value: string,
  path: string,
  code: SocialExecutionAttemptStateTransitionValidationErrorCode,
  errors: SocialExecutionAttemptStateTransitionValidationError[],
): void {
  if (typeof value !== "string" || !value.trim()) {
    errors.push({ code, path, message: `${path} is required.` });
  }
}

function requireTimestamp(
  value: string,
  path: string,
  errors: SocialExecutionAttemptStateTransitionValidationError[],
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
