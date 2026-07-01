export const PUBLICATION_PUBLISHER_JOB_TYPES = [
  "model_publication_job",
] as const;

export const PUBLICATION_PUBLISHER_CHANNEL_PLATFORMS = [
  "facebook",
  "instagram",
] as const;

export const PUBLICATION_PUBLISHER_CHANNEL_TYPES = [
  "facebook_page",
  "instagram_business_account",
] as const;

export const PUBLICATION_PUBLISHER_REQUEST_TYPES = [
  "prepare_publication_request",
] as const;

export const PUBLICATION_PUBLISHER_RESULT_TYPES = [
  "publication_request_prepared",
  "publication_request_rejected",
] as const;

export const PUBLICATION_PUBLISHER_ERROR_CODES = [
  "job_id_required",
  "job_type_required",
  "job_type_unknown",
  "channel_id_required",
  "channel_platform_unknown",
  "channel_type_unknown",
  "channel_identity_invalid",
  "request_id_required",
  "request_type_required",
  "request_type_unknown",
  "result_id_required",
  "result_type_required",
  "result_type_unknown",
  "social_post_id_required",
  "publication_target_id_required",
  "schedule_id_invalid",
  "ledger_id_invalid",
  "approval_reference_invalid",
  "publication_manifest_id_invalid",
  "authority_invalid",
  "created_at_required",
  "updated_at_required",
  "request_invariant_failed",
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
  "publish_execution_forbidden",
  "metrics_state_forbidden",
  "learning_state_forbidden",
  "mutable_publish_state_forbidden",
] as const;

export type PublicationPublisherJobId = string;
export type PublicationPublisherChannelId = string;
export type PublicationPublisherRequestId = string;
export type PublicationPublisherResultId = string;

export type PublicationPublisherJobType =
  (typeof PUBLICATION_PUBLISHER_JOB_TYPES)[number];

export type PublicationPublisherChannelPlatform =
  (typeof PUBLICATION_PUBLISHER_CHANNEL_PLATFORMS)[number];

export type PublicationPublisherChannelType =
  (typeof PUBLICATION_PUBLISHER_CHANNEL_TYPES)[number];

export type PublicationPublisherRequestType =
  (typeof PUBLICATION_PUBLISHER_REQUEST_TYPES)[number];

export type PublicationPublisherResultType =
  (typeof PUBLICATION_PUBLISHER_RESULT_TYPES)[number];

export type PublicationPublisherErrorCode =
  (typeof PUBLICATION_PUBLISHER_ERROR_CODES)[number];

export type PublicationPublisherValidationError = Readonly<{
  code: PublicationPublisherErrorCode;
  path: string;
  message: string;
}>;

export type PublicationPublisherValidationResult = Readonly<
  | {
      ok: true;
      errors: readonly [];
    }
  | {
      ok: false;
      errors: readonly PublicationPublisherValidationError[];
    }
>;

export type PublicationPublisherJsonPrimitive = string | number | boolean | null;

export type PublicationPublisherJsonValue =
  | PublicationPublisherJsonPrimitive
  | readonly PublicationPublisherJsonValue[]
  | { readonly [key: string]: PublicationPublisherJsonValue };

export type PublicationPublisherJsonObject = Readonly<{
  [key: string]: PublicationPublisherJsonValue;
}>;

export type PublicationPublisherReferences = Readonly<{
  socialPostId: string;
  publicationTargetId: string;
  publicationManifestId: string | null;
  ownerApprovalId: string | null;
  approvalId: string | null;
  proposalId: string | null;
  scheduleId: string | null;
  ledgerEntryId: string | null;
  publicationAttemptId: string | null;
}>;

export type PublicationPublisherJobIdentity = Readonly<{
  jobId: PublicationPublisherJobId;
  jobType: PublicationPublisherJobType;
  references: PublicationPublisherReferences;
  createdAt: string;
  updatedAt: string;
  modelContractOnly: true;
  executesNothing: true;
  publishesNothing: true;
  schedulesNothing: true;
  mutatesLedger: false;
  mutatesTargets: false;
  mutatesApproval: false;
  mutatesManifest: false;
  persistsNothing: true;
}>;

