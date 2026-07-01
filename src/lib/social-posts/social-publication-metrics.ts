export const PUBLICATION_METRIC_OBSERVATION_TYPES = [
  "publication_metric_observation",
] as const;

export const PUBLICATION_METRIC_STATUSES = [
  "pending",
  "completed",
  "failed",
] as const;

export const PUBLICATION_METRIC_NAMES = [
  "impressions",
  "reach",
  "engagements",
  "clicks",
  "shares",
  "comments",
  "reactions",
] as const;

export const PUBLICATION_METRIC_AGGREGATION_TYPES = [
  "sum",
  "latest",
  "count",
  "average",
] as const;

export const PUBLICATION_METRIC_SOURCES = [
  "manual_observation",
  "imported_report",
  "test",
] as const;

export const PUBLICATION_METRIC_ERROR_CODES = [
  "observation_id_required",
  "observation_type_required",
  "observation_type_unknown",
  "metric_name_required",
  "metric_name_unknown",
  "metric_status_required",
  "metric_status_unknown",
  "aggregation_type_required",
  "aggregation_type_unknown",
  "source_required",
  "source_unknown",
  "social_post_id_required",
  "publication_target_id_required",
  "publisher_reference_invalid",
  "schedule_reference_invalid",
  "ledger_reference_invalid",
  "manifest_reference_invalid",
  "approval_reference_invalid",
  "value_invalid",
  "observed_at_required",
  "observed_at_invalid",
  "created_at_required",
  "updated_at_required",
  "evidence_invalid",
  "invariant_failed",
  "secret_forbidden",
  "platform_payload_forbidden",
  "external_api_forbidden",
  "sdk_forbidden",
  "network_forbidden",
  "execution_forbidden",
  "scheduler_mutation_forbidden",
  "publisher_mutation_forbidden",
  "lower_layer_mutation_forbidden",
  "persistence_forbidden",
  "bridge_forbidden",
  "admin_ui_forbidden",
  "api_route_forbidden",
  "learning_state_forbidden",
] as const;

export type PublicationMetricObservationType =
  (typeof PUBLICATION_METRIC_OBSERVATION_TYPES)[number];
export type PublicationMetricStatus = (typeof PUBLICATION_METRIC_STATUSES)[number];
export type PublicationMetricName = (typeof PUBLICATION_METRIC_NAMES)[number];
export type PublicationMetricAggregationType =
  (typeof PUBLICATION_METRIC_AGGREGATION_TYPES)[number];
export type PublicationMetricSource = (typeof PUBLICATION_METRIC_SOURCES)[number];
export type PublicationMetricErrorCode =
  (typeof PUBLICATION_METRIC_ERROR_CODES)[number];

export type PublicationMetricValidationError = Readonly<{
  code: PublicationMetricErrorCode;
  path: string;
  message: string;
}>;

export type PublicationMetricValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly PublicationMetricValidationError[] }
>;

export type PublicationMetricJsonPrimitive = string | number | boolean | null;
export type PublicationMetricJsonValue =
  | PublicationMetricJsonPrimitive
  | readonly PublicationMetricJsonValue[]
  | { readonly [key: string]: PublicationMetricJsonValue };
export type PublicationMetricJsonObject = Readonly<{
  [key: string]: PublicationMetricJsonValue;
}>;

export type PublicationMetricReferences = Readonly<{
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
  proposalId: string | null;
}>;

export type PublicationMetricEvidence = Readonly<{
  evidenceId: string;
  evidenceKind: "manual_note" | "report_reference" | "computed_summary" | "none";
  evidence: PublicationMetricJsonObject;
  notes: string | null;
  externalReportReference: string | null;
  containsPlatformPayload: false;
  containsSecrets: false;
  containsCredentials: false;
  containsSdkClient: false;
  containsRawApiResponse: false;
  provesCollection: false;
}>;

