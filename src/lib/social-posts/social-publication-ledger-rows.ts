import {
  validateSocialPublicationLedgerAttemptRecord,
  validateSocialPublicationLedgerEvidenceRecord,
  validateSocialPublicationLedgerOutcomeRecord,
  validateSocialPublicationLedgerPersistenceModel,
  type SocialPublicationAttemptId,
  type SocialPublicationEvidenceId,
  type SocialPublicationLedgerApprovalId,
  type SocialPublicationLedgerAttemptRecord,
  type SocialPublicationLedgerEvidenceRecord,
  type SocialPublicationLedgerEntryId,
  type SocialPublicationLedgerManifestId,
  type SocialPublicationLedgerOutcomeRecord,
  type SocialPublicationLedgerOwnerApprovalId,
  type SocialPublicationLedgerPersistenceError,
  type SocialPublicationLedgerPersistenceModel,
  type SocialPublicationLedgerProposalId,
  type SocialPublicationLedgerScope,
  type SocialPublicationLedgerSocialPostId,
  type SocialPublicationLedgerTargetId,
  type SocialPublicationOutcomeId,
} from "./social-publication-ledger-persistence";
import type {
  PublicationLedgerActor,
  PublicationLedgerErrorSummary,
  PublicationLedgerEventType,
  PublicationLedgerEvidenceSummary,
  PublicationLedgerJsonObject,
  PublicationLedgerJsonValue,
  PublicationLedgerRequestSummary,
  PublicationLedgerResultSummary,
  PublicationLedgerSource,
} from "./social-publication-ledger";

type UnknownRecord = Readonly<Record<string, unknown>>;

export type SocialPublicationLedgerAttemptRow = Readonly<{
  ledger_entry_id: string;
  publication_attempt_id: string;
  attempt_sequence: number;
  event_type: string;
  social_post_id: string;
  publication_target_id: string;
  publication_manifest_id: string;
  owner_approval_id: string | null;
  approval_id: string | null;
  proposal_id: string | null;
  request_summary: PublicationLedgerJsonObject | null;
  recorded_at: string;
  recorded_by_actor: string;
  recorded_source: string;
  append_only: boolean;
  immutable: boolean;
  idempotency_key: string | null;
}>;

export type SocialPublicationLedgerOutcomeRow = Readonly<{
  ledger_entry_id: string;
  outcome_id: string;
  publication_attempt_id: string;
  attempt_sequence: number;
  event_type: string;
  social_post_id: string;
  publication_target_id: string;
  publication_manifest_id: string;
  owner_approval_id: string | null;
  approval_id: string | null;
  proposal_id: string | null;
  result_summary: PublicationLedgerJsonObject | null;
  error_summary: PublicationLedgerJsonObject | null;
  recorded_at: string;
  recorded_by_actor: string;
  recorded_source: string;
  append_only: boolean;
  immutable: boolean;
  idempotency_key: string | null;
}>;

export type SocialPublicationLedgerEvidenceRow = Readonly<{
  evidence_id: string;
  ledger_entry_id: string;
  publication_attempt_id: string;
  outcome_id: string | null;
  social_post_id: string;
  publication_target_id: string;
  publication_manifest_id: string;
  owner_approval_id: string | null;
  approval_id: string | null;
  proposal_id: string | null;
  evidence_summary: PublicationLedgerJsonObject;
  recorded_at: string;
  recorded_by_actor: string;
  recorded_source: string;
  append_only: boolean;
  immutable: boolean;
  idempotency_key: string | null;
}>;

export type SocialPublicationLedgerRowsModel = Readonly<{
  attempts: readonly SocialPublicationLedgerAttemptRow[];
  outcomes: readonly SocialPublicationLedgerOutcomeRow[];
  evidence: readonly SocialPublicationLedgerEvidenceRow[];
}>;

export const SOCIAL_PUBLICATION_LEDGER_ROW_ERROR_CODES = [
  "required_field_missing",
  "field_shape_invalid",
  "identity_invalid",
  "identity_not_separated",
  "scope_mismatch",
  "event_type_invalid",
  "attempt_sequence_invalid",
  "append_only_invariant_failed",
  "audit_field_invalid",
  "summary_shape_invalid",
  "idempotency_key_invalid",
  "relationship_invalid",
  "serialization_invalid",
  "unsafe_recursive_state_forbidden",
  "stored_computed_state_forbidden",
  "lower_layer_payload_forbidden",
  "higher_layer_authority_forbidden",
] as const;

