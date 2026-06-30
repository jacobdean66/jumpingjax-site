import {
  validatePublicationLedgerEntry,
  type PublicationLedgerEntry,
  type PublicationLedgerErrorCode,
  type PublicationLedgerValidationError,
} from "./social-publication-ledger";
import {
  validateSocialPublicationLedgerAttemptRecord,
  validateSocialPublicationLedgerEvidenceRecord,
  validateSocialPublicationLedgerOutcomeRecord,
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
  type SocialPublicationLedgerProposalId,
  type SocialPublicationLedgerScope,
  type SocialPublicationLedgerSocialPostId,
  type SocialPublicationLedgerTargetId,
  type SocialPublicationOutcomeId,
} from "./social-publication-ledger-persistence";

export const SOCIAL_PUBLICATION_LEDGER_MAPPER_ERROR_CODES = [
  "domain_validation_failed",
  "persistence_validation_failed",
  "event_family_invalid",
  "manifest_identity_required",
  "target_identity_mismatch",
  "result_summary_required",
  "error_summary_required",
  "evidence_summary_required",
  "serialization_invalid",
] as const;

export type SocialPublicationLedgerMapperErrorCode =
  (typeof SOCIAL_PUBLICATION_LEDGER_MAPPER_ERROR_CODES)[number];

export type SocialPublicationLedgerMapperError = Readonly<{
  code: SocialPublicationLedgerMapperErrorCode;
  path: string;
  message: string;
  domainErrors?: readonly PublicationLedgerValidationError[];
  persistenceErrors?: readonly SocialPublicationLedgerPersistenceError[];
}>;

export type SocialPublicationLedgerMapperResult<T> = Readonly<
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      errors: readonly SocialPublicationLedgerMapperError[];
    }
>;

export type SocialPublicationLedgerMappedEntry = Readonly<{
  sourceLedgerEntryId: string;
  publicationAttemptId: string;
  eventType: PublicationLedgerEntry["eventType"];
  attempt: SocialPublicationLedgerAttemptRecord | null;
  outcome: SocialPublicationLedgerOutcomeRecord | null;
  evidence: SocialPublicationLedgerEvidenceRecord | null;
  deterministic: true;
  persisted: false;
  publishesNothing: true;
  schedulesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
}>;

const ATTEMPT_EVENT_TYPES = new Set<PublicationLedgerEntry["eventType"]>([
  "publication_attempt_started",
  "publication_attempt_retry_started",
]);

const SUCCESS_EVENT_TYPES = new Set<PublicationLedgerEntry["eventType"]>([
  "publication_attempt_succeeded",
  "publication_attempt_retry_succeeded",
]);

const FAILURE_EVENT_TYPES = new Set<PublicationLedgerEntry["eventType"]>([
  "publication_attempt_failed",
  "publication_attempt_retry_failed",
]);

const OUTCOME_EVENT_TYPES = new Set<PublicationLedgerEntry["eventType"]>([
  "publication_attempt_succeeded",
  "publication_attempt_failed",
  "publication_attempt_cancelled",
  "publication_attempt_retry_requested",
  "publication_attempt_retry_succeeded",
  "publication_attempt_retry_failed",
]);

const FORBIDDEN_MAPPER_STATE_KEYS = new Set([
  "accessToken",
  "access_token",
  "apiKey",
  "api_key",
  "approvalAuthority",
  "approvalDecision",
  "approvalStatus",
  "authorityRole",
  "canApprove",
  "canPublish",
  "canSchedule",
  "currentPublishStatus",
  "currentState",
  "fullPayload",
  "fullResponse",
  "learning",
  "learningSignal",
  "metrics",
  "metricsAuthority",
  "rawMetrics",
  "rawPayload",
  "rawResponse",
  "readModel",
  "replayState",
  "requestPayload",
  "responsePayload",
  "scheduledAt",
  "scheduledFor",
  "schedulerAuthority",
  "schedulerJobId",
  "schedulerState",
  "secret",
  "token",
]);

