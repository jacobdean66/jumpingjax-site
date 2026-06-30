import {
  PUBLICATION_LEDGER_EVENT_TYPES,
  type PublicationLedgerActor,
  type PublicationLedgerErrorSummary,
  type PublicationLedgerEventType,
  type PublicationLedgerEvidenceSummary,
  type PublicationLedgerJsonObject,
  type PublicationLedgerRequestSummary,
  type PublicationLedgerResultSummary,
  type PublicationLedgerSource,
} from "./social-publication-ledger";

type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

type UnknownRecord = Readonly<Record<string, unknown>>;

export type SocialPublicationLedgerEntryId = Brand<
  string,
  "SocialPublicationLedgerEntryId"
>;

export type SocialPublicationAttemptId = Brand<
  string,
  "SocialPublicationAttemptId"
>;

export type SocialPublicationOutcomeId = Brand<
  string,
  "SocialPublicationOutcomeId"
>;

export type SocialPublicationEvidenceId = Brand<
  string,
  "SocialPublicationEvidenceId"
>;

export type SocialPublicationLedgerSocialPostId = Brand<
  string,
  "SocialPublicationLedgerSocialPostId"
>;

export type SocialPublicationLedgerTargetId = Brand<
  string,
  "SocialPublicationLedgerTargetId"
>;

export type SocialPublicationLedgerManifestId = Brand<
  string,
  "SocialPublicationLedgerManifestId"
>;

export type SocialPublicationLedgerOwnerApprovalId = Brand<
  string,
  "SocialPublicationLedgerOwnerApprovalId"
>;

export type SocialPublicationLedgerApprovalId = Brand<
  string,
  "SocialPublicationLedgerApprovalId"
>;

export type SocialPublicationLedgerProposalId = Brand<
  string,
  "SocialPublicationLedgerProposalId"
>;

export type SocialPublicationLedgerScope = Readonly<{
  social_post_id: SocialPublicationLedgerSocialPostId;
  publication_target_id: SocialPublicationLedgerTargetId;
  publication_manifest_id: SocialPublicationLedgerManifestId;
  owner_approval_id: SocialPublicationLedgerOwnerApprovalId | null;
  approval_id: SocialPublicationLedgerApprovalId | null;
  proposal_id: SocialPublicationLedgerProposalId | null;
}>;

export type SocialPublicationLedgerAuditFields = Readonly<{
  recorded_at: string;
  recorded_by_actor: PublicationLedgerActor;
  recorded_source: PublicationLedgerSource;
}>;

export type SocialPublicationLedgerAttemptRecord =
  SocialPublicationLedgerAuditFields &
    Readonly<{
      ledger_entry_id: SocialPublicationLedgerEntryId;
      publication_attempt_id: SocialPublicationAttemptId;
      attempt_sequence: number;
      event_type: PublicationLedgerEventType;
      scope: SocialPublicationLedgerScope;
      request_summary: PublicationLedgerRequestSummary | null;
      append_only: true;
      immutable: true;
    }>;

export type SocialPublicationLedgerOutcomeRecord =
  SocialPublicationLedgerAuditFields &
    Readonly<{
      ledger_entry_id: SocialPublicationLedgerEntryId;
      outcome_id: SocialPublicationOutcomeId;
      publication_attempt_id: SocialPublicationAttemptId;
      attempt_sequence: number;
      event_type: PublicationLedgerEventType;
      scope: SocialPublicationLedgerScope;
      result_summary: PublicationLedgerResultSummary | null;
      error_summary: PublicationLedgerErrorSummary | null;
      append_only: true;
      immutable: true;
    }>;

export type SocialPublicationLedgerEvidenceRecord =
  SocialPublicationLedgerAuditFields &
    Readonly<{
      evidence_id: SocialPublicationEvidenceId;
      ledger_entry_id: SocialPublicationLedgerEntryId;
      publication_attempt_id: SocialPublicationAttemptId;
      outcome_id: SocialPublicationOutcomeId | null;
      scope: SocialPublicationLedgerScope;
      evidence_summary: PublicationLedgerEvidenceSummary;
      append_only: true;
      immutable: true;
    }>;

export type SocialPublicationLedgerPersistenceModel = Readonly<{
  attempts: readonly SocialPublicationLedgerAttemptRecord[];
  outcomes: readonly SocialPublicationLedgerOutcomeRecord[];
  evidence: readonly SocialPublicationLedgerEvidenceRecord[];
}>;

