import {
  validateSocialPublicationLedgerAttemptRecord,
  validateSocialPublicationLedgerEvidenceRecord,
  validateSocialPublicationLedgerOutcomeRecord,
  validateSocialPublicationLedgerPersistenceModel,
  type SocialPublicationLedgerAttemptRecord,
  type SocialPublicationLedgerEvidenceRecord,
  type SocialPublicationLedgerOutcomeRecord,
  type SocialPublicationLedgerPersistenceError,
  type SocialPublicationLedgerPersistenceModel,
} from "./social-publication-ledger-persistence";

type UnknownRecord = Readonly<Record<string, unknown>>;

export const SOCIAL_PUBLICATION_LEDGER_REPOSITORY_ERROR_CODES = [
  "validation_failed",
  "not_found",
  "identity_required",
  "identity_collision",
  "relationship_invalid",
  "serialization_invalid",
] as const;

export type SocialPublicationLedgerRepositoryErrorCode =
  (typeof SOCIAL_PUBLICATION_LEDGER_REPOSITORY_ERROR_CODES)[number];

export type SocialPublicationLedgerRepositoryError = Readonly<{
  code: SocialPublicationLedgerRepositoryErrorCode;
  message: string;
  validationErrors?: readonly SocialPublicationLedgerPersistenceError[];
}>;

export type SocialPublicationLedgerRepositoryResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: SocialPublicationLedgerRepositoryError }>;

export type SocialPublicationLedgerRepositoryIdentity = Readonly<{
  social_post_id?: string;
  publication_target_id?: string;
  publication_manifest_id?: string;
  ledger_entry_id?: string;
  publication_attempt_id?: string;
  outcome_id?: string;
  evidence_id?: string;
}>;

export type SocialPublicationLedgerCreateRequest = Readonly<{
  attempt: SocialPublicationLedgerAttemptRecord;
}>;

export type SocialPublicationLedgerAppendAttemptRequest = Readonly<{
  attempt: SocialPublicationLedgerAttemptRecord;
}>;

export type SocialPublicationLedgerAppendOutcomeRequest = Readonly<{
  outcome: SocialPublicationLedgerOutcomeRecord;
}>;

export type SocialPublicationLedgerAppendEvidenceRequest = Readonly<{
  evidence: SocialPublicationLedgerEvidenceRecord;
}>;

export type SocialPublicationLedgerRepositorySnapshot =
  SocialPublicationLedgerPersistenceModel;

export type SocialPublicationLedgerRepository = Readonly<{
  createLedgerEntry(
    request: SocialPublicationLedgerCreateRequest,
  ): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerAttemptRecord>;
  appendAttempt(
    request: SocialPublicationLedgerAppendAttemptRequest,
  ): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerAttemptRecord>;
  appendOutcome(
    request: SocialPublicationLedgerAppendOutcomeRequest,
  ): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerOutcomeRecord>;
  appendEvidence(
    request: SocialPublicationLedgerAppendEvidenceRequest,
  ): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerEvidenceRecord>;
  getLedgerByIdentity(
    identity: SocialPublicationLedgerRepositoryIdentity,
  ): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerPersistenceModel>;
  listAttempts(
    identity?: SocialPublicationLedgerRepositoryIdentity,
  ): SocialPublicationLedgerRepositoryResult<
    readonly SocialPublicationLedgerAttemptRecord[]
  >;
  listOutcomes(
    identity?: SocialPublicationLedgerRepositoryIdentity,
  ): SocialPublicationLedgerRepositoryResult<
    readonly SocialPublicationLedgerOutcomeRecord[]
  >;
  listEvidence(
    identity?: SocialPublicationLedgerRepositoryIdentity,
  ): SocialPublicationLedgerRepositoryResult<
    readonly SocialPublicationLedgerEvidenceRecord[]
  >;
  snapshot(): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerRepositorySnapshot>;
}>;