export type SocialPublicationLedgerRowErrorCode =
  (typeof SOCIAL_PUBLICATION_LEDGER_ROW_ERROR_CODES)[number];

export type SocialPublicationLedgerRowError = Readonly<{
  code: SocialPublicationLedgerRowErrorCode;
  path: string;
  message: string;
  persistenceErrors?: readonly SocialPublicationLedgerPersistenceError[];
}>;

export type SocialPublicationLedgerRowValidationResult = Readonly<
  | {
      ok: true;
      errors: readonly [];
    }
  | {
      ok: false;
      errors: readonly SocialPublicationLedgerRowError[];
    }
>;

export type SocialPublicationLedgerRowResult<T> = Readonly<
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      errors: readonly SocialPublicationLedgerRowError[];
    }
>;

export type SocialPublicationLedgerRowOptions = Readonly<{
  idempotency_key?: string | null;
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ATTEMPT_EVENT_TYPES = new Set<string>([
  "publication_attempt_started",
  "publication_attempt_retry_started",
]);

const OUTCOME_EVENT_TYPES = new Set<string>([
  "publication_attempt_succeeded",
  "publication_attempt_failed",
  "publication_attempt_cancelled",
  "publication_attempt_retry_requested",
  "publication_attempt_retry_succeeded",
  "publication_attempt_retry_failed",
]);

const VALID_ACTORS = new Set<string>([
  "system",
  "owner",
  "admin",
  "scheduler",
  "publisher",
  "test",
]);

const VALID_SOURCES = new Set<string>([
  "publication_ledger_domain",
  "manual_admin",
  "future_scheduler",
  "future_publisher",
  "test",
]);

const FORBIDDEN_SECRET_KEYS = new Set([
  "accessToken",
  "access_token",
  "apiKey",
  "api_key",
  "clientSecret",
  "client_secret",
  "credential",
  "credentials",
  "oauth",
  "password",
  "refreshToken",
  "refresh_token",
  "secret",
  "token",
]);

const FORBIDDEN_COMPUTED_STATE_KEYS = new Set([
  "computedOnly",
  "computedState",
  "currentPublishStatus",
  "currentState",
  "isPublished",
  "publishedAt",
  "publishState",
  "publishStatus",
  "readModel",
  "replayState",
  "status",
]);

const FORBIDDEN_SCHEDULER_STATE_KEYS = new Set([
  "scheduledAt",
  "scheduledFor",
  "schedulerJobId",
  "schedulerState",
  "scheduleState",
]);

const FORBIDDEN_METRICS_STATE_KEYS = new Set([
  "analytics",
  "clicks",
  "engagement",
  "impressions",
  "metrics",
  "reach",
]);

const FORBIDDEN_LEARNING_STATE_KEYS = new Set([
  "campaignMemory",
  "learning",
  "learningSignal",
  "modelFeedback",
]);

const FORBIDDEN_LOWER_LAYER_PAYLOAD_KEYS = new Set([
  "approvalRecord",
  "fullPayload",
  "fullResponse",
  "manifest",
  "mediaBinary",
  "mediaBytes",
  "ownerApproval",
  "publicationManifest",
  "publicationReadiness",
  "rawPayload",
  "rawResponse",
  "readiness",
  "requestPayload",
  "responsePayload",
  "targetSnapshot",
  "workingContext",
]);

const FORBIDDEN_HIGHER_LAYER_AUTHORITY_KEYS = new Set([
  "approvalAuthority",
  "approvalDecision",
  "approvalStatus",
  "authorityRole",
  "canApprove",
  "canPublish",
  "grantsPublishingPermission",
  "metricsAuthority",
  "ownerDecision",
  "publisherAuthority",
  "schedulerAuthority",
]);

export function validateSocialPublicationLedgerAttemptRow(
  row: unknown,
): SocialPublicationLedgerRowValidationResult {
  const errors: SocialPublicationLedgerRowError[] = [];

  if (!isRecord(row)) {
    return validationResult([
      rowError("field_shape_invalid", "attempt", "Attempt row must be an object."),
    ]);
  }

  validateAttemptRowShape(row, "attempt", errors);
  const record = attemptRecordFromRow(row as SocialPublicationLedgerAttemptRow);
  appendPersistenceValidation(
    validateSocialPublicationLedgerAttemptRecord(record),
    errors,
    "attempt",
  );

  return validationResult(errors);
}

export function validateSocialPublicationLedgerOutcomeRow(
  row: unknown,
): SocialPublicationLedgerRowValidationResult {
  const errors: SocialPublicationLedgerRowError[] = [];

  if (!isRecord(row)) {
    return validationResult([
      rowError("field_shape_invalid", "outcome", "Outcome row must be an object."),
    ]);
  }

  validateOutcomeRowShape(row, "outcome", errors);
  const record = outcomeRecordFromRow(row as SocialPublicationLedgerOutcomeRow);
  appendPersistenceValidation(
    validateSocialPublicationLedgerOutcomeRecord(record),
    errors,
    "outcome",
  );

  return validationResult(errors);
}

export function validateSocialPublicationLedgerEvidenceRow(
  row: unknown,
): SocialPublicationLedgerRowValidationResult {
  const errors: SocialPublicationLedgerRowError[] = [];

  if (!isRecord(row)) {
    return validationResult([
      rowError("field_shape_invalid", "evidence", "Evidence row must be an object."),
    ]);
  }

  validateEvidenceRowShape(row, "evidence", errors);
  const record = evidenceRecordFromRow(row as SocialPublicationLedgerEvidenceRow);
  appendPersistenceValidation(
    validateSocialPublicationLedgerEvidenceRecord(record),
    errors,
    "evidence",
  );

  return validationResult(errors);
}

export function validateSocialPublicationLedgerRowsModel(
  model: unknown,
): SocialPublicationLedgerRowValidationResult {
  const errors: SocialPublicationLedgerRowError[] = [];

  if (!isRecord(model)) {
    return validationResult([
      rowError("field_shape_invalid", "model", "Ledger rows model must be an object."),
    ]);
  }

  const attempts = getArray(model, "attempts");
  const outcomes = getArray(model, "outcomes");
  const evidence = getArray(model, "evidence");

  if (!attempts) {
    errors.push(
      rowError(
        "required_field_missing",
        "model.attempts",
        "Ledger rows model must include attempt rows.",
      ),
    );
  }

  if (!outcomes) {
    errors.push(
      rowError(
        "required_field_missing",
        "model.outcomes",
        "Ledger rows model must include outcome rows.",
      ),
    );
  }

  if (!evidence) {
    errors.push(
      rowError(
        "required_field_missing",
        "model.evidence",
        "Ledger rows model must include evidence rows.",
      ),
    );
  }

  attempts?.forEach((row, index) => {
    const validation = validateSocialPublicationLedgerAttemptRow(row);
    if (!validation.ok) errors.push(...withPathPrefix(validation.errors, `attempts.${index}`));
  });
  outcomes?.forEach((row, index) => {
    const validation = validateSocialPublicationLedgerOutcomeRow(row);
    if (!validation.ok) errors.push(...withPathPrefix(validation.errors, `outcomes.${index}`));
  });
  evidence?.forEach((row, index) => {
    const validation = validateSocialPublicationLedgerEvidenceRow(row);
    if (!validation.ok) errors.push(...withPathPrefix(validation.errors, `evidence.${index}`));
  });

  if (errors.length === 0) {
    const persistenceValidation = validateSocialPublicationLedgerPersistenceModel(
      rowsModelToPersistenceModel(model as SocialPublicationLedgerRowsModel),
    );
    appendPersistenceValidation(persistenceValidation, errors, "model");
  }

  return validationResult(errors);
}

export function mapSocialPublicationLedgerAttemptRowToRecord(
  row: SocialPublicationLedgerAttemptRow,
): SocialPublicationLedgerRowResult<SocialPublicationLedgerAttemptRecord> {
  const validation = validateSocialPublicationLedgerAttemptRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(attemptRecordFromRow(row)) };
}

