import {
  PUBLICATION_EXECUTION_INTENT_TYPES,
  PUBLICATION_EXECUTION_PREFLIGHT_STATUSES,
  PUBLICATION_EXECUTION_RESULT_STATUSES,
  PUBLICATION_EXECUTION_RESULT_TYPES,
  isPublicationExecutionBlockReason,
  validatePublicationExecutionIntent,
  validatePublicationExecutionResult,
  type PublicationExecutionBlockReason,
  type PublicationExecutionIntent,
  type PublicationExecutionIntentType,
  type PublicationExecutionResult,
  type PublicationExecutionResultStatus,
  type PublicationExecutionResultType,
  type PublicationExecutionPreflightStatus,
  type PublicationExecutionValidationError,
} from "./social-publication-execution";

export type {
  PublicationExecutionIntent,
  PublicationExecutionResult,
} from "./social-publication-execution";

type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

type UnknownRecord = Readonly<Record<string, unknown>>;

export type SocialPublicationExecutionIntentId = Brand<
  string,
  "SocialPublicationExecutionIntentId"
>;
export type SocialPublicationExecutionResultId = Brand<
  string,
  "SocialPublicationExecutionResultId"
>;
export type SocialPublicationExecutionJobId = Brand<
  string,
  "SocialPublicationExecutionJobId"
>;
export type SocialPublicationExecutionSocialPostId = Brand<
  string,
  "SocialPublicationExecutionSocialPostId"
>;
export type SocialPublicationExecutionTargetId = Brand<
  string,
  "SocialPublicationExecutionTargetId"
>;
export type SocialPublicationExecutionPublisherRequestId = Brand<
  string,
  "SocialPublicationExecutionPublisherRequestId"
>;
export type SocialPublicationExecutionPublisherResultId = Brand<
  string,
  "SocialPublicationExecutionPublisherResultId"
>;
export type SocialPublicationExecutionPublisherJobId = Brand<
  string,
  "SocialPublicationExecutionPublisherJobId"
>;
export type SocialPublicationExecutionScheduleId = Brand<
  string,
  "SocialPublicationExecutionScheduleId"
>;
export type SocialPublicationExecutionLedgerEntryId = Brand<
  string,
  "SocialPublicationExecutionLedgerEntryId"
>;
export type SocialPublicationExecutionManifestId = Brand<
  string,
  "SocialPublicationExecutionManifestId"
>;
export type SocialPublicationExecutionOwnerApprovalId = Brand<
  string,
  "SocialPublicationExecutionOwnerApprovalId"
>;
export type SocialPublicationExecutionApprovalId = Brand<
  string,
  "SocialPublicationExecutionApprovalId"
>;
export type SocialPublicationExecutionMetricObservationId = Brand<
  string,
  "SocialPublicationExecutionMetricObservationId"
>;
export type SocialPublicationExecutionLearningInsightId = Brand<
  string,
  "SocialPublicationExecutionLearningInsightId"
>;
export type SocialPublicationExecutionCampaignMemoryId = Brand<
  string,
  "SocialPublicationExecutionCampaignMemoryId"
>;
export type SocialPublicationExecutionDecisionHistoryId = Brand<
  string,
  "SocialPublicationExecutionDecisionHistoryId"
>;
export type SocialPublicationExecutionEvidenceId = Brand<
  string,
  "SocialPublicationExecutionEvidenceId"
>;
export type SocialPublicationExecutionPreflightId = Brand<
  string,
  "SocialPublicationExecutionPreflightId"
>;

export const SOCIAL_PUBLICATION_EXECUTION_REPOSITORY_ERROR_CODES = [
  "validation_failed",
  "identity_required",
  "identity_collision",
  "relationship_invalid",
  "serialization_invalid",
  "contract_only",
] as const;

export const SOCIAL_PUBLICATION_EXECUTION_RECORD_ERROR_CODES = [
  "required_field_missing",
  "identity_not_separated",
  "relationship_invalid",
  "intent_type_invalid",
  "result_type_invalid",
  "result_status_invalid",
  "preflight_status_invalid",
  "block_reason_invalid",
  "timestamp_invalid",
  "contract_invariant_failed",
  "secret_forbidden",
  "network_forbidden",
  "execution_forbidden",
  "publisher_execution_forbidden",
  "scheduler_execution_forbidden",
  "lower_layer_payload_forbidden",
  "lower_layer_mutation_forbidden",
  "metrics_state_forbidden",
  "learning_state_forbidden",
] as const;

export type SocialPublicationExecutionRepositoryErrorCode =
  (typeof SOCIAL_PUBLICATION_EXECUTION_REPOSITORY_ERROR_CODES)[number];

export type SocialPublicationExecutionRecordErrorCode =
  (typeof SOCIAL_PUBLICATION_EXECUTION_RECORD_ERROR_CODES)[number];

export type SocialPublicationExecutionRecordError = Readonly<{
  code: SocialPublicationExecutionRecordErrorCode;
  path: string;
  message: string;
}>;

export type SocialPublicationExecutionRepositoryError = Readonly<{
  code: SocialPublicationExecutionRepositoryErrorCode;
  message: string;
  validationErrors?: readonly (
    | SocialPublicationExecutionRecordError
    | PublicationExecutionValidationError
  )[];
}>;

export type SocialPublicationExecutionRepositoryResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: SocialPublicationExecutionRepositoryError }>;

export type SocialPublicationExecutionRecordValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly SocialPublicationExecutionRecordError[] }
>;

export type SocialPublicationExecutionScope = Readonly<{
  social_post_id: SocialPublicationExecutionSocialPostId;
  publication_target_id: SocialPublicationExecutionTargetId;
  publisher_request_id: SocialPublicationExecutionPublisherRequestId | null;
  publisher_result_id: SocialPublicationExecutionPublisherResultId | null;
  publisher_job_id: SocialPublicationExecutionPublisherJobId | null;
  schedule_id: SocialPublicationExecutionScheduleId | null;
  ledger_entry_id: SocialPublicationExecutionLedgerEntryId | null;
  publication_manifest_id: SocialPublicationExecutionManifestId | null;
  owner_approval_id: SocialPublicationExecutionOwnerApprovalId | null;
  approval_id: SocialPublicationExecutionApprovalId | null;
  metric_observation_id: SocialPublicationExecutionMetricObservationId | null;
  learning_insight_id: SocialPublicationExecutionLearningInsightId | null;
  campaign_memory_id: SocialPublicationExecutionCampaignMemoryId | null;
  decision_history_id: SocialPublicationExecutionDecisionHistoryId | null;
}>;

