import {
  PUBLICATION_METRIC_AGGREGATION_TYPES,
  PUBLICATION_METRIC_NAMES,
  PUBLICATION_METRIC_OBSERVATION_TYPES,
  PUBLICATION_METRIC_SOURCES,
  PUBLICATION_METRIC_STATUSES,
  validatePublicationMetricObservation,
  type PublicationMetricEvidence,
  type PublicationMetricJsonObject,
  type PublicationMetricObservation,
} from "./social-publication-metrics";
import {
  metricObservationToRecord,
  metricRecordToObservation,
  validateSocialPublicationMetricObservationRecord,
  validateSocialPublicationMetricPersistenceModel,
  type SocialPublicationMetricEvidenceId,
  type SocialPublicationMetricObservationRecord,
  type SocialPublicationMetricPersistenceModel,
  type SocialPublicationMetricScope,
} from "./social-publication-metrics-repository";

type UnknownRecord = Readonly<Record<string, unknown>>;

export const PUBLICATION_METRIC_ROW_ACTORS = [
  "system",
  "owner",
  "admin",
  "analytics",
  "test",
] as const;

export const PUBLICATION_METRIC_ROW_SOURCES = [
  "publication_metrics_domain",
  "manual_admin",
  "test",
] as const;

export const PUBLICATION_METRIC_EVIDENCE_KINDS = [
  "manual_note",
  "report_reference",
  "computed_summary",
  "none",
] as const;

export type SocialPublicationMetricRowActor =
  (typeof PUBLICATION_METRIC_ROW_ACTORS)[number];
export type SocialPublicationMetricRowSource =
  (typeof PUBLICATION_METRIC_ROW_SOURCES)[number];
export type SocialPublicationMetricEvidenceKind =
  (typeof PUBLICATION_METRIC_EVIDENCE_KINDS)[number];

export type SocialPublicationMetricEvidenceRecord = Readonly<{
  evidence_id: SocialPublicationMetricEvidenceId;
  metric_observation_id: SocialPublicationMetricObservationRecord["metric_observation_id"];
  evidence_kind: SocialPublicationMetricEvidenceKind;
  notes: string | null;
  evidence: PublicationMetricJsonObject;
  external_report_reference: string | null;
  scope: SocialPublicationMetricScope;
  recorded_at: string;
  recorded_by_actor: SocialPublicationMetricRowActor;
  recorded_source: SocialPublicationMetricRowSource;
  contains_platform_payload: false;
  contains_secrets: false;
  contains_credentials: false;
  contains_sdk_client: false;
  contains_raw_api_response: false;
  proves_collection: false;
  append_only: true;
  immutable: true;
}>;

export type SocialPublicationMetricObservationRow = Readonly<{
  metric_observation_id: string;
  observation_type: string;
  metric_name: string;
  metric_status: string;
  metric_value: number | null;
  aggregation_type: string;
  observation_source: string;
  social_post_id: string;
  publication_target_id: string;
  publisher_request_id: string | null;
  publisher_result_id: string | null;
  publisher_job_id: string | null;
  schedule_id: string | null;
  ledger_entry_id: string | null;
  publication_manifest_id: string | null;
  owner_approval_id: string | null;
  approval_id: string | null;
  proposal_id: string | null;
  evidence_id: string | null;
  observed_at: string;
  created_at: string;
  updated_at: string;
  recorded_by_actor: string;
  recorded_source: string;
  passive_only: boolean;
  observation_only: boolean;
  references_only: boolean;
  contains_platform_payload: boolean;
  collects_no_metrics: boolean;
  calls_no_external_apis: boolean;
  uses_no_sdks: boolean;
  uses_no_network: boolean;
  executes_nothing: boolean;
  publishes_nothing: boolean;
  schedules_nothing: boolean;
  mutates_no_scheduler: boolean;
  mutates_no_publisher: boolean;
  mutates_no_ledger: boolean;
  mutates_no_approval: boolean;
  mutates_no_manifest: boolean;
  mutates_no_targets: boolean;
  exposes_no_api_routes: boolean;
  performs_no_learning: boolean;
  append_only: boolean;
  immutable: boolean;
  idempotency_key: string | null;
}>;