export function createSocialPublicationLedgerRepository(
  seed: SocialPublicationLedgerPersistenceModel = emptyModel(),
): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerRepository> {
  const hydrated = hydrateSocialPublicationLedgerRepositorySnapshot(
    serializeSocialPublicationLedgerRepositorySnapshot(seed),
  );
  if (!hydrated.ok) return hydrated;

  let state = mutableClone(hydrated.value);

  const repository: SocialPublicationLedgerRepository = {
    createLedgerEntry(request) {
      return appendAttemptRecord(request, state, (next) => {
        state = next;
      });
    },
    appendAttempt(request) {
      return appendAttemptRecord(request, state, (next) => {
        state = next;
      });
    },
    appendOutcome(request) {
      const requestValidation = validateAppendOutcomeRequest(request);
      if (!requestValidation.ok) return requestValidation;

      const next = {
        attempts: state.attempts,
        outcomes: [...state.outcomes, request.outcome],
        evidence: state.evidence,
      };
      const modelValidation = validateModelForRepository(next);
      if (!modelValidation.ok) return modelValidation;

      state = mutableClone(next);
      return ok(immutableClone(request.outcome));
    },
    appendEvidence(request) {
      const requestValidation = validateAppendEvidenceRequest(request);
      if (!requestValidation.ok) return requestValidation;

      const next = {
        attempts: state.attempts,
        outcomes: state.outcomes,
        evidence: [...state.evidence, request.evidence],
      };
      const modelValidation = validateModelForRepository(next);
      if (!modelValidation.ok) return modelValidation;

      state = mutableClone(next);
      return ok(immutableClone(request.evidence));
    },
    getLedgerByIdentity(identity) {
      const identityValidation = validateRepositoryIdentity(identity);
      if (!identityValidation.ok) return identityValidation;

      const attempts = state.attempts.filter((record) =>
        matchesIdentity(record, identity),
      );
      const outcomes = state.outcomes.filter(
        (record) =>
          matchesIdentity(record, identity) ||
          attempts.some(
            (attempt) =>
              attempt.publication_attempt_id === record.publication_attempt_id,
          ),
      );
      const evidence = state.evidence.filter(
        (record) =>
          matchesIdentity(record, identity) ||
          attempts.some(
            (attempt) =>
              attempt.publication_attempt_id === record.publication_attempt_id,
          ) ||
          outcomes.some((outcome) => outcome.outcome_id === record.outcome_id),
      );
      const model = { attempts, outcomes, evidence };

      if (
        model.attempts.length === 0 &&
        model.outcomes.length === 0 &&
        model.evidence.length === 0
      ) {
        return failure("not_found", "Publication ledger records were not found.");
      }

      return validateAndReturnModel(model);
    },
    listAttempts(identity) {
      const identityValidation = validateOptionalIdentity(identity);
      if (!identityValidation.ok) return identityValidation;

      const records = identity
        ? state.attempts.filter((record) => matchesIdentity(record, identity))
        : state.attempts;
      return ok(immutableClone(sortAttempts(records)));
    },
    listOutcomes(identity) {
      const identityValidation = validateOptionalIdentity(identity);
      if (!identityValidation.ok) return identityValidation;

      const records = identity
        ? state.outcomes.filter((record) => matchesIdentity(record, identity))
        : state.outcomes;
      return ok(immutableClone(sortOutcomes(records)));
    },
    listEvidence(identity) {
      const identityValidation = validateOptionalIdentity(identity);
      if (!identityValidation.ok) return identityValidation;

      const records = identity
        ? state.evidence.filter((record) => matchesIdentity(record, identity))
        : state.evidence;
      return ok(immutableClone(sortEvidence(records)));
    },
    snapshot() {
      return validateAndReturnModel(state);
    },
  };

  return ok(repository);
}

export function validateSocialPublicationLedgerRepositoryCreateRequest(
  request: unknown,
): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerCreateRequest> {
  return validateAppendAttemptRequest(request);
}

export function validateSocialPublicationLedgerRepositoryAppendAttemptRequest(
  request: unknown,
): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerAppendAttemptRequest> {
  return validateAppendAttemptRequest(request);
}

export function validateSocialPublicationLedgerRepositoryAppendOutcomeRequest(
  request: unknown,
): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerAppendOutcomeRequest> {
  return validateAppendOutcomeRequest(request);
}

export function validateSocialPublicationLedgerRepositoryAppendEvidenceRequest(
  request: unknown,
): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerAppendEvidenceRequest> {
  return validateAppendEvidenceRequest(request);
}

