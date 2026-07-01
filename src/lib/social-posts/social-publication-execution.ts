export const PUBLICATION_EXECUTION_JOB_TYPES = [
  "model_execution_job",
] as const;

export const PUBLICATION_EXECUTION_INTENT_TYPES = [
  "prepare_execution_intent",
] as const;

export const PUBLICATION_EXECUTION_RESULT_TYPES = [
  "execution_result_recorded",
] as const;

export const PUBLICATION_EXECUTION_PREFLIGHT_STATUSES = [
  "not_run",
  "passed",
  "blocked",
  "failed",
] as const;

export const PUBLICATION_EXECUTION_RESULT_STATUSES = [
  "blocked",
  "failed",
  "completed",
] as const;

export const PUBLICATION_EXECUTION_BLOCK_REASONS = [
  "missing_owner_approval",
  "missing_publisher_request",
  "missing_publisher_result",
  "publisher_result_rejected",
  "missing_schedule_intent",
  "schedule_not_active",
  "schedule_not_due",
  "missing_ledger_entry",
  "missing_publication_manifest",
  "missing_publication_target",
  "authority_insufficient",
  "preflight_not_run",
  "preflight_previously_failed",
] as const;

export const PUBLICATION_EXECUTION_ERROR_CODES = [
  "job_id_required",
  "job_type_required",
  "job_type_unknown",
  "intent_id_required",
  "intent_type_required",
  "intent_type_unknown",
  "result_id_required",
  "result_type_required",
  "result_type_unknown",
  "result_status_required",
  "result_status_unknown",
  "social_post_id_required",
  "publication_target_id_required",
  "publisher_reference_invalid",
  "schedule_id_invalid",
  "ledger_id_invalid",
  "manifest_id_invalid",
  "approval_reference_invalid",
  "metric_reference_invalid",
  "learning_reference_invalid",
  "campaign_memory_reference_invalid",
  "decision_history_reference_invalid",
  "authority_invalid",
  "preflight_invalid",
  "preflight_status_unknown",
  "preflight_job_mismatch",
  "block_reason_invalid",
  "block_reasons_required",
  "block_reasons_forbidden",
  "evidence_invalid",
  "evidence_required",
  "created_at_required",
  "updated_at_required",
  "intent_invariant_failed",
  "result_invariant_failed",
  "secret_forbidden",
  "external_api_forbidden",
  "sdk_forbidden",
  "network_forbidden",
  "cron_or_timer_forbidden",
  "worker_or_queue_forbidden",
  "api_route_forbidden",
  "admin_ui_forbidden",
  "sql_or_supabase_forbidden",
  "bridge_forbidden",
  "storage_forbidden",
  "lower_layer_payload_forbidden",
  "lower_layer_mutation_forbidden",
  "execution_trigger_forbidden",
  "metrics_state_forbidden",
  "learning_state_forbidden",
  "mutable_execution_state_forbidden",
] as const;

export type PublicationExecutionJobId = string;
export type PublicationExecutionIntentId = string;
export type PublicationExecutionPreflightId = string;
export type PublicationExecutionResultId = string;

export type PublicationExecutionJobType =
  (typeof PUBLICATION_EXECUTION_JOB_TYPES)[number];

export type PublicationExecutionIntentType =
  (typeof PUBLICATION_EXECUTION_INTENT_TYPES)[number];

export type PublicationExecutionResultType =
  (typeof PUBLICATION_EXECUTION_RESULT_TYPES)[number];

export type PublicationExecutionPreflightStatus =
  (typeof PUBLICATION_EXECUTION_PREFLIGHT_STATUSES)[number];

export type PublicationExecutionResultStatus =
  (typeof PUBLICATION_EXECUTION_RESULT_STATUSES)[number];

export type PublicationExecutionBlockReason =
  (typeof PUBLICATION_EXECUTION_BLOCK_REASONS)[number];

export type PublicationExecutionErrorCode =
  (typeof PUBLICATION_EXECUTION_ERROR_CODES)[number];

export type PublicationExecutionValidationError = Readonly<{
  code: PublicationExecutionErrorCode;
  path: string;
  message: string;
}>;

export type PublicationExecutionValidationResult = Readonly<
  | {
      ok: true;
      errors: readonly [];
    }
  | {
      ok: false;
      errors: readonly PublicationExecutionValidationError[];
    }
>;

export type PublicationExecutionJsonPrimitive = string | number | boolean | null;

export type PublicationExecutionJsonValue =
  | PublicationExecutionJsonPrimitive
  | readonly PublicationExecutionJsonValue[]
  | { readonly [key: string]: PublicationExecutionJsonValue };