export type PublicationPublisherChannelIdentity = Readonly<{
  channelId: PublicationPublisherChannelId;
  platform: PublicationPublisherChannelPlatform;
  channelType: PublicationPublisherChannelType;
  publicationTargetId: string;
  externalChannelReference: string | null;
  displayName: string | null;
  identityOnly: true;
  containsCredentials: false;
  containsSdkClient: false;
  containsStorageReference: false;
  grantsPublishingPermission: false;
  publishesNothing: true;
}>;

export type PublicationPublisherAuthorityRequirement = Readonly<{
  authorityKind: "model";
  modelAuthorityOnly: true;
  ownerApprovalId: string | null;
  approvalId: string | null;
  requiresOwnerApproval: true;
  ownerApprovalSatisfied: boolean;
  allowsExternalApiCall: false;
  allowsSdkUsage: false;
  allowsNetwork: false;
  allowsPublicationExecution: false;
  allowsPersistence: false;
  grantsPublishingPermission: false;
  canMutateLowerLayers: false;
}>;

export type PublicationPublisherRequestSummary = Readonly<{
  requestType: PublicationPublisherRequestType;
  operation: "prepare_publication";
  mediaKind: "image" | "video" | "mixed" | "none" | null;
  captionLength: number | null;
  assetReferenceCount: number;
  sanitizedSummary: PublicationPublisherJsonObject;
  containsFullPayload: false;
  containsSecrets: false;
  containsLowerLayerPayload: false;
}>;

export type PublicationPublisherResultSummary = Readonly<{
  resultType: PublicationPublisherResultType;
  status: "prepared" | "rejected";
  resultCode: string | null;
  message: string | null;
  sanitizedSummary: PublicationPublisherJsonObject;
  externalPublicationId: null;
  externalUrl: null;
  containsFullResponse: false;
  containsSecrets: false;
}>;

export type PublicationPublisherErrorSummary = Readonly<{
  errorCode: string | null;
  message: string | null;
  retryable: boolean | null;
  sanitizedSummary: PublicationPublisherJsonObject;
  containsFullResponse: false;
  containsSecrets: false;
}>;

export type PublicationPublisherEvidenceSummary = Readonly<{
  evidenceKind:
    | "request_contract"
    | "result_contract"
    | "error_contract"
    | "authority_check"
    | "operator_note"
    | "none";
  notes: string | null;
  externalReference: null;
  evidence: PublicationPublisherJsonObject;
  containsFullPayload: false;
  containsFullResponse: false;
  containsSecrets: false;
  provesExecution: false;
}>;

export type PublicationPublisherRequest = Readonly<{
  requestId: PublicationPublisherRequestId;
  job: PublicationPublisherJobIdentity;
  channel: PublicationPublisherChannelIdentity;
  authority: PublicationPublisherAuthorityRequirement;
  requestSummary: PublicationPublisherRequestSummary;
  evidenceSummary: PublicationPublisherEvidenceSummary | null;
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
}>;

export type PublicationPublisherResult = Readonly<{
  resultId: PublicationPublisherResultId;
  requestId: PublicationPublisherRequestId;
  job: PublicationPublisherJobIdentity;
  channel: PublicationPublisherChannelIdentity;
  authority: PublicationPublisherAuthorityRequirement;
  resultSummary: PublicationPublisherResultSummary;
  errorSummary: PublicationPublisherErrorSummary | null;
  evidenceSummary: PublicationPublisherEvidenceSummary | null;
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
  currentPublishStatusAuthority: false;
}>;

type UnknownRecord = Readonly<Record<string, unknown>>;

const JOB_TYPE_SET = new Set<string>(PUBLICATION_PUBLISHER_JOB_TYPES);
const PLATFORM_SET = new Set<string>(PUBLICATION_PUBLISHER_CHANNEL_PLATFORMS);
const CHANNEL_TYPE_SET = new Set<string>(PUBLICATION_PUBLISHER_CHANNEL_TYPES);
const REQUEST_TYPE_SET = new Set<string>(PUBLICATION_PUBLISHER_REQUEST_TYPES);
const RESULT_TYPE_SET = new Set<string>(PUBLICATION_PUBLISHER_RESULT_TYPES);