export function serializeSocialPublicationLedgerRepositorySnapshot(
  model: SocialPublicationLedgerPersistenceModel,
): string {
  const validation = validateSocialPublicationLedgerPersistenceModel(model);
  if (!validation.ok) {
    throw new Error("Publication ledger repository snapshot failed validation.");
  }

  return stableStringify(sortModel(model));
}

export function hydrateSocialPublicationLedgerRepositorySnapshot(
  serialized: string,
): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerRepositorySnapshot> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    return failure(
      "serialization_invalid",
      "Publication ledger repository snapshot is not valid JSON.",
    );
  }

  const validation = validateSocialPublicationLedgerPersistenceModel(parsed);
  if (!validation.ok) {
    return failure(
      "validation_failed",
      "Publication ledger repository snapshot failed validation.",
      validation.errors,
    );
  }

  return ok(immutableClone(sortModel(parsed as SocialPublicationLedgerPersistenceModel)));
}

function appendAttemptRecord(
  request: unknown,
  state: SocialPublicationLedgerPersistenceModel,
  commit: (next: SocialPublicationLedgerPersistenceModel) => void,
): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerAttemptRecord> {
  const requestValidation = validateAppendAttemptRequest(request);
  if (!requestValidation.ok) return requestValidation;

  const next = {
    attempts: [...state.attempts, requestValidation.value.attempt],
    outcomes: state.outcomes,
    evidence: state.evidence,
  };
  const modelValidation = validateModelForRepository(next);
  if (!modelValidation.ok) return modelValidation;

  commit(mutableClone(next));
  return ok(immutableClone(requestValidation.value.attempt));
}

function validateAppendAttemptRequest(
  request: unknown,
): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerAppendAttemptRequest> {
  if (!isRecord(request)) {
    return failure("validation_failed", "Append attempt request must be an object.");
  }

  const validation = validateSocialPublicationLedgerAttemptRecord(request.attempt);
  if (!validation.ok) {
    return failure(
      "validation_failed",
      "Append attempt request failed validation.",
      validation.errors,
    );
  }

  return ok({
    attempt: request.attempt as SocialPublicationLedgerAttemptRecord,
  });
}

function validateAppendOutcomeRequest(
  request: unknown,
): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerAppendOutcomeRequest> {
  if (!isRecord(request)) {
    return failure("validation_failed", "Append outcome request must be an object.");
  }

  const validation = validateSocialPublicationLedgerOutcomeRecord(request.outcome);
  if (!validation.ok) {
    return failure(
      "validation_failed",
      "Append outcome request failed validation.",
      validation.errors,
    );
  }

  return ok({
    outcome: request.outcome as SocialPublicationLedgerOutcomeRecord,
  });
}

function validateAppendEvidenceRequest(
  request: unknown,
): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerAppendEvidenceRequest> {
  if (!isRecord(request)) {
    return failure("validation_failed", "Append evidence request must be an object.");
  }

  const validation = validateSocialPublicationLedgerEvidenceRecord(request.evidence);
  if (!validation.ok) {
    return failure(
      "validation_failed",
      "Append evidence request failed validation.",
      validation.errors,
    );
  }

  return ok({
    evidence: request.evidence as SocialPublicationLedgerEvidenceRecord,
  });
}

function validateRepositoryIdentity(
  identity: unknown,
): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerRepositoryIdentity> {
  if (!isRecord(identity)) {
    return failure("identity_required", "Repository identity must be an object.");
  }

  const entries = Object.entries(identity).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return failure(
      "identity_required",
      "At least one publication ledger identity field is required.",
    );
  }

  for (const [key, value] of entries) {
    if (!hasText(value)) {
      return failure(
        "identity_required",
        `Repository identity field ${key} must be non-empty text.`,
      );
    }
  }

  return ok(identity);
}

function validateOptionalIdentity(
  identity: unknown,
): SocialPublicationLedgerRepositoryResult<
  SocialPublicationLedgerRepositoryIdentity | undefined
> {
  if (identity === undefined) return ok(undefined);
  return validateRepositoryIdentity(identity);
}