export type SocialPublicationExecutionIntentRecord = Readonly<{
  execution_intent_id: SocialPublicationExecutionIntentId;
  execution_job_id: SocialPublicationExecutionJobId;
  intent_type: PublicationExecutionIntentType;
  scope: SocialPublicationExecutionScope;
  owner_approval_satisfied: boolean;
  publisher_authority_satisfied: boolean;
  preflight_id: SocialPublicationExecutionPreflightId | null;
  preflight_status: PublicationExecutionPreflightStatus | null;
  preflight_block_reasons: readonly PublicationExecutionBlockReason[];
  preflight_evaluated_at: string | null;
  evidence_id: SocialPublicationExecutionEvidenceId | null;
  requested_at: string;
  updated_at: string;
  contract_only: true;
  model_authority_only: true;
  references_only: true;
  executes_nothing: true;
  publishes_nothing: true;
  calls_no_external_apis: true;
  uses_no_sdks: true;
  uses_no_network: true;
  starts_no_workers: true;
  starts_no_timers: true;
  creates_no_queues: true;
  exposes_no_api_routes: true;
  exposes_no_admin_ui: true;
  mutates_no_sql: true;
  mutates_no_storage: true;
  mutates_no_lower_layers: true;
  records_no_metrics: true;
  performs_no_learning: true;
  grants_execution_permission: false;
}>;

export type SocialPublicationExecutionResultRecord = Readonly<{
  execution_result_id: SocialPublicationExecutionResultId;
  execution_intent_id: SocialPublicationExecutionIntentId;
  execution_job_id: SocialPublicationExecutionJobId;
  result_type: PublicationExecutionResultType;
  result_status: PublicationExecutionResultStatus;
  scope: SocialPublicationExecutionScope;
  block_reasons: readonly PublicationExecutionBlockReason[];
  evidence_id: SocialPublicationExecutionEvidenceId | null;
  recorded_at: string;
  updated_at: string;
  contract_only: true;
  model_authority_only: true;
  references_only: true;
  executes_nothing: true;
  publishes_nothing: true;
  calls_no_external_apis: true;
  uses_no_sdks: true;
  uses_no_network: true;
  persists_nothing: true;
  mutates_no_lower_layers: true;
  current_execution_status_authority: false;
  records_no_metrics: true;
  performs_no_learning: true;
  grants_execution_permission: false;
}>;

export type SocialPublicationExecutionPersistenceModel = Readonly<{
  intents: readonly SocialPublicationExecutionIntentRecord[];
  results: readonly SocialPublicationExecutionResultRecord[];
}>;

export type SocialPublicationExecutionRepositoryIdentity = Readonly<{
  execution_intent_id?: string;
  execution_result_id?: string;
  execution_job_id?: string;
  social_post_id?: string;
  publication_target_id?: string;
  publisher_request_id?: string;
  publisher_result_id?: string;
  publisher_job_id?: string;
  schedule_id?: string;
  ledger_entry_id?: string;
  publication_manifest_id?: string;
  owner_approval_id?: string;
  approval_id?: string;
  metric_observation_id?: string;
  learning_insight_id?: string;
  campaign_memory_id?: string;
  decision_history_id?: string;
}>;

export type SocialPublicationExecutionCreateIntentRequest = Readonly<{
  intent: SocialPublicationExecutionIntentRecord;
}>;

export type SocialPublicationExecutionAppendResultRequest = Readonly<{
  result: SocialPublicationExecutionResultRecord;
}>;

export type SocialPublicationExecutionRepositorySnapshot =
  SocialPublicationExecutionPersistenceModel;

export type SocialPublicationExecutionRepository = Readonly<{
  createExecutionIntent(
    request: SocialPublicationExecutionCreateIntentRequest,
  ): SocialPublicationExecutionRepositoryResult<SocialPublicationExecutionIntentRecord>;
  appendExecutionResult(
    request: SocialPublicationExecutionAppendResultRequest,
  ): SocialPublicationExecutionRepositoryResult<SocialPublicationExecutionResultRecord>;
  getExecutionRecordsByIdentity(
    identity: SocialPublicationExecutionRepositoryIdentity,
  ): SocialPublicationExecutionRepositoryResult<SocialPublicationExecutionPersistenceModel>;
  listExecutionIntents(
    identity?: SocialPublicationExecutionRepositoryIdentity,
  ): SocialPublicationExecutionRepositoryResult<
    readonly SocialPublicationExecutionIntentRecord[]
  >;
  listExecutionResults(
    identity?: SocialPublicationExecutionRepositoryIdentity,
  ): SocialPublicationExecutionRepositoryResult<
    readonly SocialPublicationExecutionResultRecord[]
  >;
  snapshot(): SocialPublicationExecutionRepositoryResult<SocialPublicationExecutionRepositorySnapshot>;
}>;

const INTENT_TYPES = new Set<string>(PUBLICATION_EXECUTION_INTENT_TYPES);
const RESULT_TYPES = new Set<string>(PUBLICATION_EXECUTION_RESULT_TYPES);
const RESULT_STATUSES = new Set<string>(PUBLICATION_EXECUTION_RESULT_STATUSES);
const PREFLIGHT_STATUSES = new Set<string>(PUBLICATION_EXECUTION_PREFLIGHT_STATUSES);