const CHANNEL_TYPE_PLATFORM: Readonly<
  Record<PublicationPublisherChannelType, PublicationPublisherChannelPlatform>
> = {
  facebook_page: "facebook",
  instagram_business_account: "instagram",
};

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
  "facebookGraphApi",
  "instagramGraphApi",
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
  "mutateScheduler",
  "mutateTarget",
  "updateApproval",
  "updateLedger",
  "updateManifest",
  "updateSchedule",
  "updateTarget",
  "writeLedger",
]);

const FORBIDDEN_PUBLISH_EXECUTION_KEYS = new Set([
  "executePublication",
  "publish",
  "publishPost",
  "publishResult",
  "publishToTarget",
  "publishedAt",
  "sendPost",
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

const FORBIDDEN_MUTABLE_PUBLISH_STATE_KEYS = new Set([
  "currentPublishStatus",
  "isPublished",
  "postedAt",
  "publishedPostId",
  "publishState",
  "publishStatus",
]);

export function isPublicationPublisherJobType(
  value: string,
): value is PublicationPublisherJobType {
  return JOB_TYPE_SET.has(value);
}

export function isPublicationPublisherChannelPlatform(
  value: string,
): value is PublicationPublisherChannelPlatform {
  return PLATFORM_SET.has(value);
}

export function isPublicationPublisherChannelType(
  value: string,
): value is PublicationPublisherChannelType {
  return CHANNEL_TYPE_SET.has(value);
}

export function isPublicationPublisherRequestType(
  value: string,
): value is PublicationPublisherRequestType {
  return REQUEST_TYPE_SET.has(value);
}

export function isPublicationPublisherResultType(
  value: string,
): value is PublicationPublisherResultType {
  return RESULT_TYPE_SET.has(value);
}

export function validatePublicationPublisherRequest(
  request: PublicationPublisherRequest,
): PublicationPublisherValidationResult {
  const errors: PublicationPublisherValidationError[] = [];

  validateRequiredText(request.requestId, "requestId", "request_id_required", errors);
  validateJobIdentity(request.job, "job", errors);
  validateChannelIdentity(request.channel, "channel", errors);
  validateAuthority(request.authority, "authority", errors);
  validateRequestSummary(request.requestSummary, "requestSummary", errors);
  validateEvidenceSummary(request.evidenceSummary, "evidenceSummary", errors);
  validateRequiredText(request.createdAt, "createdAt", "created_at_required", errors);
  validateRequiredText(request.updatedAt, "updatedAt", "updated_at_required", errors);
  validateRequestInvariants(request, errors);
  rejectForbiddenUnsafeState(request, "request", errors);

  return validationResult(errors);
}

export function validatePublicationPublisherResult(
  result: PublicationPublisherResult,
): PublicationPublisherValidationResult {
  const errors: PublicationPublisherValidationError[] = [];

  validateRequiredText(result.resultId, "resultId", "result_id_required", errors);
  validateRequiredText(result.requestId, "requestId", "request_id_required", errors);
  validateJobIdentity(result.job, "job", errors);
  validateChannelIdentity(result.channel, "channel", errors);
  validateAuthority(result.authority, "authority", errors);
  validateResultSummary(result.resultSummary, "resultSummary", errors);
  validateErrorSummary(result.errorSummary, "errorSummary", errors);
  validateEvidenceSummary(result.evidenceSummary, "evidenceSummary", errors);
  validateRequiredText(result.createdAt, "createdAt", "created_at_required", errors);
  validateRequiredText(result.updatedAt, "updatedAt", "updated_at_required", errors);
  validateResultInvariants(result, errors);
  rejectForbiddenUnsafeState(result, "result", errors);

  return validationResult(errors);
}

export function assertPublicationPublisherRequestSafe(
  request: PublicationPublisherRequest,
): asserts request is PublicationPublisherRequest {
  const validation = validatePublicationPublisherRequest(request);
  if (!validation.ok) {
    throw new Error("Publication publisher request failed safety validation.");
  }
}

export function assertPublicationPublisherResultSafe(
  result: PublicationPublisherResult,
): asserts result is PublicationPublisherResult {
  const validation = validatePublicationPublisherResult(result);
  if (!validation.ok) {
    throw new Error("Publication publisher result failed safety validation.");
  }
}

export function serializePublicationPublisherRequest(
  request: PublicationPublisherRequest,
): string {
  assertPublicationPublisherRequestSafe(request);
  return stableStringify(request);
}

export function serializePublicationPublisherResult(
  result: PublicationPublisherResult,
): string {
  assertPublicationPublisherResultSafe(result);
  return stableStringify(result);
}

export function hydratePublicationPublisherRequest(
  serialized: string,
): PublicationPublisherValidationResult & { value?: PublicationPublisherRequest } {
  const parsed = parseSerialized(serialized, "request_invariant_failed");
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const validation = validatePublicationPublisherRequest(
    parsed.value as PublicationPublisherRequest,
  );
  if (!validation.ok) return validation;

  return {
    ok: true,
    errors: [],
    value: deepFreeze(immutableClone(parsed.value as PublicationPublisherRequest)),
  };
}

export function hydratePublicationPublisherResult(
  serialized: string,
): PublicationPublisherValidationResult & { value?: PublicationPublisherResult } {
  const parsed = parseSerialized(serialized, "result_invariant_failed");
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const validation = validatePublicationPublisherResult(
    parsed.value as PublicationPublisherResult,
  );
  if (!validation.ok) return validation;

  return {
    ok: true,
    errors: [],
    value: deepFreeze(immutableClone(parsed.value as PublicationPublisherResult)),
  };
}

function validateJobIdentity(
  job: PublicationPublisherJobIdentity,
  path: string,
  errors: PublicationPublisherValidationError[],
): void {
  if (!isRecord(job)) {
    errors.push(validationError({
      code: "job_id_required",
      path,
      message: "Publication publisher job identity is required.",
    }));
    return;
  }

  validateRequiredText(job.jobId, `${path}.jobId`, "job_id_required", errors);
  if (!hasText(job.jobType)) {
    errors.push(validationError({
      code: "job_type_required",
      path: `${path}.jobType`,
      message: "Publication publisher job type is required.",
    }));
  } else if (!isPublicationPublisherJobType(job.jobType)) {
    errors.push(validationError({
      code: "job_type_unknown",
      path: `${path}.jobType`,
      message: "Publication publisher job type is not supported.",
    }));
  }

  validateReferences(job.references, `${path}.references`, errors);
  validateRequiredText(job.createdAt, `${path}.createdAt`, "created_at_required", errors);
  validateRequiredText(job.updatedAt, `${path}.updatedAt`, "updated_at_required", errors);

  if (
    job.modelContractOnly !== true ||
    job.executesNothing !== true ||
    job.publishesNothing !== true ||
    job.schedulesNothing !== true ||
    job.mutatesLedger !== false ||
    job.mutatesTargets !== false ||
    job.mutatesApproval !== false ||
    job.mutatesManifest !== false ||
    job.persistsNothing !== true
  ) {
    errors.push(validationError({
      code: "request_invariant_failed",
      path,
      message: "Publication publisher jobs must remain model-only contracts.",
    }));
  }
}

function validateChannelIdentity(
  channel: PublicationPublisherChannelIdentity,
  path: string,
  errors: PublicationPublisherValidationError[],
): void {
  if (!isRecord(channel)) {
    errors.push(validationError({
      code: "channel_id_required",
      path,
      message: "Publication publisher channel identity is required.",
    }));
    return;
  }

  validateRequiredText(channel.channelId, `${path}.channelId`, "channel_id_required", errors);
  validateRequiredText(
    channel.publicationTargetId,
    `${path}.publicationTargetId`,
    "publication_target_id_required",
    errors,
  );

  if (!isPublicationPublisherChannelPlatform(channel.platform)) {
    errors.push(validationError({
      code: "channel_platform_unknown",
      path: `${path}.platform`,
      message: "Publication publisher channel platform is not supported.",
    }));
  }

  if (!isPublicationPublisherChannelType(channel.channelType)) {
    errors.push(validationError({
      code: "channel_type_unknown",
      path: `${path}.channelType`,
      message: "Publication publisher channel type is not supported.",
    }));
  } else if (CHANNEL_TYPE_PLATFORM[channel.channelType] !== channel.platform) {
    errors.push(validationError({
      code: "channel_identity_invalid",
      path: `${path}.channelType`,
      message: "Publication publisher channel type must match its platform.",
    }));
  }

  validateOptionalText(
    channel.externalChannelReference,
    `${path}.externalChannelReference`,
    "channel_identity_invalid",
    errors,
  );
  validateOptionalText(
    channel.displayName,
    `${path}.displayName`,
    "channel_identity_invalid",
    errors,
  );

  if (
    channel.identityOnly !== true ||
    channel.containsCredentials !== false ||
    channel.containsSdkClient !== false ||
    channel.containsStorageReference !== false ||
    channel.grantsPublishingPermission !== false ||
    channel.publishesNothing !== true
  ) {
    errors.push(validationError({
      code: "channel_identity_invalid",
      path,
      message: "Publication publisher channel identities must not contain executable authority.",
    }));
  }
}

function validateAuthority(
  authority: PublicationPublisherAuthorityRequirement,
  path: string,
  errors: PublicationPublisherValidationError[],
): void {
  if (
    !isRecord(authority) ||
    authority.authorityKind !== "model" ||
    authority.modelAuthorityOnly !== true ||
    authority.requiresOwnerApproval !== true ||
    typeof authority.ownerApprovalSatisfied !== "boolean" ||
    authority.allowsExternalApiCall !== false ||
    authority.allowsSdkUsage !== false ||
    authority.allowsNetwork !== false ||
    authority.allowsPublicationExecution !== false ||
    authority.allowsPersistence !== false ||
    authority.grantsPublishingPermission !== false ||
    authority.canMutateLowerLayers !== false
  ) {
    errors.push(validationError({
      code: "authority_invalid",
      path,
      message: "Publication publisher authority must be model-only and non-executable.",
    }));
    return;
  }

  validateOptionalText(
    authority.ownerApprovalId,
    `${path}.ownerApprovalId`,
    "approval_reference_invalid",
    errors,
  );
  validateOptionalText(
    authority.approvalId,
    `${path}.approvalId`,
    "approval_reference_invalid",
    errors,
  );
}

function validateRequestSummary(
  summary: PublicationPublisherRequestSummary,
  path: string,
  errors: PublicationPublisherValidationError[],
): void {
  if (!isRecord(summary)) {
    errors.push(validationError({
      code: "request_invariant_failed",
      path,
      message: "Publication publisher request summary is required.",
    }));
    return;
  }

  if (!hasText(summary.requestType)) {
    errors.push(validationError({
      code: "request_type_required",
      path: `${path}.requestType`,
      message: "Publication publisher request type is required.",
    }));
  } else if (!isPublicationPublisherRequestType(summary.requestType)) {
    errors.push(validationError({
      code: "request_type_unknown",
      path: `${path}.requestType`,
      message: "Publication publisher request type is not supported.",
    }));
  }

  if (
    summary.operation !== "prepare_publication" ||
    !isJsonObject(summary.sanitizedSummary) ||
    summary.containsFullPayload !== false ||
    summary.containsSecrets !== false ||
    summary.containsLowerLayerPayload !== false ||
    !Number.isInteger(summary.assetReferenceCount) ||
    summary.assetReferenceCount < 0 ||
    (summary.captionLength !== null &&
      (!Number.isInteger(summary.captionLength) || summary.captionLength < 0))
  ) {
    errors.push(validationError({
      code: "request_invariant_failed",
      path,
      message: "Publication publisher request summaries must be sanitized contract summaries.",
    }));
  }
}

function validateResultSummary(
  summary: PublicationPublisherResultSummary,
  path: string,
  errors: PublicationPublisherValidationError[],
): void {
  if (!isRecord(summary)) {
    errors.push(validationError({
      code: "result_invariant_failed",
      path,
      message: "Publication publisher result summary is required.",
    }));
    return;
  }

  if (!hasText(summary.resultType)) {
    errors.push(validationError({
      code: "result_type_required",
      path: `${path}.resultType`,
      message: "Publication publisher result type is required.",
    }));
  } else if (!isPublicationPublisherResultType(summary.resultType)) {
    errors.push(validationError({
      code: "result_type_unknown",
      path: `${path}.resultType`,
      message: "Publication publisher result type is not supported.",
    }));
  }

  if (
    !["prepared", "rejected"].includes(String(summary.status)) ||
    !isJsonObject(summary.sanitizedSummary) ||
    summary.externalPublicationId !== null ||
    summary.externalUrl !== null ||
    summary.containsFullResponse !== false ||
    summary.containsSecrets !== false
  ) {
    errors.push(validationError({
      code: "result_invariant_failed",
      path,
      message: "Publication publisher result summaries must not claim external publication.",
    }));
  }
}

function validateErrorSummary(
  summary: PublicationPublisherErrorSummary | null,
  path: string,
  errors: PublicationPublisherValidationError[],
): void {
  if (summary === null) return;

  if (
    !isRecord(summary) ||
    !isJsonObject(summary.sanitizedSummary) ||
    summary.containsFullResponse !== false ||
    summary.containsSecrets !== false
  ) {
    errors.push(validationError({
      code: "result_invariant_failed",
      path,
      message: "Publication publisher error summaries must be sanitized.",
    }));
    return;
  }

  validateOptionalText(summary.errorCode, `${path}.errorCode`, "result_invariant_failed", errors);
  validateOptionalText(summary.message, `${path}.message`, "result_invariant_failed", errors);
}

function validateEvidenceSummary(
  summary: PublicationPublisherEvidenceSummary | null,
  path: string,
  errors: PublicationPublisherValidationError[],
): void {
  if (summary === null) return;

  if (
    !isRecord(summary) ||
    !isJsonObject(summary.evidence) ||
    summary.externalReference !== null ||
    summary.containsFullPayload !== false ||
    summary.containsFullResponse !== false ||
    summary.containsSecrets !== false ||
    summary.provesExecution !== false
  ) {
    errors.push(validationError({
      code: "request_invariant_failed",
      path,
      message: "Publication publisher evidence must be sanitized and non-execution evidence.",
    }));
    return;
  }

  validateOptionalText(summary.notes, `${path}.notes`, "request_invariant_failed", errors);
}

function validateReferences(
  references: PublicationPublisherReferences,
  path: string,
  errors: PublicationPublisherValidationError[],
): void {
  if (!isRecord(references)) {
    errors.push(validationError({
      code: "social_post_id_required",
      path,
      message: "Publication publisher references are required.",
    }));
    return;
  }

  validateRequiredText(
    references.socialPostId,
    `${path}.socialPostId`,
    "social_post_id_required",
    errors,
  );
  validateRequiredText(
    references.publicationTargetId,
    `${path}.publicationTargetId`,
    "publication_target_id_required",
    errors,
  );
  validateOptionalText(
    references.publicationManifestId,
    `${path}.publicationManifestId`,
    "publication_manifest_id_invalid",
    errors,
  );
  validateOptionalText(
    references.ownerApprovalId,
    `${path}.ownerApprovalId`,
    "approval_reference_invalid",
    errors,
  );
  validateOptionalText(
    references.approvalId,
    `${path}.approvalId`,
    "approval_reference_invalid",
    errors,
  );
  validateOptionalText(
    references.proposalId,
    `${path}.proposalId`,
    "approval_reference_invalid",
    errors,
  );
  validateOptionalText(
    references.scheduleId,
    `${path}.scheduleId`,
    "schedule_id_invalid",
    errors,
  );
  validateOptionalText(
    references.ledgerEntryId,
    `${path}.ledgerEntryId`,
    "ledger_id_invalid",
    errors,
  );
  validateOptionalText(
    references.publicationAttemptId,
    `${path}.publicationAttemptId`,
    "ledger_id_invalid",
    errors,
  );
}

function validateRequestInvariants(
  request: PublicationPublisherRequest,
  errors: PublicationPublisherValidationError[],
): void {
  if (
    request.contractOnly !== true ||
    request.modelAuthorityOnly !== true ||
    request.executesNothing !== true ||
    request.publishesNothing !== true ||
    request.callsNoExternalApis !== true ||
    request.usesNoSdks !== true ||
    request.usesNoNetwork !== true ||
    request.startsNoWorkers !== true ||
    request.startsNoTimers !== true ||
    request.createsNoQueues !== true ||
    request.exposesNoApiRoutes !== true ||
    request.exposesNoAdminUi !== true ||
    request.mutatesNoSql !== true ||
    request.mutatesNoSupabase !== true ||
    request.mutatesNoBridge !== true ||
    request.mutatesNoStorage !== true ||
    request.mutatesNoLowerLayers !== true ||
    request.recordsNoMetrics !== true ||
    request.performsNoLearning !== true
  ) {
    errors.push(validationError({
      code: "request_invariant_failed",
      path: "requestInvariants",
      message: "Publication publisher requests must remain non-executable contracts.",
    }));
  }
}

function validateResultInvariants(
  result: PublicationPublisherResult,
  errors: PublicationPublisherValidationError[],
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
    result.currentPublishStatusAuthority !== false
  ) {
    errors.push(validationError({
      code: "result_invariant_failed",
      path: "resultInvariants",
      message: "Publication publisher results must remain non-executable contract evidence.",
    }));
  }
}

function rejectForbiddenUnsafeState(
  value: unknown,
  path: string,
  errors: PublicationPublisherValidationError[],
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
  rejectForbiddenKeys(value, path, FORBIDDEN_PUBLISH_EXECUTION_KEYS, "publish_execution_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_METRICS_KEYS, "metrics_state_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_LEARNING_KEYS, "learning_state_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_MUTABLE_PUBLISH_STATE_KEYS, "mutable_publish_state_forbidden", errors);
}

function rejectForbiddenKeys(
  value: unknown,
  path: string,
  forbiddenKeys: ReadonlySet<string>,
  code: PublicationPublisherErrorCode,
  errors: PublicationPublisherValidationError[],
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
        message: "Publication publisher contracts must not store unsafe execution state.",
      }));
    }

    rejectForbiddenKeys(child, childPath, forbiddenKeys, code, errors);
  }
}

