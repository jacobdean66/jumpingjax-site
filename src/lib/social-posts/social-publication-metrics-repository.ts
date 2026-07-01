import {
  PUBLICATION_METRIC_AGGREGATION_TYPES,
  PUBLICATION_METRIC_NAMES,
  PUBLICATION_METRIC_OBSERVATION_TYPES,
  PUBLICATION_METRIC_SOURCES,
  PUBLICATION_METRIC_STATUSES,
  hydratePublicationMetricObservation,
  serializePublicationMetricObservation,
  validatePublicationMetricObservation,
  type PublicationMetricAggregationType,
  type PublicationMetricName,
  type PublicationMetricObservation,
  type PublicationMetricObservationType,
  type PublicationMetricSource,
  type PublicationMetricStatus,
  type PublicationMetricValidationError,
} from "./social-publication-metrics";

export type { PublicationMetricObservation } from "./social-publication-metrics";

type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

type UnknownRecord = Readonly<Record<string, unknown>>;

export type SocialPublicationMetricObservationId = Brand<
  string,
  "SocialPublicationMetricObservationId"
>;
export type SocialPublicationMetricEvidenceId = Brand<
  string,
  "SocialPublicationMetricEvidenceId"
>;
export type SocialPublicationMetricSocialPostId = Brand<
  string,
  "SocialPublicationMetricSocialPostId"
>;
export type SocialPublicationMetricTargetId = Brand<
  string,
  "SocialPublicationMetricTargetId"
>;
export type SocialPublicationMetricPublisherRequestId = Brand<
  string,
  "SocialPublicationMetricPublisherRequestId"
>;
export type SocialPublicationMetricPublisherResultId = Brand<
  string,
  "SocialPublicationMetricPublisherResultId"
>;
export type SocialPublicationMetricPublisherJobId = Brand<
  string,
  "SocialPublicationMetricPublisherJobId"
>;
export type SocialPublicationMetricScheduleId = Brand<
  string,
  "SocialPublicationMetricScheduleId"
>;
export type SocialPublicationMetricLedgerEntryId = Brand<
  string,
  "SocialPublicationMetricLedgerEntryId"
>;
export type SocialPublicationMetricManifestId = Brand<
  string,
  "SocialPublicationMetricManifestId"
>;
export type SocialPublicationMetricOwnerApprovalId = Brand<
  string,
  "SocialPublicationMetricOwnerApprovalId"
>;
export type SocialPublicationMetricApprovalId = Brand<
  string,
  "SocialPublicationMetricApprovalId"
>;
export type SocialPublicationMetricProposalId = Brand<
  string,
  "SocialPublicationMetricProposalId"
>;

export const SOCIAL_PUBLICATION_METRIC_REPOSITORY_ERROR_CODES = [
  "validation_failed",
  "identity_required",
  "identity_collision",
  "relationship_invalid",
  "serialization_invalid",
  "contract_only",
] as const;

export const SOCIAL_PUBLICATION_METRIC_RECORD_ERROR_CODES = [
  "required_field_missing",
  "identity_not_separated",
  "relationship_invalid",
  "metric_type_invalid",
  "metric_name_invalid",
  "metric_status_invalid",
  "aggregation_type_invalid",
  "source_invalid",
  "timestamp_invalid",
  "value_invalid",
  "contract_invariant_failed",
  "secret_forbidden",
  "platform_payload_forbidden",
  "network_forbidden",
  "execution_forbidden",
  "scheduler_mutation_forbidden",
  "publisher_mutation_forbidden",
  "persistence_forbidden",
  "learning_state_forbidden",
] as const;

export type SocialPublicationMetricRepositoryErrorCode =
  (typeof SOCIAL_PUBLICATION_METRIC_REPOSITORY_ERROR_CODES)[number];
export type SocialPublicationMetricRecordErrorCode =
  (typeof SOCIAL_PUBLICATION_METRIC_RECORD_ERROR_CODES)[number];