export type SocialPublicationMetricEvidenceRow = Readonly<{
  evidence_id: string;
  metric_observation_id: string;
  evidence_kind: string;
  notes: string | null;
  evidence: PublicationMetricJsonObject;
  external_report_reference: string | null;
  social_post_id: string;
  publication_target_id: string;
  publisher_request_id: string | null;
  publisher_result_id: string | null;
  publisher_job_id: string | null;
  schedule_id: string | null;
  ledger_entry_id: string | null;
  publication_manifest_id: string | null;
  owner_approval_id: string | null;
  approval_id: string | null;
  proposal_id: string | null;
  recorded_at: string;
  recorded_by_actor: string;
  recorded_source: string;
  contains_platform_payload: boolean;
  contains_secrets: boolean;
  contains_credentials: boolean;
  contains_sdk_client: boolean;
  contains_raw_api_response: boolean;
  proves_collection: boolean;
  append_only: boolean;
  immutable: boolean;
  idempotency_key: string | null;
}>;

export type SocialPublicationMetricRowsModel = Readonly<{
  observations: readonly SocialPublicationMetricObservationRow[];
  evidence: readonly SocialPublicationMetricEvidenceRow[];
}>;

export type SocialPublicationMetricRowsPersistenceModel = Readonly<{
  observations: readonly SocialPublicationMetricObservationRecord[];
  evidence: readonly SocialPublicationMetricEvidenceRecord[];
}>;

export const SOCIAL_PUBLICATION_METRIC_ROW_ERROR_CODES = [
  "required_field_missing",
  "field_shape_invalid",
  "identity_invalid",
  "identity_not_separated",
  "metric_type_invalid",
  "metric_name_invalid",
  "metric_status_invalid",
  "aggregation_type_invalid",
  "source_invalid",
  "evidence_kind_invalid",
  "audit_field_invalid",
  "idempotency_key_invalid",
  "relationship_invalid",
  "value_invalid",
  "serialization_invalid",
  "secret_forbidden",
  "platform_payload_forbidden",
  "external_api_forbidden",
  "sdk_forbidden",
  "network_forbidden",
  "execution_forbidden",
  "lower_layer_mutation_forbidden",
  "learning_state_forbidden",
] as const;

export type SocialPublicationMetricRowErrorCode =
  (typeof SOCIAL_PUBLICATION_METRIC_ROW_ERROR_CODES)[number];

export type SocialPublicationMetricRowError = Readonly<{
  code: SocialPublicationMetricRowErrorCode;
  path: string;
  message: string;
}>;

export type SocialPublicationMetricRowValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly SocialPublicationMetricRowError[] }
>;

export type SocialPublicationMetricRowResult<T> = Readonly<
  | { ok: true; value: T }
  | { ok: false; errors: readonly SocialPublicationMetricRowError[] }
>;

export type SocialPublicationMetricRowOptions = Readonly<{
  recorded_by_actor?: SocialPublicationMetricRowActor;
  recorded_source?: SocialPublicationMetricRowSource;
  idempotency_key?: string | null;
}>;

export type SocialPublicationMetricMappedObservationRows = Readonly<{
  observation: SocialPublicationMetricObservationRow;
  evidence: SocialPublicationMetricEvidenceRow | null;
}>;

const OBSERVATION_TYPE_SET = new Set<string>(PUBLICATION_METRIC_OBSERVATION_TYPES);
const STATUS_SET = new Set<string>(PUBLICATION_METRIC_STATUSES);
const METRIC_NAME_SET = new Set<string>(PUBLICATION_METRIC_NAMES);
const AGGREGATION_TYPE_SET = new Set<string>(PUBLICATION_METRIC_AGGREGATION_TYPES);
const SOURCE_SET = new Set<string>(PUBLICATION_METRIC_SOURCES);
const ACTOR_SET = new Set<string>(PUBLICATION_METRIC_ROW_ACTORS);
const ROW_SOURCE_SET = new Set<string>(PUBLICATION_METRIC_ROW_SOURCES);
const EVIDENCE_KIND_SET = new Set<string>(PUBLICATION_METRIC_EVIDENCE_KINDS);

const DEFAULT_ROW_ACTOR: SocialPublicationMetricRowActor = "analytics";
const DEFAULT_ROW_SOURCE: SocialPublicationMetricRowSource =
  "publication_metrics_domain";

