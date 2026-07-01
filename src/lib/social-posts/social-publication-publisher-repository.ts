import {
  PUBLICATION_PUBLISHER_CHANNEL_PLATFORMS,
  PUBLICATION_PUBLISHER_CHANNEL_TYPES,
  PUBLICATION_PUBLISHER_REQUEST_TYPES,
  PUBLICATION_PUBLISHER_RESULT_TYPES,
  validatePublicationPublisherRequest,
  validatePublicationPublisherResult,
  type PublicationPublisherChannelPlatform,
  type PublicationPublisherChannelType,
  type PublicationPublisherRequest,
  type PublicationPublisherRequestType,
  type PublicationPublisherResult,
  type PublicationPublisherResultType,
  type PublicationPublisherValidationError,
} from "./social-publication-publisher";

export type {
  PublicationPublisherRequest,
  PublicationPublisherResult,
} from "./social-publication-publisher";

type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

type UnknownRecord = Readonly<Record<string, unknown>>;

export type SocialPublicationPublisherRequestId = Brand<
  string,
  "SocialPublicationPublisherRequestId"
>;
export type SocialPublicationPublisherResultId = Brand<
  string,
  "SocialPublicationPublisherResultId"
>;
export type SocialPublicationPublisherJobId = Brand<
  string,
  "SocialPublicationPublisherJobId"
>;
export type SocialPublicationPublisherChannelId = Brand<
  string,
  "SocialPublicationPublisherChannelId"
>;
export type SocialPublicationPublisherSocialPostId = Brand<
  string,
  "SocialPublicationPublisherSocialPostId"
>;
export type SocialPublicationPublisherTargetId = Brand<
  string,
  "SocialPublicationPublisherTargetId"
>;
export type SocialPublicationPublisherManifestId = Brand<
  string,
  "SocialPublicationPublisherManifestId"
>;
export type SocialPublicationPublisherScheduleId = Brand<
  string,
  "SocialPublicationPublisherScheduleId"
>;
export type SocialPublicationPublisherLedgerEntryId = Brand<
  string,
  "SocialPublicationPublisherLedgerEntryId"
>;
export type SocialPublicationPublisherAttemptId = Brand<
  string,
  "SocialPublicationPublisherAttemptId"
>;
export type SocialPublicationPublisherOwnerApprovalId = Brand<
  string,
  "SocialPublicationPublisherOwnerApprovalId"
>;
export type SocialPublicationPublisherApprovalId = Brand<
  string,
  "SocialPublicationPublisherApprovalId"
>;
export type SocialPublicationPublisherProposalId = Brand<
  string,
  "SocialPublicationPublisherProposalId"
>;

export const SOCIAL_PUBLICATION_PUBLISHER_REPOSITORY_ERROR_CODES = [
  "validation_failed",
  "identity_required",
  "identity_collision",
  "relationship_invalid",
  "serialization_invalid",
  "contract_only",
] as const;

export const SOCIAL_PUBLICATION_PUBLISHER_RECORD_ERROR_CODES = [
  "required_field_missing",
  "identity_not_separated",
  "relationship_invalid",
  "channel_invalid",
  "request_type_invalid",
  "result_type_invalid",
  "timestamp_invalid",
  "contract_invariant_failed",
  "secret_forbidden",
  "network_forbidden",
  "execution_forbidden",
  "scheduler_execution_forbidden",
  "lower_layer_payload_forbidden",
  "lower_layer_mutation_forbidden",
  "metrics_state_forbidden",
  "learning_state_forbidden",
] as const;

export type SocialPublicationPublisherRepositoryErrorCode =
  (typeof SOCIAL_PUBLICATION_PUBLISHER_REPOSITORY_ERROR_CODES)[number];

export type SocialPublicationPublisherRecordErrorCode =
  (typeof SOCIAL_PUBLICATION_PUBLISHER_RECORD_ERROR_CODES)[number];

export type SocialPublicationPublisherRecordError = Readonly<{
  code: SocialPublicationPublisherRecordErrorCode;
  path: string;
  message: string;
}>;

export type SocialPublicationPublisherRepositoryError = Readonly<{
  code: SocialPublicationPublisherRepositoryErrorCode;
  message: string;
  validationErrors?: readonly (
    | SocialPublicationPublisherRecordError
    | PublicationPublisherValidationError
  )[];
}>;

export type SocialPublicationPublisherRepositoryResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: SocialPublicationPublisherRepositoryError }>;

export type SocialPublicationPublisherRecordValidationResult = Readonly<
  | {
      ok: true;
      errors: readonly [];
    }
  | {
      ok: false;
      errors: readonly SocialPublicationPublisherRecordError[];
    }
>;

export type SocialPublicationPublisherScope = Readonly<{
  social_post_id: SocialPublicationPublisherSocialPostId;
  publication_target_id: SocialPublicationPublisherTargetId;
  publication_manifest_id: SocialPublicationPublisherManifestId | null;
  schedule_id: SocialPublicationPublisherScheduleId | null;
  ledger_entry_id: SocialPublicationPublisherLedgerEntryId | null;
  publication_attempt_id: SocialPublicationPublisherAttemptId | null;
  owner_approval_id: SocialPublicationPublisherOwnerApprovalId | null;
  approval_id: SocialPublicationPublisherApprovalId | null;
  proposal_id: SocialPublicationPublisherProposalId | null;
}>;

export type SocialPublicationPublisherRequestRecord = Readonly<{
  publisher_request_id: SocialPublicationPublisherRequestId;
  publisher_job_id: SocialPublicationPublisherJobId;
  request_type: PublicationPublisherRequestType;
  channel_id: SocialPublicationPublisherChannelId;
  channel_platform: PublicationPublisherChannelPlatform;
  channel_type: PublicationPublisherChannelType;
  scope: SocialPublicationPublisherScope;
  owner_approval_satisfied: boolean;
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
}>;

export type SocialPublicationPublisherResultRecord = Readonly<{
  publisher_result_id: SocialPublicationPublisherResultId;
  publisher_request_id: SocialPublicationPublisherRequestId;
  publisher_job_id: SocialPublicationPublisherJobId;
  result_type: PublicationPublisherResultType;
  result_status: "prepared" | "rejected";
  channel_id: SocialPublicationPublisherChannelId;
  channel_platform: PublicationPublisherChannelPlatform;
  channel_type: PublicationPublisherChannelType;
  scope: SocialPublicationPublisherScope;
  result_code: string | null;
  error_code: string | null;
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
  current_publish_status_authority: false;
  records_no_metrics: true;
  performs_no_learning: true;
}>;

export type SocialPublicationPublisherPersistenceModel = Readonly<{
  requests: readonly SocialPublicationPublisherRequestRecord[];
  results: readonly SocialPublicationPublisherResultRecord[];
}>;

export type SocialPublicationPublisherRepositoryIdentity = Readonly<{
  publisher_request_id?: string;
  publisher_result_id?: string;
  publisher_job_id?: string;
  channel_id?: string;
  social_post_id?: string;
  publication_target_id?: string;
  publication_manifest_id?: string;
  schedule_id?: string;
  ledger_entry_id?: string;
  publication_attempt_id?: string;
  owner_approval_id?: string;
  approval_id?: string;
  proposal_id?: string;
}>;

export type SocialPublicationPublisherCreateRequest = Readonly<{
  request: SocialPublicationPublisherRequestRecord;
}>;

export type SocialPublicationPublisherAppendResultRequest = Readonly<{
  result: SocialPublicationPublisherResultRecord;
}>;

export type SocialPublicationPublisherRepositorySnapshot =
  SocialPublicationPublisherPersistenceModel;

export type SocialPublicationPublisherRepository = Readonly<{
  createPublisherRequest(
    request: SocialPublicationPublisherCreateRequest,
  ): SocialPublicationPublisherRepositoryResult<SocialPublicationPublisherRequestRecord>;
  appendPublisherResult(
    request: SocialPublicationPublisherAppendResultRequest,
  ): SocialPublicationPublisherRepositoryResult<SocialPublicationPublisherResultRecord>;
  getPublisherRecordsByIdentity(
    identity: SocialPublicationPublisherRepositoryIdentity,
  ): SocialPublicationPublisherRepositoryResult<SocialPublicationPublisherPersistenceModel>;
  listPublisherRequests(
    identity?: SocialPublicationPublisherRepositoryIdentity,
  ): SocialPublicationPublisherRepositoryResult<
    readonly SocialPublicationPublisherRequestRecord[]
  >;
  listPublisherResults(
    identity?: SocialPublicationPublisherRepositoryIdentity,
  ): SocialPublicationPublisherRepositoryResult<
    readonly SocialPublicationPublisherResultRecord[]
  >;
  snapshot(): SocialPublicationPublisherRepositoryResult<SocialPublicationPublisherRepositorySnapshot>;
}>;