const FORBIDDEN_KEYS: Readonly<Record<string, SocialPublicationExecutionRecordErrorCode>> = {
  accessToken: "secret_forbidden",
  access_token: "secret_forbidden",
  apiKey: "secret_forbidden",
  api_key: "secret_forbidden",
  authHeader: "secret_forbidden",
  clientSecret: "secret_forbidden",
  client_secret: "secret_forbidden",
  credentials: "secret_forbidden",
  oauth: "secret_forbidden",
  password: "secret_forbidden",
  refreshToken: "secret_forbidden",
  refresh_token: "secret_forbidden",
  secret: "secret_forbidden",
  token: "secret_forbidden",
  fetch: "network_forbidden",
  httpClient: "network_forbidden",
  networkRequest: "network_forbidden",
  webhook: "network_forbidden",
  execute: "execution_forbidden",
  executeJob: "execution_forbidden",
  executionPlan: "execution_forbidden",
  execution_plan: "execution_forbidden",
  executedAt: "execution_forbidden",
  publishExecution: "execution_forbidden",
  publishResult: "execution_forbidden",
  publishedAt: "execution_forbidden",
  runPublisher: "publisher_execution_forbidden",
  publisherJobExecution: "publisher_execution_forbidden",
  runScheduler: "scheduler_execution_forbidden",
  schedulerJobId: "scheduler_execution_forbidden",
  approvalPayload: "lower_layer_payload_forbidden",
  ledgerEntry: "lower_layer_payload_forbidden",
  ledgerPayload: "lower_layer_payload_forbidden",
  manifest: "lower_layer_payload_forbidden",
  manifestPayload: "lower_layer_payload_forbidden",
  ownerApproval: "lower_layer_payload_forbidden",
  publicationManifest: "lower_layer_payload_forbidden",
  publicationTarget: "lower_layer_payload_forbidden",
  publisherPayload: "lower_layer_payload_forbidden",
  rawPayload: "lower_layer_payload_forbidden",
  targetPayload: "lower_layer_payload_forbidden",
  targetSnapshot: "lower_layer_payload_forbidden",
  workingContext: "lower_layer_payload_forbidden",
  appendLedgerEntry: "lower_layer_mutation_forbidden",
  mutateApproval: "lower_layer_mutation_forbidden",
  mutatePublisher: "lower_layer_mutation_forbidden",
  updateManifest: "lower_layer_mutation_forbidden",
  writeLedger: "lower_layer_mutation_forbidden",
  analytics: "metrics_state_forbidden",
  impressions: "metrics_state_forbidden",
  metrics: "metrics_state_forbidden",
  reach: "metrics_state_forbidden",
  campaignMemory: "learning_state_forbidden",
  learning: "learning_state_forbidden",
  modelFeedback: "learning_state_forbidden",
};

export function mapPublicationExecutionIntentToIntentRecord(
  intent: PublicationExecutionIntent,
): SocialPublicationExecutionRepositoryResult<SocialPublicationExecutionIntentRecord> {
  const validation = validatePublicationExecutionIntent(intent);
  if (!validation.ok) {
    return failure("validation_failed", "Execution domain intent failed validation.", validation.errors);
  }

  return validateAndReturnIntentRecord({
    execution_intent_id: intent.intentId as SocialPublicationExecutionIntentId,
    execution_job_id: intent.job.jobId as SocialPublicationExecutionJobId,
    intent_type: intent.intentType,
    scope: mapReferencesToScope(intent.job.references),
    owner_approval_satisfied: intent.authority.ownerApprovalSatisfied,
    publisher_authority_satisfied: intent.authority.publisherAuthoritySatisfied,
    preflight_id: (intent.preflight?.preflightId ?? null) as SocialPublicationExecutionPreflightId | null,
    preflight_status: intent.preflight?.status ?? null,
    preflight_block_reasons: intent.preflight?.blockReasons ?? [],
    preflight_evaluated_at: intent.preflight?.evaluatedAt ?? null,
    evidence_id: (intent.evidence?.evidenceId ?? null) as SocialPublicationExecutionEvidenceId | null,
    requested_at: intent.createdAt,
    updated_at: intent.updatedAt,
    contract_only: true,
    model_authority_only: true,
    references_only: true,
    executes_nothing: true,
    publishes_nothing: true,
    calls_no_external_apis: true,
    uses_no_sdks: true,
    uses_no_network: true,
    starts_no_workers: true,
    starts_no_timers: true,
    creates_no_queues: true,
    exposes_no_api_routes: true,
    exposes_no_admin_ui: true,
    mutates_no_sql: true,
    mutates_no_storage: true,
    mutates_no_lower_layers: true,
    records_no_metrics: true,
    performs_no_learning: true,
    grants_execution_permission: false,
  });
}

export function mapIntentRecordToPublicationExecutionIntent(
  record: SocialPublicationExecutionIntentRecord,
): SocialPublicationExecutionRepositoryResult<PublicationExecutionIntent> {
  const recordValidation = validateSocialPublicationExecutionIntentRecord(record);
  if (!recordValidation.ok) {
    return failure("validation_failed", "Execution intent record failed validation.", recordValidation.errors);
  }

  const intent = buildPublicationExecutionIntent(record);
  const validation = validatePublicationExecutionIntent(intent);
  if (!validation.ok) {
    return failure(
      "validation_failed",
      "Execution intent record could not hydrate to a valid domain intent.",
      validation.errors,
    );
  }

  return ok(immutableClone(intent));
}

export function mapPublicationExecutionResultToResultRecord(
  result: PublicationExecutionResult,
): SocialPublicationExecutionRepositoryResult<SocialPublicationExecutionResultRecord> {
  const validation = validatePublicationExecutionResult(result);
  if (!validation.ok) {
    return failure("validation_failed", "Execution domain result failed validation.", validation.errors);
  }

  return validateAndReturnResultRecord({
    execution_result_id: result.resultId as SocialPublicationExecutionResultId,
    execution_intent_id: result.intentId as SocialPublicationExecutionIntentId,
    execution_job_id: result.job.jobId as SocialPublicationExecutionJobId,
    result_type: result.resultType,
    result_status: result.status,
    scope: mapReferencesToScope(result.job.references),
    block_reasons: result.blockReasons,
    evidence_id: (result.evidence?.evidenceId ?? null) as SocialPublicationExecutionEvidenceId | null,
    recorded_at: result.createdAt,
    updated_at: result.updatedAt,
    contract_only: true,
    model_authority_only: true,
    references_only: true,
    executes_nothing: true,
    publishes_nothing: true,
    calls_no_external_apis: true,
    uses_no_sdks: true,
    uses_no_network: true,
    persists_nothing: true,
    mutates_no_lower_layers: true,
    current_execution_status_authority: false,
    records_no_metrics: true,
    performs_no_learning: true,
    grants_execution_permission: false,
  });
}

