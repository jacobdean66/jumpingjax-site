export const SOCIAL_EXECUTION_AUTHORIZATION_VERSION = "d16-w5-v1" as const;

export const SOCIAL_EXECUTION_AUTHORIZATION_STATES = [
  "authorized",
  "cancelled",
  "expired",
] as const;

export const SOCIAL_EXECUTION_AUTHORIZATION_SCOPES = [
  "publication_target_execution",
] as const;

export const SOCIAL_EXECUTION_AUTHORIZATION_VALIDATION_ERROR_CODES = [
  "authorization_version_invalid",
  "authorization_id_required",
  "authorization_identity_required",
  "authorization_identity_duplicate",
  "authorization_identity_invalid",
  "authorization_scope_required",
  "authorization_scope_unknown",
  "authorization_state_required",
  "authorization_state_unknown",
  "authorization_state_transition_invalid",
  "owner_approval_id_required",
  "publication_target_id_required",
  "execution_intent_id_required",
  "correlation_id_required",
  "authorized_at_required",
  "authorized_at_invalid",
  "expires_at_required",
  "expires_at_invalid",
  "expires_at_before_authorized_at",
  "mutable_authorization_forbidden",
  "admin_actor_id_required",
  "created_at_required",
  "created_at_invalid",
  "append_only_violation",
  "grants_execution_permission_forbidden",
  "contains_secrets_forbidden",
] as const;

export type SocialExecutionAuthorizationState =
  (typeof SOCIAL_EXECUTION_AUTHORIZATION_STATES)[number];

export type SocialExecutionAuthorizationScopeKind =
  (typeof SOCIAL_EXECUTION_AUTHORIZATION_SCOPES)[number];

export type SocialExecutionAuthorizationValidationErrorCode =
  (typeof SOCIAL_EXECUTION_AUTHORIZATION_VALIDATION_ERROR_CODES)[number];

export type SocialExecutionAuthorizationValidationError = Readonly<{
  code: SocialExecutionAuthorizationValidationErrorCode;
  path: string;
  message: string;
}>;

export type SocialExecutionAuthorizationValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly SocialExecutionAuthorizationValidationError[] }
>;

export type SocialExecutionAuthorizationScope = Readonly<{
  scopeKind: SocialExecutionAuthorizationScopeKind;
  executionIntentId: string;
  publicationTargetId: string;
  ownerApprovalId: string;
  approvalId: string | null;
  socialPostId: string | null;
}>;

export type SocialExecutionAuthorizationRecord = Readonly<{
  authorizationVersion: typeof SOCIAL_EXECUTION_AUTHORIZATION_VERSION;
  authorizationId: string;
  authorizationIdentity: string;
  scope: SocialExecutionAuthorizationScope;
  authorizationState: "authorized";
  correlationId: string;
  authorizedAt: string;
  expiresAt: string;
  ownerApprovalId: string;
  publicationTargetId: string;
  executionIntentId: string;
  adminActorId: string;
  createdAt: string;
  appendOnly: true;
  immutable: true;
  containsSecrets: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  authorizesFutureExecutionOnly: true;
}>;