const REQUEST_TYPES = new Set<string>(PUBLICATION_PUBLISHER_REQUEST_TYPES);
const RESULT_TYPES = new Set<string>(PUBLICATION_PUBLISHER_RESULT_TYPES);
const CHANNEL_PLATFORMS = new Set<string>(PUBLICATION_PUBLISHER_CHANNEL_PLATFORMS);
const CHANNEL_TYPES = new Set<string>(PUBLICATION_PUBLISHER_CHANNEL_TYPES);

const FORBIDDEN_KEYS: Readonly<Record<string, SocialPublicationPublisherRecordErrorCode>> = {
  accessToken: "secret_forbidden",
  access_token: "secret_forbidden",
  apiKey: "secret_forbidden",
  api_key: "secret_forbidden",
  authHeader: "secret_forbidden",
  clientSecret: "secret_forbidden",
  client_secret: "secret_forbidden",
  credentials: "secret_forbidden",
  password: "secret_forbidden",
  refreshToken: "secret_forbidden",
  refresh_token: "secret_forbidden",
  secret: "secret_forbidden",
  token: "secret_forbidden",
  fetch: "network_forbidden",
  httpClient: "network_forbidden",
  networkRequest: "network_forbidden",
  webhook: "network_forbidden",
  executionPlan: "execution_forbidden",
  execution_plan: "execution_forbidden",
  publishExecution: "execution_forbidden",
  publishResult: "execution_forbidden",
  publishedAt: "execution_forbidden",
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
  rawPayload: "lower_layer_payload_forbidden",
  targetPayload: "lower_layer_payload_forbidden",
  targetSnapshot: "lower_layer_payload_forbidden",
  workingContext: "lower_layer_payload_forbidden",
  appendLedgerEntry: "lower_layer_mutation_forbidden",
  mutateApproval: "lower_layer_mutation_forbidden",
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

export function mapPublicationPublisherRequestToRequestRecord(
  request: PublicationPublisherRequest,
): SocialPublicationPublisherRepositoryResult<SocialPublicationPublisherRequestRecord> {
  const validation = validatePublicationPublisherRequest(request);
  if (!validation.ok) {
    return failure(
      "validation_failed",
      "Publisher domain request failed validation.",
      validation.errors,
    );
  }

  return validateAndReturnRequestRecord({
    publisher_request_id: request.requestId as SocialPublicationPublisherRequestId,
    publisher_job_id: request.job.jobId as SocialPublicationPublisherJobId,
    request_type: request.requestSummary.requestType,
    channel_id: request.channel.channelId as SocialPublicationPublisherChannelId,
    channel_platform: request.channel.platform,
    channel_type: request.channel.channelType,
    scope: mapReferencesToScope(request.job.references),
    owner_approval_satisfied: request.authority.ownerApprovalSatisfied,
    requested_at: request.createdAt,
    updated_at: request.updatedAt,
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
  });
}

export function mapRequestRecordToPublicationPublisherRequest(
  record: SocialPublicationPublisherRequestRecord,
): SocialPublicationPublisherRepositoryResult<PublicationPublisherRequest> {
  const recordValidation = validateSocialPublicationPublisherRequestRecord(record);
  if (!recordValidation.ok) {
    return failure(
      "validation_failed",
      "Publisher request record failed validation.",
      recordValidation.errors,
    );
  }

  const request = buildPublicationPublisherRequest(record);
  const validation = validatePublicationPublisherRequest(request);
  if (!validation.ok) {
    return failure(
      "validation_failed",
      "Publisher request record could not hydrate to a valid domain request.",
      validation.errors,
    );
  }

  return ok(immutableClone(request));
}

export function mapPublicationPublisherResultToResultRecord(
  result: PublicationPublisherResult,
): SocialPublicationPublisherRepositoryResult<SocialPublicationPublisherResultRecord> {
  const validation = validatePublicationPublisherResult(result);
  if (!validation.ok) {
    return failure(
      "validation_failed",
      "Publisher domain result failed validation.",
      validation.errors,
    );
  }

  return validateAndReturnResultRecord({
    publisher_result_id: result.resultId as SocialPublicationPublisherResultId,
    publisher_request_id: result.requestId as SocialPublicationPublisherRequestId,
    publisher_job_id: result.job.jobId as SocialPublicationPublisherJobId,
    result_type: result.resultSummary.resultType,
    result_status: result.resultSummary.status,
    channel_id: result.channel.channelId as SocialPublicationPublisherChannelId,
    channel_platform: result.channel.platform,
    channel_type: result.channel.channelType,
    scope: mapReferencesToScope(result.job.references),
    result_code: result.resultSummary.resultCode,
    error_code: result.errorSummary?.errorCode ?? null,
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
    current_publish_status_authority: false,
    records_no_metrics: true,
    performs_no_learning: true,
  });
}

export function mapResultRecordToPublicationPublisherResult(
  record: SocialPublicationPublisherResultRecord,
): SocialPublicationPublisherRepositoryResult<PublicationPublisherResult> {
  const recordValidation = validateSocialPublicationPublisherResultRecord(record);
  if (!recordValidation.ok) {
    return failure(
      "validation_failed",
      "Publisher result record failed validation.",
      recordValidation.errors,
    );
  }

  const result = buildPublicationPublisherResult(record);
  const validation = validatePublicationPublisherResult(result);
  if (!validation.ok) {
    return failure(
      "validation_failed",
      "Publisher result record could not hydrate to a valid domain result.",
      validation.errors,
    );
  }

  return ok(immutableClone(result));
}

export function validateSocialPublicationPublisherRequestRecord(
  record: unknown,
): SocialPublicationPublisherRecordValidationResult {
  const errors: SocialPublicationPublisherRecordError[] = [];
  if (!isRecord(record)) {
    return recordValidationFailure(
      "required_field_missing",
      "request",
      "Publisher request record must be an object.",
    );
  }

  requireText(record.publisher_request_id, "request.publisher_request_id", errors);
  requireText(record.publisher_job_id, "request.publisher_job_id", errors);
  validateEnum(record.request_type, REQUEST_TYPES, "request.request_type", "request_type_invalid", errors);
  validateChannel(record, "request", errors);
  validateScope(record.scope, "request.scope", errors);
  validateTimestamp(record.requested_at, "request.requested_at", errors);
  validateTimestamp(record.updated_at, "request.updated_at", errors);
  validateRequestInvariants(record, "request", errors);
  rejectForbiddenState(record, "request", errors);

  return validationResult(errors);
}

export function validateSocialPublicationPublisherResultRecord(
  record: unknown,
): SocialPublicationPublisherRecordValidationResult {
  const errors: SocialPublicationPublisherRecordError[] = [];
  if (!isRecord(record)) {
    return recordValidationFailure(
      "required_field_missing",
      "result",
      "Publisher result record must be an object.",
    );
  }

  requireText(record.publisher_result_id, "result.publisher_result_id", errors);
  requireText(record.publisher_request_id, "result.publisher_request_id", errors);
  requireText(record.publisher_job_id, "result.publisher_job_id", errors);
  validateEnum(record.result_type, RESULT_TYPES, "result.result_type", "result_type_invalid", errors);
  if (record.result_status !== "prepared" && record.result_status !== "rejected") {
    errors.push(recordError("result_type_invalid", "result.result_status", "Publisher result status is invalid."));
  }
  validateChannel(record, "result", errors);
  validateScope(record.scope, "result.scope", errors);
  validateTimestamp(record.recorded_at, "result.recorded_at", errors);
  validateTimestamp(record.updated_at, "result.updated_at", errors);
  validateResultInvariants(record, "result", errors);
  rejectForbiddenState(record, "result", errors);

  return validationResult(errors);
}

export function validateSocialPublicationPublisherPersistenceModel(
  model: unknown,
): SocialPublicationPublisherRecordValidationResult {
  const errors: SocialPublicationPublisherRecordError[] = [];
  if (!isRecord(model)) {
    return recordValidationFailure(
      "required_field_missing",
      "model",
      "Publisher persistence model must be an object.",
    );
  }

  const requests = Array.isArray(model.requests) ? model.requests : null;
  const results = Array.isArray(model.results) ? model.results : null;
  if (!requests) {
    errors.push(recordError("required_field_missing", "model.requests", "Publisher model requires requests."));
  }
  if (!results) {
    errors.push(recordError("required_field_missing", "model.results", "Publisher model requires results."));
  }

  const requestIds = new Set<string>();
  const resultIds = new Set<string>();
  const requestsById = new Map<string, UnknownRecord>();

  requests?.forEach((request, index) => {
    const validation = validateSocialPublicationPublisherRequestRecord(request);
    if (!validation.ok) {
      for (const error of validation.errors) {
        errors.push({ ...error, path: `requests.${index}.${error.path}` });
      }
    }
    if (!isRecord(request)) return;
    validateUnique(request.publisher_request_id, `requests.${index}.publisher_request_id`, requestIds, errors);
    if (hasText(request.publisher_request_id)) {
      requestsById.set(request.publisher_request_id, request);
    }
  });

  results?.forEach((result, index) => {
    const validation = validateSocialPublicationPublisherResultRecord(result);
    if (!validation.ok) {
      for (const error of validation.errors) {
        errors.push({ ...error, path: `results.${index}.${error.path}` });
      }
    }
    if (!isRecord(result)) return;
    validateUnique(result.publisher_result_id, `results.${index}.publisher_result_id`, resultIds, errors);
    validateResultRelationship(result, `results.${index}`, requestsById, errors);
  });

  return validationResult(errors);
}

export function validateSocialPublicationPublisherCreateRequest(
  request: unknown,
): SocialPublicationPublisherRepositoryResult<SocialPublicationPublisherCreateRequest> {
  if (!isRecord(request)) {
    return failure("validation_failed", "Publisher create request must be an object.");
  }

  const validation = validateSocialPublicationPublisherRequestRecord(request.request);
  if (!validation.ok) {
    return failure("validation_failed", "Publisher create request failed validation.", validation.errors);
  }

  return ok({ request: request.request as SocialPublicationPublisherRequestRecord });
}

export function validateSocialPublicationPublisherAppendResultRequest(
  request: unknown,
): SocialPublicationPublisherRepositoryResult<SocialPublicationPublisherAppendResultRequest> {
  if (!isRecord(request)) {
    return failure("validation_failed", "Publisher append result request must be an object.");
  }

  const validation = validateSocialPublicationPublisherResultRecord(request.result);
  if (!validation.ok) {
    return failure("validation_failed", "Publisher append result request failed validation.", validation.errors);
  }

  return ok({ result: request.result as SocialPublicationPublisherResultRecord });
}

export function validateSocialPublicationPublisherRepositoryIdentity(
  identity: unknown,
): SocialPublicationPublisherRepositoryResult<SocialPublicationPublisherRepositoryIdentity> {
  if (!isRecord(identity)) {
    return failure("identity_required", "Publisher repository identity must be an object.");
  }

  const entries = Object.entries(identity).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return failure("identity_required", "Publisher repository identity requires at least one field.");
  }

  for (const [key, value] of entries) {
    if (!hasText(value)) {
      return failure("identity_required", `Publisher identity field ${key} must be non-empty text.`);
    }
  }

  return ok(identity);
}