export const SOCIAL_PUBLICATION_LEDGER_PERSISTENCE_ERROR_CODES = [
  "required_field_missing",
  "identity_not_separated",
  "scope_mismatch",
  "event_type_invalid",
  "attempt_sequence_invalid",
  "append_only_invariant_failed",
  "audit_field_invalid",
  "summary_shape_invalid",
  "relationship_invalid",
  "unsafe_recursive_state_forbidden",
  "stored_computed_state_forbidden",
  "lower_layer_payload_forbidden",
  "higher_layer_authority_forbidden",
] as const;

export type SocialPublicationLedgerPersistenceErrorCode =
  (typeof SOCIAL_PUBLICATION_LEDGER_PERSISTENCE_ERROR_CODES)[number];

export type SocialPublicationLedgerPersistenceError = Readonly<{
  code: SocialPublicationLedgerPersistenceErrorCode;
  path: string;
  message: string;
}>;

export type SocialPublicationLedgerPersistenceValidationResult = Readonly<
  | {
      ok: true;
      errors: readonly [];
    }
  | {
      ok: false;
      errors: readonly SocialPublicationLedgerPersistenceError[];
    }
>;

const LEDGER_EVENT_TYPES = new Set<string>(PUBLICATION_LEDGER_EVENT_TYPES);

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

export function validateSocialPublicationLedgerAttemptRecord(
  record: unknown,
): SocialPublicationLedgerPersistenceValidationResult {
  const errors: SocialPublicationLedgerPersistenceError[] = [];

  if (!isRecord(record)) {
    return singleError(
      "required_field_missing",
      "attempt",
      "Attempt record must be an object.",
    );
  }

  validateAttemptRecord(record, "attempt", errors);
  rejectUnsafeState(record, "attempt", errors);

  return validationResult(errors);
}

export function validateSocialPublicationLedgerOutcomeRecord(
  record: unknown,
): SocialPublicationLedgerPersistenceValidationResult {
  const errors: SocialPublicationLedgerPersistenceError[] = [];

  if (!isRecord(record)) {
    return singleError(
      "required_field_missing",
      "outcome",
      "Outcome record must be an object.",
    );
  }

  validateOutcomeRecord(record, "outcome", errors);
  rejectUnsafeState(record, "outcome", errors);

  return validationResult(errors);
}

export function validateSocialPublicationLedgerEvidenceRecord(
  record: unknown,
): SocialPublicationLedgerPersistenceValidationResult {
  const errors: SocialPublicationLedgerPersistenceError[] = [];

  if (!isRecord(record)) {
    return singleError(
      "required_field_missing",
      "evidence",
      "Evidence record must be an object.",
    );
  }

  validateEvidenceRecord(record, "evidence", errors);
  rejectUnsafeState(record, "evidence", errors);

  return validationResult(errors);
}

