import type { PublicationLedgerJsonObject } from "./social-publication-ledger";
import {
  validateSocialPublicationLedgerEvidenceRecord,
  validateSocialPublicationLedgerOutcomeRecord,
  type SocialPublicationLedgerEvidenceRecord,
  type SocialPublicationLedgerOutcomeRecord,
  type SocialPublicationLedgerPersistenceError,
  type SocialPublicationLedgerScope,
} from "./social-publication-ledger-persistence";

type UnknownRecord = Readonly<Record<string, unknown>>;

export const SOCIAL_PUBLICATION_LEDGER_INTEGRATION_KINDS = [
  "future_scheduler",
  "future_metrics",
] as const;

export const SOCIAL_PUBLICATION_LEDGER_INTEGRATION_ERROR_CODES = [
  "request_invalid",
  "response_invalid",
  "identity_invalid",
  "scope_invalid",
  "append_only_violation",
  "authority_violation",
  "computed_state_forbidden",
  "unsafe_recursive_state_forbidden",
  "lower_layer_payload_forbidden",
  "impossible_transition",
  "future_compatibility_invalid",
  "ledger_record_invalid",
] as const;

export type SocialPublicationLedgerIntegrationKind =
  (typeof SOCIAL_PUBLICATION_LEDGER_INTEGRATION_KINDS)[number];

export type SocialPublicationLedgerIntegrationErrorCode =
  (typeof SOCIAL_PUBLICATION_LEDGER_INTEGRATION_ERROR_CODES)[number];

export type SocialPublicationLedgerIntegrationError = Readonly<{
  code: SocialPublicationLedgerIntegrationErrorCode;
  path: string;
  message: string;
  persistenceErrors?: readonly SocialPublicationLedgerPersistenceError[];
}>;

export type SocialPublicationLedgerIntegrationValidationResult = Readonly<
  | {
      ok: true;
      errors: readonly [];
    }
  | {
      ok: false;
      errors: readonly SocialPublicationLedgerIntegrationError[];
    }
>;

export type SocialPublicationLedgerIntegrationResult<T> = Readonly<
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      errors: readonly SocialPublicationLedgerIntegrationError[];
    }
>;

export type SocialPublicationLedgerBoundaryIdentity = Readonly<{
  integrationRequestId: string;
  ledgerEntryId: string;
  publicationAttemptId: string;
  outcomeId: string | null;
  evidenceId: string | null;
}>;

export type SocialPublicationLedgerBoundaryAudit = Readonly<{
  requestedAt: string;
  requestedBy: SocialPublicationLedgerIntegrationKind;
  idempotencyKey: string;
}>;

export type SocialPublicationLedgerSchedulerBoundaryRequest = Readonly<{
  kind: "future_scheduler";
  identity: SocialPublicationLedgerBoundaryIdentity;
  scope: SocialPublicationLedgerScope;
  audit: SocialPublicationLedgerBoundaryAudit;
  proposedOutcome: SocialPublicationLedgerOutcomeRecord;
  schedulerContext: Readonly<{
    intent: "record_attempt_outcome";
    schedulerReference: string | null;
    sanitizedContext: PublicationLedgerJsonObject;
    containsExecutionPlan: false;
    containsSecrets: false;
    executesNothing: true;
    schedulesNothing: true;
    publishesNothing: true;
  }>;
  appendOnly: true;
  immutable: true;
  futureCompatible: true;
  grantsAuthority: false;
}>;

export type SocialPublicationLedgerMetricsBoundaryRequest = Readonly<{
  kind: "future_metrics";
  identity: SocialPublicationLedgerBoundaryIdentity;
  scope: SocialPublicationLedgerScope;
  audit: SocialPublicationLedgerBoundaryAudit;
  proposedEvidence: SocialPublicationLedgerEvidenceRecord;
  metricsContext: Readonly<{
    intent: "record_sanitized_evidence";
    observationReference: string | null;
    sanitizedObservation: PublicationLedgerJsonObject;
    containsRawMetrics: false;
    containsSecrets: false;
    recordsNoMetrics: true;
    performsNoLearning: true;
  }>;
  appendOnly: true;
  immutable: true;
  futureCompatible: true;
  grantsAuthority: false;
}>;