export type PublicationMetricObservation = Readonly<{
  observationId: string;
  observationType: PublicationMetricObservationType;
  metricName: PublicationMetricName;
  metricStatus: PublicationMetricStatus;
  metricValue: number | null;
  aggregationType: PublicationMetricAggregationType;
  source: PublicationMetricSource;
  references: PublicationMetricReferences;
  evidence: PublicationMetricEvidence | null;
  observedAt: string;
  createdAt: string;
  updatedAt: string;
  passiveOnly: true;
  observationOnly: true;
  computedOnly: false;
  authoritative: false;
  referencesOnly: true;
  containsPlatformPayload: false;
  collectsNoMetrics: true;
  callsNoExternalApis: true;
  usesNoSdks: true;
  usesNoNetwork: true;
  executesNothing: true;
  publishesNothing: true;
  schedulesNothing: true;
  mutatesNoScheduler: true;
  mutatesNoPublisher: true;
  mutatesNoLedger: true;
  mutatesNoApproval: true;
  mutatesNoManifest: true;
  mutatesNoTargets: true;
  persistsNothing: true;
  exposesNoBridge: true;
  exposesNoAdminUi: true;
  exposesNoApiRoutes: true;
  performsNoLearning: true;
}>;

type UnknownRecord = Readonly<Record<string, unknown>>;

const OBSERVATION_TYPE_SET = new Set<string>(PUBLICATION_METRIC_OBSERVATION_TYPES);
const STATUS_SET = new Set<string>(PUBLICATION_METRIC_STATUSES);
const METRIC_NAME_SET = new Set<string>(PUBLICATION_METRIC_NAMES);
const AGGREGATION_TYPE_SET = new Set<string>(PUBLICATION_METRIC_AGGREGATION_TYPES);
const SOURCE_SET = new Set<string>(PUBLICATION_METRIC_SOURCES);

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

const FORBIDDEN_PLATFORM_PAYLOAD_KEYS = new Set([
  "apiResponse",
  "api_response",
  "facebookPayload",
  "instagramPayload",
  "linkedinPayload",
  "platformPayload",
  "rawMetrics",
  "rawResponse",
  "tiktokPayload",
]);

const FORBIDDEN_NETWORK_KEYS = new Set([
  "analyticsSdk",
  "client",
  "endpoint",
  "externalApi",
  "fetch",
  "http",
  "sdk",
  "url",
]);

const FORBIDDEN_EXECUTION_KEYS = new Set([
  "cron",
  "execution",
  "executionPlan",
  "job",
  "publish",
  "queue",
  "retry",
  "scheduleWork",
  "timer",
  "worker",
]);

const FORBIDDEN_LEARNING_KEYS = new Set([
  "campaignMemory",
  "learning",
  "learningSignal",
  "modelFeedback",
]);

export function validatePublicationMetricObservation(
  observation: PublicationMetricObservation,
): PublicationMetricValidationResult {
  const errors: PublicationMetricValidationError[] = [];
  const record = asRecord(observation);

  if (!hasText(record.observationId)) {
    errors.push(error("observation_id_required", "observationId", "Metric observation id is required."));
  }
  validateEnum(record.observationType, OBSERVATION_TYPE_SET, "observationType", "observation_type_required", "observation_type_unknown", errors);
  validateEnum(record.metricName, METRIC_NAME_SET, "metricName", "metric_name_required", "metric_name_unknown", errors);
  validateEnum(record.metricStatus, STATUS_SET, "metricStatus", "metric_status_required", "metric_status_unknown", errors);
  validateEnum(record.aggregationType, AGGREGATION_TYPE_SET, "aggregationType", "aggregation_type_required", "aggregation_type_unknown", errors);
  validateEnum(record.source, SOURCE_SET, "source", "source_required", "source_unknown", errors);
  validateMetricValue(record.metricValue, record.metricStatus, errors);
  validateReferences(record.references, "references", errors);
  validateEvidence(record.evidence, "evidence", errors);
  validateTimestamp(record.observedAt, "observedAt", "observed_at_invalid", errors);
  validateTimestamp(record.createdAt, "createdAt", "created_at_required", errors);
  validateTimestamp(record.updatedAt, "updatedAt", "updated_at_required", errors);
  validateInvariants(record, errors);
  findForbiddenState(observation, "observation", errors);

  return errors.length === 0
    ? { ok: true, errors: [] }
    : { ok: false, errors: deepFreeze(errors) };
}