export function validateSocialPublicationLedgerPersistenceModel(
  model: unknown,
): SocialPublicationLedgerPersistenceValidationResult {
  const errors: SocialPublicationLedgerPersistenceError[] = [];

  if (!isRecord(model)) {
    return singleError(
      "required_field_missing",
      "model",
      "Publication ledger persistence model must be an object.",
    );
  }

  const attempts = getArray(model, "attempts");
  const outcomes = getArray(model, "outcomes");
  const evidence = getArray(model, "evidence");

  if (!attempts) {
    errors.push(
      persistenceError(
        "required_field_missing",
        "model.attempts",
        "Persistence model must include append-only attempt records.",
      ),
    );
  }

  if (!outcomes) {
    errors.push(
      persistenceError(
        "required_field_missing",
        "model.outcomes",
        "Persistence model must include append-only outcome records.",
      ),
    );
  }

  if (!evidence) {
    errors.push(
      persistenceError(
        "required_field_missing",
        "model.evidence",
        "Persistence model must include append-only evidence records.",
      ),
    );
  }

  const attemptsById = new Map<string, UnknownRecord>();
  const outcomesById = new Map<string, UnknownRecord>();
  const ledgerEntryIds = new Set<string>();

  attempts?.forEach((attempt, index) => {
    const path = `attempts.${index}`;
    if (!isRecord(attempt)) {
      errors.push(
        persistenceError(
          "required_field_missing",
          path,
          "Attempt record must be an object.",
        ),
      );
      return;
    }

    validateAttemptRecord(attempt, path, errors);
    validateUniqueLedgerEntryId(attempt, path, ledgerEntryIds, errors);
    rejectUnsafeState(attempt, path, errors);

    const attemptId = getText(attempt, "publication_attempt_id");
    if (attemptId) {
      if (attemptsById.has(attemptId)) {
        errors.push(
          persistenceError(
            "identity_not_separated",
            `${path}.publication_attempt_id`,
            "Attempt identities must be unique within the ledger model.",
          ),
        );
      }
      attemptsById.set(attemptId, attempt);
    }
  });

  outcomes?.forEach((outcome, index) => {
    const path = `outcomes.${index}`;
    if (!isRecord(outcome)) {
      errors.push(
        persistenceError(
          "required_field_missing",
          path,
          "Outcome record must be an object.",
        ),
      );
      return;
    }

    validateOutcomeRecord(outcome, path, errors);
    validateUniqueLedgerEntryId(outcome, path, ledgerEntryIds, errors);
    rejectUnsafeState(outcome, path, errors);

    const outcomeId = getText(outcome, "outcome_id");
    if (outcomeId) {
      if (outcomesById.has(outcomeId)) {
        errors.push(
          persistenceError(
            "identity_not_separated",
            `${path}.outcome_id`,
            "Outcome identities must be unique within the ledger model.",
          ),
        );
      }
      outcomesById.set(outcomeId, outcome);
    }

    validateAttemptRelationship(outcome, path, attemptsById, errors);
  });

  evidence?.forEach((evidenceRecord, index) => {
    const path = `evidence.${index}`;
    if (!isRecord(evidenceRecord)) {
      errors.push(
        persistenceError(
          "required_field_missing",
          path,
          "Evidence record must be an object.",
        ),
      );
      return;
    }

    validateEvidenceRecord(evidenceRecord, path, errors);
    rejectUnsafeState(evidenceRecord, path, errors);
    validateEvidenceRelationship(
      evidenceRecord,
      path,
      attemptsById,
      outcomesById,
      errors,
    );
  });

  return validationResult(errors);
}

function validateAttemptRecord(
  record: UnknownRecord,
  path: string,
  errors: SocialPublicationLedgerPersistenceError[],
): void {
  const ledgerEntryId = requireText(record, "ledger_entry_id", path, errors);
  const publicationAttemptId = requireText(
    record,
    "publication_attempt_id",
    path,
    errors,
  );
  const attemptSequence = record.attempt_sequence;
  const eventType = requireText(record, "event_type", path, errors);

  validateAttemptSequence(attemptSequence, `${path}.attempt_sequence`, errors);
  validateEventType(eventType, ATTEMPT_EVENT_TYPES, `${path}.event_type`, errors);
  validateScope(requireRecord(record, "scope", path, errors), `${path}.scope`, errors);
  validateAuditFields(record, path, errors);
  validateAppendOnly(record, path, errors);
  validateRequestSummary(record.request_summary, `${path}.request_summary`, errors);

  rejectIdentityCollisions(
    [
      ["ledger_entry_id", ledgerEntryId],
      ["publication_attempt_id", publicationAttemptId],
      ...scopeIdentityPairs(getRecord(record, "scope")),
    ],
    path,
    errors,
  );
}

function validateOutcomeRecord(
  record: UnknownRecord,
  path: string,
  errors: SocialPublicationLedgerPersistenceError[],
): void {
  const ledgerEntryId = requireText(record, "ledger_entry_id", path, errors);
  const outcomeId = requireText(record, "outcome_id", path, errors);
  const publicationAttemptId = requireText(
    record,
    "publication_attempt_id",
    path,
    errors,
  );
  const attemptSequence = record.attempt_sequence;
  const eventType = requireText(record, "event_type", path, errors);

  validateAttemptSequence(attemptSequence, `${path}.attempt_sequence`, errors);
  validateEventType(eventType, OUTCOME_EVENT_TYPES, `${path}.event_type`, errors);
  validateScope(requireRecord(record, "scope", path, errors), `${path}.scope`, errors);
  validateAuditFields(record, path, errors);
  validateAppendOnly(record, path, errors);
  validateResultSummary(record.result_summary, `${path}.result_summary`, errors);
  validateErrorSummary(record.error_summary, `${path}.error_summary`, errors);

  if (
    eventType === "publication_attempt_succeeded" ||
    eventType === "publication_attempt_retry_succeeded"
  ) {
    requireRecord(record, "result_summary", path, errors);
  }

  if (
    eventType === "publication_attempt_failed" ||
    eventType === "publication_attempt_retry_failed"
  ) {
    requireRecord(record, "error_summary", path, errors);
  }

  rejectIdentityCollisions(
    [
      ["ledger_entry_id", ledgerEntryId],
      ["outcome_id", outcomeId],
      ["publication_attempt_id", publicationAttemptId],
      ...scopeIdentityPairs(getRecord(record, "scope")),
    ],
    path,
    errors,
  );
}