export type SocialPublicationMetricRecordError = Readonly<{
  code: SocialPublicationMetricRecordErrorCode;
  path: string;
  message: string;
}>;

export type SocialPublicationMetricRepositoryError = Readonly<{
  code: SocialPublicationMetricRepositoryErrorCode;
  message: string;
  validationErrors?: readonly (
    | SocialPublicationMetricRecordError
    | PublicationMetricValidationError
  )[];
}>;

export type SocialPublicationMetricRepositoryResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: SocialPublicationMetricRepositoryError }>;

export type SocialPublicationMetricRecordValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly SocialPublicationMetricRecordError[] }
>;

export type SocialPublicationMetricScope = Readonly<{
  social_post_id: SocialPublicationMetricSocialPostId;
  publication_target_id: SocialPublicationMetricTargetId;
  publisher_request_id: SocialPublicationMetricPublisherRequestId | null;
  publisher_result_id: SocialPublicationMetricPublisherResultId | null;
  publisher_job_id: SocialPublicationMetricPublisherJobId | null;
  schedule_id: SocialPublicationMetricScheduleId | null;
  ledger_entry_id: SocialPublicationMetricLedgerEntryId | null;
  publication_manifest_id: SocialPublicationMetricManifestId | null;
  owner_approval_id: SocialPublicationMetricOwnerApprovalId | null;
  approval_id: SocialPublicationMetricApprovalId | null;
  proposal_id: SocialPublicationMetricProposalId | null;
}>;

export type SocialPublicationMetricObservationRecord = Readonly<{
  metric_observation_id: SocialPublicationMetricObservationId;
  observation_type: PublicationMetricObservationType;
  metric_name: PublicationMetricName;
  metric_status: PublicationMetricStatus;
  metric_value: number | null;
  aggregation_type: PublicationMetricAggregationType;
  observation_source: PublicationMetricSource;
  scope: SocialPublicationMetricScope;
  evidence_id: SocialPublicationMetricEvidenceId | null;
  observed_at: string;
  created_at: string;
  updated_at: string;
  passive_only: true;
  observation_only: true;
  references_only: true;
  contains_platform_payload: false;
  collects_no_metrics: true;
  calls_no_external_apis: true;
  uses_no_sdks: true;
  uses_no_network: true;
  executes_nothing: true;
  publishes_nothing: true;
  schedules_nothing: true;
  mutates_no_scheduler: true;
  mutates_no_publisher: true;
  mutates_no_ledger: true;
  mutates_no_approval: true;
  mutates_no_manifest: true;
  mutates_no_targets: true;
  persists_nothing: true;
  exposes_no_bridge: true;
  exposes_no_admin_ui: true;
  exposes_no_api_routes: true;
  performs_no_learning: true;
}>;

export type SocialPublicationMetricPersistenceModel = Readonly<{
  observations: readonly SocialPublicationMetricObservationRecord[];
}>;

export type SocialPublicationMetricRepositoryIdentity = Readonly<{
  metric_observation_id?: string;
  metric_name?: string;
  metric_status?: string;
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
  proposal_id?: string;
}>;

export type SocialPublicationMetricAppendObservationRequest = Readonly<{
  observation: SocialPublicationMetricObservationRecord;
}>;

export type SocialPublicationMetricRepositorySnapshot =
  SocialPublicationMetricPersistenceModel;

export type SocialPublicationMetricRepository = Readonly<{
  appendMetricObservation(
    request: SocialPublicationMetricAppendObservationRequest,
  ): SocialPublicationMetricRepositoryResult<SocialPublicationMetricObservationRecord>;
  getMetricRecordsByIdentity(
    identity: SocialPublicationMetricRepositoryIdentity,
  ): SocialPublicationMetricRepositoryResult<SocialPublicationMetricPersistenceModel>;
  listMetricObservations(
    identity?: SocialPublicationMetricRepositoryIdentity,
  ): SocialPublicationMetricRepositoryResult<
    readonly SocialPublicationMetricObservationRecord[]
  >;
  snapshot(): SocialPublicationMetricRepositoryResult<SocialPublicationMetricRepositorySnapshot>;
}>;