export type SocialPublicationLedgerIntegrationRequest =
  | SocialPublicationLedgerSchedulerBoundaryRequest
  | SocialPublicationLedgerMetricsBoundaryRequest;

export type SocialPublicationLedgerBoundaryResponse = Readonly<{
  accepted: true;
  kind: SocialPublicationLedgerIntegrationKind;
  integrationRequestId: string;
  ledgerEntryId: string;
  publicationAttemptId: string;
  outcomeId: string | null;
  evidenceId: string | null;
  validationOnly: true;
  persisted: false;
  executed: false;
  scheduled: false;
  published: false;
  metricsCollected: false;
  learningPerformed: false;
  computedOnly: true;
  authoritative: false;
}>;

const FORBIDDEN_AUTHORITY_KEYS = new Set([
  "approvalAuthority",
  "approvalDecision",
  "approvalStatus",
  "authority",
  "canApprove",
  "canCancel",
  "canPublish",
  "canRetry",
  "canSchedule",
  "grantsPublishingPermission",
  "metricsAuthority",
  "publisherAuthority",
  "schedulerAuthority",
]);

const FORBIDDEN_COMPUTED_KEYS = new Set([
  "computedPublishState",
  "computedState",
  "currentPublishStatus",
  "currentState",
  "publishStatus",
  "readModel",
  "replayState",
  "status",
]);

const FORBIDDEN_PAYLOAD_KEYS = new Set([
  "accessToken",
  "apiKey",
  "fullPayload",
  "fullResponse",
  "rawMetrics",
  "rawPayload",
  "rawResponse",
  "requestPayload",
  "responsePayload",
  "secret",
  "token",
]);

export function validateSocialPublicationLedgerIntegrationRequest(
  request: unknown,
): SocialPublicationLedgerIntegrationValidationResult {
  const errors: SocialPublicationLedgerIntegrationError[] = [];

  if (!isRecord(request)) {
    return validationResult([
      integrationError(
        "request_invalid",
        "request",
        "Integration boundary request must be an object.",
      ),
    ]);
  }

  rejectUnsafeState(request, "request", errors);
  validateBoundaryIdentity(getRecord(request, "identity"), "request.identity", errors);
  validateBoundaryAudit(getRecord(request, "audit"), "request.audit", errors);
  validateBoundaryScope(getRecord(request, "scope"), "request.scope", errors);
  validateBoundaryInvariants(request, "request", errors);

  if (request.kind === "future_scheduler") {
    validateSchedulerRequest(request, errors);
  } else if (request.kind === "future_metrics") {
    validateMetricsRequest(request, errors);
  } else {
    errors.push(
      integrationError(
        "request_invalid",
        "request.kind",
        "Integration kind must be future_scheduler or future_metrics.",
      ),
    );
  }

  return validationResult(errors);
}

export function validateSocialPublicationLedgerBoundaryResponse(
  response: unknown,
): SocialPublicationLedgerIntegrationValidationResult {
  const errors: SocialPublicationLedgerIntegrationError[] = [];

  if (!isRecord(response)) {
    return validationResult([
      integrationError(
        "response_invalid",
        "response",
        "Integration boundary response must be an object.",
      ),
    ]);
  }

  validateRequiredText(response.integrationRequestId, "response.integrationRequestId", errors);
  validateRequiredText(response.ledgerEntryId, "response.ledgerEntryId", errors);
  validateRequiredText(response.publicationAttemptId, "response.publicationAttemptId", errors);

  if (
    response.accepted !== true ||
    response.validationOnly !== true ||
    response.persisted !== false ||
    response.executed !== false ||
    response.scheduled !== false ||
    response.published !== false ||
    response.metricsCollected !== false ||
    response.learningPerformed !== false ||
    response.computedOnly !== true ||
    response.authoritative !== false
  ) {
    errors.push(
      integrationError(
        "response_invalid",
        "response",
        "Integration boundary response must remain validation-only and inert.",
      ),
    );
  }

  return validationResult(errors);
}