function validateEvidenceRecord(
  record: UnknownRecord,
  path: string,
  errors: SocialPublicationLedgerPersistenceError[],
): void {
  const evidenceId = requireText(record, "evidence_id", path, errors);
  const ledgerEntryId = requireText(record, "ledger_entry_id", path, errors);
  const publicationAttemptId = requireText(
    record,
    "publication_attempt_id",
    path,
    errors,
  );
  const outcomeId = optionalText(record, "outcome_id", path, errors);

  validateScope(requireRecord(record, "scope", path, errors), `${path}.scope`, errors);
  validateAuditFields(record, path, errors);
  validateAppendOnly(record, path, errors);
  validateEvidenceSummary(
    requireRecord(record, "evidence_summary", path, errors),
    `${path}.evidence_summary`,
    errors,
  );

  rejectIdentityCollisions(
    [
      ["evidence_id", evidenceId],
      ["ledger_entry_id", ledgerEntryId],
      ["publication_attempt_id", publicationAttemptId],
      ["outcome_id", outcomeId],
      ...scopeIdentityPairs(getRecord(record, "scope")),
    ],
    path,
    errors,
  );
}

function validateScope(
  scope: UnknownRecord | null,
  path: string,
  errors: SocialPublicationLedgerPersistenceError[],
): void {
  if (!scope) return;

  requireText(scope, "social_post_id", path, errors);
  requireText(scope, "publication_target_id", path, errors);
  requireText(scope, "publication_manifest_id", path, errors);
  optionalText(scope, "owner_approval_id", path, errors);
  optionalText(scope, "approval_id", path, errors);
  optionalText(scope, "proposal_id", path, errors);
}

function validateAuditFields(
  record: UnknownRecord,
  path: string,
  errors: SocialPublicationLedgerPersistenceError[],
): void {
  const recordedAt = requireText(record, "recorded_at", path, errors);
  const recordedByActor = requireText(record, "recorded_by_actor", path, errors);
  const recordedSource = requireText(record, "recorded_source", path, errors);

  if (recordedAt && Number.isNaN(Date.parse(recordedAt))) {
    errors.push(
      persistenceError(
        "audit_field_invalid",
        `${path}.recorded_at`,
        "Ledger audit timestamp must be parseable ISO-style text.",
      ),
    );
  }

  if (recordedByActor && !VALID_ACTORS.has(recordedByActor)) {
    errors.push(
      persistenceError(
        "audit_field_invalid",
        `${path}.recorded_by_actor`,
        "Ledger audit actor must use the D8 M1 actor vocabulary.",
      ),
    );
  }

  if (recordedSource && !VALID_SOURCES.has(recordedSource)) {
    errors.push(
      persistenceError(
        "audit_field_invalid",
        `${path}.recorded_source`,
        "Ledger audit source must use the D8 M1 source vocabulary.",
      ),
    );
  }
}

function validateAppendOnly(
  record: UnknownRecord,
  path: string,
  errors: SocialPublicationLedgerPersistenceError[],
): void {
  if (record.append_only !== true || record.immutable !== true) {
    errors.push(
      persistenceError(
        "append_only_invariant_failed",
        path,
        "Ledger persistence records must be immutable append-only facts.",
      ),
    );
  }
}

function validateEventType(
  value: string | null,
  allowedTypes: ReadonlySet<string>,
  path: string,
  errors: SocialPublicationLedgerPersistenceError[],
): void {
  if (!value) return;

  if (!LEDGER_EVENT_TYPES.has(value) || !allowedTypes.has(value)) {
    errors.push(
      persistenceError(
        "event_type_invalid",
        path,
        "Ledger persistence event type must match the record family.",
      ),
    );
  }
}