export function mapResultRecordToPublicationExecutionResult(
  record: SocialPublicationExecutionResultRecord,
): SocialPublicationExecutionRepositoryResult<PublicationExecutionResult> {
  const recordValidation = validateSocialPublicationExecutionResultRecord(record);
  if (!recordValidation.ok) {
    return failure("validation_failed", "Execution result record failed validation.", recordValidation.errors);
  }

  const result = buildPublicationExecutionResult(record);
  const validation = validatePublicationExecutionResult(result);
  if (!validation.ok) {
    return failure(
      "validation_failed",
      "Execution result record could not hydrate to a valid domain result.",
      validation.errors,
    );
  }

  return ok(immutableClone(result));
}

export function validateSocialPublicationExecutionIntentRecord(
  record: unknown,
): SocialPublicationExecutionRecordValidationResult {
  const errors: SocialPublicationExecutionRecordError[] = [];
  if (!isRecord(record)) {
    return recordValidationFailure("required_field_missing", "intent", "Execution intent record must be an object.");
  }

  requireText(record.execution_intent_id, "intent.execution_intent_id", errors);
  requireText(record.execution_job_id, "intent.execution_job_id", errors);
  validateEnum(record.intent_type, INTENT_TYPES, "intent.intent_type", "intent_type_invalid", errors);
  validateScope(record.scope, "intent.scope", errors);
  validatePreflightFields(record, "intent", errors);
  validateTimestamp(record.requested_at, "intent.requested_at", errors);
  validateTimestamp(record.updated_at, "intent.updated_at", errors);
  validateIntentRecordInvariants(record, "intent", errors);
  rejectForbiddenState(record, "intent", errors);

  return validationResult(errors);
}

export function validateSocialPublicationExecutionResultRecord(
  record: unknown,
): SocialPublicationExecutionRecordValidationResult {
  const errors: SocialPublicationExecutionRecordError[] = [];
  if (!isRecord(record)) {
    return recordValidationFailure("required_field_missing", "result", "Execution result record must be an object.");
  }

  requireText(record.execution_result_id, "result.execution_result_id", errors);
  requireText(record.execution_intent_id, "result.execution_intent_id", errors);
  requireText(record.execution_job_id, "result.execution_job_id", errors);
  validateEnum(record.result_type, RESULT_TYPES, "result.result_type", "result_type_invalid", errors);
  validateEnum(record.result_status, RESULT_STATUSES, "result.result_status", "result_status_invalid", errors);
  validateScope(record.scope, "result.scope", errors);
  validateBlockReasonsField(record.block_reasons, "result.block_reasons", errors);
  validateTimestamp(record.recorded_at, "result.recorded_at", errors);
  validateTimestamp(record.updated_at, "result.updated_at", errors);
  validateResultRecordInvariants(record, "result", errors);
  rejectForbiddenState(record, "result", errors);

  return validationResult(errors);
}

export function validateSocialPublicationExecutionPersistenceModel(
  model: unknown,
): SocialPublicationExecutionRecordValidationResult {
  const errors: SocialPublicationExecutionRecordError[] = [];
  if (!isRecord(model)) {
    return recordValidationFailure("required_field_missing", "model", "Execution persistence model must be an object.");
  }

  const intents = Array.isArray(model.intents) ? model.intents : null;
  const results = Array.isArray(model.results) ? model.results : null;
  if (!intents) {
    errors.push(recordError("required_field_missing", "model.intents", "Execution model requires intents."));
  }
  if (!results) {
    errors.push(recordError("required_field_missing", "model.results", "Execution model requires results."));
  }

  const intentIds = new Set<string>();
  const resultIds = new Set<string>();
  const intentsById = new Map<string, UnknownRecord>();

  intents?.forEach((intent, index) => {
    const validation = validateSocialPublicationExecutionIntentRecord(intent);
    if (!validation.ok) {
      for (const error of validation.errors) {
        errors.push({ ...error, path: `intents.${index}.${error.path}` });
      }
    }
    if (!isRecord(intent)) return;
    validateUnique(intent.execution_intent_id, `intents.${index}.execution_intent_id`, intentIds, errors);
    if (hasText(intent.execution_intent_id)) {
      intentsById.set(intent.execution_intent_id, intent);
    }
  });

  results?.forEach((result, index) => {
    const validation = validateSocialPublicationExecutionResultRecord(result);
    if (!validation.ok) {
      for (const error of validation.errors) {
        errors.push({ ...error, path: `results.${index}.${error.path}` });
      }
    }
    if (!isRecord(result)) return;
    validateUnique(result.execution_result_id, `results.${index}.execution_result_id`, resultIds, errors);
    validateResultRelationship(result, `results.${index}`, intentsById, errors);
  });

  return validationResult(errors);
}

export function validateSocialPublicationExecutionCreateIntentRequest(
  request: unknown,
): SocialPublicationExecutionRepositoryResult<SocialPublicationExecutionCreateIntentRequest> {
  if (!isRecord(request)) {
    return failure("validation_failed", "Execution create intent request must be an object.");
  }

  const validation = validateSocialPublicationExecutionIntentRecord(request.intent);
  if (!validation.ok) {
    return failure("validation_failed", "Execution create intent request failed validation.", validation.errors);
  }

  return ok({ intent: request.intent as SocialPublicationExecutionIntentRecord });
}

export function validateSocialPublicationExecutionAppendResultRequest(
  request: unknown,
): SocialPublicationExecutionRepositoryResult<SocialPublicationExecutionAppendResultRequest> {
  if (!isRecord(request)) {
    return failure("validation_failed", "Execution append result request must be an object.");
  }

  const validation = validateSocialPublicationExecutionResultRecord(request.result);
  if (!validation.ok) {
    return failure("validation_failed", "Execution append result request failed validation.", validation.errors);
  }

  return ok({ result: request.result as SocialPublicationExecutionResultRecord });
}