export type PublicationExecutionJsonObject = Readonly<{
  [key: string]: PublicationExecutionJsonValue;
}>;

export type PublicationExecutionReferences = Readonly<{
  socialPostId: string;
  publicationTargetId: string;
  publisherRequestId: string | null;
  publisherResultId: string | null;
  publisherJobId: string | null;
  scheduleId: string | null;
  ledgerEntryId: string | null;
  publicationManifestId: string | null;
  ownerApprovalId: string | null;
  approvalId: string | null;
  metricObservationId: string | null;
  learningInsightId: string | null;
  campaignMemoryId: string | null;
  decisionHistoryId: string | null;
}>;

export type PublicationExecutionJobIdentity = Readonly<{
  jobId: PublicationExecutionJobId;
  jobType: PublicationExecutionJobType;
  references: PublicationExecutionReferences;
  createdAt: string;
  updatedAt: string;
  modelContractOnly: true;
  executesNothing: true;
  publishesNothing: true;
  grantsExecutionPermission: false;
  mutatesLedger: false;
  mutatesTargets: false;
  mutatesApproval: false;
  mutatesManifest: false;
  mutatesScheduler: false;
  mutatesPublisher: false;
  persistsNothing: true;
}>;

export type PublicationExecutionAuthorityRequirement = Readonly<{
  authorityKind: "model";
  modelAuthorityOnly: true;
  ownerApprovalId: string | null;
  approvalId: string | null;
  requiresOwnerApproval: true;
  ownerApprovalSatisfied: boolean;
  requiresPublisherAuthority: true;
  publisherAuthoritySatisfied: boolean;
  requiresPreflightPass: true;
  preflightPassed: boolean;
  allowsExternalApiCall: false;
  allowsSdkUsage: false;
  allowsNetwork: false;
  allowsExecution: false;
  allowsPersistence: false;
  grantsExecutionPermission: false;
  canMutateLowerLayers: false;
}>;

export type PublicationExecutionPreflightResult = Readonly<{
  preflightId: PublicationExecutionPreflightId;
  jobId: PublicationExecutionJobId;
  status: PublicationExecutionPreflightStatus;
  blockReasons: readonly PublicationExecutionBlockReason[];
  evaluatedAt: string;
  computedOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  mutatesNoLowerLayers: true;
}>;

export type PublicationExecutionEvidenceReference = Readonly<{
  evidenceId: string;
  evidenceKind:
    | "preflight_evidence"
    | "authority_evidence"
    | "operator_note"
    | "none";
  notes: string | null;
  evidence: PublicationExecutionJsonObject;
  containsFullPayload: false;
  containsSecrets: false;
  provesExecution: false;
}>;

export type PublicationExecutionIntent = Readonly<{
  intentId: PublicationExecutionIntentId;
  intentType: PublicationExecutionIntentType;
  job: PublicationExecutionJobIdentity;
  authority: PublicationExecutionAuthorityRequirement;
  preflight: PublicationExecutionPreflightResult | null;
  evidence: PublicationExecutionEvidenceReference | null;
  createdAt: string;
  updatedAt: string;
  contractOnly: true;
  modelAuthorityOnly: true;
  executesNothing: true;
  publishesNothing: true;
  callsNoExternalApis: true;
  usesNoSdks: true;
  usesNoNetwork: true;
  startsNoWorkers: true;
  startsNoTimers: true;
  createsNoQueues: true;
  exposesNoApiRoutes: true;
  exposesNoAdminUi: true;
  mutatesNoSql: true;
  mutatesNoSupabase: true;
  mutatesNoBridge: true;
  mutatesNoStorage: true;
  mutatesNoLowerLayers: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
  grantsExecutionPermission: false;
}>;

export type PublicationExecutionResult = Readonly<{
  resultId: PublicationExecutionResultId;
  intentId: PublicationExecutionIntentId;
  job: PublicationExecutionJobIdentity;
  authority: PublicationExecutionAuthorityRequirement;
  resultType: PublicationExecutionResultType;
  status: PublicationExecutionResultStatus;
  blockReasons: readonly PublicationExecutionBlockReason[];
  evidence: PublicationExecutionEvidenceReference | null;
  createdAt: string;
  updatedAt: string;
  contractOnly: true;
  modelAuthorityOnly: true;
  executesNothing: true;
  publishesNothing: true;
  callsNoExternalApis: true;
  usesNoSdks: true;
  usesNoNetwork: true;
  persistsNothing: true;
  mutatesNoLowerLayers: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
  currentExecutionStatusAuthority: false;
  grantsExecutionPermission: false;
}>;