export function serializePublicationMetricObservation(
  observation: PublicationMetricObservation,
): PublicationMetricJsonObject {
  const validation = validatePublicationMetricObservation(observation);
  if (!validation.ok) {
    throw new Error(`Invalid publication metric observation: ${validation.errors[0]?.message ?? "unknown error"}`);
  }
  return deepFreeze(JSON.parse(JSON.stringify(observation)) as PublicationMetricJsonObject);
}

export function hydratePublicationMetricObservation(
  value: PublicationMetricJsonObject,
): PublicationMetricObservation {
  const observation = value as unknown as PublicationMetricObservation;
  const validation = validatePublicationMetricObservation(observation);
  if (!validation.ok) {
    throw new Error(`Invalid publication metric observation: ${validation.errors[0]?.message ?? "unknown error"}`);
  }
  return deepFreeze(observation);
}

export function sortPublicationMetricObservations(
  observations: readonly PublicationMetricObservation[],
): readonly PublicationMetricObservation[] {
  return deepFreeze(
    [...observations].sort((left, right) => {
      const observed = Date.parse(left.observedAt) - Date.parse(right.observedAt);
      if (observed !== 0) return observed;
      return left.observationId.localeCompare(right.observationId);
    }),
  );
}

function validateReferences(
  references: unknown,
  path: string,
  errors: PublicationMetricValidationError[],
): void {
  const record = asRecord(references);
  if (!hasText(record.socialPostId)) {
    errors.push(error("social_post_id_required", `${path}.socialPostId`, "Social post reference is required."));
  }
  if (!hasText(record.publicationTargetId)) {
    errors.push(error("publication_target_id_required", `${path}.publicationTargetId`, "Publication target reference is required."));
  }
  validateOptionalReference(record.publisherRequestId, `${path}.publisherRequestId`, "publisher_reference_invalid", errors);
  validateOptionalReference(record.publisherResultId, `${path}.publisherResultId`, "publisher_reference_invalid", errors);
  validateOptionalReference(record.publisherJobId, `${path}.publisherJobId`, "publisher_reference_invalid", errors);
  validateOptionalReference(record.scheduleId, `${path}.scheduleId`, "schedule_reference_invalid", errors);
  validateOptionalReference(record.ledgerEntryId, `${path}.ledgerEntryId`, "ledger_reference_invalid", errors);
  validateOptionalReference(record.publicationManifestId, `${path}.publicationManifestId`, "manifest_reference_invalid", errors);
  validateOptionalReference(record.ownerApprovalId, `${path}.ownerApprovalId`, "approval_reference_invalid", errors);
  validateOptionalReference(record.approvalId, `${path}.approvalId`, "approval_reference_invalid", errors);
  validateOptionalReference(record.proposalId, `${path}.proposalId`, "approval_reference_invalid", errors);
}

function validateEvidence(
  evidence: unknown,
  path: string,
  errors: PublicationMetricValidationError[],
): void {
  if (evidence === null) return;
  const record = asRecord(evidence);
  if (!hasText(record.evidenceId)) {
    errors.push(error("evidence_invalid", `${path}.evidenceId`, "Evidence id is required when evidence is present."));
  }
  if (
    record.containsPlatformPayload !== false ||
    record.containsSecrets !== false ||
    record.containsCredentials !== false ||
    record.containsSdkClient !== false ||
    record.containsRawApiResponse !== false ||
    record.provesCollection !== false
  ) {
    errors.push(error("evidence_invalid", path, "Metric evidence must be sanitized and must not prove collection."));
  }
}