export function serializeSocialPublicationPublisherPersistenceModel(
  model: SocialPublicationPublisherPersistenceModel,
): string {
  const validation = validateSocialPublicationPublisherPersistenceModel(model);
  if (!validation.ok) {
    throw new Error("Publisher persistence model failed validation before serialization.");
  }

  return stableStringify(sortModel(model));
}

export function hydrateSocialPublicationPublisherPersistenceModel(
  serialized: string,
): SocialPublicationPublisherRepositoryResult<SocialPublicationPublisherPersistenceModel> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    return failure("serialization_invalid", "Publisher persistence model JSON is invalid.");
  }

  const validation = validateSocialPublicationPublisherPersistenceModel(parsed);
  if (!validation.ok) {
    return failure("validation_failed", "Publisher persistence model failed validation.", validation.errors);
  }

  return ok(deepFreeze(immutableClone(sortModel(parsed as SocialPublicationPublisherPersistenceModel))));
}

function validateAndReturnRequestRecord(
  record: SocialPublicationPublisherRequestRecord,
): SocialPublicationPublisherRepositoryResult<SocialPublicationPublisherRequestRecord> {
  const validation = validateSocialPublicationPublisherRequestRecord(record);
  if (!validation.ok) {
    return failure("validation_failed", "Publisher request record failed validation.", validation.errors);
  }

  return ok(immutableClone(record));
}