export function mapSocialPublicationLedgerOutcomeRowToRecord(
  row: SocialPublicationLedgerOutcomeRow,
): SocialPublicationLedgerRowResult<SocialPublicationLedgerOutcomeRecord> {
  const validation = validateSocialPublicationLedgerOutcomeRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(outcomeRecordFromRow(row)) };
}

export function mapSocialPublicationLedgerEvidenceRowToRecord(
  row: SocialPublicationLedgerEvidenceRow,
): SocialPublicationLedgerRowResult<SocialPublicationLedgerEvidenceRecord> {
  const validation = validateSocialPublicationLedgerEvidenceRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(evidenceRecordFromRow(row)) };
}

export function mapSocialPublicationLedgerAttemptRecordToRow(
  record: SocialPublicationLedgerAttemptRecord,
  options: SocialPublicationLedgerRowOptions = {},
): SocialPublicationLedgerRowResult<SocialPublicationLedgerAttemptRow> {
  const row = attemptRowFromRecord(record, options);
  const validation = validateSocialPublicationLedgerAttemptRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(row) };
}

export function mapSocialPublicationLedgerOutcomeRecordToRow(
  record: SocialPublicationLedgerOutcomeRecord,
  options: SocialPublicationLedgerRowOptions = {},
): SocialPublicationLedgerRowResult<SocialPublicationLedgerOutcomeRow> {
  const row = outcomeRowFromRecord(record, options);
  const validation = validateSocialPublicationLedgerOutcomeRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(row) };
}