const FORBIDDEN_KEYS: Readonly<Record<string, SocialPublicationMetricRowErrorCode>> = {
  accessToken: "secret_forbidden",
  access_token: "secret_forbidden",
  apiKey: "secret_forbidden",
  api_key: "secret_forbidden",
  credential: "secret_forbidden",
  credentials: "secret_forbidden",
  oauth: "secret_forbidden",
  password: "secret_forbidden",
  refreshToken: "secret_forbidden",
  refresh_token: "secret_forbidden",
  secret: "secret_forbidden",
  token: "secret_forbidden",
  apiResponse: "platform_payload_forbidden",
  api_response: "platform_payload_forbidden",
  facebookPayload: "platform_payload_forbidden",
  instagramPayload: "platform_payload_forbidden",
  platformPayload: "platform_payload_forbidden",
  rawMetrics: "platform_payload_forbidden",
  rawResponse: "platform_payload_forbidden",
  analyticsSdk: "sdk_forbidden",
  client: "sdk_forbidden",
  sdk: "sdk_forbidden",
  sdkClient: "sdk_forbidden",
  endpoint: "network_forbidden",
  externalApi: "external_api_forbidden",
  fetch: "network_forbidden",
  http: "network_forbidden",
  url: "network_forbidden",
  cron: "execution_forbidden",
  executionPlan: "execution_forbidden",
  publish: "execution_forbidden",
  queue: "execution_forbidden",
  scheduleWork: "execution_forbidden",
  timer: "execution_forbidden",
  worker: "execution_forbidden",
  mutateApproval: "lower_layer_mutation_forbidden",
  mutateLedger: "lower_layer_mutation_forbidden",
  mutateManifest: "lower_layer_mutation_forbidden",
  mutatePublisher: "lower_layer_mutation_forbidden",
  mutateScheduler: "lower_layer_mutation_forbidden",
  mutateTarget: "lower_layer_mutation_forbidden",
  campaignMemory: "learning_state_forbidden",
  learning: "learning_state_forbidden",
  learningSignal: "learning_state_forbidden",
};

export function validateSocialPublicationMetricObservationRow(
  row: unknown,
): SocialPublicationMetricRowValidationResult {
  const errors: SocialPublicationMetricRowError[] = [];
  if (!isRecord(row)) {
    return validationResult([
      rowError("field_shape_invalid", "observation", "Metric observation row must be an object."),
    ]);
  }

  validateObservationRowShape(row, "observation", errors);
  return validationResult(errors);
}

export function validateSocialPublicationMetricEvidenceRow(
  row: unknown,
): SocialPublicationMetricRowValidationResult {
  const errors: SocialPublicationMetricRowError[] = [];
  if (!isRecord(row)) {
    return validationResult([
      rowError("field_shape_invalid", "evidence", "Metric evidence row must be an object."),
    ]);
  }

  validateEvidenceRowShape(row, "evidence", errors);
  return validationResult(errors);
}

export function validateSocialPublicationMetricRowsModel(
  model: unknown,
): SocialPublicationMetricRowValidationResult {
  const errors: SocialPublicationMetricRowError[] = [];
  if (!isRecord(model)) {
    return validationResult([
      rowError("field_shape_invalid", "model", "Metric rows model must be an object."),
    ]);
  }

  const observations = getArray(model, "observations");
  const evidence = getArray(model, "evidence");
  const observationIds = new Set<string>();

  if (!observations) {
    errors.push(rowError("required_field_missing", "model.observations", "Metric rows model must include observations."));
  }
  if (!evidence) {
    errors.push(rowError("required_field_missing", "model.evidence", "Metric rows model must include evidence."));
  }

  observations?.forEach((row, index) => {
    const validation = validateSocialPublicationMetricObservationRow(row);
    if (!validation.ok) errors.push(...withPathPrefix(validation.errors, `observations.${index}`));
    const id = getText(row as UnknownRecord, "metric_observation_id");
    if (id) {
      if (observationIds.has(id)) {
        errors.push(rowError("identity_not_separated", `observations.${index}.metric_observation_id`, "Metric observation identities must be unique."));
      }
      observationIds.add(id);
    }
  });

  evidence?.forEach((row, index) => {
    const validation = validateSocialPublicationMetricEvidenceRow(row);
    if (!validation.ok) errors.push(...withPathPrefix(validation.errors, `evidence.${index}`));
    const observationId = getText(row as UnknownRecord, "metric_observation_id");
    if (observationId && !observationIds.has(observationId)) {
      errors.push(rowError("relationship_invalid", `evidence.${index}.metric_observation_id`, "Metric evidence must reference an observation present in the model."));
    }
  });

  return validationResult(errors);
}