export function createDormantPublicationLedgerSchedulerBoundaryAdapter(): Readonly<{
  validate(
    request: unknown,
  ): SocialPublicationLedgerIntegrationValidationResult;
  previewResponse(
    request: SocialPublicationLedgerSchedulerBoundaryRequest,
  ): SocialPublicationLedgerIntegrationResult<SocialPublicationLedgerBoundaryResponse>;
}> {
  return Object.freeze({
    validate: validateSocialPublicationLedgerIntegrationRequest,
    previewResponse(request) {
      const validation = validateSocialPublicationLedgerIntegrationRequest(request);
      if (!validation.ok) return { ok: false, errors: validation.errors };
      return {
        ok: true,
        value: immutableClone(buildBoundaryResponse(request)),
      };
    },
  });
}

export function createDormantPublicationLedgerMetricsBoundaryAdapter(): Readonly<{
  validate(
    request: unknown,
  ): SocialPublicationLedgerIntegrationValidationResult;
  previewResponse(
    request: SocialPublicationLedgerMetricsBoundaryRequest,
  ): SocialPublicationLedgerIntegrationResult<SocialPublicationLedgerBoundaryResponse>;
}> {
  return Object.freeze({
    validate: validateSocialPublicationLedgerIntegrationRequest,
    previewResponse(request) {
      const validation = validateSocialPublicationLedgerIntegrationRequest(request);
      if (!validation.ok) return { ok: false, errors: validation.errors };
      return {
        ok: true,
        value: immutableClone(buildBoundaryResponse(request)),
      };
    },
  });
}

export function serializeSocialPublicationLedgerIntegrationRequest(
  request: SocialPublicationLedgerIntegrationRequest,
): string {
  const validation = validateSocialPublicationLedgerIntegrationRequest(request);
  if (!validation.ok) {
    throw new Error("Publication ledger integration request failed validation.");
  }

  return stableStringify(request);
}

export function hydrateSocialPublicationLedgerIntegrationRequest(
  serialized: string,
): SocialPublicationLedgerIntegrationResult<SocialPublicationLedgerIntegrationRequest> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    return {
      ok: false,
      errors: [
        integrationError(
          "request_invalid",
          "serialized",
          "Serialized integration request must be valid JSON.",
        ),
      ],
    };
  }

  const validation = validateSocialPublicationLedgerIntegrationRequest(parsed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return {
    ok: true,
    value: immutableClone(parsed as SocialPublicationLedgerIntegrationRequest),
  };
}

function validateSchedulerRequest(
  request: UnknownRecord,
  errors: SocialPublicationLedgerIntegrationError[],
): void {
  const context = getRecord(request, "schedulerContext");
  if (
    !context ||
    context.intent !== "record_attempt_outcome" ||
    context.containsExecutionPlan !== false ||
    context.containsSecrets !== false ||
    context.executesNothing !== true ||
    context.schedulesNothing !== true ||
    context.publishesNothing !== true
  ) {
    errors.push(
      integrationError(
        "request_invalid",
        "request.schedulerContext",
        "Scheduler boundary context must be inert and validation-only.",
      ),
    );
  }

  const validation = validateSocialPublicationLedgerOutcomeRecord(
    request.proposedOutcome,
  );
  if (!validation.ok) {
    errors.push(
      integrationError(
        "ledger_record_invalid",
        "request.proposedOutcome",
        "Scheduler boundary proposed outcome must be a valid ledger outcome.",
        validation.errors,
      ),
    );
  }

  validateRecordIdentityMatch(request, "proposedOutcome", "outcomeId", errors);
}

function validateMetricsRequest(
  request: UnknownRecord,
  errors: SocialPublicationLedgerIntegrationError[],
): void {
  const context = getRecord(request, "metricsContext");
  if (
    !context ||
    context.intent !== "record_sanitized_evidence" ||
    context.containsRawMetrics !== false ||
    context.containsSecrets !== false ||
    context.recordsNoMetrics !== true ||
    context.performsNoLearning !== true
  ) {
    errors.push(
      integrationError(
        "request_invalid",
        "request.metricsContext",
        "Metrics boundary context must contain sanitized evidence only.",
      ),
    );
  }

  const validation = validateSocialPublicationLedgerEvidenceRecord(
    request.proposedEvidence,
  );
  if (!validation.ok) {
    errors.push(
      integrationError(
        "ledger_record_invalid",
        "request.proposedEvidence",
        "Metrics boundary proposed evidence must be a valid ledger evidence record.",
        validation.errors,
      ),
    );
  }

  validateRecordIdentityMatch(request, "proposedEvidence", "evidenceId", errors);
}