export function mapSocialPublicationLedgerEvidenceRecordToRow(
  record: SocialPublicationLedgerEvidenceRecord,
  options: SocialPublicationLedgerRowOptions = {},
): SocialPublicationLedgerRowResult<SocialPublicationLedgerEvidenceRow> {
  const row = evidenceRowFromRecord(record, options);
  const validation = validateSocialPublicationLedgerEvidenceRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(row) };
}

export function mapSocialPublicationLedgerRowsToPersistenceModel(
  rows: SocialPublicationLedgerRowsModel,
): SocialPublicationLedgerRowResult<SocialPublicationLedgerPersistenceModel> {
  const validation = validateSocialPublicationLedgerRowsModel(rows);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return {
    ok: true,
    value: immutableClone(rowsModelToPersistenceModel(sortRowsModel(rows))),
  };
}

export function serializeSocialPublicationLedgerRowsModel(
  rows: SocialPublicationLedgerRowsModel,
): string {
  const validation = validateSocialPublicationLedgerRowsModel(rows);
  if (!validation.ok) {
    throw new Error("Publication ledger rows model failed validation.");
  }

  return stableStringify(sortRowsModel(rows));
}

export function hydrateSocialPublicationLedgerRowsModel(
  serialized: string,
): SocialPublicationLedgerRowResult<SocialPublicationLedgerRowsModel> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    return {
      ok: false,
      errors: [
        rowError(
          "serialization_invalid",
          "serialized",
          "Serialized publication ledger rows model must be valid JSON.",
        ),
      ],
    };
  }

  const validation = validateSocialPublicationLedgerRowsModel(parsed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return {
    ok: true,
    value: immutableClone(sortRowsModel(parsed as SocialPublicationLedgerRowsModel)),
  };
}

function validateAttemptRowShape(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationLedgerRowError[],
): void {
  validateCommonRowFields(row, path, errors);
  validateUuid(row.ledger_entry_id, `${path}.ledger_entry_id`, errors);
  validateUuid(row.publication_attempt_id, `${path}.publication_attempt_id`, errors);
  validateAttemptSequence(row.attempt_sequence, `${path}.attempt_sequence`, errors);
  validateEventType(row.event_type, ATTEMPT_EVENT_TYPES, `${path}.event_type`, errors);
  validateScopeColumns(row, path, errors);
  validateJsonObjectOrNull(row.request_summary, `${path}.request_summary`, errors);
  validateIdempotencyKey(row.idempotency_key, `${path}.idempotency_key`, errors);
  validateIdentitySeparation(
    path,
    errors,
    row.ledger_entry_id,
    row.publication_attempt_id,
    row.social_post_id,
    row.publication_target_id,
    row.publication_manifest_id,
  );
  rejectUnsafeJson(row.request_summary, `${path}.request_summary`, errors);
}

function validateOutcomeRowShape(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationLedgerRowError[],
): void {
  validateCommonRowFields(row, path, errors);
  validateUuid(row.ledger_entry_id, `${path}.ledger_entry_id`, errors);
  validateUuid(row.outcome_id, `${path}.outcome_id`, errors);
  validateUuid(row.publication_attempt_id, `${path}.publication_attempt_id`, errors);
  validateAttemptSequence(row.attempt_sequence, `${path}.attempt_sequence`, errors);
  validateEventType(row.event_type, OUTCOME_EVENT_TYPES, `${path}.event_type`, errors);
  validateScopeColumns(row, path, errors);
  validateJsonObjectOrNull(row.result_summary, `${path}.result_summary`, errors);
  validateJsonObjectOrNull(row.error_summary, `${path}.error_summary`, errors);
  validateIdempotencyKey(row.idempotency_key, `${path}.idempotency_key`, errors);
  validateIdentitySeparation(
    path,
    errors,
    row.ledger_entry_id,
    row.outcome_id,
    row.publication_attempt_id,
    row.social_post_id,
    row.publication_target_id,
    row.publication_manifest_id,
  );
  rejectUnsafeJson(row.result_summary, `${path}.result_summary`, errors);
  rejectUnsafeJson(row.error_summary, `${path}.error_summary`, errors);
}