export function validateSocialPublicationExecutionRepositoryIdentity(
  identity: unknown,
): SocialPublicationExecutionRepositoryResult<SocialPublicationExecutionRepositoryIdentity> {
  if (!isRecord(identity)) {
    return failure("identity_required", "Execution repository identity must be an object.");
  }

  const entries = Object.entries(identity).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return failure("identity_required", "Execution repository identity requires at least one field.");
  }

  for (const [key, value] of entries) {
    if (!hasText(value)) {
      return failure("identity_required", `Execution identity field ${key} must be non-empty text.`);
    }
  }

  return ok(identity);
}

export function serializeSocialPublicationExecutionPersistenceModel(
  model: SocialPublicationExecutionPersistenceModel,
): string {
  const validation = validateSocialPublicationExecutionPersistenceModel(model);
  if (!validation.ok) {
    throw new Error("Execution persistence model failed validation before serialization.");
  }

  return stableStringify(sortModel(model));
}

export function hydrateSocialPublicationExecutionPersistenceModel(
  serialized: string,
): SocialPublicationExecutionRepositoryResult<SocialPublicationExecutionPersistenceModel> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    return failure("serialization_invalid", "Execution persistence model JSON is invalid.");
  }

  const validation = validateSocialPublicationExecutionPersistenceModel(parsed);
  if (!validation.ok) {
    return failure("validation_failed", "Execution persistence model failed validation.", validation.errors);
  }

  return ok(deepFreeze(immutableClone(sortModel(parsed as SocialPublicationExecutionPersistenceModel))));
}

export function createReferenceSocialPublicationExecutionRepository(
  model: SocialPublicationExecutionPersistenceModel = { intents: [], results: [] },
): SocialPublicationExecutionRepository {
  const validation = validateSocialPublicationExecutionPersistenceModel(model);
  if (!validation.ok) {
    throw new Error(`Invalid execution persistence model: ${validation.errors[0]?.message ?? "unknown error"}`);
  }

  const intents = [...model.intents];
  const results = [...model.results];

  return {
    createExecutionIntent(request) {
      const validationResult = validateSocialPublicationExecutionIntentRecord(request.intent);
      if (!validationResult.ok) {
        return failure("validation_failed", "Execution intent record failed validation.", validationResult.errors);
      }
      if (intents.some((record) => record.execution_intent_id === request.intent.execution_intent_id)) {
        return failure("identity_collision", "Execution intent identity already exists.");
      }
      intents.push(deepFreeze({ ...request.intent, scope: { ...request.intent.scope } }));
      return ok(request.intent);
    },
    appendExecutionResult(request) {
      const validationResult = validateSocialPublicationExecutionResultRecord(request.result);
      if (!validationResult.ok) {
        return failure("validation_failed", "Execution result record failed validation.", validationResult.errors);
      }
      if (results.some((record) => record.execution_result_id === request.result.execution_result_id)) {
        return failure("identity_collision", "Execution result identity already exists.");
      }
      results.push(deepFreeze({ ...request.result, scope: { ...request.result.scope } }));
      return ok(request.result);
    },
    getExecutionRecordsByIdentity(identity) {
      return ok(
        deepFreeze({
          intents: filterIntents(intents, identity),
          results: filterResults(results, identity),
        }),
      );
    },
    listExecutionIntents(identity = {}) {
      return ok(filterIntents(intents, identity));
    },
    listExecutionResults(identity = {}) {
      return ok(filterResults(results, identity));
    },
    snapshot() {
      return ok(deepFreeze({ intents: [...intents], results: [...results] }));
    },
  };
}

function filterIntents(
  intents: readonly SocialPublicationExecutionIntentRecord[],
  identity: SocialPublicationExecutionRepositoryIdentity,
): readonly SocialPublicationExecutionIntentRecord[] {
  return deepFreeze(
    intents.filter((record) => {
      const scope = record.scope;
      return (
        matches(identity.execution_intent_id, record.execution_intent_id) &&
        matches(identity.execution_job_id, record.execution_job_id) &&
        matches(identity.social_post_id, scope.social_post_id) &&
        matches(identity.publication_target_id, scope.publication_target_id) &&
        matches(identity.publisher_request_id, scope.publisher_request_id) &&
        matches(identity.publisher_result_id, scope.publisher_result_id) &&
        matches(identity.publisher_job_id, scope.publisher_job_id) &&
        matches(identity.schedule_id, scope.schedule_id) &&
        matches(identity.ledger_entry_id, scope.ledger_entry_id) &&
        matches(identity.publication_manifest_id, scope.publication_manifest_id) &&
        matches(identity.owner_approval_id, scope.owner_approval_id) &&
        matches(identity.approval_id, scope.approval_id) &&
        matches(identity.metric_observation_id, scope.metric_observation_id) &&
        matches(identity.learning_insight_id, scope.learning_insight_id) &&
        matches(identity.campaign_memory_id, scope.campaign_memory_id) &&
        matches(identity.decision_history_id, scope.decision_history_id)
      );
    }),
  );
}

function filterResults(
  results: readonly SocialPublicationExecutionResultRecord[],
  identity: SocialPublicationExecutionRepositoryIdentity,
): readonly SocialPublicationExecutionResultRecord[] {
  return deepFreeze(
    results.filter((record) => {
      const scope = record.scope;
      return (
        matches(identity.execution_result_id, record.execution_result_id) &&
        matches(identity.execution_intent_id, record.execution_intent_id) &&
        matches(identity.execution_job_id, record.execution_job_id) &&
        matches(identity.social_post_id, scope.social_post_id) &&
        matches(identity.publication_target_id, scope.publication_target_id) &&
        matches(identity.publisher_request_id, scope.publisher_request_id) &&
        matches(identity.publisher_result_id, scope.publisher_result_id) &&
        matches(identity.publisher_job_id, scope.publisher_job_id) &&
        matches(identity.schedule_id, scope.schedule_id) &&
        matches(identity.ledger_entry_id, scope.ledger_entry_id) &&
        matches(identity.publication_manifest_id, scope.publication_manifest_id) &&
        matches(identity.owner_approval_id, scope.owner_approval_id) &&
        matches(identity.approval_id, scope.approval_id) &&
        matches(identity.metric_observation_id, scope.metric_observation_id) &&
        matches(identity.learning_insight_id, scope.learning_insight_id) &&
        matches(identity.campaign_memory_id, scope.campaign_memory_id) &&
        matches(identity.decision_history_id, scope.decision_history_id)
      );
    }),
  );
}