export function validatePublicationLedgerEntryForPersistenceMapping(
  entry: unknown,
): SocialPublicationLedgerMapperResult<PublicationLedgerEntry> {
  const errors: SocialPublicationLedgerMapperError[] = [];

  const domainValidation = safeValidatePublicationLedgerEntry(entry);
  if (!domainValidation.ok) {
    errors.push(
      ...domainValidation.errors.map((error) =>
        mapperError(
          "domain_validation_failed",
          error.path,
          error.message,
          [error],
        ),
      ),
    );
  }

  if (!isRecord(entry)) {
    return { ok: false, errors };
  }

  const candidate = entry as PublicationLedgerEntry;
  rejectForbiddenMapperState(candidate, "entry", errors);

  if (!candidate.references?.publicationManifestId) {
    errors.push(
      mapperError(
        "manifest_identity_required",
        "references.publicationManifestId",
        "Publication ledger persistence requires a manifest identity.",
      ),
    );
  }

  if (
    candidate.references?.publicationTargetId &&
    candidate.targetSnapshot?.targetId &&
    candidate.references.publicationTargetId !== candidate.targetSnapshot.targetId
  ) {
    errors.push(
      mapperError(
        "target_identity_mismatch",
        "targetSnapshot.targetId",
        "Publication target snapshot must match ledger references.",
      ),
    );
  }

  if (
    SUCCESS_EVENT_TYPES.has(candidate.eventType) &&
    candidate.resultSummary === null
  ) {
    errors.push(
      mapperError(
        "result_summary_required",
        "resultSummary",
        "Successful publication events require a result summary.",
      ),
    );
  }

  if (
    FAILURE_EVENT_TYPES.has(candidate.eventType) &&
    candidate.errorSummary === null
  ) {
    errors.push(
      mapperError(
        "error_summary_required",
        "errorSummary",
        "Failed publication events require an error summary.",
      ),
    );
  }

  if (
    !ATTEMPT_EVENT_TYPES.has(candidate.eventType) &&
    !OUTCOME_EVENT_TYPES.has(candidate.eventType)
  ) {
    errors.push(
      mapperError(
        "event_family_invalid",
        "eventType",
        "Publication ledger event type does not map to a persistence family.",
      ),
    );
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: immutableClone(candidate) };
}

function safeValidatePublicationLedgerEntry(
  entry: unknown,
):
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly PublicationLedgerValidationError[] } {
  try {
    return validatePublicationLedgerEntry(entry as PublicationLedgerEntry);
  } catch {
    return {
      ok: false,
      errors: [
        {
          code: "secret_forbidden" as PublicationLedgerErrorCode,
          path: "entry",
          message: "Publication ledger entry must be safe, acyclic data.",
        },
      ],
    };
  }
}

export function mapPublicationLedgerEntryToAttemptRecord(
  entry: PublicationLedgerEntry,
): SocialPublicationLedgerMapperResult<SocialPublicationLedgerAttemptRecord> {
  const validation = validatePublicationLedgerEntryForPersistenceMapping(entry);
  if (!validation.ok) return validation;

  if (!ATTEMPT_EVENT_TYPES.has(entry.eventType)) {
    return {
      ok: false,
      errors: [
        mapperError(
          "event_family_invalid",
          "eventType",
          "Only attempt-started events map to attempt records.",
        ),
      ],
    };
  }

  const record: SocialPublicationLedgerAttemptRecord = {
    ledger_entry_id: entry.ledgerEntryId as SocialPublicationLedgerEntryId,
    publication_attempt_id:
      entry.publicationAttemptId as SocialPublicationAttemptId,
    attempt_sequence: entry.attemptSequence,
    event_type: entry.eventType,
    scope: scopeFromEntry(entry),
    request_summary: entry.requestSummary,
    recorded_at: entry.createdAt,
    recorded_by_actor: entry.actor,
    recorded_source: entry.source,
    append_only: entry.appendOnly,
    immutable: entry.immutable,
  };

  return validateAndReturnRecord(
    record,
    validateSocialPublicationLedgerAttemptRecord(record),
  );
}