function validateEvidenceRowShape(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationLedgerRowError[],
): void {
  validateCommonRowFields(row, path, errors);
  validateUuid(row.evidence_id, `${path}.evidence_id`, errors);
  validateUuid(row.ledger_entry_id, `${path}.ledger_entry_id`, errors);
  validateUuid(row.publication_attempt_id, `${path}.publication_attempt_id`, errors);
  validateOptionalUuid(row.outcome_id, `${path}.outcome_id`, errors);
  validateScopeColumns(row, path, errors);
  validateJsonObject(row.evidence_summary, `${path}.evidence_summary`, errors);
  validateIdempotencyKey(row.idempotency_key, `${path}.idempotency_key`, errors);
  validateIdentitySeparation(
    path,
    errors,
    row.evidence_id,
    row.ledger_entry_id,
    row.publication_attempt_id,
    row.outcome_id,
    row.social_post_id,
    row.publication_target_id,
    row.publication_manifest_id,
  );
  rejectUnsafeJson(row.evidence_summary, `${path}.evidence_summary`, errors);
}

function validateCommonRowFields(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationLedgerRowError[],
): void {
  validateRequiredText(row.recorded_at, `${path}.recorded_at`, errors);
  if (hasText(row.recorded_at) && Number.isNaN(Date.parse(row.recorded_at))) {
    errors.push(
      rowError(
        "audit_field_invalid",
        `${path}.recorded_at`,
        "Recorded timestamp must be parseable.",
      ),
    );
  }
  if (!hasText(row.recorded_by_actor) || !VALID_ACTORS.has(row.recorded_by_actor)) {
    errors.push(
      rowError(
        "audit_field_invalid",
        `${path}.recorded_by_actor`,
        "Recorded actor must use the D8 actor vocabulary.",
      ),
    );
  }
  if (!hasText(row.recorded_source) || !VALID_SOURCES.has(row.recorded_source)) {
    errors.push(
      rowError(
        "audit_field_invalid",
        `${path}.recorded_source`,
        "Recorded source must use the D8 source vocabulary.",
      ),
    );
  }
  if (row.append_only !== true || row.immutable !== true) {
    errors.push(
      rowError(
        "append_only_invariant_failed",
        path,
        "Ledger rows must remain append-only and immutable.",
      ),
    );
  }
}

function validateScopeColumns(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationLedgerRowError[],
): void {
  validateUuid(row.social_post_id, `${path}.social_post_id`, errors);
  validateUuid(row.publication_target_id, `${path}.publication_target_id`, errors);
  validateRequiredText(row.publication_manifest_id, `${path}.publication_manifest_id`, errors);
  validateOptionalUuid(row.owner_approval_id, `${path}.owner_approval_id`, errors);
  validateOptionalUuid(row.approval_id, `${path}.approval_id`, errors);
  validateOptionalUuid(row.proposal_id, `${path}.proposal_id`, errors);
}

function validateUuid(
  value: unknown,
  path: string,
  errors: SocialPublicationLedgerRowError[],
): void {
  if (!hasText(value)) {
    errors.push(rowError("required_field_missing", path, "Required UUID field is missing."));
    return;
  }

  if (!UUID_PATTERN.test(value)) {
    errors.push(rowError("identity_invalid", path, "Field must be a UUID string."));
  }
}

function validateOptionalUuid(
  value: unknown,
  path: string,
  errors: SocialPublicationLedgerRowError[],
): void {
  if (value === null || value === undefined) return;
  if (!hasText(value) || !UUID_PATTERN.test(value)) {
    errors.push(rowError("identity_invalid", path, "Optional UUID field must be null or UUID text."));
  }
}

function validateRequiredText(
  value: unknown,
  path: string,
  errors: SocialPublicationLedgerRowError[],
): void {
  if (!hasText(value)) {
    errors.push(rowError("required_field_missing", path, "Required text field is missing."));
  }
}

function validateAttemptSequence(
  value: unknown,
  path: string,
  errors: SocialPublicationLedgerRowError[],
): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    errors.push(
      rowError(
        "attempt_sequence_invalid",
        path,
        "Attempt sequence must be a non-negative integer.",
      ),
    );
  }
}

function validateEventType(
  value: unknown,
  allowed: ReadonlySet<string>,
  path: string,
  errors: SocialPublicationLedgerRowError[],
): void {
  if (!hasText(value) || !allowed.has(value)) {
    errors.push(
      rowError(
        "event_type_invalid",
        path,
        "Event type must match the SQL row family.",
      ),
    );
  }
}