export function mapSocialPublicationMetricObservationRecordToRow(
  record: SocialPublicationMetricObservationRecord,
  options: SocialPublicationMetricRowOptions = {},
): SocialPublicationMetricRowResult<SocialPublicationMetricObservationRow> {
  const validation = validateSocialPublicationMetricObservationRecord(record);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors.map((error) => rowError("field_shape_invalid", error.path, error.message)) };
  }
  const row = observationRowFromRecord(record, options);
  const rowValidation = validateSocialPublicationMetricObservationRow(row);
  if (!rowValidation.ok) return { ok: false, errors: rowValidation.errors };
  return { ok: true, value: immutableClone(row) };
}

export function mapSocialPublicationMetricObservationRowToRecord(
  row: SocialPublicationMetricObservationRow,
): SocialPublicationMetricRowResult<SocialPublicationMetricObservationRecord> {
  const validation = validateSocialPublicationMetricObservationRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };
  return { ok: true, value: immutableClone(observationRecordFromRow(row)) };
}

export function mapSocialPublicationMetricEvidenceRecordToRow(
  record: SocialPublicationMetricEvidenceRecord,
  options: SocialPublicationMetricRowOptions = {},
): SocialPublicationMetricRowResult<SocialPublicationMetricEvidenceRow> {
  const row = evidenceRowFromRecord(record, options);
  const validation = validateSocialPublicationMetricEvidenceRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };
  return { ok: true, value: immutableClone(row) };
}

export function mapSocialPublicationMetricEvidenceRowToRecord(
  row: SocialPublicationMetricEvidenceRow,
): SocialPublicationMetricRowResult<SocialPublicationMetricEvidenceRecord> {
  const validation = validateSocialPublicationMetricEvidenceRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };
  return { ok: true, value: immutableClone(evidenceRecordFromRow(row)) };
}

export function mapPublicationMetricObservationToRows(
  observation: PublicationMetricObservation,
  options: SocialPublicationMetricRowOptions = {},
): SocialPublicationMetricRowResult<SocialPublicationMetricMappedObservationRows> {
  const domainValidation = validatePublicationMetricObservation(observation);
  if (!domainValidation.ok) {
    return {
      ok: false,
      errors: domainValidation.errors.map((error) =>
        rowError("field_shape_invalid", error.path, error.message),
      ),
    };
  }

  const recordResult = metricObservationToRecord(observation);
  if (!recordResult.ok) {
    return {
      ok: false,
      errors: recordResult.error.validationErrors?.map((error) =>
        rowError("field_shape_invalid", error.path, error.message),
      ) ?? [rowError("field_shape_invalid", "observation", recordResult.error.message)],
    };
  }

  const observationRow = mapSocialPublicationMetricObservationRecordToRow(
    recordResult.value,
    options,
  );
  if (!observationRow.ok) return observationRow;

  const evidence = observation.evidence
    ? mapSocialPublicationMetricEvidenceRecordToRow(
        evidenceRecordFromDomain(observation.evidence, recordResult.value, options),
        options,
      )
    : { ok: true as const, value: null };
  if (!evidence.ok) return evidence;

  return {
    ok: true,
    value: immutableClone({
      observation: observationRow.value,
      evidence: evidence.value,
    }),
  };
}

export function mapSocialPublicationMetricRowsToPersistenceModel(
  rows: SocialPublicationMetricRowsModel,
): SocialPublicationMetricRowResult<SocialPublicationMetricRowsPersistenceModel> {
  const validation = validateSocialPublicationMetricRowsModel(rows);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return {
    ok: true,
    value: immutableClone({
      observations: sortObservationRows(rows.observations).map(observationRecordFromRow),
      evidence: sortEvidenceRows(rows.evidence).map(evidenceRecordFromRow),
    }),
  };
}

export function mapSocialPublicationMetricRowsToRepositoryModel(
  rows: SocialPublicationMetricRowsModel,
): SocialPublicationMetricRowResult<SocialPublicationMetricPersistenceModel> {
  const mapped = mapSocialPublicationMetricRowsToPersistenceModel(rows);
  if (!mapped.ok) return mapped;
  const model = { observations: mapped.value.observations };
  const validation = validateSocialPublicationMetricPersistenceModel(model);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors.map((error) =>
        rowError("field_shape_invalid", error.path, error.message),
      ),
    };
  }
  return { ok: true, value: immutableClone(model) };
}