export type SocialExecutionAuthorizationCancellationRecord = Readonly<{
  cancellationId: string;
  authorizationId: string;
  authorizationIdentity: string;
  correlationId: string;
  cancelledAt: string;
  adminActorId: string;
  sanitizedDetail: string;
  createdAt: string;
  appendOnly: true;
  immutable: true;
  containsSecrets: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialExecutionAuthorizationDerivedState =
  | "missing"
  | "valid"
  | "expired"
  | "cancelled";

const AUTHORIZATION_ID_PATTERN = /^exec-auth:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const CORRELATION_ID_PATTERN = /^corr:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const REFERENCE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

export function buildExecutionAuthorizationIdentity(input: {
  executionIntentId: string;
  publicationTargetId: string;
}): string {
  return `exec-auth-id:${input.executionIntentId}:${input.publicationTargetId}`;
}

export function validateExecutionAuthorizationScope(
  scope: SocialExecutionAuthorizationScope,
  path = "scope",
): SocialExecutionAuthorizationValidationError[] {
  const errors: SocialExecutionAuthorizationValidationError[] = [];

  if (!SOCIAL_EXECUTION_AUTHORIZATION_SCOPES.includes(scope.scopeKind)) {
    errors.push({
      code: "authorization_scope_unknown",
      path: `${path}.scopeKind`,
      message: "Execution authorization scope kind is not recognized.",
    });
  }

  requireReference(scope.executionIntentId, `${path}.executionIntentId`, "execution_intent_id_required", errors);
  requireReference(scope.publicationTargetId, `${path}.publicationTargetId`, "publication_target_id_required", errors);
  requireReference(scope.ownerApprovalId, `${path}.ownerApprovalId`, "owner_approval_id_required", errors);

  if (scope.approvalId !== null && !REFERENCE_ID_PATTERN.test(scope.approvalId)) {
    errors.push({
      code: "authorization_identity_invalid",
      path: `${path}.approvalId`,
      message: "Execution authorization approval id format is invalid.",
    });
  }

  if (scope.socialPostId !== null && !REFERENCE_ID_PATTERN.test(scope.socialPostId)) {
    errors.push({
      code: "authorization_identity_invalid",
      path: `${path}.socialPostId`,
      message: "Execution authorization social post id format is invalid.",
    });
  }

  return errors;
}

export function validateExecutionAuthorizationRecord(
  record: SocialExecutionAuthorizationRecord,
  existingIdentities: ReadonlySet<string> = new Set(),
  path = "authorization",
): SocialExecutionAuthorizationValidationResult {
  const errors: SocialExecutionAuthorizationValidationError[] = [];

  if (record.authorizationVersion !== SOCIAL_EXECUTION_AUTHORIZATION_VERSION) {
    errors.push({
      code: "authorization_version_invalid",
      path: `${path}.authorizationVersion`,
      message: "Execution authorization version is invalid.",
    });
  }

  requireText(record.authorizationId, `${path}.authorizationId`, "authorization_id_required", errors);
  if (record.authorizationId && !AUTHORIZATION_ID_PATTERN.test(record.authorizationId)) {
    errors.push({
      code: "authorization_identity_invalid",
      path: `${path}.authorizationId`,
      message: "Execution authorization id format is invalid.",
    });
  }

  requireText(record.authorizationIdentity, `${path}.authorizationIdentity`, "authorization_identity_required", errors);
  if (
    record.authorizationIdentity &&
    record.authorizationIdentity !==
      buildExecutionAuthorizationIdentity({
        executionIntentId: record.executionIntentId,
        publicationTargetId: record.publicationTargetId,
      })
  ) {
    errors.push({
      code: "authorization_identity_invalid",
      path: `${path}.authorizationIdentity`,
      message: "Execution authorization identity must match execution intent and publication target.",
    });
  }

  if (existingIdentities.has(record.authorizationIdentity)) {
    errors.push({
      code: "authorization_identity_duplicate",
      path: `${path}.authorizationIdentity`,
      message: "Execution authorization identity must remain unique.",
    });
  }

  errors.push(...validateExecutionAuthorizationScope(record.scope, `${path}.scope`));

  if (record.authorizationState !== "authorized") {
    errors.push({
      code: "authorization_state_unknown",
      path: `${path}.authorizationState`,
      message: "Persisted execution authorization records must remain in authorized state.",
    });
  }

  requireReference(record.ownerApprovalId, `${path}.ownerApprovalId`, "owner_approval_id_required", errors);
  requireReference(record.publicationTargetId, `${path}.publicationTargetId`, "publication_target_id_required", errors);
  requireReference(record.executionIntentId, `${path}.executionIntentId`, "execution_intent_id_required", errors);
  requireText(record.correlationId, `${path}.correlationId`, "correlation_id_required", errors);
  if (record.correlationId && !CORRELATION_ID_PATTERN.test(record.correlationId)) {
    errors.push({
      code: "authorization_identity_invalid",
      path: `${path}.correlationId`,
      message: "Execution authorization correlation id format is invalid.",
    });
  }

  requireTimestamp(record.authorizedAt, `${path}.authorizedAt`, "authorized_at_required", "authorized_at_invalid", errors);
  requireTimestamp(record.expiresAt, `${path}.expiresAt`, "expires_at_required", "expires_at_invalid", errors);
  if (record.authorizedAt && record.expiresAt && Date.parse(record.expiresAt) <= Date.parse(record.authorizedAt)) {
    errors.push({
      code: "expires_at_before_authorized_at",
      path: `${path}.expiresAt`,
      message: "Execution authorization expiration must be after authorization timestamp.",
    });
  }

  requireText(record.adminActorId, `${path}.adminActorId`, "admin_actor_id_required", errors);
  requireTimestamp(record.createdAt, `${path}.createdAt`, "created_at_required", "created_at_invalid", errors);

  if (!record.appendOnly || !record.immutable) {
    errors.push({
      code: "mutable_authorization_forbidden",
      path,
      message: "Execution authorization records must remain append-only and immutable.",
    });
  }

  if (record.grantsExecutionPermission) {
    errors.push({
      code: "grants_execution_permission_forbidden",
      path,
      message: "Execution authorization records must not grant execution permission.",
    });
  }

  if (record.containsSecrets) {
    errors.push({
      code: "contains_secrets_forbidden",
      path,
      message: "Execution authorization records must not contain secrets.",
    });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [] };
}

export function validateExecutionAuthorizationCancellationRecord(
  record: SocialExecutionAuthorizationCancellationRecord,
  path = "cancellation",
): SocialExecutionAuthorizationValidationResult {
  const errors: SocialExecutionAuthorizationValidationError[] = [];

  requireText(record.cancellationId, `${path}.cancellationId`, "authorization_id_required", errors);
  requireText(record.authorizationId, `${path}.authorizationId`, "authorization_id_required", errors);
  requireText(record.authorizationIdentity, `${path}.authorizationIdentity`, "authorization_identity_required", errors);
  requireText(record.correlationId, `${path}.correlationId`, "correlation_id_required", errors);
  requireTimestamp(record.cancelledAt, `${path}.cancelledAt`, "authorized_at_required", "authorized_at_invalid", errors);
  requireText(record.adminActorId, `${path}.adminActorId`, "admin_actor_id_required", errors);
  requireTimestamp(record.createdAt, `${path}.createdAt`, "created_at_required", "created_at_invalid", errors);

  if (!record.sanitizedDetail.trim()) {
    errors.push({
      code: "authorization_id_required",
      path: `${path}.sanitizedDetail`,
      message: "Execution authorization cancellation detail is required.",
    });
  }

  if (!record.appendOnly || !record.immutable) {
    errors.push({
      code: "mutable_authorization_forbidden",
      path,
      message: "Execution authorization cancellation records must remain append-only and immutable.",
    });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [] };
}

export function deriveExecutionAuthorizationState(input: {
  authorization: SocialExecutionAuthorizationRecord | null;
  cancellation: SocialExecutionAuthorizationCancellationRecord | null;
  now?: Date;
}): SocialExecutionAuthorizationDerivedState {
  if (!input.authorization) return "missing";
  if (input.cancellation) return "cancelled";

  const nowMs = (input.now ?? new Date()).getTime();
  if (Date.parse(input.authorization.expiresAt) <= nowMs) {
    return "expired";
  }

  return "valid";
}

export function isValidAuthorizationStateTransition(input: {
  from: SocialExecutionAuthorizationDerivedState | "requested";
  to: SocialExecutionAuthorizationDerivedState;
}): boolean {
  const allowed: Record<string, readonly SocialExecutionAuthorizationDerivedState[]> = {
    requested: ["valid", "missing"],
    missing: ["valid"],
    valid: ["cancelled", "expired"],
    cancelled: [],
    expired: [],
  };

  return (allowed[input.from] ?? []).includes(input.to);
}

function requireText(
  value: string,
  path: string,
  code: SocialExecutionAuthorizationValidationErrorCode,
  errors: SocialExecutionAuthorizationValidationError[],
): void {
  if (typeof value !== "string" || !value.trim()) {
    errors.push({ code, path, message: `${path} is required.` });
  }
}

function requireReference(
  value: string,
  path: string,
  code: SocialExecutionAuthorizationValidationErrorCode,
  errors: SocialExecutionAuthorizationValidationError[],
): void {
  requireText(value, path, code, errors);
  if (value && !REFERENCE_ID_PATTERN.test(value)) {
    errors.push({
      code: "authorization_identity_invalid",
      path,
      message: `${path} format is invalid.`,
    });
  }
}

function requireTimestamp(
  value: string,
  path: string,
  requiredCode: SocialExecutionAuthorizationValidationErrorCode,
  invalidCode: SocialExecutionAuthorizationValidationErrorCode,
  errors: SocialExecutionAuthorizationValidationError[],
): void {
  requireText(value, path, requiredCode, errors);
  if (value && Number.isNaN(Date.parse(value))) {
    errors.push({ code: invalidCode, path, message: `${path} must be a valid ISO timestamp.` });
  }
}