function validateJsonObject(
  value: unknown,
  path: string,
  errors: SocialPublicationLedgerRowError[],
): void {
  if (!isJsonObject(value)) {
    errors.push(rowError("summary_shape_invalid", path, "Summary must be a JSON object."));
  }
}

function validateJsonObjectOrNull(
  value: unknown,
  path: string,
  errors: SocialPublicationLedgerRowError[],
): void {
  if (value !== null && !isJsonObject(value)) {
    errors.push(rowError("summary_shape_invalid", path, "Summary must be null or a JSON object."));
  }
}

function validateIdempotencyKey(
  value: unknown,
  path: string,
  errors: SocialPublicationLedgerRowError[],
): void {
  if (value !== null && !hasText(value)) {
    errors.push(
      rowError(
        "idempotency_key_invalid",
        path,
        "Idempotency key must be null or non-empty text.",
      ),
    );
  }
}

function validateIdentitySeparation(
  path: string,
  errors: SocialPublicationLedgerRowError[],
  ...values: readonly unknown[]
): void {
  const textValues = values.filter(hasText);
  if (new Set(textValues).size !== textValues.length) {
    errors.push(
      rowError(
        "identity_not_separated",
        path,
        "Ledger row identities and scope identities must remain separated.",
      ),
    );
  }
}

function rejectUnsafeJson(
  value: unknown,
  path: string,
  errors: SocialPublicationLedgerRowError[],
): void {
  rejectForbiddenKeys(value, path, FORBIDDEN_SECRET_KEYS, "lower_layer_payload_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_SCHEDULER_STATE_KEYS, "stored_computed_state_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_METRICS_STATE_KEYS, "stored_computed_state_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_LEARNING_STATE_KEYS, "stored_computed_state_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_COMPUTED_STATE_KEYS, "stored_computed_state_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_LOWER_LAYER_PAYLOAD_KEYS, "lower_layer_payload_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_HIGHER_LAYER_AUTHORITY_KEYS, "higher_layer_authority_forbidden", errors);
}

function rejectForbiddenKeys(
  value: unknown,
  path: string,
  forbiddenKeys: ReadonlySet<string>,
  code: SocialPublicationLedgerRowErrorCode,
  errors: SocialPublicationLedgerRowError[],
  seen = new WeakSet<object>(),
): void {
  if (!value || typeof value !== "object") return;

  if (seen.has(value)) {
    errors.push(
      rowError(
        "unsafe_recursive_state_forbidden",
        path,
        "Ledger row JSON must be acyclic.",
      ),
    );
    return;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      rejectForbiddenKeys(item, `${path}.${index}`, forbiddenKeys, code, errors, seen),
    );
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (forbiddenKeys.has(key)) {
      errors.push(rowError(code, childPath, "Ledger row JSON contains forbidden state."));
    }
    rejectForbiddenKeys(child, childPath, forbiddenKeys, code, errors, seen);
  }
}

function attemptRecordFromRow(
  row: SocialPublicationLedgerAttemptRow,
): SocialPublicationLedgerAttemptRecord {
  return {
    ledger_entry_id: row.ledger_entry_id as SocialPublicationLedgerEntryId,
    publication_attempt_id: row.publication_attempt_id as SocialPublicationAttemptId,
    attempt_sequence: row.attempt_sequence,
    event_type: row.event_type as PublicationLedgerEventType,
    scope: scopeFromRow(row),
    request_summary: row.request_summary as PublicationLedgerRequestSummary | null,
    recorded_at: row.recorded_at,
    recorded_by_actor: row.recorded_by_actor as PublicationLedgerActor,
    recorded_source: row.recorded_source as PublicationLedgerSource,
    append_only: row.append_only as true,
    immutable: row.immutable as true,
  };
}

function outcomeRecordFromRow(
  row: SocialPublicationLedgerOutcomeRow,
): SocialPublicationLedgerOutcomeRecord {
  return {
    ledger_entry_id: row.ledger_entry_id as SocialPublicationLedgerEntryId,
    outcome_id: row.outcome_id as SocialPublicationOutcomeId,
    publication_attempt_id: row.publication_attempt_id as SocialPublicationAttemptId,
    attempt_sequence: row.attempt_sequence,
    event_type: row.event_type as PublicationLedgerEventType,
    scope: scopeFromRow(row),
    result_summary: row.result_summary as PublicationLedgerResultSummary | null,
    error_summary: row.error_summary as PublicationLedgerErrorSummary | null,
    recorded_at: row.recorded_at,
    recorded_by_actor: row.recorded_by_actor as PublicationLedgerActor,
    recorded_source: row.recorded_source as PublicationLedgerSource,
    append_only: row.append_only as true,
    immutable: row.immutable as true,
  };
}