function validateAndReturnResultRecord(
  record: SocialPublicationPublisherResultRecord,
): SocialPublicationPublisherRepositoryResult<SocialPublicationPublisherResultRecord> {
  const validation = validateSocialPublicationPublisherResultRecord(record);
  if (!validation.ok) {
    return failure("validation_failed", "Publisher result record failed validation.", validation.errors);
  }

  return ok(immutableClone(record));
}

function mapReferencesToScope(
  references: PublicationPublisherRequest["job"]["references"],
): SocialPublicationPublisherScope {
  return {
    social_post_id: references.socialPostId as SocialPublicationPublisherSocialPostId,
    publication_target_id: references.publicationTargetId as SocialPublicationPublisherTargetId,
    publication_manifest_id: references.publicationManifestId as SocialPublicationPublisherManifestId | null,
    schedule_id: references.scheduleId as SocialPublicationPublisherScheduleId | null,
    ledger_entry_id: references.ledgerEntryId as SocialPublicationPublisherLedgerEntryId | null,
    publication_attempt_id: references.publicationAttemptId as SocialPublicationPublisherAttemptId | null,
    owner_approval_id: references.ownerApprovalId as SocialPublicationPublisherOwnerApprovalId | null,
    approval_id: references.approvalId as SocialPublicationPublisherApprovalId | null,
    proposal_id: references.proposalId as SocialPublicationPublisherProposalId | null,
  };
}