type UnknownRecord = Readonly<Record<string, unknown>>;

const JOB_TYPE_SET = new Set<string>(PUBLICATION_EXECUTION_JOB_TYPES);
const INTENT_TYPE_SET = new Set<string>(PUBLICATION_EXECUTION_INTENT_TYPES);
const RESULT_TYPE_SET = new Set<string>(PUBLICATION_EXECUTION_RESULT_TYPES);
const PREFLIGHT_STATUS_SET = new Set<string>(PUBLICATION_EXECUTION_PREFLIGHT_STATUSES);
const RESULT_STATUS_SET = new Set<string>(PUBLICATION_EXECUTION_RESULT_STATUSES);
const BLOCK_REASON_SET = new Set<string>(PUBLICATION_EXECUTION_BLOCK_REASONS);

const FORBIDDEN_SECRET_KEYS = new Set([
  "accessToken",
  "access_token",
  "apiKey",
  "api_key",
  "authHeader",
  "clientSecret",
  "client_secret",
  "credential",
  "credentials",
  "oauth",
  "oauthClientId",
  "oauthClientSecret",
  "oauthToken",
  "password",
  "refreshToken",
  "refresh_token",
  "secret",
  "token",
]);

const FORBIDDEN_EXTERNAL_API_KEYS = new Set([
  "apiEndpoint",
  "apiRequest",
  "apiResponse",
  "externalApi",
  "externalRequest",
  "externalResponse",
  "facebookApi",
  "facebookGraphApi",
  "googleApi",
  "instagramApi",
  "instagramGraphApi",
  "linkedinApi",
  "tiktokApi",
]);

const FORBIDDEN_SDK_KEYS = new Set([
  "client",
  "facebookClient",
  "graphClient",
  "instagramClient",
  "sdk",
  "sdkClient",
]);

const FORBIDDEN_NETWORK_KEYS = new Set([
  "fetch",
  "httpClient",
  "networkRequest",
  "requestInit",
  "urlToFetch",
  "webhook",
]);

const FORBIDDEN_CRON_TIMER_KEYS = new Set([
  "cron",
  "cronExpression",
  "intervalId",
  "setInterval",
  "setTimeout",
  "timerId",
  "timerReference",
]);

const FORBIDDEN_WORKER_QUEUE_KEYS = new Set([
  "jobQueue",
  "queue",
  "queueName",
  "worker",
  "workerId",
]);

const FORBIDDEN_API_ROUTE_KEYS = new Set([
  "apiRoute",
  "routeHandler",
  "routePath",
]);

const FORBIDDEN_ADMIN_UI_KEYS = new Set([
  "adminAction",
  "adminComponent",
  "adminUi",
  "adminUrl",
]);

const FORBIDDEN_SQL_SUPABASE_KEYS = new Set([
  "serviceRoleClient",
  "sql",
  "sqlMutation",
  "supabase",
  "supabaseClient",
  "supabaseMutation",
]);

const FORBIDDEN_BRIDGE_KEYS = new Set([
  "bridge",
  "bridgePayload",
  "ledgerBridge",
  "publisherBridge",
  "schedulerBridge",
]);

const FORBIDDEN_STORAGE_KEYS = new Set([
  "bucket",
  "objectPath",
  "storage",
  "storagePath",
  "upload",
]);

const FORBIDDEN_LOWER_LAYER_PAYLOAD_KEYS = new Set([
  "approvalDecision",
  "approvalPayload",
  "approvalState",
  "ledgerEntry",
  "ledgerPayload",
  "manifest",
  "manifestPayload",
  "publisherPayload",
  "publisherRequestPayload",
  "publisherResultPayload",
  "schedulePayload",
  "schedulerState",
  "targetDefinition",
  "targetPayload",
]);

const FORBIDDEN_LOWER_LAYER_MUTATION_KEYS = new Set([
  "appendLedgerEntry",
  "mutateApproval",
  "mutateLedger",
  "mutateManifest",
  "mutatePublisher",
  "mutateScheduler",
  "mutateTarget",
  "updateApproval",
  "updateLedger",
  "updateManifest",
  "updatePublisher",
  "updateSchedule",
  "updateTarget",
  "writeLedger",
]);

const FORBIDDEN_EXECUTION_TRIGGER_KEYS = new Set([
  "execute",
  "executeJob",
  "executePublication",
  "publish",
  "publishPost",
  "publishResult",
  "publishToTarget",
  "publishedAt",
  "runExecution",
  "sendPost",
  "triggerExecution",
]);

const FORBIDDEN_METRICS_KEYS = new Set([
  "analytics",
  "clicks",
  "engagement",
  "impressions",
  "metrics",
  "reach",
]);