function validateAttemptSequence(
  value: unknown,
  path: string,
  errors: SocialPublicationLedgerPersistenceError[],
): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    errors.push(
      persistenceError(
        "attempt_sequence_invalid",
        path,
        "Attempt sequence must be a non-negative integer.",
      ),
    );
  }
}

function validateRequestSummary(
  value: unknown,
  path: string,
  errors: SocialPublicationLedgerPersistenceError[],
): void {
  if (value === null) return;
  if (!isRecord(value)) {
    errors.push(
      persistenceError(
        "summary_shape_invalid",
        path,
        "Request summary must be null or an object.",
      ),
    );
    return;
  }

  if (value.containsFullPayload !== false || value.containsSecrets !== false) {
    errors.push(
      persistenceError(
        "lower_layer_payload_forbidden",
        path,
        "Request summaries must not store full payloads or secrets.",
      ),
    );
  }
}

function validateResultSummary(
  value: unknown,
  path: string,
  errors: SocialPublicationLedgerPersistenceError[],
): void {
  if (value === null) return;
  if (!isRecord(value)) {
    errors.push(
      persistenceError(
        "summary_shape_invalid",
        path,
        "Result summary must be null or an object.",
      ),
    );
    return;
  }

  if (value.containsFullResponse !== false || value.containsSecrets !== false) {
    errors.push(
      persistenceError(
        "lower_layer_payload_forbidden",
        path,
        "Result summaries must not store full responses or secrets.",
      ),
    );
  }
}

function validateErrorSummary(
  value: unknown,
  path: string,
  errors: SocialPublicationLedgerPersistenceError[],
): void {
  if (value === null) return;
  if (!isRecord(value)) {
    errors.push(
      persistenceError(
        "summary_shape_invalid",
        path,
        "Error summary must be null or an object.",
      ),
    );
    return;
  }

  if (value.containsFullResponse !== false || value.containsSecrets !== false) {
    errors.push(
      persistenceError(
        "lower_layer_payload_forbidden",
        path,
        "Error summaries must not store full responses or secrets.",
      ),
    );
  }
}

function validateEvidenceSummary(
  value: UnknownRecord | null,
  path: string,
  errors: SocialPublicationLedgerPersistenceError[],
): void {
  if (!value) return;

  if (
    value.containsFullPayload !== false ||
    value.containsFullResponse !== false ||
    value.containsSecrets !== false
  ) {
    errors.push(
      persistenceError(
        "lower_layer_payload_forbidden",
        path,
        "Evidence summaries must not store full payloads, full responses, or secrets.",
      ),
    );
  }
}

function validateAttemptRelationship(
  outcome: UnknownRecord,
  path: string,
  attemptsById: ReadonlyMap<string, UnknownRecord>,
  errors: SocialPublicationLedgerPersistenceError[],
): void {
  const attemptId = getText(outcome, "publication_attempt_id");
  if (!attemptId) return;

  const attempt = attemptsById.get(attemptId);
  if (!attempt) {
    errors.push(
      persistenceError(
        "relationship_invalid",
        `${path}.publication_attempt_id`,
        "Outcome record must reference a stored attempt record.",
      ),
    );
    return;
  }

  if (!recordsShareScope(attempt, outcome)) {
    errors.push(
      persistenceError(
        "scope_mismatch",
        path,
        "Outcome scope must match the referenced attempt scope.",
      ),
    );
  }

  if (attempt.attempt_sequence !== outcome.attempt_sequence) {
    errors.push(
      persistenceError(
        "relationship_invalid",
        `${path}.attempt_sequence`,
        "Outcome sequence must match the referenced attempt sequence.",
      ),
    );
  }
}