function buildPublicationPublisherRequest(
  record: SocialPublicationPublisherRequestRecord,
): PublicationPublisherRequest {
  const references = mapScopeToReferences(record.scope);

  return {
    requestId: record.publisher_request_id,
    job: {
      jobId: record.publisher_job_id,
      jobType: "model_publication_job",
      references,
      createdAt: record.requested_at,
      updatedAt: record.updated_at,
      modelContractOnly: true,
      executesNothing: true,
      publishesNothing: true,
      schedulesNothing: true,
      mutatesLedger: false,
      mutatesTargets: false,
      mutatesApproval: false,
      mutatesManifest: false,
      persistsNothing: true,
    },
    channel: {
      channelId: record.channel_id,
      platform: record.channel_platform,
      channelType: record.channel_type,
      publicationTargetId: record.scope.publication_target_id,
      externalChannelReference: null,
      displayName: null,
      identityOnly: true,
      containsCredentials: false,
      containsSdkClient: false,
      containsStorageReference: false,
      grantsPublishingPermission: false,
      publishesNothing: true,
    },
    authority: authorityFromRecord(record.owner_approval_satisfied, record.scope),
    requestSummary: {
      requestType: record.request_type,
      operation: "prepare_publication",
      mediaKind: null,
      captionLength: null,
      assetReferenceCount: 0,
      sanitizedSummary: {},
      containsFullPayload: false,
      containsSecrets: false,
      containsLowerLayerPayload: false,
    },
    evidenceSummary: null,
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
  };
}

function buildPublicationPublisherResult(
  record: SocialPublicationPublisherResultRecord,
): PublicationPublisherResult {
  const requestRecord: SocialPublicationPublisherRequestRecord = {
    publisher_request_id: record.publisher_request_id,
    publisher_job_id: record.publisher_job_id,
    request_type: "prepare_publication_request",
    channel_id: record.channel_id,
    channel_platform: record.channel_platform,
    channel_type: record.channel_type,
    scope: record.scope,
    owner_approval_satisfied: true,
    requested_at: record.recorded_at,
    updated_at: record.updated_at,
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
  };
  const request = buildPublicationPublisherRequest(requestRecord);

  return {
    resultId: record.publisher_result_id,
    requestId: record.publisher_request_id,
    job: request.job,
    channel: request.channel,
    authority: request.authority,
    resultSummary: {
      resultType: record.result_type,
      status: record.result_status,
      resultCode: record.result_code,
      message: null,
      sanitizedSummary: {},
      externalPublicationId: null,
      externalUrl: null,
      containsFullResponse: false,
      containsSecrets: false,
    },
    errorSummary: record.error_code
      ? {
          errorCode: record.error_code,
          message: null,
          retryable: null,
          sanitizedSummary: {},
          containsFullResponse: false,
          containsSecrets: false,
        }
      : null,
    evidenceSummary: null,
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
    currentPublishStatusAuthority: false,
  };
}