const FORBIDDEN_LEARNING_KEYS = new Set([
  "campaignMemory",
  "learning",
  "learningSignal",
  "modelFeedback",
]);

const FORBIDDEN_MUTABLE_EXECUTION_STATE_KEYS = new Set([
  "currentExecutionStatus",
  "executedAt",
  "executedPostId",
  "executionState",
  "executionStatus",
  "isExecuted",
]);

export function isPublicationExecutionJobType(
  value: string,
): value is PublicationExecutionJobType {
  return JOB_TYPE_SET.has(value);
}

export function isPublicationExecutionIntentType(
  value: string,
): value is PublicationExecutionIntentType {
  return INTENT_TYPE_SET.has(value);
}

export function isPublicationExecutionResultType(
  value: string,
): value is PublicationExecutionResultType {
  return RESULT_TYPE_SET.has(value);
}

export function isPublicationExecutionPreflightStatus(
  value: string,
): value is PublicationExecutionPreflightStatus {
  return PREFLIGHT_STATUS_SET.has(value);
}

export function isPublicationExecutionResultStatus(
  value: string,
): value is PublicationExecutionResultStatus {
  return RESULT_STATUS_SET.has(value);
}

export function isPublicationExecutionBlockReason(
  value: string,
): value is PublicationExecutionBlockReason {
  return BLOCK_REASON_SET.has(value);
}

export function validatePublicationExecutionIntent(
  intent: PublicationExecutionIntent,
): PublicationExecutionValidationResult {
  const errors: PublicationExecutionValidationError[] = [];

  validateRequiredText(intent.intentId, "intentId", "intent_id_required", errors);
  if (!hasText(intent.intentType)) {
    errors.push(validationError({
      code: "intent_type_required",
      path: "intentType",
      message: "Execution intent type is required.",
    }));
  } else if (!isPublicationExecutionIntentType(intent.intentType)) {
    errors.push(validationError({
      code: "intent_type_unknown",
      path: "intentType",
      message: "Execution intent type is not supported.",
    }));
  }

  validateJobIdentity(intent.job, "job", errors);
  validateAuthority(intent.authority, "authority", errors);
  validatePreflight(intent.preflight, intent.job, "preflight", errors);
  validateEvidence(intent.evidence, "evidence", errors);
  validateRequiredText(intent.createdAt, "createdAt", "created_at_required", errors);
  validateRequiredText(intent.updatedAt, "updatedAt", "updated_at_required", errors);
  validateIntentInvariants(intent, errors);
  rejectForbiddenUnsafeState(intent, "intent", errors);

  return validationResult(errors);
}

export function validatePublicationExecutionResult(
  result: PublicationExecutionResult,
): PublicationExecutionValidationResult {
  const errors: PublicationExecutionValidationError[] = [];

  validateRequiredText(result.resultId, "resultId", "result_id_required", errors);
  validateRequiredText(result.intentId, "intentId", "intent_id_required", errors);
  if (!hasText(result.resultType)) {
    errors.push(validationError({
      code: "result_type_required",
      path: "resultType",
      message: "Execution result type is required.",
    }));
  } else if (!isPublicationExecutionResultType(result.resultType)) {
    errors.push(validationError({
      code: "result_type_unknown",
      path: "resultType",
      message: "Execution result type is not supported.",
    }));
  }

  validateJobIdentity(result.job, "job", errors);
  validateAuthority(result.authority, "authority", errors);
  validateResultStatusAndReasons(result, errors);
  validateEvidence(result.evidence, "evidence", errors);
  validateRequiredText(result.createdAt, "createdAt", "created_at_required", errors);
  validateRequiredText(result.updatedAt, "updatedAt", "updated_at_required", errors);
  validateResultInvariants(result, errors);
  rejectForbiddenUnsafeState(result, "result", errors);

  return validationResult(errors);
}

export function assertPublicationExecutionIntentSafe(
  intent: PublicationExecutionIntent,
): asserts intent is PublicationExecutionIntent {
  const validation = validatePublicationExecutionIntent(intent);
  if (!validation.ok) {
    throw new Error("Publication execution intent failed safety validation.");
  }
}

export function assertPublicationExecutionResultSafe(
  result: PublicationExecutionResult,
): asserts result is PublicationExecutionResult {
  const validation = validatePublicationExecutionResult(result);
  if (!validation.ok) {
    throw new Error("Publication execution result failed safety validation.");
  }
}

export function serializePublicationExecutionIntent(
  intent: PublicationExecutionIntent,
): string {
  assertPublicationExecutionIntentSafe(intent);
  return stableStringify(intent);
}