function validateEvidenceRelationship(
  evidence: UnknownRecord,
  path: string,
  attemptsById: ReadonlyMap<string, UnknownRecord>,
  outcomesById: ReadonlyMap<string, UnknownRecord>,
  errors: SocialPublicationLedgerPersistenceError[],
): void {
  const attemptId = getText(evidence, "publication_attempt_id");
  const outcomeId = getText(evidence, "outcome_id");

  if (attemptId) {
    const attempt = attemptsById.get(attemptId);
    if (!attempt) {
      errors.push(
        persistenceError(
          "relationship_invalid",
          `${path}.publication_attempt_id`,
          "Evidence record must reference a stored attempt record.",
        ),
      );
    } else if (!recordsShareScope(attempt, evidence)) {
      errors.push(
        persistenceError(
          "scope_mismatch",
          path,
          "Evidence scope must match the referenced attempt scope.",
        ),
      );
    }
  }

  if (outcomeId) {
    const outcome = outcomesById.get(outcomeId);
    if (!outcome) {
      errors.push(
        persistenceError(
          "relationship_invalid",
          `${path}.outcome_id`,
          "Evidence outcome reference must point at a stored outcome record.",
        ),
      );
    } else if (!recordsShareScope(outcome, evidence)) {
      errors.push(
        persistenceError(
          "scope_mismatch",
          path,
          "Evidence scope must match the referenced outcome scope.",
        ),
      );
    } else if (getText(outcome, "publication_attempt_id") !== attemptId) {
      errors.push(
        persistenceError(
          "relationship_invalid",
          `${path}.outcome_id`,
          "Evidence outcome must belong to the referenced attempt.",
        ),
      );
    }
  }
}

function validateUniqueLedgerEntryId(
  record: UnknownRecord,
  path: string,
  seen: Set<string>,
  errors: SocialPublicationLedgerPersistenceError[],
): void {
  const ledgerEntryId = getText(record, "ledger_entry_id");
  if (!ledgerEntryId) return;

  if (seen.has(ledgerEntryId)) {
    errors.push(
      persistenceError(
        "identity_not_separated",
        `${path}.ledger_entry_id`,
        "Ledger entry identities must be unique across stored entries.",
      ),
    );
  }

  seen.add(ledgerEntryId);
}

function recordsShareScope(left: UnknownRecord, right: UnknownRecord): boolean {
  const leftScope = getRecord(left, "scope");
  const rightScope = getRecord(right, "scope");
  if (!leftScope || !rightScope) return false;

  return (
    getText(leftScope, "social_post_id") === getText(rightScope, "social_post_id") &&
    getText(leftScope, "publication_target_id") ===
      getText(rightScope, "publication_target_id") &&
    getText(leftScope, "publication_manifest_id") ===
      getText(rightScope, "publication_manifest_id") &&
    nullableText(leftScope.owner_approval_id) ===
      nullableText(rightScope.owner_approval_id) &&
    nullableText(leftScope.approval_id) === nullableText(rightScope.approval_id) &&
    nullableText(leftScope.proposal_id) === nullableText(rightScope.proposal_id)
  );
}

function rejectIdentityCollisions(
  pairs: readonly (readonly [string, string | null])[],
  path: string,
  errors: SocialPublicationLedgerPersistenceError[],
): void {
  const seen = new Map<string, string>();

  for (const [field, value] of pairs) {
    if (!value) continue;

    const previous = seen.get(value);
    if (previous) {
      errors.push(
        persistenceError(
          "identity_not_separated",
          `${path}.${field}`,
          `${previous} and ${field} must remain separate identities.`,
        ),
      );
    } else {
      seen.set(value, field);
    }
  }
}

function scopeIdentityPairs(
  scope: UnknownRecord | null,
): readonly (readonly [string, string | null])[] {
  if (!scope) return [];

  return [
    ["scope.social_post_id", getText(scope, "social_post_id")],
    ["scope.publication_target_id", getText(scope, "publication_target_id")],
    ["scope.publication_manifest_id", getText(scope, "publication_manifest_id")],
    ["scope.owner_approval_id", optionalKnownText(scope.owner_approval_id)],
    ["scope.approval_id", optionalKnownText(scope.approval_id)],
    ["scope.proposal_id", optionalKnownText(scope.proposal_id)],
  ];
}