const OBSERVATION_TYPE_SET = new Set<string>(PUBLICATION_METRIC_OBSERVATION_TYPES);
const STATUS_SET = new Set<string>(PUBLICATION_METRIC_STATUSES);
const METRIC_NAME_SET = new Set<string>(PUBLICATION_METRIC_NAMES);
const AGGREGATION_TYPE_SET = new Set<string>(PUBLICATION_METRIC_AGGREGATION_TYPES);
const SOURCE_SET = new Set<string>(PUBLICATION_METRIC_SOURCES);

export function createReferenceSocialPublicationMetricRepository(
  model: SocialPublicationMetricPersistenceModel = { observations: [] },
): SocialPublicationMetricRepository {
  const validation = validateSocialPublicationMetricPersistenceModel(model);
  if (!validation.ok) {
    throw new Error(`Invalid metric persistence model: ${validation.errors[0]?.message ?? "unknown error"}`);
  }

  const observations = [...model.observations];

  return {
    appendMetricObservation(request) {
      const validationResult = validateSocialPublicationMetricObservationRecord(request.observation);
      if (!validationResult.ok) {
        return repositoryError("validation_failed", "Metric observation record failed validation.", validationResult.errors);
      }
      if (observations.some((record) => record.metric_observation_id === request.observation.metric_observation_id)) {
        return repositoryError("identity_collision", "Metric observation identity already exists.");
      }
      observations.push(deepFreeze({ ...request.observation, scope: { ...request.observation.scope } }));
      return { ok: true, value: request.observation };
    },
    getMetricRecordsByIdentity(identity) {
      return {
        ok: true,
        value: deepFreeze({
          observations: filterObservations(observations, identity),
        }),
      };
    },
    listMetricObservations(identity = {}) {
      return { ok: true, value: filterObservations(observations, identity) };
    },
    snapshot() {
      return { ok: true, value: deepFreeze({ observations: [...observations] }) };
    },
  };
}

export function metricObservationToRecord(
  observation: PublicationMetricObservation,
): SocialPublicationMetricRepositoryResult<SocialPublicationMetricObservationRecord> {
  const validation = validatePublicationMetricObservation(observation);
  if (!validation.ok) {
    return repositoryError("validation_failed", "Metric observation failed domain validation.", validation.errors);
  }

  const record: SocialPublicationMetricObservationRecord = {
    metric_observation_id: observation.observationId as SocialPublicationMetricObservationId,
    observation_type: observation.observationType,
    metric_name: observation.metricName,
    metric_status: observation.metricStatus,
    metric_value: observation.metricValue,
    aggregation_type: observation.aggregationType,
    observation_source: observation.source,
    scope: {
      social_post_id: observation.references.socialPostId as SocialPublicationMetricSocialPostId,
      publication_target_id: observation.references.publicationTargetId as SocialPublicationMetricTargetId,
      publisher_request_id: observation.references.publisherRequestId as SocialPublicationMetricPublisherRequestId | null,
      publisher_result_id: observation.references.publisherResultId as SocialPublicationMetricPublisherResultId | null,
      publisher_job_id: observation.references.publisherJobId as SocialPublicationMetricPublisherJobId | null,
      schedule_id: observation.references.scheduleId as SocialPublicationMetricScheduleId | null,
      ledger_entry_id: observation.references.ledgerEntryId as SocialPublicationMetricLedgerEntryId | null,
      publication_manifest_id: observation.references.publicationManifestId as SocialPublicationMetricManifestId | null,
      owner_approval_id: observation.references.ownerApprovalId as SocialPublicationMetricOwnerApprovalId | null,
      approval_id: observation.references.approvalId as SocialPublicationMetricApprovalId | null,
      proposal_id: observation.references.proposalId as SocialPublicationMetricProposalId | null,
    },
    evidence_id: observation.evidence?.evidenceId as SocialPublicationMetricEvidenceId | null,
    observed_at: observation.observedAt,
    created_at: observation.createdAt,
    updated_at: observation.updatedAt,
    passive_only: true,
    observation_only: true,
    references_only: true,
    contains_platform_payload: false,
    collects_no_metrics: true,
    calls_no_external_apis: true,
    uses_no_sdks: true,
    uses_no_network: true,
    executes_nothing: true,
    publishes_nothing: true,
    schedules_nothing: true,
    mutates_no_scheduler: true,
    mutates_no_publisher: true,
    mutates_no_ledger: true,
    mutates_no_approval: true,
    mutates_no_manifest: true,
    mutates_no_targets: true,
    persists_nothing: true,
    exposes_no_bridge: true,
    exposes_no_admin_ui: true,
    exposes_no_api_routes: true,
    performs_no_learning: true,
  };

  const recordValidation = validateSocialPublicationMetricObservationRecord(record);
  if (!recordValidation.ok) {
    return repositoryError("serialization_invalid", "Metric observation record failed validation.", recordValidation.errors);
  }
  return { ok: true, value: deepFreeze(record) };
}