function parseSerialized(
  serialized: string,
  code: PublicationPublisherErrorCode,
): Readonly<
  | {
      ok: true;
      errors: readonly [];
      value: unknown;
    }
  | {
      ok: false;
      errors: readonly PublicationPublisherValidationError[];
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
          message: "Publication publisher JSON is invalid.",
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
          message: "Publication publisher JSON must deserialize to an object.",
        }),
      ],
    };
  }

  return { ok: true, errors: [], value: parsed };
}

function validateRequiredText(
  value: unknown,
  path: string,
  code: PublicationPublisherErrorCode,
  errors: PublicationPublisherValidationError[],
): void {
  if (!hasText(value)) {
    errors.push(validationError({
      code,
      path,
      message: "Required publication publisher field is missing.",
    }));
  }
}

function validateOptionalText(
  value: unknown,
  path: string,
  code: PublicationPublisherErrorCode,
  errors: PublicationPublisherValidationError[],
): void {
  if (value !== null && value !== undefined && !hasText(value)) {
    errors.push(validationError({
      code,
      path,
      message: "Optional publication publisher reference must be null or non-empty text.",
    }));
  }
}

function validationError(input: {
  code: PublicationPublisherErrorCode;
  path: string;
  message: string;
}): PublicationPublisherValidationError {
  return input;
}

function validationResult(
  errors: PublicationPublisherValidationError[],
): PublicationPublisherValidationResult {
  if (errors.length === 0) {
    return { ok: true, errors: [] };
  }

  return { ok: false, errors };
}

function isJsonObject(value: unknown): value is PublicationPublisherJsonObject {
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