export function serializePublicationExecutionResult(
  result: PublicationExecutionResult,
): string {
  assertPublicationExecutionResultSafe(result);
  return stableStringify(result);
}

export function hydratePublicationExecutionIntent(
  serialized: string,
): PublicationExecutionValidationResult & { value?: PublicationExecutionIntent } {
  const parsed = parseSerialized(serialized, "intent_invariant_failed");
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const validation = validatePublicationExecutionIntent(
    parsed.value as PublicationExecutionIntent,
  );
  if (!validation.ok) return validation;

  return {
    ok: true,
    errors: [],
    value: deepFreeze(immutableClone(parsed.value as PublicationExecutionIntent)),
  };
}

export function hydratePublicationExecutionResult(
  serialized: string,
): PublicationExecutionValidationResult & { value?: PublicationExecutionResult } {
  const parsed = parseSerialized(serialized, "result_invariant_failed");
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const validation = validatePublicationExecutionResult(
    parsed.value as PublicationExecutionResult,
  );
  if (!validation.ok) return validation;

  return {
    ok: true,
    errors: [],
    value: deepFreeze(immutableClone(parsed.value as PublicationExecutionResult)),
  };
}

export function sortPublicationExecutionIntentsByUpdatedAt(
  intents: readonly PublicationExecutionIntent[],
): readonly PublicationExecutionIntent[] {
  return deepFreeze(
    [...intents].sort(
      (left, right) =>
        left.updatedAt.localeCompare(right.updatedAt) ||
        left.intentId.localeCompare(right.intentId),
    ),
  );
}

function validateJobIdentity(
  job: PublicationExecutionJobIdentity,
  path: string,
  errors: PublicationExecutionValidationError[],
): void {
  if (!isRecord(job)) {
    errors.push(validationError({
      code: "job_id_required",
      path,
      message: "Execution job identity is required.",
    }));
    return;
  }

  validateRequiredText(job.jobId, `${path}.jobId`, "job_id_required", errors);
  if (!hasText(job.jobType)) {
    errors.push(validationError({
      code: "job_type_required",
      path: `${path}.jobType`,
      message: "Execution job type is required.",
    }));
  } else if (!isPublicationExecutionJobType(job.jobType)) {
    errors.push(validationError({
      code: "job_type_unknown",
      path: `${path}.jobType`,
      message: "Execution job type is not supported.",
    }));
  }

  validateReferences(job.references, `${path}.references`, errors);
  validateRequiredText(job.createdAt, `${path}.createdAt`, "created_at_required", errors);
  validateRequiredText(job.updatedAt, `${path}.updatedAt`, "updated_at_required", errors);

  if (
    job.modelContractOnly !== true ||
    job.executesNothing !== true ||
    job.publishesNothing !== true ||
    job.grantsExecutionPermission !== false ||
    job.mutatesLedger !== false ||
    job.mutatesTargets !== false ||
    job.mutatesApproval !== false ||
    job.mutatesManifest !== false ||
    job.mutatesScheduler !== false ||
    job.mutatesPublisher !== false ||
    job.persistsNothing !== true
  ) {
    errors.push(validationError({
      code: "intent_invariant_failed",
      path,
      message: "Execution jobs must remain model-only contracts.",
    }));
  }
}

function validateReferences(
  references: PublicationExecutionReferences,
  path: string,
  errors: PublicationExecutionValidationError[],
): void {
  if (!isRecord(references)) {
    errors.push(validationError({
      code: "social_post_id_required",
      path,
      message: "Execution references are required.",
    }));
    return;
  }

  validateRequiredText(references.socialPostId, `${path}.socialPostId`, "social_post_id_required", errors);
  validateRequiredText(
    references.publicationTargetId,
    `${path}.publicationTargetId`,
    "publication_target_id_required",
    errors,
  );
  validateOptionalText(references.publisherRequestId, `${path}.publisherRequestId`, "publisher_reference_invalid", errors);
  validateOptionalText(references.publisherResultId, `${path}.publisherResultId`, "publisher_reference_invalid", errors);
  validateOptionalText(references.publisherJobId, `${path}.publisherJobId`, "publisher_reference_invalid", errors);
  validateOptionalText(references.scheduleId, `${path}.scheduleId`, "schedule_id_invalid", errors);
  validateOptionalText(references.ledgerEntryId, `${path}.ledgerEntryId`, "ledger_id_invalid", errors);
  validateOptionalText(references.publicationManifestId, `${path}.publicationManifestId`, "manifest_id_invalid", errors);
  validateOptionalText(references.ownerApprovalId, `${path}.ownerApprovalId`, "approval_reference_invalid", errors);
  validateOptionalText(references.approvalId, `${path}.approvalId`, "approval_reference_invalid", errors);
  validateOptionalText(references.metricObservationId, `${path}.metricObservationId`, "metric_reference_invalid", errors);
  validateOptionalText(references.learningInsightId, `${path}.learningInsightId`, "learning_reference_invalid", errors);
  validateOptionalText(references.campaignMemoryId, `${path}.campaignMemoryId`, "campaign_memory_reference_invalid", errors);
  validateOptionalText(references.decisionHistoryId, `${path}.decisionHistoryId`, "decision_history_reference_invalid", errors);
}