export function metricRecordToObservation(
  record: SocialPublicationMetricObservationRecord,
): SocialPublicationMetricRepositoryResult<PublicationMetricObservation> {
  const validation = validateSocialPublicationMetricObservationRecord(record);
  if (!validation.ok) {
    return repositoryError("validation_failed", "Metric record failed validation.", validation.errors);
  }

  const observation = hydratePublicationMetricObservation(
    serializePublicationMetricObservation({
      observationId: record.metric_observation_id,
      observationType: record.observation_type,
      metricName: record.metric_name,
      metricStatus: record.metric_status,
      metricValue: record.metric_value,
      aggregationType: record.aggregation_type,
      source: record.observation_source,
      references: {
        socialPostId: record.scope.social_post_id,
        publicationTargetId: record.scope.publication_target_id,
        publisherRequestId: record.scope.publisher_request_id,
        publisherResultId: record.scope.publisher_result_id,
        publisherJobId: record.scope.publisher_job_id,
        scheduleId: record.scope.schedule_id,
        ledgerEntryId: record.scope.ledger_entry_id,
        publicationManifestId: record.scope.publication_manifest_id,
        ownerApprovalId: record.scope.owner_approval_id,
        approvalId: record.scope.approval_id,
        proposalId: record.scope.proposal_id,
      },
      evidence: record.evidence_id
        ? {
            evidenceId: record.evidence_id,
            evidenceKind: "report_reference",
            evidence: {},
            notes: null,
            externalReportReference: null,
            containsPlatformPayload: false,
            containsSecrets: false,
            containsCredentials: false,
            containsSdkClient: false,
            containsRawApiResponse: false,
            provesCollection: false,
          }
        : null,
      observedAt: record.observed_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      passiveOnly: true,
      observationOnly: true,
      computedOnly: false,
      authoritative: false,
      referencesOnly: true,
      containsPlatformPayload: false,
      collectsNoMetrics: true,
      callsNoExternalApis: true,
      usesNoSdks: true,
      usesNoNetwork: true,
      executesNothing: true,
      publishesNothing: true,
      schedulesNothing: true,
      mutatesNoScheduler: true,
      mutatesNoPublisher: true,
      mutatesNoLedger: true,
      mutatesNoApproval: true,
      mutatesNoManifest: true,
      mutatesNoTargets: true,
      persistsNothing: true,
      exposesNoBridge: true,
      exposesNoAdminUi: true,
      exposesNoApiRoutes: true,
      performsNoLearning: true,
    }),
  );
  return { ok: true, value: observation };
}

export function validateSocialPublicationMetricPersistenceModel(
  model: SocialPublicationMetricPersistenceModel,
): SocialPublicationMetricRecordValidationResult {
  const errors: SocialPublicationMetricRecordError[] = [];
  const seen = new Set<string>();
  model.observations.forEach((record, index) => {
    validateSocialPublicationMetricObservationRecord(record, `observations.${index}`, errors);
    validateUnique(record.metric_observation_id, `observations.${index}.metric_observation_id`, seen, errors);
  });
  return errors.length === 0
    ? { ok: true, errors: [] }
    : { ok: false, errors: deepFreeze(errors) };
}

