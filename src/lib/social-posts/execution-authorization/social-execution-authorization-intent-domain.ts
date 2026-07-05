import {
  SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
  type SocialExecutionAuthorizationDerivedState,
  isValidAuthorizationStateTransition,
} from "./social-execution-authorization-domain";

export const SOCIAL_EXECUTION_AUTHORIZATION_INTENT_VERSION =
  SOCIAL_EXECUTION_AUTHORIZATION_VERSION;

export const SOCIAL_EXECUTION_AUTHORIZATION_INTENT_STATES = [
  "requested_execution",
  "authorized_execution",
  "cancelled_execution",
  "expired_execution",
] as const;

export const SOCIAL_EXECUTION_AUTHORIZATION_INTENT_VALIDATION_ERROR_CODES = [
  "intent_version_invalid",
  "intent_record_id_required",
  "execution_intent_id_required",
  "authorization_id_required",
  "correlation_id_required",
  "intent_state_required",
  "intent_state_unknown",
  "intent_state_transition_invalid",
  "created_at_required",
  "created_at_invalid",
  "mutable_intent_forbidden",
  "grants_execution_permission_forbidden",
] as const;

export type SocialExecutionAuthorizationIntentState =
  (typeof SOCIAL_EXECUTION_AUTHORIZATION_INTENT_STATES)[number];

export type SocialExecutionAuthorizationIntentValidationErrorCode =
  (typeof SOCIAL_EXECUTION_AUTHORIZATION_INTENT_VALIDATION_ERROR_CODES)[number];

export type SocialExecutionAuthorizationIntentValidationError = Readonly<{
  code: SocialExecutionAuthorizationIntentValidationErrorCode;
  path: string;
  message: string;
}>;

export type SocialExecutionAuthorizationIntentValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly SocialExecutionAuthorizationIntentValidationError[] }
>;

export type SocialExecutionAuthorizationIntentRecord = Readonly<{
  intentVersion: typeof SOCIAL_EXECUTION_AUTHORIZATION_INTENT_VERSION;
  intentRecordId: string;
  executionIntentId: string;
  authorizationId: string | null;
  correlationId: string;
  intentState: SocialExecutionAuthorizationIntentState;
  publicationTargetId: string;
  ownerApprovalId: string;
  createdAt: string;
  appendOnly: true;
  immutable: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

const INTENT_RECORD_ID_PATTERN = /^exec-auth-intent:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const REFERENCE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

const INTENT_TRANSITIONS: Record<
  SocialExecutionAuthorizationIntentState,
  readonly SocialExecutionAuthorizationIntentState[]
> = {
  requested_execution: ["authorized_execution"],
  authorized_execution: ["cancelled_execution", "expired_execution"],
  cancelled_execution: [],
  expired_execution: [],
};

export function validateExecutionAuthorizationIntentRecord(
  record: SocialExecutionAuthorizationIntentRecord,
  path = "intent",
): SocialExecutionAuthorizationIntentValidationResult {
  const errors: SocialExecutionAuthorizationIntentValidationError[] = [];

  if (record.intentVersion !== SOCIAL_EXECUTION_AUTHORIZATION_INTENT_VERSION) {
    errors.push({
      code: "intent_version_invalid",
      path: `${path}.intentVersion`,
      message: "Execution authorization intent version is invalid.",
    });
  }

  requireText(record.intentRecordId, `${path}.intentRecordId`, "intent_record_id_required", errors);
  if (record.intentRecordId && !INTENT_RECORD_ID_PATTERN.test(record.intentRecordId)) {
    errors.push({
      code: "intent_record_id_required",
      path: `${path}.intentRecordId`,
      message: "Execution authorization intent record id format is invalid.",
    });
  }

  requireReference(record.executionIntentId, `${path}.executionIntentId`, "execution_intent_id_required", errors);
  requireReference(record.publicationTargetId, `${path}.publicationTargetId`, "execution_intent_id_required", errors);
  requireReference(record.ownerApprovalId, `${path}.ownerApprovalId`, "execution_intent_id_required", errors);
  requireText(record.correlationId, `${path}.correlationId`, "correlation_id_required", errors);

  if (!SOCIAL_EXECUTION_AUTHORIZATION_INTENT_STATES.includes(record.intentState)) {
    errors.push({
      code: "intent_state_unknown",
      path: `${path}.intentState`,
      message: "Execution authorization intent state is not recognized.",
    });
  }

  if (record.intentState === "requested_execution" && record.authorizationId !== null) {
    errors.push({
      code: "intent_state_transition_invalid",
      path: `${path}.authorizationId`,
      message: "Requested execution intent must not reference an authorization id yet.",
    });
  }

  if (record.intentState !== "requested_execution" && !record.authorizationId) {
    errors.push({
      code: "authorization_id_required",
      path: `${path}.authorizationId`,
      message: "Non-requested execution authorization intent requires an authorization id.",
    });
  }

  requireTimestamp(record.createdAt, `${path}.createdAt`, errors);

  if (!record.appendOnly || !record.immutable) {
    errors.push({
      code: "mutable_intent_forbidden",
      path,
      message: "Execution authorization intent records must remain append-only and immutable.",
    });
  }

  if (record.grantsExecutionPermission) {
    errors.push({
      code: "grants_execution_permission_forbidden",
      path,
      message: "Execution authorization intent records must not grant execution permission.",
    });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [] };
}

export function isValidExecutionAuthorizationIntentTransition(
  from: SocialExecutionAuthorizationIntentState,
  to: SocialExecutionAuthorizationIntentState,
): boolean {
  return (INTENT_TRANSITIONS[from] ?? []).includes(to);
}

export function deriveExecutionAuthorizationIntentState(input: {
  records: readonly SocialExecutionAuthorizationIntentRecord[];
  derivedAuthorizationState: SocialExecutionAuthorizationDerivedState;
}): SocialExecutionAuthorizationIntentState | "missing" {
  if (input.records.length === 0) {
    return input.derivedAuthorizationState === "missing" ? "missing" : "requested_execution";
  }

  const latest = [...input.records].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )[0];

  if (input.derivedAuthorizationState === "expired" && latest.intentState === "authorized_execution") {
    return "expired_execution";
  }

  return latest.intentState;
}