function validateAndReturnIntentRecord(
  record: SocialPublicationExecutionIntentRecord,
): SocialPublicationExecutionRepositoryResult<SocialPublicationExecutionIntentRecord> {
  const validation = validateSocialPublicationExecutionIntentRecord(record);
  if (!validation.ok) {
    return failure("validation_failed", "Execution intent record failed validation.", validation.errors);
  }

  return ok(immutableClone(record));
}

function validateAndReturnResultRecord(
  record: SocialPublicationExecutionResultRecord,
): SocialPublicationExecutionRepositoryResult<SocialPublicationExecutionResultRecord> {
  const validation = validateSocialPublicationExecutionResultRecord(record);
  if (!validation.ok) {
    return failure("validation_failed", "Execution result record failed validation.", validation.errors);
  }

  return ok(immutableClone(record));
}

function mapReferencesToScope(
  references: PublicationExecutionIntent["job"]["references"],
): SocialPublicationExecutionScope {
  return {
    social_post_id: references.socialPostId as SocialPublicationExecutionSocialPostId,
    publication_target_id: references.publicationTargetId as SocialPublicationExecutionTargetId,
    publisher_request_id: references.publisherRequestId as SocialPublicationExecutionPublisherRequestId | null,
    publisher_result_id: references.publisherResultId as SocialPublicationExecutionPublisherResultId | null,
    publisher_job_id: references.publisherJobId as SocialPublicationExecutionPublisherJobId | null,
    schedule_id: references.scheduleId as SocialPublicationExecutionScheduleId | null,
    ledger_entry_id: references.ledgerEntryId as SocialPublicationExecutionLedgerEntryId | null,
    publication_manifest_id: references.publicationManifestId as SocialPublicationExecutionManifestId | null,
    owner_approval_id: references.ownerApprovalId as SocialPublicationExecutionOwnerApprovalId | null,
    approval_id: references.approvalId as SocialPublicationExecutionApprovalId | null,
    metric_observation_id: references.metricObservationId as SocialPublicationExecutionMetricObservationId | null,
    learning_insight_id: references.learningInsightId as SocialPublicationExecutionLearningInsightId | null,
    campaign_memory_id: references.campaignMemoryId as SocialPublicationExecutionCampaignMemoryId | null,
    decision_history_id: references.decisionHistoryId as SocialPublicationExecutionDecisionHistoryId | null,
  };
}

function mapScopeToReferences(
  scope: SocialPublicationExecutionScope,
): PublicationExecutionIntent["job"]["references"] {
  return {
    socialPostId: scope.social_post_id,
    publicationTargetId: scope.publication_target_id,
    publisherRequestId: scope.publisher_request_id,
    publisherResultId: scope.publisher_result_id,
    publisherJobId: scope.publisher_job_id,
    scheduleId: scope.schedule_id,
    ledgerEntryId: scope.ledger_entry_id,
    publicationManifestId: scope.publication_manifest_id,
    ownerApprovalId: scope.owner_approval_id,
    approvalId: scope.approval_id,
    metricObservationId: scope.metric_observation_id,
    learningInsightId: scope.learning_insight_id,
    campaignMemoryId: scope.campaign_memory_id,
    decisionHistoryId: scope.decision_history_id,
  };
}

function buildJobIdentity(
  jobId: string,
  references: PublicationExecutionIntent["job"]["references"],
  createdAt: string,
  updatedAt: string,
): PublicationExecutionIntent["job"] {
  return {
    jobId,
    jobType: "model_execution_job",
    references,
    createdAt,
    updatedAt,
    modelContractOnly: true,
    executesNothing: true,
    publishesNothing: true,
    grantsExecutionPermission: false,
    mutatesLedger: false,
    mutatesTargets: false,
    mutatesApproval: false,
    mutatesManifest: false,
    mutatesScheduler: false,
    mutatesPublisher: false,
    persistsNothing: true,
  };
}

function buildAuthority(
  ownerApprovalId: string | null,
  approvalId: string | null,
  ownerApprovalSatisfied: boolean,
  publisherAuthoritySatisfied: boolean,
  preflightPassed: boolean,
): PublicationExecutionIntent["authority"] {
  return {
    authorityKind: "model",
    modelAuthorityOnly: true,
    ownerApprovalId,
    approvalId,
    requiresOwnerApproval: true,
    ownerApprovalSatisfied,
    requiresPublisherAuthority: true,
    publisherAuthoritySatisfied,
    requiresPreflightPass: true,
    preflightPassed,
    allowsExternalApiCall: false,
    allowsSdkUsage: false,
    allowsNetwork: false,
    allowsExecution: false,
    allowsPersistence: false,
    grantsExecutionPermission: false,
    canMutateLowerLayers: false,
  };
}

function buildPublicationExecutionIntent(
  record: SocialPublicationExecutionIntentRecord,
): PublicationExecutionIntent {
  const references = mapScopeToReferences(record.scope);
  const preflightPassed = record.preflight_status === "passed";

  return {
    intentId: record.execution_intent_id,
    intentType: record.intent_type,
    job: buildJobIdentity(record.execution_job_id, references, record.requested_at, record.updated_at),
    authority: buildAuthority(
      record.scope.owner_approval_id,
      record.scope.approval_id,
      record.owner_approval_satisfied,
      record.publisher_authority_satisfied,
      preflightPassed,
    ),
    preflight: record.preflight_id
      ? {
          preflightId: record.preflight_id,
          jobId: record.execution_job_id,
          status: record.preflight_status ?? "not_run",
          blockReasons: record.preflight_block_reasons,
          evaluatedAt: record.preflight_evaluated_at ?? record.updated_at,
          computedOnly: true,
          authoritative: false,
          grantsExecutionPermission: false,
          mutatesNoLowerLayers: true,
        }
      : null,
    evidence: record.evidence_id
      ? {
          evidenceId: record.evidence_id,
          evidenceKind: "preflight_evidence",
          notes: null,
          evidence: {},
          containsFullPayload: false,
          containsSecrets: false,
          provesExecution: false,
        }
      : null,
    createdAt: record.requested_at,
    updatedAt: record.updated_at,
    contractOnly: true,
    modelAuthorityOnly: true,
    executesNothing: true,
    publishesNothing: true,
    callsNoExternalApis: true,
    usesNoSdks: true,
    usesNoNetwork: true,
    startsNoWorkers: true,
    startsNoTimers: true,
    createsNoQueues: true,
    exposesNoApiRoutes: true,
    exposesNoAdminUi: true,
    mutatesNoSql: true,
    mutatesNoSupabase: true,
    mutatesNoBridge: true,
    mutatesNoStorage: true,
    mutatesNoLowerLayers: true,
    recordsNoMetrics: true,
    performsNoLearning: true,
    grantsExecutionPermission: false,
  };
}