function evidenceRecordFromRow(
  row: SocialPublicationLedgerEvidenceRow,
): SocialPublicationLedgerEvidenceRecord {
  return {
    evidence_id: row.evidence_id as SocialPublicationEvidenceId,
    ledger_entry_id: row.ledger_entry_id as SocialPublicationLedgerEntryId,
    publication_attempt_id: row.publication_attempt_id as SocialPublicationAttemptId,
    outcome_id: row.outcome_id as SocialPublicationOutcomeId | null,
    scope: scopeFromRow(row),
    evidence_summary: row.evidence_summary as PublicationLedgerEvidenceSummary,
    recorded_at: row.recorded_at,
    recorded_by_actor: row.recorded_by_actor as PublicationLedgerActor,
    recorded_source: row.recorded_source as PublicationLedgerSource,
    append_only: row.append_only as true,
    immutable: row.immutable as true,
  };
}

function attemptRowFromRecord(
  record: SocialPublicationLedgerAttemptRecord,
  options: SocialPublicationLedgerRowOptions,
): SocialPublicationLedgerAttemptRow {
  return {
    ledger_entry_id: record.ledger_entry_id,
    publication_attempt_id: record.publication_attempt_id,
    attempt_sequence: record.attempt_sequence,
    event_type: record.event_type,
    ...scopeColumnsFromRecord(record.scope),
    request_summary: record.request_summary,
    recorded_at: record.recorded_at,
    recorded_by_actor: record.recorded_by_actor,
    recorded_source: record.recorded_source,
    append_only: record.append_only,
    immutable: record.immutable,
    idempotency_key: options.idempotency_key ?? null,
  };
}

function outcomeRowFromRecord(
  record: SocialPublicationLedgerOutcomeRecord,
  options: SocialPublicationLedgerRowOptions,
): SocialPublicationLedgerOutcomeRow {
  return {
    ledger_entry_id: record.ledger_entry_id,
    outcome_id: record.outcome_id,
    publication_attempt_id: record.publication_attempt_id,
    attempt_sequence: record.attempt_sequence,
    event_type: record.event_type,
    ...scopeColumnsFromRecord(record.scope),
    result_summary: record.result_summary,
    error_summary: record.error_summary,
    recorded_at: record.recorded_at,
    recorded_by_actor: record.recorded_by_actor,
    recorded_source: record.recorded_source,
    append_only: record.append_only,
    immutable: record.immutable,
    idempotency_key: options.idempotency_key ?? null,
  };
}

function evidenceRowFromRecord(
  record: SocialPublicationLedgerEvidenceRecord,
  options: SocialPublicationLedgerRowOptions,
): SocialPublicationLedgerEvidenceRow {
  return {
    evidence_id: record.evidence_id,
    ledger_entry_id: record.ledger_entry_id,
    publication_attempt_id: record.publication_attempt_id,
    outcome_id: record.outcome_id,
    ...scopeColumnsFromRecord(record.scope),
    evidence_summary: record.evidence_summary,
    recorded_at: record.recorded_at,
    recorded_by_actor: record.recorded_by_actor,
    recorded_source: record.recorded_source,
    append_only: record.append_only,
    immutable: record.immutable,
    idempotency_key: options.idempotency_key ?? null,
  };
}

function rowsModelToPersistenceModel(
  rows: SocialPublicationLedgerRowsModel,
): SocialPublicationLedgerPersistenceModel {
  return {
    attempts: rows.attempts.map(attemptRecordFromRow),
    outcomes: rows.outcomes.map(outcomeRecordFromRow),
    evidence: rows.evidence.map(evidenceRecordFromRow),
  };
}

function scopeFromRow(
  row:
    | SocialPublicationLedgerAttemptRow
    | SocialPublicationLedgerOutcomeRow
    | SocialPublicationLedgerEvidenceRow,
): SocialPublicationLedgerScope {
  return {
    social_post_id: row.social_post_id as SocialPublicationLedgerSocialPostId,
    publication_target_id:
      row.publication_target_id as SocialPublicationLedgerTargetId,
    publication_manifest_id:
      row.publication_manifest_id as SocialPublicationLedgerManifestId,
    owner_approval_id:
      row.owner_approval_id as SocialPublicationLedgerOwnerApprovalId | null,
    approval_id: row.approval_id as SocialPublicationLedgerApprovalId | null,
    proposal_id: row.proposal_id as SocialPublicationLedgerProposalId | null,
  };
}