function mapScopeToReferences(
  scope: SocialPublicationPublisherScope,
): PublicationPublisherRequest["job"]["references"] {
  return {
    socialPostId: scope.social_post_id,
    publicationTargetId: scope.publication_target_id,
    publicationManifestId: scope.publication_manifest_id,
    ownerApprovalId: scope.owner_approval_id,
    approvalId: scope.approval_id,
    proposalId: scope.proposal_id,
    scheduleId: scope.schedule_id,
    ledgerEntryId: scope.ledger_entry_id,
    publicationAttemptId: scope.publication_attempt_id,
  };
}

function authorityFromRecord(
  ownerApprovalSatisfied: boolean,
  scope: SocialPublicationPublisherScope,
): PublicationPublisherRequest["authority"] {
  return {
    authorityKind: "model",
    modelAuthorityOnly: true,
    ownerApprovalId: scope.owner_approval_id,
    approvalId: scope.approval_id,
    requiresOwnerApproval: true,
    ownerApprovalSatisfied,
    allowsExternalApiCall: false,
    allowsSdkUsage: false,
    allowsNetwork: false,
    allowsPublicationExecution: false,
    allowsPersistence: false,
    grantsPublishingPermission: false,
    canMutateLowerLayers: false,
  };
}

function validateChannel(
  record: UnknownRecord,
  path: string,
  errors: SocialPublicationPublisherRecordError[],
): void {
  requireText(record.channel_id, `${path}.channel_id`, errors);
  validateEnum(record.channel_platform, CHANNEL_PLATFORMS, `${path}.channel_platform`, "channel_invalid", errors);
  validateEnum(record.channel_type, CHANNEL_TYPES, `${path}.channel_type`, "channel_invalid", errors);

  if (
    (record.channel_type === "facebook_page" && record.channel_platform !== "facebook") ||
    (record.channel_type === "instagram_business_account" && record.channel_platform !== "instagram")
  ) {
    errors.push(recordError("channel_invalid", `${path}.channel_type`, "Publisher channel type must match platform."));
  }
}

function validateScope(
  scope: unknown,
  path: string,
  errors: SocialPublicationPublisherRecordError[],
): void {
  if (!isRecord(scope)) {
    errors.push(recordError("required_field_missing", path, "Publisher scope is required."));
    return;
  }

  requireText(scope.social_post_id, `${path}.social_post_id`, errors);
  requireText(scope.publication_target_id, `${path}.publication_target_id`, errors);
  validateOptionalText(scope.publication_manifest_id, `${path}.publication_manifest_id`, errors);
  validateOptionalText(scope.schedule_id, `${path}.schedule_id`, errors);
  validateOptionalText(scope.ledger_entry_id, `${path}.ledger_entry_id`, errors);
  validateOptionalText(scope.publication_attempt_id, `${path}.publication_attempt_id`, errors);
  validateOptionalText(scope.owner_approval_id, `${path}.owner_approval_id`, errors);
  validateOptionalText(scope.approval_id, `${path}.approval_id`, errors);
  validateOptionalText(scope.proposal_id, `${path}.proposal_id`, errors);
}

function validateRequestInvariants(
  record: UnknownRecord,
  path: string,
  errors: SocialPublicationPublisherRecordError[],
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
    record.performs_no_learning !== true
  ) {
    errors.push(recordError("contract_invariant_failed", `${path}.contract_invariants`, "Publisher request records must remain contract-only."));
  }
}

function validateResultInvariants(
  record: UnknownRecord,
  path: string,
  errors: SocialPublicationPublisherRecordError[],
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
    record.current_publish_status_authority !== false ||
    record.records_no_metrics !== true ||
    record.performs_no_learning !== true
  ) {
    errors.push(recordError("contract_invariant_failed", `${path}.contract_invariants`, "Publisher result records must remain contract-only."));
  }
}