function buildPublicationExecutionResult(
  record: SocialPublicationExecutionResultRecord,
): PublicationExecutionResult {
  const references = mapScopeToReferences(record.scope);
  const preflightPassed = record.result_status !== "blocked";

  return {
    resultId: record.execution_result_id,
    intentId: record.execution_intent_id,
    job: buildJobIdentity(record.execution_job_id, references, record.recorded_at, record.updated_at),
    authority: buildAuthority(
      record.scope.owner_approval_id,
      record.scope.approval_id,
      record.result_status === "completed",
      record.result_status === "completed",
      preflightPassed && record.result_status === "completed",
    ),
    resultType: record.result_type,
    status: record.result_status,
    blockReasons: record.block_reasons,
    evidence: record.evidence_id
      ? {
          evidenceId: record.evidence_id,
          evidenceKind: "authority_evidence",
          notes: null,
          evidence: {},
          containsFullPayload: false,
          containsSecrets: false,
          provesExecution: false,
        }
      : null,
    createdAt: record.recorded_at,
    updatedAt: record.updated_at,
    contractOnly: true,
    modelAuthorityOnly: true,
    executesNothing: true,
    publishesNothing: true,
    callsNoExternalApis: true,
    usesNoSdks: true,
    usesNoNetwork: true,
    persistsNothing: true,
    mutatesNoLowerLayers: true,
    recordsNoMetrics: true,
    performsNoLearning: true,
    currentExecutionStatusAuthority: false,
    grantsExecutionPermission: false,
  };
}

function validateScope(
  scope: unknown,
  path: string,
  errors: SocialPublicationExecutionRecordError[],
): void {
  if (!isRecord(scope)) {
    errors.push(recordError("required_field_missing", path, "Execution scope is required."));
    return;
  }

  requireText(scope.social_post_id, `${path}.social_post_id`, errors);
  requireText(scope.publication_target_id, `${path}.publication_target_id`, errors);
  validateOptionalText(scope.publisher_request_id, `${path}.publisher_request_id`, errors);
  validateOptionalText(scope.publisher_result_id, `${path}.publisher_result_id`, errors);
  validateOptionalText(scope.publisher_job_id, `${path}.publisher_job_id`, errors);
  validateOptionalText(scope.schedule_id, `${path}.schedule_id`, errors);
  validateOptionalText(scope.ledger_entry_id, `${path}.ledger_entry_id`, errors);
  validateOptionalText(scope.publication_manifest_id, `${path}.publication_manifest_id`, errors);
  validateOptionalText(scope.owner_approval_id, `${path}.owner_approval_id`, errors);
  validateOptionalText(scope.approval_id, `${path}.approval_id`, errors);
  validateOptionalText(scope.metric_observation_id, `${path}.metric_observation_id`, errors);
  validateOptionalText(scope.learning_insight_id, `${path}.learning_insight_id`, errors);
  validateOptionalText(scope.campaign_memory_id, `${path}.campaign_memory_id`, errors);
  validateOptionalText(scope.decision_history_id, `${path}.decision_history_id`, errors);
}

function validatePreflightFields(
  record: UnknownRecord,
  path: string,
  errors: SocialPublicationExecutionRecordError[],
): void {
  const status = record.preflight_status;
  if (status !== null && status !== undefined) {
    if (typeof status !== "string" || !PREFLIGHT_STATUSES.has(status)) {
      errors.push(recordError("preflight_status_invalid", `${path}.preflight_status`, "Execution preflight status is not supported."));
    }
    validateOptionalText(record.preflight_id, `${path}.preflight_id`, errors);
  }
  validateBlockReasonsField(record.preflight_block_reasons, `${path}.preflight_block_reasons`, errors);
}

function validateBlockReasonsField(
  value: unknown,
  path: string,
  errors: SocialPublicationExecutionRecordError[],
): void {
  if (!Array.isArray(value)) {
    errors.push(recordError("block_reason_invalid", path, "Execution block reasons must be an array."));
    return;
  }
  value.forEach((reason, index) => {
    if (typeof reason !== "string" || !isPublicationExecutionBlockReason(reason)) {
      errors.push(recordError("block_reason_invalid", `${path}.${index}`, "Execution block reason is not supported."));
    }
  });
}

function validateIntentRecordInvariants(
  record: UnknownRecord,
  path: string,
  errors: SocialPublicationExecutionRecordError[],
): void {
  if (
    record.contract_only !== true ||
    record.model_authority_only !== true ||
    record.references_only !== true ||
    record.executes_nothing !== true ||
    record.publishes_nothing !== true ||
    record.calls_no_external_apis !== true ||
    record.uses_no_sdks !== true ||
    record.uses_no_network !== true ||
    record.starts_no_workers !== true ||
    record.starts_no_timers !== true ||
    record.creates_no_queues !== true ||
    record.exposes_no_api_routes !== true ||
    record.exposes_no_admin_ui !== true ||
    record.mutates_no_sql !== true ||
    record.mutates_no_storage !== true ||
    record.mutates_no_lower_layers !== true ||
    record.records_no_metrics !== true ||
    record.performs_no_learning !== true ||
    record.grants_execution_permission !== false
  ) {
    errors.push(recordError("contract_invariant_failed", `${path}.contract_invariants`, "Execution intent records must remain contract-only."));
  }
}