export function validateSocialPublicationMetricObservationRecord(
  record: SocialPublicationMetricObservationRecord,
  path = "observation",
  errors: SocialPublicationMetricRecordError[] = [],
): SocialPublicationMetricRecordValidationResult {
  const value = asRecord(record);
  if (!hasText(value.metric_observation_id)) {
    errors.push(recordError("required_field_missing", `${path}.metric_observation_id`, "Metric observation id is required."));
  }
  validateEnum(value.observation_type, OBSERVATION_TYPE_SET, `${path}.observation_type`, "metric_type_invalid", errors);
  validateEnum(value.metric_name, METRIC_NAME_SET, `${path}.metric_name`, "metric_name_invalid", errors);
  validateEnum(value.metric_status, STATUS_SET, `${path}.metric_status`, "metric_status_invalid", errors);
  validateEnum(value.aggregation_type, AGGREGATION_TYPE_SET, `${path}.aggregation_type`, "aggregation_type_invalid", errors);
  validateEnum(value.observation_source, SOURCE_SET, `${path}.observation_source`, "source_invalid", errors);
  validateRecordValue(value.metric_value, value.metric_status, `${path}.metric_value`, errors);
  validateScope(value.scope, `${path}.scope`, errors);
  validateTimestamp(value.observed_at, `${path}.observed_at`, errors);
  validateTimestamp(value.created_at, `${path}.created_at`, errors);
  validateTimestamp(value.updated_at, `${path}.updated_at`, errors);
  validateRecordInvariants(value, path, errors);
  findForbiddenRecordState(value, path, errors);

  return errors.length === 0
    ? { ok: true, errors: [] }
    : { ok: false, errors: deepFreeze(errors) };
}

function filterObservations(
  observations: readonly SocialPublicationMetricObservationRecord[],
  identity: SocialPublicationMetricRepositoryIdentity,
): readonly SocialPublicationMetricObservationRecord[] {
  return deepFreeze(
    observations.filter((record) => {
      const scope = record.scope;
      return (
        matches(identity.metric_observation_id, record.metric_observation_id) &&
        matches(identity.metric_name, record.metric_name) &&
        matches(identity.metric_status, record.metric_status) &&
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
        matches(identity.proposal_id, scope.proposal_id)
      );
    }),
  );
}

function validateScope(
  scope: unknown,
  path: string,
  errors: SocialPublicationMetricRecordError[],
): void {
  const record = asRecord(scope);
  if (!hasText(record.social_post_id)) {
    errors.push(recordError("required_field_missing", `${path}.social_post_id`, "Social post reference is required."));
  }
  if (!hasText(record.publication_target_id)) {
    errors.push(recordError("required_field_missing", `${path}.publication_target_id`, "Publication target reference is required."));
  }
  [
    "publisher_request_id",
    "publisher_result_id",
    "publisher_job_id",
    "schedule_id",
    "ledger_entry_id",
    "publication_manifest_id",
    "owner_approval_id",
    "approval_id",
    "proposal_id",
  ].forEach((key) => {
    if (record[key] !== null && !hasText(record[key])) {
      errors.push(recordError("relationship_invalid", `${path}.${key}`, "Optional references must be text or null."));
    }
  });
}