function validateResultRelationship(
  result: UnknownRecord,
  path: string,
  requestsById: ReadonlyMap<string, UnknownRecord>,
  errors: SocialPublicationPublisherRecordError[],
): void {
  const requestId = result.publisher_request_id;
  if (!hasText(requestId)) return;

  const request = requestsById.get(requestId);
  if (!request) {
    errors.push(recordError("relationship_invalid", `${path}.publisher_request_id`, "Publisher result must reference a request record."));
    return;
  }

  if (request.publisher_job_id !== result.publisher_job_id || !sameScope(request.scope, result.scope)) {
    errors.push(recordError("relationship_invalid", `${path}.scope`, "Publisher result must match request identity and scope."));
  }
}

function sameScope(left: unknown, right: unknown): boolean {
  if (!isRecord(left) || !isRecord(right)) return false;

  return [
    "social_post_id",
    "publication_target_id",
    "publication_manifest_id",
    "schedule_id",
    "ledger_entry_id",
    "publication_attempt_id",
    "owner_approval_id",
    "approval_id",
    "proposal_id",
  ].every((key) => left[key] === right[key]);
}

function validateEnum(
  value: unknown,
  allowed: ReadonlySet<string>,
  path: string,
  code: SocialPublicationPublisherRecordErrorCode,
  errors: SocialPublicationPublisherRecordError[],
): void {
  if (!hasText(value) || !allowed.has(value)) {
    errors.push(recordError(code, path, "Publisher record enum value is not supported."));
  }
}

function validateTimestamp(
  value: unknown,
  path: string,
  errors: SocialPublicationPublisherRecordError[],
): void {
  if (!hasText(value) || !Number.isFinite(Date.parse(value))) {
    errors.push(recordError("timestamp_invalid", path, "Publisher record timestamp must be valid."));
  }
}

function validateUnique(
  value: unknown,
  path: string,
  seen: Set<string>,
  errors: SocialPublicationPublisherRecordError[],
): void {
  if (!hasText(value)) return;
  if (seen.has(value)) {
    errors.push(recordError("identity_not_separated", path, "Publisher record identities must be unique."));
    return;
  }
  seen.add(value);
}

function requireText(
  value: unknown,
  path: string,
  errors: SocialPublicationPublisherRecordError[],
): void {
  if (!hasText(value)) {
    errors.push(recordError("required_field_missing", path, "Required publisher record field is missing."));
  }
}

function validateOptionalText(
  value: unknown,
  path: string,
  errors: SocialPublicationPublisherRecordError[],
): void {
  if (value !== null && value !== undefined && !hasText(value)) {
    errors.push(recordError("required_field_missing", path, "Optional publisher record reference must be null or non-empty text."));
  }
}

function rejectForbiddenState(
  value: unknown,
  path: string,
  errors: SocialPublicationPublisherRecordError[],
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
      errors.push(recordError(code, `${path}.${key}`, "Publisher repository records must not store forbidden state."));
    }
    rejectForbiddenState(child, `${path}.${key}`, errors, seen);
  }
}

function recordValidationFailure(
  code: SocialPublicationPublisherRecordErrorCode,
  path: string,
  message: string,
): SocialPublicationPublisherRecordValidationResult {
  return {
    ok: false,
    errors: [recordError(code, path, message)],
  };
}

function recordError(
  code: SocialPublicationPublisherRecordErrorCode,
  path: string,
  message: string,
): SocialPublicationPublisherRecordError {
  return { code, path, message };
}

function validationResult(
  errors: SocialPublicationPublisherRecordError[],
): SocialPublicationPublisherRecordValidationResult {
  if (errors.length === 0) return { ok: true, errors: [] };
  return { ok: false, errors };
}

function sortModel(
  model: SocialPublicationPublisherPersistenceModel,
): SocialPublicationPublisherPersistenceModel {
  return {
    requests: [...model.requests].sort(
      (left, right) =>
        left.requested_at.localeCompare(right.requested_at) ||
        left.publisher_request_id.localeCompare(right.publisher_request_id),
    ),
    results: [...model.results].sort(
      (left, right) =>
        left.recorded_at.localeCompare(right.recorded_at) ||
        left.publisher_result_id.localeCompare(right.publisher_result_id),
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

function ok<T>(value: T): SocialPublicationPublisherRepositoryResult<T> {
  return { ok: true, value };
}

function failure(
  code: SocialPublicationPublisherRepositoryErrorCode,
  message: string,
  validationErrors?: readonly (
    | SocialPublicationPublisherRecordError
    | PublicationPublisherValidationError
  )[],
): SocialPublicationPublisherRepositoryResult<never> {
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