function validateAuthority(
  authority: PublicationExecutionAuthorityRequirement,
  path: string,
  errors: PublicationExecutionValidationError[],
): void {
  if (
    !isRecord(authority) ||
    authority.authorityKind !== "model" ||
    authority.modelAuthorityOnly !== true ||
    authority.requiresOwnerApproval !== true ||
    typeof authority.ownerApprovalSatisfied !== "boolean" ||
    authority.requiresPublisherAuthority !== true ||
    typeof authority.publisherAuthoritySatisfied !== "boolean" ||
    authority.requiresPreflightPass !== true ||
    typeof authority.preflightPassed !== "boolean" ||
    authority.allowsExternalApiCall !== false ||
    authority.allowsSdkUsage !== false ||
    authority.allowsNetwork !== false ||
    authority.allowsExecution !== false ||
    authority.allowsPersistence !== false ||
    authority.grantsExecutionPermission !== false ||
    authority.canMutateLowerLayers !== false
  ) {
    errors.push(validationError({
      code: "authority_invalid",
      path,
      message: "Execution authority must be model-only and non-executable.",
    }));
    return;
  }

  validateOptionalText(authority.ownerApprovalId, `${path}.ownerApprovalId`, "approval_reference_invalid", errors);
  validateOptionalText(authority.approvalId, `${path}.approvalId`, "approval_reference_invalid", errors);
}

function validatePreflight(
  preflight: PublicationExecutionPreflightResult | null,
  job: PublicationExecutionJobIdentity,
  path: string,
  errors: PublicationExecutionValidationError[],
): void {
  if (preflight === null) return;

  if (!isRecord(preflight)) {
    errors.push(validationError({
      code: "preflight_invalid",
      path,
      message: "Execution preflight result must be an object or null.",
    }));
    return;
  }

  validateRequiredText(preflight.preflightId, `${path}.preflightId`, "preflight_invalid", errors);
  validateRequiredText(preflight.jobId, `${path}.jobId`, "preflight_invalid", errors);
  if (isRecord(job) && hasText(preflight.jobId) && hasText(job.jobId) && preflight.jobId !== job.jobId) {
    errors.push(validationError({
      code: "preflight_job_mismatch",
      path: `${path}.jobId`,
      message: "Execution preflight must reference the same job it was evaluated for.",
    }));
  }

  if (!hasText(preflight.status)) {
    errors.push(validationError({
      code: "preflight_status_unknown",
      path: `${path}.status`,
      message: "Execution preflight status is required.",
    }));
  } else if (!isPublicationExecutionPreflightStatus(preflight.status)) {
    errors.push(validationError({
      code: "preflight_status_unknown",
      path: `${path}.status`,
      message: "Execution preflight status is not supported.",
    }));
  } else {
    validateBlockReasons(preflight.status, preflight.blockReasons, path, errors);
  }

  validateRequiredText(preflight.evaluatedAt, `${path}.evaluatedAt`, "created_at_required", errors);

  if (
    preflight.computedOnly !== true ||
    preflight.authoritative !== false ||
    preflight.grantsExecutionPermission !== false ||
    preflight.mutatesNoLowerLayers !== true
  ) {
    errors.push(validationError({
      code: "preflight_invalid",
      path,
      message: "Execution preflight results must remain computed-only and non-authoritative.",
    }));
  }
}