function validateRecordInvariants(
  record: UnknownRecord,
  path: string,
  errors: SocialPublicationMetricRecordError[],
): void {
  if (
    record.passive_only !== true ||
    record.observation_only !== true ||
    record.references_only !== true ||
    record.contains_platform_payload !== false ||
    record.collects_no_metrics !== true ||
    record.calls_no_external_apis !== true ||
    record.uses_no_sdks !== true ||
    record.uses_no_network !== true ||
    record.executes_nothing !== true ||
    record.publishes_nothing !== true ||
    record.schedules_nothing !== true ||
    record.mutates_no_scheduler !== true ||
    record.mutates_no_publisher !== true ||
    record.mutates_no_ledger !== true ||
    record.mutates_no_approval !== true ||
    record.mutates_no_manifest !== true ||
    record.mutates_no_targets !== true ||
    record.persists_nothing !== true ||
    record.exposes_no_bridge !== true ||
    record.exposes_no_admin_ui !== true ||
    record.exposes_no_api_routes !== true ||
    record.performs_no_learning !== true
  ) {
    errors.push(recordError("contract_invariant_failed", `${path}.contract`, "Metric records must remain passive and observational."));
  }
}

function validateRecordValue(
  value: unknown,
  status: unknown,
  path: string,
  errors: SocialPublicationMetricRecordError[],
): void {
  if (status === "completed") {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      errors.push(recordError("value_invalid", path, "Completed metric records require a non-negative numeric value."));
    }
    return;
  }
  if (value !== null) {
    errors.push(recordError("value_invalid", path, "Pending and failed metric records must not carry a value."));
  }
}

function validateTimestamp(
  value: unknown,
  path: string,
  errors: SocialPublicationMetricRecordError[],
): void {
  if (!hasText(value) || !Number.isFinite(Date.parse(value))) {
    errors.push(recordError("timestamp_invalid", path, "Metric record timestamp must be valid."));
  }
}

function validateEnum(
  value: unknown,
  allowed: ReadonlySet<string>,
  path: string,
  code: SocialPublicationMetricRecordErrorCode,
  errors: SocialPublicationMetricRecordError[],
): void {
  if (!hasText(value) || !allowed.has(value)) {
    errors.push(recordError(code, path, "Metric record enum value is not supported."));
  }
}

function validateUnique(
  value: unknown,
  path: string,
  seen: Set<string>,
  errors: SocialPublicationMetricRecordError[],
): void {
  if (!hasText(value)) return;
  if (seen.has(value)) {
    errors.push(recordError("identity_not_separated", path, "Metric observation identities must be unique."));
    return;
  }
  seen.add(value);
}

function findForbiddenRecordState(
  value: unknown,
  path: string,
  errors: SocialPublicationMetricRecordError[],
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findForbiddenRecordState(entry, `${path}.${index}`, errors));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;
    if (["secret", "access_token", "api_key", "credentials", "oauth"].includes(key)) {
      errors.push(recordError("secret_forbidden", nestedPath, "Metric records must not contain secrets."));
    }
    if (["rawMetrics", "rawResponse", "platformPayload", "apiResponse"].includes(key)) {
      errors.push(recordError("platform_payload_forbidden", nestedPath, "Metric records must not contain platform payloads."));
    }
    if (["fetch", "http", "endpoint", "sdk", "client"].includes(key)) {
      errors.push(recordError("network_forbidden", nestedPath, "Metric records must not contain network or SDK state."));
    }
    if (["cron", "timer", "worker", "queue", "publish", "executionPlan"].includes(key)) {
      errors.push(recordError("execution_forbidden", nestedPath, "Metric records must not contain execution state."));
    }
    if (["learning", "learningSignal", "campaignMemory"].includes(key)) {
      errors.push(recordError("learning_state_forbidden", nestedPath, "Metric records must not contain learning state."));
    }
    findForbiddenRecordState(nested, nestedPath, errors);
  }
}

function repositoryError<T>(
  code: SocialPublicationMetricRepositoryErrorCode,
  message: string,
  validationErrors?: readonly (
    | SocialPublicationMetricRecordError
    | PublicationMetricValidationError
  )[],
): SocialPublicationMetricRepositoryResult<T> {
  return {
    ok: false,
    error: validationErrors ? { code, message, validationErrors } : { code, message },
  };
}

function recordError(
  code: SocialPublicationMetricRecordErrorCode,
  path: string,
  message: string,
): SocialPublicationMetricRecordError {
  return { code, path, message };
}

function matches(expected: string | undefined, actual: string | null): boolean {
  return expected === undefined || expected === actual;
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
