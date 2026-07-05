import {
  SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
  type SocialExecutionAuthorizationDerivedState,
} from "./social-execution-authorization-domain";

export const SOCIAL_EXECUTION_RUNTIME_SESSION_VERSION =
  SOCIAL_EXECUTION_AUTHORIZATION_VERSION;

export const SOCIAL_EXECUTION_RUNTIME_SESSION_STATUSES = [
  "active",
  "expired",
  "cancelled",
] as const;

export const SOCIAL_EXECUTION_RUNTIME_SESSION_VALIDATION_ERROR_CODES = [
  "session_version_invalid",
  "session_id_required",
  "authorization_id_required",
  "correlation_id_required",
  "runtime_status_required",
  "runtime_status_unknown",
  "runtime_status_transition_invalid",
  "created_at_required",
  "created_at_invalid",
  "expires_at_required",
  "expires_at_invalid",
  "expires_at_before_created_at",
  "mutable_session_forbidden",
  "grants_execution_permission_forbidden",
  "background_worker_forbidden",
] as const;

export type SocialExecutionRuntimeSessionStatus =
  (typeof SOCIAL_EXECUTION_RUNTIME_SESSION_STATUSES)[number];

export type SocialExecutionRuntimeSessionValidationErrorCode =
  (typeof SOCIAL_EXECUTION_RUNTIME_SESSION_VALIDATION_ERROR_CODES)[number];

export type SocialExecutionRuntimeSessionValidationError = Readonly<{
  code: SocialExecutionRuntimeSessionValidationErrorCode;
  path: string;
  message: string;
}>;

export type SocialExecutionRuntimeSessionValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly SocialExecutionRuntimeSessionValidationError[] }
>;

export type SocialExecutionRuntimeSessionRecord = Readonly<{
  sessionVersion: typeof SOCIAL_EXECUTION_RUNTIME_SESSION_VERSION;
  sessionId: string;
  authorizationId: string;
  correlationId: string;
  runtimeStatus: "active";
  createdAt: string;
  expiresAt: string;
  publicationTargetId: string;
  executionIntentId: string;
  metadataOnly: true;
  appendOnly: true;
  immutable: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  backgroundWorkersForbidden: true;
}>;

const SESSION_ID_PATTERN = /^exec-runtime-session:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const REFERENCE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

export function validateExecutionRuntimeSessionRecord(
  record: SocialExecutionRuntimeSessionRecord,
  path = "session",
): SocialExecutionRuntimeSessionValidationResult {
  const errors: SocialExecutionRuntimeSessionValidationError[] = [];

  if (record.sessionVersion !== SOCIAL_EXECUTION_RUNTIME_SESSION_VERSION) {
    errors.push({
      code: "session_version_invalid",
      path: `${path}.sessionVersion`,
      message: "Execution runtime session version is invalid.",
    });
  }

  requireText(record.sessionId, `${path}.sessionId`, "session_id_required", errors);
  if (record.sessionId && !SESSION_ID_PATTERN.test(record.sessionId)) {
    errors.push({
      code: "session_id_required",
      path: `${path}.sessionId`,
      message: "Execution runtime session id format is invalid.",
    });
  }

  requireReference(record.authorizationId, `${path}.authorizationId`, "authorization_id_required", errors);
  requireText(record.correlationId, `${path}.correlationId`, "correlation_id_required", errors);
  requireReference(record.publicationTargetId, `${path}.publicationTargetId`, "authorization_id_required", errors);
  requireReference(record.executionIntentId, `${path}.executionIntentId`, "authorization_id_required", errors);

  if (record.runtimeStatus !== "active") {
    errors.push({
      code: "runtime_status_unknown",
      path: `${path}.runtimeStatus`,
      message: "Persisted execution runtime sessions must remain in active status.",
    });
  }

  requireTimestamp(record.createdAt, `${path}.createdAt`, "created_at_required", "created_at_invalid", errors);
  requireTimestamp(record.expiresAt, `${path}.expiresAt`, "expires_at_required", "expires_at_invalid", errors);
  if (record.createdAt && record.expiresAt && Date.parse(record.expiresAt) <= Date.parse(record.createdAt)) {
    errors.push({
      code: "expires_at_before_created_at",
      path: `${path}.expiresAt`,
      message: "Execution runtime session expiration must be after creation timestamp.",
    });
  }

  if (!record.appendOnly || !record.immutable || !record.metadataOnly) {
    errors.push({
      code: "mutable_session_forbidden",
      path,
      message: "Execution runtime session records must remain metadata-only, append-only, and immutable.",
    });
  }

  if (record.grantsExecutionPermission || !record.backgroundWorkersForbidden) {
    errors.push({
      code: "background_worker_forbidden",
      path,
      message: "Execution runtime sessions must not grant execution permission or background workers.",
    });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [] };
}

export function deriveExecutionRuntimeSessionStatus(input: {
  session: SocialExecutionRuntimeSessionRecord | null;
  derivedAuthorizationState: SocialExecutionAuthorizationDerivedState;
  now?: Date;
}): SocialExecutionRuntimeSessionStatus | "missing" {
  if (!input.session) return "missing";

  if (input.derivedAuthorizationState === "cancelled") return "cancelled";

  const nowMs = (input.now ?? new Date()).getTime();
  if (
    input.derivedAuthorizationState === "expired" ||
    Date.parse(input.session.expiresAt) <= nowMs
  ) {
    return "expired";
  }

  return "active";
}

export function isValidRuntimeSessionStatusTransition(
  from: SocialExecutionRuntimeSessionStatus | "missing",
  to: SocialExecutionRuntimeSessionStatus | "missing",
): boolean {
  const allowed: Record<string, readonly (SocialExecutionRuntimeSessionStatus | "missing")[]> = {
    missing: ["active"],
    active: ["expired", "cancelled"],
    expired: [],
    cancelled: [],
  };

  return (allowed[from] ?? []).includes(to);
}

function requireText(
  value: string,
  path: string,
  code: SocialExecutionRuntimeSessionValidationErrorCode,
  errors: SocialExecutionRuntimeSessionValidationError[],
): void {
  if (typeof value !== "string" || !value.trim()) {
    errors.push({ code, path, message: `${path} is required.` });
  }
}

function requireReference(
  value: string,
  path: string,
  code: SocialExecutionRuntimeSessionValidationErrorCode,
  errors: SocialExecutionRuntimeSessionValidationError[],
): void {
  requireText(value, path, code, errors);
  if (value && !REFERENCE_ID_PATTERN.test(value)) {
    errors.push({
      code: "authorization_id_required",
      path,
      message: `${path} format is invalid.`,
    });
  }
}

function requireTimestamp(
  value: string,
  path: string,
  requiredCode: SocialExecutionRuntimeSessionValidationErrorCode,
  invalidCode: SocialExecutionRuntimeSessionValidationErrorCode,
  errors: SocialExecutionRuntimeSessionValidationError[],
): void {
  requireText(value, path, requiredCode, errors);
  if (value && Number.isNaN(Date.parse(value))) {
    errors.push({ code: invalidCode, path, message: `${path} must be a valid ISO timestamp.` });
  }
}