export function mapSocialPublicationMetricRowToDomain(
  row: SocialPublicationMetricObservationRow,
  evidenceRow: SocialPublicationMetricEvidenceRow | null = null,
): SocialPublicationMetricRowResult<PublicationMetricObservation> {
  const record = mapSocialPublicationMetricObservationRowToRecord(row);
  if (!record.ok) return record;
  const observation = metricRecordToObservation(record.value);
  if (!observation.ok) {
    return {
      ok: false,
      errors: observation.error.validationErrors?.map((error) =>
        rowError("field_shape_invalid", error.path, error.message),
      ) ?? [rowError("field_shape_invalid", "observation", observation.error.message)],
    };
  }

  const value: PublicationMetricObservation = {
    ...observation.value,
    evidence: evidenceRow ? evidenceFromRow(evidenceRow) : null,
  };
  const validation = validatePublicationMetricObservation(value);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors.map((error) =>
        rowError("field_shape_invalid", error.path, error.message),
      ),
    };
  }
  return { ok: true, value: immutableClone(value) };
}

function validateObservationRowShape(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationMetricRowError[],
): void {
  validateRequiredText(row.metric_observation_id, `${path}.metric_observation_id`, errors);
  validateEnum(row.observation_type, OBSERVATION_TYPE_SET, `${path}.observation_type`, "metric_type_invalid", errors);
  validateEnum(row.metric_name, METRIC_NAME_SET, `${path}.metric_name`, "metric_name_invalid", errors);
  validateEnum(row.metric_status, STATUS_SET, `${path}.metric_status`, "metric_status_invalid", errors);
  validateValue(row.metric_value, row.metric_status, `${path}.metric_value`, errors);
  validateEnum(row.aggregation_type, AGGREGATION_TYPE_SET, `${path}.aggregation_type`, "aggregation_type_invalid", errors);
  validateEnum(row.observation_source, SOURCE_SET, `${path}.observation_source`, "source_invalid", errors);
  validateScopeColumns(row, path, errors);
  validateOptionalText(row.evidence_id, `${path}.evidence_id`, errors);
  validateTimestamp(row.observed_at, `${path}.observed_at`, errors);
  validateTimestamp(row.created_at, `${path}.created_at`, errors);
  validateTimestamp(row.updated_at, `${path}.updated_at`, errors);
  validateAuditFields(row, path, errors);
  validateIdempotencyKey(row.idempotency_key, `${path}.idempotency_key`, errors);
  validateObservationInvariants(row, path, errors);
  rejectForbiddenState(row, path, errors);
}

function validateEvidenceRowShape(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationMetricRowError[],
): void {
  validateRequiredText(row.evidence_id, `${path}.evidence_id`, errors);
  validateRequiredText(row.metric_observation_id, `${path}.metric_observation_id`, errors);
  validateEnum(row.evidence_kind, EVIDENCE_KIND_SET, `${path}.evidence_kind`, "evidence_kind_invalid", errors);
  validateScopeColumns(row, path, errors);
  validateTimestamp(row.recorded_at, `${path}.recorded_at`, errors);
  validateAuditFields(row, path, errors);
  validateIdempotencyKey(row.idempotency_key, `${path}.idempotency_key`, errors);
  if (!isRecord(row.evidence)) {
    errors.push(rowError("field_shape_invalid", `${path}.evidence`, "Metric evidence payload must be an object."));
  }
  if (
    row.contains_platform_payload !== false ||
    row.contains_secrets !== false ||
    row.contains_credentials !== false ||
    row.contains_sdk_client !== false ||
    row.contains_raw_api_response !== false ||
    row.proves_collection !== false ||
    row.append_only !== true ||
    row.immutable !== true
  ) {
    errors.push(rowError("field_shape_invalid", `${path}.contract`, "Metric evidence rows must remain sanitized and append-only."));
  }
  rejectForbiddenState(row, path, errors);
}