function validateBlockReasons(
  status: PublicationExecutionPreflightStatus | PublicationExecutionResultStatus,
  blockReasons: unknown,
  path: string,
  errors: PublicationExecutionValidationError[],
): void {
  if (!Array.isArray(blockReasons)) {
    errors.push(validationError({
      code: "block_reason_invalid",
      path: `${path}.blockReasons`,
      message: "Execution block reasons must be an array.",
    }));
    return;
  }

  for (const [index, reason] of blockReasons.entries()) {
    if (typeof reason !== "string" || !isPublicationExecutionBlockReason(reason)) {
      errors.push(validationError({
        code: "block_reason_invalid",
        path: `${path}.blockReasons.${index}`,
        message: "Execution block reason is not supported.",
      }));
    }
  }

  if (status === "blocked" && blockReasons.length === 0) {
    errors.push(validationError({
      code: "block_reasons_required",
      path: `${path}.blockReasons`,
      message: "Blocked execution status requires at least one block reason.",
    }));
  }

  if ((status === "passed" || status === "not_run" || status === "completed") && blockReasons.length > 0) {
    errors.push(validationError({
      code: "block_reasons_forbidden",
      path: `${path}.blockReasons`,
      message: "Execution block reasons are only permitted for blocked or failed status.",
    }));
  }
}

function validateEvidence(
  evidence: PublicationExecutionEvidenceReference | null,
  path: string,
  errors: PublicationExecutionValidationError[],
): void {
  if (evidence === null) return;

  if (!isRecord(evidence)) {
    errors.push(validationError({
      code: "evidence_invalid",
      path,
      message: "Execution evidence must be an object or null.",
    }));
    return;
  }

  validateRequiredText(evidence.evidenceId, `${path}.evidenceId`, "evidence_invalid", errors);

  const allowedKinds = new Set([
    "preflight_evidence",
    "authority_evidence",
    "operator_note",
    "none",
  ]);
  if (!hasText(evidence.evidenceKind) || !allowedKinds.has(evidence.evidenceKind)) {
    errors.push(validationError({
      code: "evidence_invalid",
      path: `${path}.evidenceKind`,
      message: "Execution evidence kind is not supported.",
    }));
  }

  if (
    !isJsonObject(evidence.evidence) ||
    evidence.containsFullPayload !== false ||
    evidence.containsSecrets !== false ||
    evidence.provesExecution !== false
  ) {
    errors.push(validationError({
      code: "evidence_invalid",
      path,
      message: "Execution evidence must be sanitized and must not prove execution occurred.",
    }));
  }

  validateOptionalText(evidence.notes, `${path}.notes`, "evidence_invalid", errors);
}

function validateResultStatusAndReasons(
  result: PublicationExecutionResult,
  errors: PublicationExecutionValidationError[],
): void {
  if (!hasText(result.status)) {
    errors.push(validationError({
      code: "result_status_required",
      path: "status",
      message: "Execution result status is required.",
    }));
    return;
  }

  if (!isPublicationExecutionResultStatus(result.status)) {
    errors.push(validationError({
      code: "result_status_unknown",
      path: "status",
      message: "Execution result status is not supported.",
    }));
    return;
  }

  validateBlockReasons(result.status, result.blockReasons, "", errors);

  if (result.status === "completed") {
    const authority = result.authority;
    if (
      !isRecord(authority) ||
      authority.preflightPassed !== true ||
      authority.ownerApprovalSatisfied !== true ||
      authority.publisherAuthoritySatisfied !== true
    ) {
      errors.push(validationError({
        code: "result_invariant_failed",
        path: "status",
        message: "A completed execution result requires satisfied owner, publisher, and preflight authority.",
      }));
    }
  }

  if ((result.status === "blocked" || result.status === "failed") && result.evidence === null) {
    errors.push(validationError({
      code: "evidence_required",
      path: "evidence",
      message: "Blocked or failed execution results require sanitized evidence explaining the outcome.",
    }));
  }
}

function validateIntentInvariants(
  intent: PublicationExecutionIntent,
  errors: PublicationExecutionValidationError[],
): void {
  if (
    intent.contractOnly !== true ||
    intent.modelAuthorityOnly !== true ||
    intent.executesNothing !== true ||
    intent.publishesNothing !== true ||
    intent.callsNoExternalApis !== true ||
    intent.usesNoSdks !== true ||
    intent.usesNoNetwork !== true ||
    intent.startsNoWorkers !== true ||
    intent.startsNoTimers !== true ||
    intent.createsNoQueues !== true ||
    intent.exposesNoApiRoutes !== true ||
    intent.exposesNoAdminUi !== true ||
    intent.mutatesNoSql !== true ||
    intent.mutatesNoSupabase !== true ||
    intent.mutatesNoBridge !== true ||
    intent.mutatesNoStorage !== true ||
    intent.mutatesNoLowerLayers !== true ||
    intent.recordsNoMetrics !== true ||
    intent.performsNoLearning !== true ||
    intent.grantsExecutionPermission !== false
  ) {
    errors.push(validationError({
      code: "intent_invariant_failed",
      path: "intentInvariants",
      message: "Execution intents must remain non-executable contracts.",
    }));
  }
}