function validateRecordIdentityMatch(
  request: UnknownRecord,
  recordKey: string,
  typedIdentityKey: "outcomeId" | "evidenceId",
  errors: SocialPublicationLedgerIntegrationError[],
): void {
  const identity = getRecord(request, "identity");
  const record = getRecord(request, recordKey);
  if (!identity || !record) return;

  if (identity.ledgerEntryId !== record.ledger_entry_id) {
    errors.push(
      integrationError(
        "identity_invalid",
        `request.${recordKey}.ledger_entry_id`,
        "Boundary identity must match the proposed ledger record.",
      ),
    );
  }

  if (identity.publicationAttemptId !== record.publication_attempt_id) {
    errors.push(
      integrationError(
        "identity_invalid",
        `request.${recordKey}.publication_attempt_id`,
        "Boundary attempt identity must match the proposed ledger record.",
      ),
    );
  }

  const recordIdentity =
    typedIdentityKey === "outcomeId" ? record.outcome_id : record.evidence_id;
  if (identity[typedIdentityKey] !== recordIdentity) {
    errors.push(
      integrationError(
        "identity_invalid",
        `request.${recordKey}.${typedIdentityKey}`,
        "Typed boundary identity must match the proposed ledger record.",
      ),
    );
  }
}

function validateBoundaryIdentity(
  identity: UnknownRecord | null,
  path: string,
  errors: SocialPublicationLedgerIntegrationError[],
): void {
  if (!identity) {
    errors.push(
      integrationError("identity_invalid", path, "Boundary identity is required."),
    );
    return;
  }

  validateRequiredText(identity.integrationRequestId, `${path}.integrationRequestId`, errors);
  validateRequiredText(identity.ledgerEntryId, `${path}.ledgerEntryId`, errors);
  validateRequiredText(identity.publicationAttemptId, `${path}.publicationAttemptId`, errors);
  validateOptionalText(identity.outcomeId, `${path}.outcomeId`, errors);
  validateOptionalText(identity.evidenceId, `${path}.evidenceId`, errors);

  const values = [
    identity.integrationRequestId,
    identity.ledgerEntryId,
    identity.publicationAttemptId,
    identity.outcomeId,
    identity.evidenceId,
  ].filter(hasText);
  if (new Set(values).size !== values.length) {
    errors.push(
      integrationError(
        "identity_invalid",
        path,
        "Boundary identities must remain separated.",
      ),
    );
  }
}

function validateBoundaryAudit(
  audit: UnknownRecord | null,
  path: string,
  errors: SocialPublicationLedgerIntegrationError[],
): void {
  if (!audit) {
    errors.push(integrationError("request_invalid", path, "Audit is required."));
    return;
  }

  validateRequiredText(audit.requestedAt, `${path}.requestedAt`, errors);
  validateRequiredText(audit.idempotencyKey, `${path}.idempotencyKey`, errors);
  if (
    audit.requestedBy !== "future_scheduler" &&
    audit.requestedBy !== "future_metrics"
  ) {
    errors.push(
      integrationError(
        "request_invalid",
        `${path}.requestedBy`,
        "Audit requester must be a future integration boundary.",
      ),
    );
  }
}

function validateBoundaryScope(
  scope: UnknownRecord | null,
  path: string,
  errors: SocialPublicationLedgerIntegrationError[],
): void {
  if (!scope) {
    errors.push(integrationError("scope_invalid", path, "Scope is required."));
    return;
  }

  validateRequiredText(scope.social_post_id, `${path}.social_post_id`, errors);
  validateRequiredText(scope.publication_target_id, `${path}.publication_target_id`, errors);
  validateRequiredText(scope.publication_manifest_id, `${path}.publication_manifest_id`, errors);
  validateOptionalText(scope.owner_approval_id, `${path}.owner_approval_id`, errors);
  validateOptionalText(scope.approval_id, `${path}.approval_id`, errors);
  validateOptionalText(scope.proposal_id, `${path}.proposal_id`, errors);
}