function observationRowFromRecord(
  record: SocialPublicationMetricObservationRecord,
  options: SocialPublicationMetricRowOptions,
): SocialPublicationMetricObservationRow {
  return {
    metric_observation_id: record.metric_observation_id,
    observation_type: record.observation_type,
    metric_name: record.metric_name,
    metric_status: record.metric_status,
    metric_value: record.metric_value,
    aggregation_type: record.aggregation_type,
    observation_source: record.observation_source,
    ...scopeColumns(record.scope),
    evidence_id: record.evidence_id,
    observed_at: record.observed_at,
    created_at: record.created_at,
    updated_at: record.updated_at,
    recorded_by_actor: options.recorded_by_actor ?? DEFAULT_ROW_ACTOR,
    recorded_source: options.recorded_source ?? DEFAULT_ROW_SOURCE,
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
    exposes_no_api_routes: true,
    performs_no_learning: true,
    append_only: true,
    immutable: true,
    idempotency_key: options.idempotency_key ?? null,
  };
}

function observationRecordFromRow(
  row: SocialPublicationMetricObservationRow,
): SocialPublicationMetricObservationRecord {
  return {
    metric_observation_id: row.metric_observation_id as SocialPublicationMetricObservationRecord["metric_observation_id"],
    observation_type: row.observation_type as SocialPublicationMetricObservationRecord["observation_type"],
    metric_name: row.metric_name as SocialPublicationMetricObservationRecord["metric_name"],
    metric_status: row.metric_status as SocialPublicationMetricObservationRecord["metric_status"],
    metric_value: row.metric_value,
    aggregation_type: row.aggregation_type as SocialPublicationMetricObservationRecord["aggregation_type"],
    observation_source: row.observation_source as SocialPublicationMetricObservationRecord["observation_source"],
    scope: scopeFromColumns(row),
    evidence_id: row.evidence_id as SocialPublicationMetricObservationRecord["evidence_id"],
    observed_at: row.observed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
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
}

function evidenceRecordFromDomain(
  evidence: PublicationMetricEvidence,
  observation: SocialPublicationMetricObservationRecord,
  options: SocialPublicationMetricRowOptions,
): SocialPublicationMetricEvidenceRecord {
  return {
    evidence_id: evidence.evidenceId as SocialPublicationMetricEvidenceId,
    metric_observation_id: observation.metric_observation_id,
    evidence_kind: evidence.evidenceKind,
    notes: evidence.notes,
    evidence: evidence.evidence,
    external_report_reference: evidence.externalReportReference,
    scope: observation.scope,
    recorded_at: observation.updated_at,
    recorded_by_actor: options.recorded_by_actor ?? DEFAULT_ROW_ACTOR,
    recorded_source: options.recorded_source ?? DEFAULT_ROW_SOURCE,
    contains_platform_payload: false,
    contains_secrets: false,
    contains_credentials: false,
    contains_sdk_client: false,
    contains_raw_api_response: false,
    proves_collection: false,
    append_only: true,
    immutable: true,
  };
}

function evidenceRowFromRecord(
  record: SocialPublicationMetricEvidenceRecord,
  options: SocialPublicationMetricRowOptions,
): SocialPublicationMetricEvidenceRow {
  return {
    evidence_id: record.evidence_id,
    metric_observation_id: record.metric_observation_id,
    evidence_kind: record.evidence_kind,
    notes: record.notes,
    evidence: record.evidence,
    external_report_reference: record.external_report_reference,
    ...scopeColumns(record.scope),
    recorded_at: record.recorded_at,
    recorded_by_actor: options.recorded_by_actor ?? record.recorded_by_actor,
    recorded_source: options.recorded_source ?? record.recorded_source,
    contains_platform_payload: false,
    contains_secrets: false,
    contains_credentials: false,
    contains_sdk_client: false,
    contains_raw_api_response: false,
    proves_collection: false,
    append_only: true,
    immutable: true,
    idempotency_key: options.idempotency_key ?? null,
  };
}

function evidenceRecordFromRow(
  row: SocialPublicationMetricEvidenceRow,
): SocialPublicationMetricEvidenceRecord {
  return {
    evidence_id: row.evidence_id as SocialPublicationMetricEvidenceId,
    metric_observation_id: row.metric_observation_id as SocialPublicationMetricObservationRecord["metric_observation_id"],
    evidence_kind: row.evidence_kind as SocialPublicationMetricEvidenceKind,
    notes: row.notes,
    evidence: row.evidence,
    external_report_reference: row.external_report_reference,
    scope: scopeFromColumns(row),
    recorded_at: row.recorded_at,
    recorded_by_actor: row.recorded_by_actor as SocialPublicationMetricRowActor,
    recorded_source: row.recorded_source as SocialPublicationMetricRowSource,
    contains_platform_payload: false,
    contains_secrets: false,
    contains_credentials: false,
    contains_sdk_client: false,
    contains_raw_api_response: false,
    proves_collection: false,
    append_only: true,
    immutable: true,
  };
}

function evidenceFromRow(row: SocialPublicationMetricEvidenceRow): PublicationMetricEvidence {
  return {
    evidenceId: row.evidence_id,
    evidenceKind: row.evidence_kind as PublicationMetricEvidence["evidenceKind"],
    evidence: row.evidence,
    notes: row.notes,
    externalReportReference: row.external_report_reference,
    containsPlatformPayload: false,
    containsSecrets: false,
    containsCredentials: false,
    containsSdkClient: false,
    containsRawApiResponse: false,
    provesCollection: false,
  };
}

function scopeColumns(scope: SocialPublicationMetricScope) {
  return {
    social_post_id: scope.social_post_id,
    publication_target_id: scope.publication_target_id,
    publisher_request_id: scope.publisher_request_id,
    publisher_result_id: scope.publisher_result_id,
    publisher_job_id: scope.publisher_job_id,
    schedule_id: scope.schedule_id,
    ledger_entry_id: scope.ledger_entry_id,
    publication_manifest_id: scope.publication_manifest_id,
    owner_approval_id: scope.owner_approval_id,
    approval_id: scope.approval_id,
    proposal_id: scope.proposal_id,
  };
}

function scopeFromColumns(row: UnknownRecord): SocialPublicationMetricScope {
  return {
    social_post_id: String(row.social_post_id) as SocialPublicationMetricScope["social_post_id"],
    publication_target_id: String(row.publication_target_id) as SocialPublicationMetricScope["publication_target_id"],
    publisher_request_id: optionalScopeText(row.publisher_request_id) as SocialPublicationMetricScope["publisher_request_id"],
    publisher_result_id: optionalScopeText(row.publisher_result_id) as SocialPublicationMetricScope["publisher_result_id"],
    publisher_job_id: optionalScopeText(row.publisher_job_id) as SocialPublicationMetricScope["publisher_job_id"],
    schedule_id: optionalScopeText(row.schedule_id) as SocialPublicationMetricScope["schedule_id"],
    ledger_entry_id: optionalScopeText(row.ledger_entry_id) as SocialPublicationMetricScope["ledger_entry_id"],
    publication_manifest_id: optionalScopeText(row.publication_manifest_id) as SocialPublicationMetricScope["publication_manifest_id"],
    owner_approval_id: optionalScopeText(row.owner_approval_id) as SocialPublicationMetricScope["owner_approval_id"],
    approval_id: optionalScopeText(row.approval_id) as SocialPublicationMetricScope["approval_id"],
    proposal_id: optionalScopeText(row.proposal_id) as SocialPublicationMetricScope["proposal_id"],
  };
}

function optionalScopeText(value: unknown): string | null {
  return hasText(value) ? value : null;
}

function validateScopeColumns(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationMetricRowError[],
): void {
  validateRequiredText(row.social_post_id, `${path}.social_post_id`, errors);
  validateRequiredText(row.publication_target_id, `${path}.publication_target_id`, errors);
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
  ].forEach((key) => validateOptionalText(row[key], `${path}.${key}`, errors));
}