function validateInvariants(
  record: UnknownRecord,
  errors: PublicationMetricValidationError[],
): void {
  if (
    record.passiveOnly !== true ||
    record.observationOnly !== true ||
    record.computedOnly !== false ||
    record.authoritative !== false ||
    record.referencesOnly !== true ||
    record.containsPlatformPayload !== false ||
    record.collectsNoMetrics !== true ||
    record.callsNoExternalApis !== true ||
    record.usesNoSdks !== true ||
    record.usesNoNetwork !== true ||
    record.executesNothing !== true ||
    record.publishesNothing !== true ||
    record.schedulesNothing !== true ||
    record.mutatesNoScheduler !== true ||
    record.mutatesNoPublisher !== true ||
    record.mutatesNoLedger !== true ||
    record.mutatesNoApproval !== true ||
    record.mutatesNoManifest !== true ||
    record.mutatesNoTargets !== true ||
    record.persistsNothing !== true ||
    record.exposesNoBridge !== true ||
    record.exposesNoAdminUi !== true ||
    record.exposesNoApiRoutes !== true ||
    record.performsNoLearning !== true
  ) {
    errors.push(error("invariant_failed", "contract", "Metrics observations must remain passive and observational."));
  }
}

function validateMetricValue(
  value: unknown,
  status: unknown,
  errors: PublicationMetricValidationError[],
): void {
  if (status === "completed") {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      errors.push(error("value_invalid", "metricValue", "Completed metric observations require a non-negative numeric value."));
    }
    return;
  }
  if (value !== null) {
    errors.push(error("value_invalid", "metricValue", "Pending or failed metric observations must not carry a metric value."));
  }
}

function validateOptionalReference(
  value: unknown,
  path: string,
  code: PublicationMetricErrorCode,
  errors: PublicationMetricValidationError[],
): void {
  if (value !== null && !hasText(value)) {
    errors.push(error(code, path, "Optional references must be text or null."));
  }
}

function validateEnum(
  value: unknown,
  allowed: ReadonlySet<string>,
  path: string,
  requiredCode: PublicationMetricErrorCode,
  code: PublicationMetricErrorCode,
  errors: PublicationMetricValidationError[],
): void {
  if (!hasText(value)) {
    errors.push(error(requiredCode, path, "Metric enum value is required."));
    return;
  }
  if (!allowed.has(value)) {
    errors.push(error(code, path, "Metric enum value is not supported."));
  }
}

function validateTimestamp(
  value: unknown,
  path: string,
  code: PublicationMetricErrorCode,
  errors: PublicationMetricValidationError[],
): void {
  if (!hasText(value) || !Number.isFinite(Date.parse(value))) {
    errors.push(error(code, path, "Metric timestamp must be valid."));
  }
}

function findForbiddenState(
  value: unknown,
  path: string,
  errors: PublicationMetricValidationError[],
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findForbiddenState(entry, `${path}.${index}`, errors));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;
    if (FORBIDDEN_SECRET_KEYS.has(key)) {
      errors.push(error("secret_forbidden", nestedPath, "Metric state must not contain secrets."));
    }
    if (FORBIDDEN_PLATFORM_PAYLOAD_KEYS.has(key)) {
      errors.push(error("platform_payload_forbidden", nestedPath, "Metric state must not contain platform payloads."));
    }
    if (FORBIDDEN_NETWORK_KEYS.has(key)) {
      errors.push(error("network_forbidden", nestedPath, "Metric state must not contain API clients, SDKs, URLs, or network instructions."));
    }
    if (FORBIDDEN_EXECUTION_KEYS.has(key)) {
      errors.push(error("execution_forbidden", nestedPath, "Metric state must not contain execution, publishing, scheduling, or worker instructions."));
    }
    if (FORBIDDEN_LEARNING_KEYS.has(key)) {
      errors.push(error("learning_state_forbidden", nestedPath, "Metric state must not contain learning state."));
    }
    findForbiddenState(nested, nestedPath, errors);
  }
}

function error(
  code: PublicationMetricErrorCode,
  path: string,
  message: string,
): PublicationMetricValidationError {
  return { code, path, message };
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return value;
}