export function validateIntentTransitionSequence(
  records: readonly SocialExecutionAuthorizationIntentRecord[],
): SocialExecutionAuthorizationIntentValidationError[] {
  const errors: SocialExecutionAuthorizationIntentValidationError[] = [];
  const ordered = [...records].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (!isValidExecutionAuthorizationIntentTransition(previous.intentState, current.intentState)) {
      errors.push({
        code: "intent_state_transition_invalid",
        path: `intent.${index}.intentState`,
        message: `Invalid execution authorization intent transition from ${previous.intentState} to ${current.intentState}.`,
      });
    }
  }

  return errors;
}

export function mapDerivedAuthorizationStateToIntentState(
  state: SocialExecutionAuthorizationDerivedState,
): SocialExecutionAuthorizationIntentState | "missing" {
  switch (state) {
    case "missing":
      return "missing";
    case "valid":
      return "authorized_execution";
    case "cancelled":
      return "cancelled_execution";
    case "expired":
      return "expired_execution";
  }
}

export function validateDerivedAuthorizationIntentAlignment(input: {
  derivedAuthorizationState: SocialExecutionAuthorizationDerivedState;
  derivedIntentState: SocialExecutionAuthorizationIntentState | "missing";
}): boolean {
  if (input.derivedIntentState === "missing") {
    return input.derivedAuthorizationState === "missing";
  }

  return isValidAuthorizationStateTransition({
    from: "requested",
    to:
      input.derivedAuthorizationState === "valid"
        ? "valid"
        : input.derivedAuthorizationState,
  }) || input.derivedAuthorizationState !== "missing";
}

function requireText(
  value: string,
  path: string,
  code: SocialExecutionAuthorizationIntentValidationErrorCode,
  errors: SocialExecutionAuthorizationIntentValidationError[],
): void {
  if (typeof value !== "string" || !value.trim()) {
    errors.push({ code, path, message: `${path} is required.` });
  }
}

function requireReference(
  value: string,
  path: string,
  code: SocialExecutionAuthorizationIntentValidationErrorCode,
  errors: SocialExecutionAuthorizationIntentValidationError[],
): void {
  requireText(value, path, code, errors);
  if (value && !REFERENCE_ID_PATTERN.test(value)) {
    errors.push({
      code: "execution_intent_id_required",
      path,
      message: `${path} format is invalid.`,
    });
  }
}

function requireTimestamp(
  value: string,
  path: string,
  errors: SocialExecutionAuthorizationIntentValidationError[],
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