function validateObservationInvariants(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationMetricRowError[],
): void {
  if (
    row.passive_only !== true ||
    row.observation_only !== true ||
    row.references_only !== true ||
    row.contains_platform_payload !== false ||
    row.collects_no_metrics !== true ||
    row.calls_no_external_apis !== true ||
    row.uses_no_sdks !== true ||
    row.uses_no_network !== true ||
    row.executes_nothing !== true ||
    row.publishes_nothing !== true ||
    row.schedules_nothing !== true ||
    row.mutates_no_scheduler !== true ||
    row.mutates_no_publisher !== true ||
    row.mutates_no_ledger !== true ||
    row.mutates_no_approval !== true ||
    row.mutates_no_manifest !== true ||
    row.mutates_no_targets !== true ||
    row.exposes_no_api_routes !== true ||
    row.performs_no_learning !== true ||
    row.append_only !== true ||
    row.immutable !== true
  ) {
    errors.push(rowError("field_shape_invalid", `${path}.contract`, "Metric rows must remain passive and append-only."));
  }
}

function validateAuditFields(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationMetricRowError[],
): void {
  validateEnum(row.recorded_by_actor, ACTOR_SET, `${path}.recorded_by_actor`, "audit_field_invalid", errors);
  validateEnum(row.recorded_source, ROW_SOURCE_SET, `${path}.recorded_source`, "audit_field_invalid", errors);
}