function rejectUnsafeState(
  value: UnknownRecord,
  path: string,
  errors: SocialPublicationLedgerPersistenceError[],
): void {
  rejectForbiddenKeys({
    value,
    path,
    forbiddenKeys: FORBIDDEN_COMPUTED_STATE_KEYS,
    code: "stored_computed_state_forbidden",
    message: "D8 M2 persistence records must not store computed publication state.",
    errors,
    seen: new WeakSet<object>(),
  });
  rejectForbiddenKeys({
    value,
    path,
    forbiddenKeys: FORBIDDEN_LOWER_LAYER_PAYLOAD_KEYS,
    code: "lower_layer_payload_forbidden",
    message: "D8 M2 persistence records must not duplicate lower-layer payloads.",
    errors,
    seen: new WeakSet<object>(),
  });
  rejectForbiddenKeys({
    value,
    path,
    forbiddenKeys: FORBIDDEN_HIGHER_LAYER_AUTHORITY_KEYS,
    code: "higher_layer_authority_forbidden",
    message: "D8 M2 persistence records must not store higher-layer authority.",
    errors,
    seen: new WeakSet<object>(),
  });
}

function rejectForbiddenKeys(input: {
  value: unknown;
  path: string;
  forbiddenKeys: ReadonlySet<string>;
  code: SocialPublicationLedgerPersistenceErrorCode;
  message: string;
  errors: SocialPublicationLedgerPersistenceError[];
  seen: WeakSet<object>;
}): void {
  if (!input.value || typeof input.value !== "object") return;

  if (input.seen.has(input.value)) {
    input.errors.push(
      persistenceError(
        "unsafe_recursive_state_forbidden",
        input.path,
        "D8 M2 persistence records must be acyclic JSON-shaped data.",
      ),
    );
    return;
  }

  input.seen.add(input.value);

  if (Array.isArray(input.value)) {
    input.value.forEach((item, index) =>
      rejectForbiddenKeys({
        ...input,
        value: item,
        path: `${input.path}.${index}`,
      }),
    );
    return;
  }

  for (const [key, child] of Object.entries(input.value)) {
    const childPath = `${input.path}.${key}`;
    if (input.forbiddenKeys.has(key)) {
      input.errors.push(persistenceError(input.code, childPath, input.message));
    }

    rejectForbiddenKeys({
      ...input,
      value: child,
      path: childPath,
    });
  }
}

function requireRecord(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: SocialPublicationLedgerPersistenceError[],
): UnknownRecord | null {
  const child = getRecord(record, key);
  if (!child) {
    errors.push(
      persistenceError(
        "required_field_missing",
        `${path}.${key}`,
        "Required object field is missing.",
      ),
    );
  }
  return child;
}

function requireText(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: SocialPublicationLedgerPersistenceError[],
): string | null {
  const text = getText(record, key);
  if (!text) {
    errors.push(
      persistenceError(
        "required_field_missing",
        `${path}.${key}`,
        "Required text field is missing.",
      ),
    );
  }
  return text;
}

function optionalText(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: SocialPublicationLedgerPersistenceError[],
): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (hasText(value)) return value;

  errors.push(
    persistenceError(
      "required_field_missing",
      `${path}.${key}`,
      "Optional identity field must be null or non-empty text.",
    ),
  );
  return null;
}

function optionalKnownText(value: unknown): string | null {
  return value === null || value === undefined ? null : hasText(value) ? value : null;
}

function nullableText(value: unknown): string | null {
  return hasText(value) ? value : null;
}

function getText(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  return hasText(value) ? value : null;
}

function getRecord(record: UnknownRecord, key: string): UnknownRecord | null {
  const value = record[key];
  return isRecord(value) ? value : null;
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

function persistenceError(
  code: SocialPublicationLedgerPersistenceErrorCode,
  path: string,
  message: string,
): SocialPublicationLedgerPersistenceError {
  return { code, path, message };
}

function singleError(
  code: SocialPublicationLedgerPersistenceErrorCode,
  path: string,
  message: string,
): SocialPublicationLedgerPersistenceValidationResult {
  return {
    ok: false,
    errors: [persistenceError(code, path, message)],
  };
}

function validationResult(
  errors: SocialPublicationLedgerPersistenceError[],
): SocialPublicationLedgerPersistenceValidationResult {
  if (errors.length === 0) {
    return { ok: true, errors: [] };
  }

  return { ok: false, errors };
}

export type {
  PublicationLedgerJsonObject as SocialPublicationLedgerJsonObject,
  PublicationLedgerRequestSummary as SocialPublicationLedgerRequestSummary,
  PublicationLedgerResultSummary as SocialPublicationLedgerResultSummary,
  PublicationLedgerErrorSummary as SocialPublicationLedgerErrorSummary,
  PublicationLedgerEvidenceSummary as SocialPublicationLedgerEvidenceSummary,
};
