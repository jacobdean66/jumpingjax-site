import type { PublicationTargetSelectionSnapshot } from "./social-publication-targets";

export const PUBLICATION_LEDGER_EVENT_TYPES = [
  "publication_attempt_started",
  "publication_attempt_succeeded",
  "publication_attempt_failed",
  "publication_attempt_cancelled",
  "publication_attempt_retry_requested",
  "publication_attempt_retry_started",
  "publication_attempt_retry_succeeded",
  "publication_attempt_retry_failed",
] as const;

export const PUBLICATION_LEDGER_ACTORS = [
  "system",
  "owner",
  "admin",
  "scheduler",
  "publisher",
  "test",
] as const;

export const PUBLICATION_LEDGER_SOURCES = [
  "publication_ledger_domain",
  "manual_admin",
  "future_scheduler",
  "future_publisher",
  "test",
] as const;

export const PUBLICATION_LEDGER_ERROR_CODES = [
  "ledger_entry_id_required",
  "publication_attempt_id_required",
  "event_type_required",
  "event_type_unknown",
  "attempt_sequence_invalid",
  "social_post_id_required",
  "publication_target_id_required",
  "publication_manifest_id_invalid",
  "approval_reference_invalid",
  "target_snapshot_invalid",
  "actor_invalid",
  "source_invalid",
  "created_at_required",
  "append_only_invariant_failed",
  "secret_forbidden",
  "scheduler_state_forbidden",
  "metrics_state_forbidden",
  "learning_state_forbidden",
  "mutable_publish_state_forbidden",
  "approval_state_forbidden",
] as const;

export type PublicationLedgerEntryId = string;
export type PublicationAttemptId = string;

export type PublicationLedgerEventType =
  (typeof PUBLICATION_LEDGER_EVENT_TYPES)[number];

export type PublicationLedgerActor =
  (typeof PUBLICATION_LEDGER_ACTORS)[number];

export type PublicationLedgerSource =
  (typeof PUBLICATION_LEDGER_SOURCES)[number];

export type PublicationLedgerErrorCode =
  (typeof PUBLICATION_LEDGER_ERROR_CODES)[number];

export type PublicationLedgerValidationError = Readonly<{
  code: PublicationLedgerErrorCode;
  path: string;
  message: string;
}>;

export type PublicationLedgerValidationResult = Readonly<
  | {
      ok: true;
      errors: readonly [];
    }
  | {
      ok: false;
      errors: readonly PublicationLedgerValidationError[];
    }
>;

export type PublicationLedgerJsonPrimitive = string | number | boolean | null;

export type PublicationLedgerJsonValue =
  | PublicationLedgerJsonPrimitive
  | readonly PublicationLedgerJsonValue[]
  | { readonly [key: string]: PublicationLedgerJsonValue };

export type PublicationLedgerJsonObject = Readonly<{
  [key: string]: PublicationLedgerJsonValue;
}>;

export type PublicationLedgerRequestSummary = Readonly<{
  requestId: string | null;
  operation: string;
  mediaKind: "image" | "video" | "mixed" | "none" | null;
  payloadSummary: PublicationLedgerJsonObject;
  containsFullPayload: false;
  containsSecrets: false;
}>;

export type PublicationLedgerResultSummary = Readonly<{
  externalPublicationId: string | null;
  externalUrl: string | null;
  resultCode: string | null;
  message: string | null;
  responseSummary: PublicationLedgerJsonObject;
  containsFullResponse: false;
  containsSecrets: false;
}>;

export type PublicationLedgerErrorSummary = Readonly<{
  errorCode: string | null;
  message: string | null;
  retryable: boolean | null;
  errorSummary: PublicationLedgerJsonObject;
  containsFullResponse: false;
  containsSecrets: false;
}>;

export type PublicationLedgerEvidenceSummary = Readonly<{
  evidenceKind: "request_summary" | "result_summary" | "error_summary" | "operator_note" | "none";
  notes: string | null;
  externalReference: string | null;
  evidence: PublicationLedgerJsonObject;
  containsFullPayload: false;
  containsFullResponse: false;
  containsSecrets: false;
}>;

export type PublicationLedgerReferences = Readonly<{
  socialPostId: string;
  publicationTargetId: string;
  publicationManifestId: string | null;
  ownerApprovalId: string | null;
  approvalId: string | null;
  proposalId: string | null;
}>;

export type PublicationLedgerEntry = Readonly<{
  ledgerEntryId: PublicationLedgerEntryId;
  publicationAttemptId: PublicationAttemptId;
  eventType: PublicationLedgerEventType;
  attemptSequence: number;
  references: PublicationLedgerReferences;
  targetSnapshot: PublicationTargetSelectionSnapshot;
  requestSummary: PublicationLedgerRequestSummary | null;
  resultSummary: PublicationLedgerResultSummary | null;
  errorSummary: PublicationLedgerErrorSummary | null;
  evidenceSummary: PublicationLedgerEvidenceSummary | null;
  actor: PublicationLedgerActor;
  source: PublicationLedgerSource;
  createdAt: string;
  appendOnly: true;
  immutable: true;
  grantsPublishingPermission: false;
  approvesNothing: true;
  publishesNothing: true;
  schedulesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
  currentPublishStatusAuthority: false;
}>;