function validateBoundaryInvariants(
  request: UnknownRecord,
  path: string,
  errors: SocialPublicationLedgerIntegrationError[],
): void {
  if (
    request.appendOnly !== true ||
    request.immutable !== true ||
    request.futureCompatible !== true ||
    request.grantsAuthority !== false
  ) {
    errors.push(
      integrationError(
        "future_compatibility_invalid",
        path,
        "Integration boundary DTOs must remain immutable, append-only, and non-authoritative.",
      ),
    );
  }
}

function buildBoundaryResponse(
  request: SocialPublicationLedgerIntegrationRequest,
): SocialPublicationLedgerBoundaryResponse {
  return {
    accepted: true,
    kind: request.kind,
    integrationRequestId: request.identity.integrationRequestId,
    ledgerEntryId: request.identity.ledgerEntryId,
    publicationAttemptId: request.identity.publicationAttemptId,
    outcomeId: request.identity.outcomeId,
    evidenceId: request.identity.evidenceId,
    validationOnly: true,
    persisted: false,
    executed: false,
    scheduled: false,
    published: false,
    metricsCollected: false,
    learningPerformed: false,
    computedOnly: true,
    authoritative: false,
  };
}

function rejectUnsafeState(
  value: unknown,
  path: string,
  errors: SocialPublicationLedgerIntegrationError[],
  seen = new WeakSet<object>(),
): void {
  if (!value || typeof value !== "object") return;

  if (seen.has(value)) {
    errors.push(
      integrationError(
        "unsafe_recursive_state_forbidden",
        path,
        "Integration boundary DTOs must be acyclic JSON-shaped data.",
      ),
    );
    return;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      rejectUnsafeState(item, `${path}.${index}`, errors, seen),
    );
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_AUTHORITY_KEYS.has(key)) {
      errors.push(
        integrationError(
          "authority_violation",
          childPath,
          "Integration boundary DTOs must not carry authority fields.",
        ),
      );
    }
    if (FORBIDDEN_COMPUTED_KEYS.has(key)) {
      errors.push(
        integrationError(
          "computed_state_forbidden",
          childPath,
          "Integration boundary DTOs must not carry computed state.",
        ),
      );
    }
    if (FORBIDDEN_PAYLOAD_KEYS.has(key)) {
      errors.push(
        integrationError(
          "lower_layer_payload_forbidden",
          childPath,
          "Integration boundary DTOs must not carry raw payloads or secrets.",
        ),
      );
    }

    rejectUnsafeState(child, childPath, errors, seen);
  }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((output, key) => {
      output[key] = stableValue(value[key]);
      return output;
    }, {});
}

function immutableClone<T>(value: T): T {
  return deepFreeze(JSON.parse(JSON.stringify(value)) as T);
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function validateRequiredText(
  value: unknown,
  path: string,
  errors: SocialPublicationLedgerIntegrationError[],
): void {
  if (!hasText(value)) {
    errors.push(
      integrationError("identity_invalid", path, "Required text field is missing."),
    );
  }
}

function validateOptionalText(
  value: unknown,
  path: string,
  errors: SocialPublicationLedgerIntegrationError[],
): void {
  if (value !== null && value !== undefined && !hasText(value)) {
    errors.push(
      integrationError(
        "identity_invalid",
        path,
        "Optional identity field must be null or non-empty text.",
      ),
    );
  }
}

function validationResult(
  errors: SocialPublicationLedgerIntegrationError[],
): SocialPublicationLedgerIntegrationValidationResult {
  if (errors.length === 0) return { ok: true, errors: [] };
  return { ok: false, errors };
}

function integrationError(
  code: SocialPublicationLedgerIntegrationErrorCode,
  path: string,
  message: string,
  persistenceErrors?: readonly SocialPublicationLedgerPersistenceError[],
): SocialPublicationLedgerIntegrationError {
  return { code, path, message, persistenceErrors };
}

function getRecord(value: UnknownRecord, key: string): UnknownRecord | null {
  const child = value[key];
  return isRecord(child) ? child : null;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