export function mapPublicationLedgerEntryToOutcomeRecord(
  entry: PublicationLedgerEntry,
): SocialPublicationLedgerMapperResult<SocialPublicationLedgerOutcomeRecord> {
  const validation = validatePublicationLedgerEntryForPersistenceMapping(entry);
  if (!validation.ok) return validation;

  if (!OUTCOME_EVENT_TYPES.has(entry.eventType)) {
    return {
      ok: false,
      errors: [
        mapperError(
          "event_family_invalid",
          "eventType",
          "Only outcome events map to outcome records.",
        ),
      ],
    };
  }

  const record: SocialPublicationLedgerOutcomeRecord = {
    ledger_entry_id: entry.ledgerEntryId as SocialPublicationLedgerEntryId,
    outcome_id: deterministicOutcomeId(entry.ledgerEntryId),
    publication_attempt_id:
      entry.publicationAttemptId as SocialPublicationAttemptId,
    attempt_sequence: entry.attemptSequence,
    event_type: entry.eventType,
    scope: scopeFromEntry(entry),
    result_summary: entry.resultSummary,
    error_summary: entry.errorSummary,
    recorded_at: entry.createdAt,
    recorded_by_actor: entry.actor,
    recorded_source: entry.source,
    append_only: entry.appendOnly,
    immutable: entry.immutable,
  };

  return validateAndReturnRecord(
    record,
    validateSocialPublicationLedgerOutcomeRecord(record),
  );
}

export function mapPublicationLedgerEntryToEvidenceRecord(
  entry: PublicationLedgerEntry,
): SocialPublicationLedgerMapperResult<SocialPublicationLedgerEvidenceRecord> {
  const validation = validatePublicationLedgerEntryForPersistenceMapping(entry);
  if (!validation.ok) return validation;

  if (entry.evidenceSummary === null) {
    return {
      ok: false,
      errors: [
        mapperError(
          "evidence_summary_required",
          "evidenceSummary",
          "Evidence mapping requires an evidence summary.",
        ),
      ],
    };
  }

  const record: SocialPublicationLedgerEvidenceRecord = {
    evidence_id: deterministicEvidenceId(entry.ledgerEntryId),
    ledger_entry_id: entry.ledgerEntryId as SocialPublicationLedgerEntryId,
    publication_attempt_id:
      entry.publicationAttemptId as SocialPublicationAttemptId,
    outcome_id: OUTCOME_EVENT_TYPES.has(entry.eventType)
      ? deterministicOutcomeId(entry.ledgerEntryId)
      : null,
    scope: scopeFromEntry(entry),
    evidence_summary: entry.evidenceSummary,
    recorded_at: entry.createdAt,
    recorded_by_actor: entry.actor,
    recorded_source: entry.source,
    append_only: entry.appendOnly,
    immutable: entry.immutable,
  };

  return validateAndReturnRecord(
    record,
    validateSocialPublicationLedgerEvidenceRecord(record),
  );
}