function validateModelForRepository(
  model: SocialPublicationLedgerPersistenceModel,
): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerPersistenceModel> {
  const validation = validateSocialPublicationLedgerPersistenceModel(model);
  if (!validation.ok) {
    const hasCollision = validation.errors.some(
      (error) => error.code === "identity_not_separated",
    );
    const hasRelationshipError = validation.errors.some(
      (error) =>
        error.code === "relationship_invalid" || error.code === "scope_mismatch",
    );

    return failure(
      hasCollision
        ? "identity_collision"
        : hasRelationshipError
          ? "relationship_invalid"
          : "validation_failed",
      "Publication ledger repository model failed validation.",
      validation.errors,
    );
  }

  return ok(model);
}

function validateAndReturnModel(
  model: SocialPublicationLedgerPersistenceModel,
): SocialPublicationLedgerRepositoryResult<SocialPublicationLedgerPersistenceModel> {
  const validation = validateModelForRepository(model);
  if (!validation.ok) return validation;

  return ok(immutableClone(sortModel(model)));
}

function matchesIdentity(
  record:
    | SocialPublicationLedgerAttemptRecord
    | SocialPublicationLedgerOutcomeRecord
    | SocialPublicationLedgerEvidenceRecord,
  identity: SocialPublicationLedgerRepositoryIdentity,
): boolean {
  return (
    matchesValue(record, "ledger_entry_id", identity.ledger_entry_id) ||
    matchesValue(record, "publication_attempt_id", identity.publication_attempt_id) ||
    matchesValue(record, "outcome_id", identity.outcome_id) ||
    matchesValue(record, "evidence_id", identity.evidence_id) ||
    matchesScope(record.scope, identity)
  );
}

function matchesScope(
  scope: UnknownRecord,
  identity: SocialPublicationLedgerRepositoryIdentity,
): boolean {
  return (
    matchesValue(scope, "social_post_id", identity.social_post_id) ||
    matchesValue(scope, "publication_target_id", identity.publication_target_id) ||
    matchesValue(scope, "publication_manifest_id", identity.publication_manifest_id)
  );
}

function matchesValue(
  record: UnknownRecord,
  key: string,
  expected: string | undefined,
): boolean {
  return expected !== undefined && record[key] === expected;
}

function sortModel(
  model: SocialPublicationLedgerPersistenceModel,
): SocialPublicationLedgerPersistenceModel {
  return {
    attempts: sortAttempts(model.attempts),
    outcomes: sortOutcomes(model.outcomes),
    evidence: sortEvidence(model.evidence),
  };
}

function sortAttempts(
  attempts: readonly SocialPublicationLedgerAttemptRecord[],
): readonly SocialPublicationLedgerAttemptRecord[] {
  return [...attempts].sort(
    (left, right) =>
      left.attempt_sequence - right.attempt_sequence ||
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.ledger_entry_id.localeCompare(right.ledger_entry_id),
  );
}

function sortOutcomes(
  outcomes: readonly SocialPublicationLedgerOutcomeRecord[],
): readonly SocialPublicationLedgerOutcomeRecord[] {
  return [...outcomes].sort(
    (left, right) =>
      left.attempt_sequence - right.attempt_sequence ||
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.outcome_id.localeCompare(right.outcome_id),
  );
}

function sortEvidence(
  evidence: readonly SocialPublicationLedgerEvidenceRecord[],
): readonly SocialPublicationLedgerEvidenceRecord[] {
  return [...evidence].sort(
    (left, right) =>
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.evidence_id.localeCompare(right.evidence_id),
  );
}

function stableStringify(value: unknown): string {
  return JSON.stringify(toStableValue(value));
}

function toStableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toStableValue);
  if (!isRecord(value)) return value;

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((output, key) => {
      output[key] = toStableValue(value[key]);
      return output;
    }, {});
}

function emptyModel(): SocialPublicationLedgerPersistenceModel {
  return {
    attempts: [],
    outcomes: [],
    evidence: [],
  };
}

function mutableClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function immutableClone<T>(value: T): T {
  return deepFreeze(mutableClone(value));
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object") return value;

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}

function ok<T>(value: T): SocialPublicationLedgerRepositoryResult<T> {
  return { ok: true, value };
}

function failure(
  code: SocialPublicationLedgerRepositoryErrorCode,
  message: string,
  validationErrors?: readonly SocialPublicationLedgerPersistenceError[],
): SocialPublicationLedgerRepositoryResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      validationErrors,
    },
  };
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