type UnknownRecord = Readonly<Record<string, unknown>>;

const EVENT_TYPE_SET = new Set<string>(PUBLICATION_LEDGER_EVENT_TYPES);
const ACTOR_SET = new Set<string>(PUBLICATION_LEDGER_ACTORS);
const SOURCE_SET = new Set<string>(PUBLICATION_LEDGER_SOURCES);

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

const FORBIDDEN_SCHEDULER_STATE_KEYS = new Set([
  "scheduledAt",
  "scheduledFor",
  "schedulerAuthority",
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

const FORBIDDEN_MUTABLE_PUBLISH_STATE_KEYS = new Set([
  "currentPublishStatus",
  "isPublished",
  "postedAt",
  "publishState",
  "publishStatus",
  "publishedAt",
]);

const FORBIDDEN_APPROVAL_STATE_KEYS = new Set([
  "approvalDecision",
  "approvalState",
  "approvalStatus",
  "currentApproval",
  "ownerApproval",
]);

export function isPublicationLedgerEventType(
  value: string,
): value is PublicationLedgerEventType {
  return EVENT_TYPE_SET.has(value);
}

export function validatePublicationLedgerEntry(
  entry: PublicationLedgerEntry,
): PublicationLedgerValidationResult {
  const errors: PublicationLedgerValidationError[] = [];

  validateRequiredText(entry.ledgerEntryId, "ledgerEntryId", "ledger_entry_id_required", errors);
  validateRequiredText(
    entry.publicationAttemptId,
    "publicationAttemptId",
    "publication_attempt_id_required",
    errors,
  );
  validateEventType(entry.eventType, errors);
  validateAttemptSequence(entry.attemptSequence, errors);
  validateReferences(entry.references, errors);
  validateTargetSnapshot(entry.targetSnapshot, errors);
  validateActor(entry.actor, errors);
  validateSource(entry.source, errors);
  validateRequiredText(entry.createdAt, "createdAt", "created_at_required", errors);
  validateAppendOnlyInvariants(entry, errors);
  rejectForbiddenStoredState(entry, errors);

  return validationResult(errors);
}

function validateEventType(
  eventType: PublicationLedgerEventType,
  errors: PublicationLedgerValidationError[],
): void {
  if (!hasText(eventType)) {
    errors.push(
      validationError({
        code: "event_type_required",
        path: "eventType",
        message: "Publication ledger event type is required.",
      }),
    );
  } else if (!isPublicationLedgerEventType(eventType)) {
    errors.push(
      validationError({
        code: "event_type_unknown",
        path: "eventType",
        message: "Publication ledger event type is not supported.",
      }),
    );
  }
}

function validateAttemptSequence(
  attemptSequence: number,
  errors: PublicationLedgerValidationError[],
): void {
  if (!Number.isInteger(attemptSequence) || attemptSequence < 0) {
    errors.push(
      validationError({
        code: "attempt_sequence_invalid",
        path: "attemptSequence",
        message: "Publication attempt sequence must be a non-negative integer.",
      }),
    );
  }
}

function validateReferences(
  references: PublicationLedgerReferences,
  errors: PublicationLedgerValidationError[],
): void {
  if (!isRecord(references)) {
    errors.push(
      validationError({
        code: "social_post_id_required",
        path: "references",
        message: "Publication ledger references are required.",
      }),
    );
    return;
  }

  validateRequiredText(
    references.socialPostId,
    "references.socialPostId",
    "social_post_id_required",
    errors,
  );
  validateRequiredText(
    references.publicationTargetId,
    "references.publicationTargetId",
    "publication_target_id_required",
    errors,
  );
  validateOptionalText(
    references.publicationManifestId,
    "references.publicationManifestId",
    "publication_manifest_id_invalid",
    errors,
  );
  validateOptionalText(
    references.ownerApprovalId,
    "references.ownerApprovalId",
    "approval_reference_invalid",
    errors,
  );
  validateOptionalText(
    references.approvalId,
    "references.approvalId",
    "approval_reference_invalid",
    errors,
  );
  validateOptionalText(
    references.proposalId,
    "references.proposalId",
    "approval_reference_invalid",
    errors,
  );
}

function validateTargetSnapshot(
  snapshot: PublicationTargetSelectionSnapshot,
  errors: PublicationLedgerValidationError[],
): void {
  if (
    !isRecord(snapshot) ||
    !hasText(snapshot.targetId) ||
    !hasText(snapshot.platform) ||
    !hasText(snapshot.targetType) ||
    !hasText(snapshot.displayName) ||
    !hasText(snapshot.externalId) ||
    !snapshot.capabilitySummary ||
    snapshot.source !== "publication_target_selection_snapshot" ||
    snapshot.computedOnly !== true ||
    snapshot.authoritative !== false ||
    snapshot.grantsPublishingPermission !== false ||
    snapshot.publishesNothing !== true ||
    snapshot.schedulesNothing !== true ||
    snapshot.recordsNoMetrics !== true ||
    snapshot.performsNoLearning !== true
  ) {
    errors.push(
      validationError({
        code: "target_snapshot_invalid",
        path: "targetSnapshot",
        message: "Publication ledger entries require a safe D7 target selection snapshot.",
      }),
    );
  }
}

function validateActor(
  actor: PublicationLedgerActor,
  errors: PublicationLedgerValidationError[],
): void {
  if (!ACTOR_SET.has(actor)) {
    errors.push(
      validationError({
        code: "actor_invalid",
        path: "actor",
        message: "Publication ledger actor is not supported.",
      }),
    );
  }
}

function validateSource(
  source: PublicationLedgerSource,
  errors: PublicationLedgerValidationError[],
): void {
  if (!SOURCE_SET.has(source)) {
    errors.push(
      validationError({
        code: "source_invalid",
        path: "source",
        message: "Publication ledger source is not supported.",
      }),
    );
  }
}

function validateAppendOnlyInvariants(
  entry: PublicationLedgerEntry,
  errors: PublicationLedgerValidationError[],
): void {
  if (
    entry.appendOnly !== true ||
    entry.immutable !== true ||
    entry.grantsPublishingPermission !== false ||
    entry.approvesNothing !== true ||
    entry.publishesNothing !== true ||
    entry.schedulesNothing !== true ||
    entry.recordsNoMetrics !== true ||
    entry.performsNoLearning !== true ||
    entry.currentPublishStatusAuthority !== false
  ) {
    errors.push(
      validationError({
        code: "append_only_invariant_failed",
        path: "appendOnlyInvariants",
        message: "Publication ledger entries must remain append-only evidence, not authority.",
      }),
    );
  }
}

function rejectForbiddenStoredState(
  entry: PublicationLedgerEntry,
  errors: PublicationLedgerValidationError[],
): void {
  rejectForbiddenKeys(entry, "entry", FORBIDDEN_SECRET_KEYS, "secret_forbidden", errors);
  rejectForbiddenKeys(
    entry,
    "entry",
    FORBIDDEN_SCHEDULER_STATE_KEYS,
    "scheduler_state_forbidden",
    errors,
  );
  rejectForbiddenKeys(entry, "entry", FORBIDDEN_METRICS_STATE_KEYS, "metrics_state_forbidden", errors);
  rejectForbiddenKeys(entry, "entry", FORBIDDEN_LEARNING_STATE_KEYS, "learning_state_forbidden", errors);
  rejectForbiddenKeys(
    entry,
    "entry",
    FORBIDDEN_MUTABLE_PUBLISH_STATE_KEYS,
    "mutable_publish_state_forbidden",
    errors,
  );
  rejectForbiddenKeys(
    entry,
    "entry",
    FORBIDDEN_APPROVAL_STATE_KEYS,
    "approval_state_forbidden",
    errors,
  );
}

function rejectForbiddenKeys(
  value: unknown,
  path: string,
  forbiddenKeys: ReadonlySet<string>,
  code: PublicationLedgerErrorCode,
  errors: PublicationLedgerValidationError[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      rejectForbiddenKeys(item, `${path}.${index}`, forbiddenKeys, code, errors),
    );
    return;
  }

  if (!isRecord(value)) return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (forbiddenKeys.has(key)) {
      errors.push(
        validationError({
          code,
          path: childPath,
          message: "Publication ledger entries must not store unsafe execution state.",
        }),
      );
    }

    rejectForbiddenKeys(child, childPath, forbiddenKeys, code, errors);
  }
}

function validateRequiredText(
  value: unknown,
  path: string,
  code: PublicationLedgerErrorCode,
  errors: PublicationLedgerValidationError[],
): void {
  if (!hasText(value)) {
    errors.push(
      validationError({
        code,
        path,
        message: "Required publication ledger field is missing.",
      }),
    );
  }
}

function validateOptionalText(
  value: unknown,
  path: string,
  code: PublicationLedgerErrorCode,
  errors: PublicationLedgerValidationError[],
): void {
  if (value !== null && value !== undefined && !hasText(value)) {
    errors.push(
      validationError({
        code,
        path,
        message: "Optional publication ledger reference must be null or non-empty text.",
      }),
    );
  }
}

function validationError(input: {
  code: PublicationLedgerErrorCode;
  path: string;
  message: string;
}): PublicationLedgerValidationError {
  return input;
}

function validationResult(
  errors: PublicationLedgerValidationError[],
): PublicationLedgerValidationResult {
  if (errors.length === 0) {
    return { ok: true, errors: [] };
  }

  return { ok: false, errors };
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