export function mapPublicationLedgerEntryToPersistenceRecords(
  entry: PublicationLedgerEntry,
): SocialPublicationLedgerMapperResult<SocialPublicationLedgerMappedEntry> {
  const validation = validatePublicationLedgerEntryForPersistenceMapping(entry);
  if (!validation.ok) return validation;

  const attempt = ATTEMPT_EVENT_TYPES.has(entry.eventType)
    ? mapPublicationLedgerEntryToAttemptRecord(entry)
    : null;
  const outcome = OUTCOME_EVENT_TYPES.has(entry.eventType)
    ? mapPublicationLedgerEntryToOutcomeRecord(entry)
    : null;
  const evidence = entry.evidenceSummary
    ? mapPublicationLedgerEntryToEvidenceRecord(entry)
    : null;
  const errors = [
    ...errorsFromResult(attempt),
    ...errorsFromResult(outcome),
    ...errorsFromResult(evidence),
  ];

  if (errors.length > 0) return { ok: false, errors };

  const attemptRecord = attempt && attempt.ok ? attempt.value : null;
  const outcomeRecord = outcome && outcome.ok ? outcome.value : null;
  const evidenceRecord = evidence && evidence.ok ? evidence.value : null;

  return {
    ok: true,
    value: immutableClone({
      sourceLedgerEntryId: entry.ledgerEntryId,
      publicationAttemptId: entry.publicationAttemptId,
      eventType: entry.eventType,
      attempt: attemptRecord,
      outcome: outcomeRecord,
      evidence: evidenceRecord,
      deterministic: true,
      persisted: false,
      publishesNothing: true,
      schedulesNothing: true,
      recordsNoMetrics: true,
      performsNoLearning: true,
    }),
  };
}

export function previewPublicationLedgerEntryPersistenceMapping(
  entry: PublicationLedgerEntry,
): SocialPublicationLedgerMapperResult<SocialPublicationLedgerMappedEntry> {
  return mapPublicationLedgerEntryToPersistenceRecords(entry);
}

export function publicationLedgerMappedEntriesEqual(
  left: SocialPublicationLedgerMappedEntry,
  right: SocialPublicationLedgerMappedEntry,
): boolean {
  return stableStringify(sortMappedEntry(left)) === stableStringify(sortMappedEntry(right));
}

export function serializePublicationLedgerMappedEntry(
  mapped: SocialPublicationLedgerMappedEntry,
): string {
  return stableStringify(sortMappedEntry(mapped));
}

export function hydratePublicationLedgerMappedEntry(
  serialized: string,
): SocialPublicationLedgerMapperResult<SocialPublicationLedgerMappedEntry> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    return {
      ok: false,
      errors: [
        mapperError(
          "serialization_invalid",
          "serialized",
          "Serialized publication ledger mapped entry must be valid JSON.",
        ),
      ],
    };
  }

  if (!isMappedEntry(parsed)) {
    return {
      ok: false,
      errors: [
        mapperError(
          "serialization_invalid",
          "serialized",
          "Serialized publication ledger mapped entry has an invalid shape.",
        ),
      ],
    };
  }

  return { ok: true, value: immutableClone(sortMappedEntry(parsed)) };
}

function validateAndReturnRecord<T>(
  record: T,
  validation:
    | { ok: true; errors: readonly [] }
    | { ok: false; errors: readonly SocialPublicationLedgerPersistenceError[] },
): SocialPublicationLedgerMapperResult<T> {
  if (validation.ok) return { ok: true, value: immutableClone(record) };

  return {
    ok: false,
    errors: [
      mapperError(
        "persistence_validation_failed",
        "persistence",
        "Mapped persistence record failed validation.",
        undefined,
        validation.errors,
      ),
    ],
  };
}

function errorsFromResult<T>(
  result: SocialPublicationLedgerMapperResult<T> | null,
): readonly SocialPublicationLedgerMapperError[] {
  if (!result || result.ok) return [];
  return result.errors;
}

function scopeFromEntry(entry: PublicationLedgerEntry): SocialPublicationLedgerScope {
  return {
    social_post_id:
      entry.references.socialPostId as SocialPublicationLedgerSocialPostId,
    publication_target_id:
      entry.references.publicationTargetId as SocialPublicationLedgerTargetId,
    publication_manifest_id:
      entry.references.publicationManifestId as SocialPublicationLedgerManifestId,
    owner_approval_id:
      entry.references.ownerApprovalId as SocialPublicationLedgerOwnerApprovalId | null,
    approval_id:
      entry.references.approvalId as SocialPublicationLedgerApprovalId | null,
    proposal_id:
      entry.references.proposalId as SocialPublicationLedgerProposalId | null,
  };
}