function validateResultInvariants(
  result: PublicationExecutionResult,
  errors: PublicationExecutionValidationError[],
): void {
  if (
    result.contractOnly !== true ||
    result.modelAuthorityOnly !== true ||
    result.executesNothing !== true ||
    result.publishesNothing !== true ||
    result.callsNoExternalApis !== true ||
    result.usesNoSdks !== true ||
    result.usesNoNetwork !== true ||
    result.persistsNothing !== true ||
    result.mutatesNoLowerLayers !== true ||
    result.recordsNoMetrics !== true ||
    result.performsNoLearning !== true ||
    result.currentExecutionStatusAuthority !== false ||
    result.grantsExecutionPermission !== false
  ) {
    errors.push(validationError({
      code: "result_invariant_failed",
      path: "resultInvariants",
      message: "Execution results must remain non-executable contract evidence.",
    }));
  }
}

function rejectForbiddenUnsafeState(
  value: unknown,
  path: string,
  errors: PublicationExecutionValidationError[],
): void {
  rejectForbiddenKeys(value, path, FORBIDDEN_SECRET_KEYS, "secret_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_EXTERNAL_API_KEYS, "external_api_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_SDK_KEYS, "sdk_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_NETWORK_KEYS, "network_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_CRON_TIMER_KEYS, "cron_or_timer_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_WORKER_QUEUE_KEYS, "worker_or_queue_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_API_ROUTE_KEYS, "api_route_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_ADMIN_UI_KEYS, "admin_ui_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_SQL_SUPABASE_KEYS, "sql_or_supabase_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_BRIDGE_KEYS, "bridge_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_STORAGE_KEYS, "storage_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_LOWER_LAYER_PAYLOAD_KEYS, "lower_layer_payload_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_LOWER_LAYER_MUTATION_KEYS, "lower_layer_mutation_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_EXECUTION_TRIGGER_KEYS, "execution_trigger_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_METRICS_KEYS, "metrics_state_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_LEARNING_KEYS, "learning_state_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_MUTABLE_EXECUTION_STATE_KEYS, "mutable_execution_state_forbidden", errors);
}

function rejectForbiddenKeys(
  value: unknown,
  path: string,
  forbiddenKeys: ReadonlySet<string>,
  code: PublicationExecutionErrorCode,
  errors: PublicationExecutionValidationError[],
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
      errors.push(validationError({
        code,
        path: childPath,
        message: "Execution contracts must not store unsafe execution state.",
      }));
    }

    rejectForbiddenKeys(child, childPath, forbiddenKeys, code, errors);
  }
}

function parseSerialized(
  serialized: string,
  code: PublicationExecutionErrorCode,
): Readonly<
  | {
      ok: true;
      errors: readonly [];
      value: unknown;
    }
  | {
      ok: false;
      errors: readonly PublicationExecutionValidationError[];
    }
> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    return {
      ok: false,
      errors: [
        validationError({
          code,
          path: "serialized",
          message: "Execution JSON is invalid.",
        }),
      ],
    };
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      errors: [
        validationError({
          code,
          path: "serialized",
          message: "Execution JSON must deserialize to an object.",
        }),
      ],
    };
  }

  return { ok: true, errors: [], value: parsed };
}

function validateRequiredText(
  value: unknown,
  path: string,
  code: PublicationExecutionErrorCode,
  errors: PublicationExecutionValidationError[],
): void {
  if (!hasText(value)) {
    errors.push(validationError({
      code,
      path,
      message: "Required execution field is missing.",
    }));
  }
}

function validateOptionalText(
  value: unknown,
  path: string,
  code: PublicationExecutionErrorCode,
  errors: PublicationExecutionValidationError[],
): void {
  if (value !== null && value !== undefined && !hasText(value)) {
    errors.push(validationError({
      code,
      path,
      message: "Optional execution reference must be null or non-empty text.",
    }));
  }
}

function validationError(input: {
  code: PublicationExecutionErrorCode;
  path: string;
  message: string;
}): PublicationExecutionValidationError {
  return input;
}

function validationResult(
  errors: PublicationExecutionValidationError[],
): PublicationExecutionValidationResult {
  if (errors.length === 0) {
    return { ok: true, errors: [] };
  }

  return { ok: false, errors };
}

function isJsonObject(value: unknown): value is PublicationExecutionJsonObject {
  return isRecord(value);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function immutableClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (isRecord(value)) {
    Object.values(value).forEach((item) => deepFreeze(item));
  }

  return Object.freeze(value);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((sorted, key) => {
      sorted[key] = sortValue(value[key]);
      return sorted;
    }, {});
}