function validateValue(
  value: unknown,
  status: unknown,
  path: string,
  errors: SocialPublicationMetricRowError[],
): void {
  if (status === "completed") {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      errors.push(rowError("value_invalid", path, "Completed metric rows require a non-negative numeric value."));
    }
    return;
  }
  if (value !== null) {
    errors.push(rowError("value_invalid", path, "Pending and failed metric rows must not carry values."));
  }
}

function validateTimestamp(
  value: unknown,
  path: string,
  errors: SocialPublicationMetricRowError[],
): void {
  if (!hasText(value) || !Number.isFinite(Date.parse(value))) {
    errors.push(rowError("field_shape_invalid", path, "Metric row timestamp must be valid."));
  }
}

function validateIdempotencyKey(
  value: unknown,
  path: string,
  errors: SocialPublicationMetricRowError[],
): void {
  if (value !== null && value !== undefined && !hasText(value)) {
    errors.push(rowError("idempotency_key_invalid", path, "Idempotency key must be non-empty text or null."));
  }
}

function validateRequiredText(
  value: unknown,
  path: string,
  errors: SocialPublicationMetricRowError[],
): void {
  if (!hasText(value)) {
    errors.push(rowError("required_field_missing", path, "Required metric row field is missing."));
  }
}

function validateOptionalText(
  value: unknown,
  path: string,
  errors: SocialPublicationMetricRowError[],
): void {
  if (value !== null && value !== undefined && !hasText(value)) {
    errors.push(rowError("relationship_invalid", path, "Optional metric row reference must be text or null."));
  }
}

function validateEnum(
  value: unknown,
  allowed: ReadonlySet<string>,
  path: string,
  code: SocialPublicationMetricRowErrorCode,
  errors: SocialPublicationMetricRowError[],
): void {
  if (!hasText(value) || !allowed.has(value)) {
    errors.push(rowError(code, path, "Metric row enum value is not supported."));
  }
}

function rejectForbiddenState(
  value: unknown,
  path: string,
  errors: SocialPublicationMetricRowError[],
  seen = new WeakSet<object>(),
): void {
  if (Array.isArray(value)) {
    if (seen.has(value)) return;
    seen.add(value);
    value.forEach((entry, index) => rejectForbiddenState(entry, `${path}.${index}`, errors, seen));
    return;
  }
  if (!isRecord(value)) return;
  if (seen.has(value)) return;
  seen.add(value);

  for (const [key, child] of Object.entries(value)) {
    const code = FORBIDDEN_KEYS[key];
    if (code) {
      errors.push(rowError(code, `${path}.${key}`, "Metric rows must not store forbidden state."));
    }
    rejectForbiddenState(child, `${path}.${key}`, errors, seen);
  }
}

function sortObservationRows(
  rows: readonly SocialPublicationMetricObservationRow[],
): readonly SocialPublicationMetricObservationRow[] {
  return [...rows].sort(
    (left, right) =>
      left.observed_at.localeCompare(right.observed_at) ||
      left.metric_observation_id.localeCompare(right.metric_observation_id),
  );
}

function sortEvidenceRows(
  rows: readonly SocialPublicationMetricEvidenceRow[],
): readonly SocialPublicationMetricEvidenceRow[] {
  return [...rows].sort(
    (left, right) =>
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.evidence_id.localeCompare(right.evidence_id),
  );
}

function getArray(record: UnknownRecord, key: string): readonly unknown[] | null {
  return Array.isArray(record[key]) ? record[key] : null;
}

function getText(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  return hasText(value) ? value : null;
}

function withPathPrefix(
  errors: readonly SocialPublicationMetricRowError[],
  prefix: string,
): readonly SocialPublicationMetricRowError[] {
  return errors.map((error) => ({
    ...error,
    path: `${prefix}.${error.path}`,
  }));
}

function validationResult(
  errors: SocialPublicationMetricRowError[],
): SocialPublicationMetricRowValidationResult {
  if (errors.length === 0) return { ok: true, errors: [] };
  return { ok: false, errors };
}

function rowError(
  code: SocialPublicationMetricRowErrorCode,
  path: string,
  message: string,
): SocialPublicationMetricRowError {
  return { code, path, message };
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