function deterministicOutcomeId(ledgerEntryId: string): SocialPublicationOutcomeId {
  return deterministicUuid(
    "social-publication-ledger-outcome",
    ledgerEntryId,
  ) as SocialPublicationOutcomeId;
}

function deterministicEvidenceId(ledgerEntryId: string): SocialPublicationEvidenceId {
  return deterministicUuid(
    "social-publication-ledger-evidence",
    ledgerEntryId,
  ) as SocialPublicationEvidenceId;
}

function deterministicUuid(namespace: string, seed: string): string {
  const hash = fnv1a(`${namespace}:${seed}`);
  const hex = hash.padEnd(32, "0").slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  const chunks: string[] = [];

  for (let index = 0; index < 4; index += 1) {
    for (let charIndex = 0; charIndex < input.length; charIndex += 1) {
      hash ^= input.charCodeAt(charIndex) + index;
      hash = Math.imul(hash, 0x01000193);
    }
    chunks.push((hash >>> 0).toString(16).padStart(8, "0"));
  }

  return chunks.join("");
}

function mapperError(
  code: SocialPublicationLedgerMapperErrorCode,
  path: string,
  message: string,
  domainErrors?: readonly PublicationLedgerValidationError[],
  persistenceErrors?: readonly SocialPublicationLedgerPersistenceError[],
): SocialPublicationLedgerMapperError {
  return { code, path, message, domainErrors, persistenceErrors };
}

function rejectForbiddenMapperState(
  value: unknown,
  path: string,
  errors: SocialPublicationLedgerMapperError[],
  seen = new WeakSet<object>(),
): void {
  if (!value || typeof value !== "object") return;

  if (seen.has(value)) {
    errors.push(
      mapperError(
        "domain_validation_failed",
        path,
        "Publication ledger mapper input must be acyclic.",
      ),
    );
    return;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      rejectForbiddenMapperState(item, `${path}.${index}`, errors, seen),
    );
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_MAPPER_STATE_KEYS.has(key)) {
      errors.push(
        mapperError(
          "domain_validation_failed",
          childPath,
          "Publication ledger mapper input contains forbidden execution state.",
        ),
      );
    }
    rejectForbiddenMapperState(child, childPath, errors, seen);
  }
}

function sortMappedEntry(
  mapped: SocialPublicationLedgerMappedEntry,
): SocialPublicationLedgerMappedEntry {
  return {
    sourceLedgerEntryId: mapped.sourceLedgerEntryId,
    publicationAttemptId: mapped.publicationAttemptId,
    eventType: mapped.eventType,
    attempt: mapped.attempt,
    outcome: mapped.outcome,
    evidence: mapped.evidence,
    deterministic: mapped.deterministic,
    persisted: mapped.persisted,
    publishesNothing: mapped.publishesNothing,
    schedulesNothing: mapped.schedulesNothing,
    recordsNoMetrics: mapped.recordsNoMetrics,
    performsNoLearning: mapped.performsNoLearning,
  };
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

function isMappedEntry(value: unknown): value is SocialPublicationLedgerMappedEntry {
  if (!isRecord(value)) return false;

  return (
    typeof value.sourceLedgerEntryId === "string" &&
    typeof value.publicationAttemptId === "string" &&
    typeof value.eventType === "string" &&
    (value.attempt === null || isRecord(value.attempt)) &&
    (value.outcome === null || isRecord(value.outcome)) &&
    (value.evidence === null || isRecord(value.evidence)) &&
    value.deterministic === true &&
    value.persisted === false &&
    value.publishesNothing === true &&
    value.schedulesNothing === true &&
    value.recordsNoMetrics === true &&
    value.performsNoLearning === true
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