function scopeColumnsFromRecord(scope: SocialPublicationLedgerScope): {
  social_post_id: string;
  publication_target_id: string;
  publication_manifest_id: string;
  owner_approval_id: string | null;
  approval_id: string | null;
  proposal_id: string | null;
} {
  return {
    social_post_id: scope.social_post_id,
    publication_target_id: scope.publication_target_id,
    publication_manifest_id: scope.publication_manifest_id,
    owner_approval_id: scope.owner_approval_id,
    approval_id: scope.approval_id,
    proposal_id: scope.proposal_id,
  };
}

function sortRowsModel(
  rows: SocialPublicationLedgerRowsModel,
): SocialPublicationLedgerRowsModel {
  return {
    attempts: [...rows.attempts].sort(
      (left, right) =>
        left.attempt_sequence - right.attempt_sequence ||
        left.recorded_at.localeCompare(right.recorded_at) ||
        left.ledger_entry_id.localeCompare(right.ledger_entry_id),
    ),
    outcomes: [...rows.outcomes].sort(
      (left, right) =>
        left.attempt_sequence - right.attempt_sequence ||
        left.recorded_at.localeCompare(right.recorded_at) ||
        left.outcome_id.localeCompare(right.outcome_id),
    ),
    evidence: [...rows.evidence].sort(
      (left, right) =>
        left.recorded_at.localeCompare(right.recorded_at) ||
        left.evidence_id.localeCompare(right.evidence_id),
    ),
  };
}

function appendPersistenceValidation(
  result: { ok: true } | { ok: false; errors: readonly SocialPublicationLedgerPersistenceError[] },
  errors: SocialPublicationLedgerRowError[],
  path: string,
): void {
  if (result.ok) return;

  errors.push(
    ...result.errors.map((error) =>
      rowError(mapPersistenceCode(error.code), `${path}.${error.path}`, error.message, [
        error,
      ]),
    ),
  );
}

function mapPersistenceCode(
  code: SocialPublicationLedgerPersistenceError["code"],
): SocialPublicationLedgerRowErrorCode {
  if (code === "audit_field_invalid") return "audit_field_invalid";
  if (code === "event_type_invalid") return "event_type_invalid";
  if (code === "attempt_sequence_invalid") return "attempt_sequence_invalid";
  if (code === "append_only_invariant_failed") return "append_only_invariant_failed";
  if (code === "identity_not_separated") return "identity_not_separated";
  if (code === "relationship_invalid") return "relationship_invalid";
  if (code === "scope_mismatch") return "scope_mismatch";
  if (code === "summary_shape_invalid") return "summary_shape_invalid";
  if (code === "unsafe_recursive_state_forbidden") return "unsafe_recursive_state_forbidden";
  if (code === "stored_computed_state_forbidden") return "stored_computed_state_forbidden";
  if (code === "higher_layer_authority_forbidden") return "higher_layer_authority_forbidden";
  if (code === "lower_layer_payload_forbidden") return "lower_layer_payload_forbidden";
  return "required_field_missing";
}

function withPathPrefix(
  errors: readonly SocialPublicationLedgerRowError[],
  prefix: string,
): readonly SocialPublicationLedgerRowError[] {
  return errors.map((error) => ({
    ...error,
    path: `${prefix}.${error.path}`,
  }));
}

function rowError(
  code: SocialPublicationLedgerRowErrorCode,
  path: string,
  message: string,
  persistenceErrors?: readonly SocialPublicationLedgerPersistenceError[],
): SocialPublicationLedgerRowError {
  return { code, path, message, persistenceErrors };
}

function validationResult(
  errors: SocialPublicationLedgerRowError[],
): SocialPublicationLedgerRowValidationResult {
  if (errors.length === 0) return { ok: true, errors: [] };
  return { ok: false, errors };
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

function getArray(record: UnknownRecord, key: string): readonly unknown[] | null {
  const value = record[key];
  return Array.isArray(value) ? value : null;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isJsonObject(value: unknown): value is PublicationLedgerJsonObject {
  return isJsonValue(value) && isRecord(value);
}

function isJsonValue(value: unknown, seen = new WeakSet<object>()): value is PublicationLedgerJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return Number.isNaN(value) === false;
  }

  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, seen));
  return Object.values(value).every((item) => isJsonValue(item, seen));
}