function validateResultRecordInvariants(
  record: UnknownRecord,
  path: string,
  errors: SocialPublicationExecutionRecordError[],
): void {
  if (
    record.contract_only !== true ||
    record.model_authority_only !== true ||
    record.references_only !== true ||
    record.executes_nothing !== true ||
    record.publishes_nothing !== true ||
    record.calls_no_external_apis !== true ||
    record.uses_no_sdks !== true ||
    record.uses_no_network !== true ||
    record.persists_nothing !== true ||
    record.mutates_no_lower_layers !== true ||
    record.current_execution_status_authority !== false ||
    record.records_no_metrics !== true ||
    record.performs_no_learning !== true ||
    record.grants_execution_permission !== false
  ) {
    errors.push(recordError("contract_invariant_failed", `${path}.contract_invariants`, "Execution result records must remain contract-only."));
  }
}

function validateResultRelationship(
  result: UnknownRecord,
  path: string,
  intentsById: ReadonlyMap<string, UnknownRecord>,
  errors: SocialPublicationExecutionRecordError[],
): void {
  const intentId = result.execution_intent_id;
  if (!hasText(intentId)) return;

  const intent = intentsById.get(intentId);
  if (!intent) {
    errors.push(recordError("relationship_invalid", `${path}.execution_intent_id`, "Execution result must reference an intent record."));
    return;
  }

  if (intent.execution_job_id !== result.execution_job_id || !sameScope(intent.scope, result.scope)) {
    errors.push(recordError("relationship_invalid", `${path}.scope`, "Execution result must match intent identity and scope."));
  }
}

function sameScope(left: unknown, right: unknown): boolean {
  if (!isRecord(left) || !isRecord(right)) return false;

  return [
    "social_post_id",
    "publication_target_id",
    "publisher_request_id",
    "publisher_result_id",
    "publisher_job_id",
    "schedule_id",
    "ledger_entry_id",
    "publication_manifest_id",
    "owner_approval_id",
    "approval_id",
    "metric_observation_id",
    "learning_insight_id",
    "campaign_memory_id",
    "decision_history_id",
  ].every((key) => left[key] === right[key]);
}

function validateEnum(
  value: unknown,
  allowed: ReadonlySet<string>,
  path: string,
  code: SocialPublicationExecutionRecordErrorCode,
  errors: SocialPublicationExecutionRecordError[],
): void {
  if (!hasText(value) || !allowed.has(value)) {
    errors.push(recordError(code, path, "Execution record enum value is not supported."));
  }
}

function validateTimestamp(
  value: unknown,
  path: string,
  errors: SocialPublicationExecutionRecordError[],
): void {
  if (!hasText(value) || !Number.isFinite(Date.parse(value))) {
    errors.push(recordError("timestamp_invalid", path, "Execution record timestamp must be valid."));
  }
}

function validateUnique(
  value: unknown,
  path: string,
  seen: Set<string>,
  errors: SocialPublicationExecutionRecordError[],
): void {
  if (!hasText(value)) return;
  if (seen.has(value)) {
    errors.push(recordError("identity_not_separated", path, "Execution record identities must be unique."));
    return;
  }
  seen.add(value);
}

function requireText(
  value: unknown,
  path: string,
  errors: SocialPublicationExecutionRecordError[],
): void {
  if (!hasText(value)) {
    errors.push(recordError("required_field_missing", path, "Required execution record field is missing."));
  }
}

function validateOptionalText(
  value: unknown,
  path: string,
  errors: SocialPublicationExecutionRecordError[],
): void {
  if (value !== null && value !== undefined && !hasText(value)) {
    errors.push(recordError("required_field_missing", path, "Optional execution record reference must be null or non-empty text."));
  }
}

function rejectForbiddenState(
  value: unknown,
  path: string,
  errors: SocialPublicationExecutionRecordError[],
  seen = new WeakSet<object>(),
): void {
  if (Array.isArray(value)) {
    if (seen.has(value)) return;
    seen.add(value);
    value.forEach((item, index) => rejectForbiddenState(item, `${path}.${index}`, errors, seen));
    return;
  }
  if (!isRecord(value)) return;
  if (seen.has(value)) return;
  seen.add(value);

  for (const [key, child] of Object.entries(value)) {
    const code = FORBIDDEN_KEYS[key];
    if (code) {
      errors.push(recordError(code, `${path}.${key}`, "Execution repository records must not store forbidden state."));
    }
    rejectForbiddenState(child, `${path}.${key}`, errors, seen);
  }
}

function recordValidationFailure(
  code: SocialPublicationExecutionRecordErrorCode,
  path: string,
  message: string,
): SocialPublicationExecutionRecordValidationResult {
  return {
    ok: false,
    errors: [recordError(code, path, message)],
  };
}

function recordError(
  code: SocialPublicationExecutionRecordErrorCode,
  path: string,
  message: string,
): SocialPublicationExecutionRecordError {
  return { code, path, message };
}

function validationResult(
  errors: SocialPublicationExecutionRecordError[],
): SocialPublicationExecutionRecordValidationResult {
  if (errors.length === 0) return { ok: true, errors: [] };
  return { ok: false, errors };
}

function sortModel(
  model: SocialPublicationExecutionPersistenceModel,
): SocialPublicationExecutionPersistenceModel {
  return {
    intents: [...model.intents].sort(
      (left, right) =>
        left.requested_at.localeCompare(right.requested_at) ||
        left.execution_intent_id.localeCompare(right.execution_intent_id),
    ),
    results: [...model.results].sort(
      (left, right) =>
        left.recorded_at.localeCompare(right.recorded_at) ||
        left.execution_result_id.localeCompare(right.execution_result_id),
    ),
  };
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

function ok<T>(value: T): SocialPublicationExecutionRepositoryResult<T> {
  return { ok: true, value };
}

function failure(
  code: SocialPublicationExecutionRepositoryErrorCode,
  message: string,
  validationErrors?: readonly (
    | SocialPublicationExecutionRecordError
    | PublicationExecutionValidationError
  )[],
): SocialPublicationExecutionRepositoryResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      validationErrors,
    },
  };
}

function matches(expected: string | undefined, actual: string | null): boolean {
  return expected === undefined || expected === actual;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
