import {
  type SocialPublicationExecutionApprovalId,
  type SocialPublicationExecutionCampaignMemoryId,
  type SocialPublicationExecutionDecisionHistoryId,
  type SocialPublicationExecutionIntentId,
  type SocialPublicationExecutionIntentRecord,
  type SocialPublicationExecutionJobId,
  type SocialPublicationExecutionLearningInsightId,
  type SocialPublicationExecutionLedgerEntryId,
  type SocialPublicationExecutionManifestId,
  type SocialPublicationExecutionMetricObservationId,
  type SocialPublicationExecutionOwnerApprovalId,
  type SocialPublicationExecutionPreflightId,
  type SocialPublicationExecutionPublisherJobId,
  type SocialPublicationExecutionPublisherRequestId,
  type SocialPublicationExecutionPublisherResultId,
  type SocialPublicationExecutionResultId,
  type SocialPublicationExecutionResultRecord,
  type SocialPublicationExecutionScheduleId,
  type SocialPublicationExecutionScope,
  type SocialPublicationExecutionSocialPostId,
  type SocialPublicationExecutionTargetId,
} from "./social-publication-execution-repository";
import {
  PUBLICATION_EXECUTION_INTENT_TYPES,
  PUBLICATION_EXECUTION_PREFLIGHT_STATUSES,
  PUBLICATION_EXECUTION_RESULT_STATUSES,
  PUBLICATION_EXECUTION_RESULT_TYPES,
  isPublicationExecutionBlockReason,
  type PublicationExecutionIntentType,
  type PublicationExecutionJsonObject,
  type PublicationExecutionPreflightStatus,
  type PublicationExecutionResultStatus,
  type PublicationExecutionResultType,
} from "./social-publication-execution";

type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

type UnknownRecord = Readonly<Record<string, unknown>>;

export type SocialPublicationExecutionEvidenceId = Brand<
  string,
  "SocialPublicationExecutionEvidenceId"
>;

export const PUBLICATION_EXECUTION_ROW_ACTORS = [
  "system",
  "owner",
  "admin",
  "scheduler",
  "publisher",
  "model",
  "test",
] as const;

export const PUBLICATION_EXECUTION_ROW_SOURCES = [
  "publication_execution_domain",
  "manual_admin",
  "test",
] as const;

export const PUBLICATION_EXECUTION_EVIDENCE_KINDS = [
  "preflight_evidence",
  "authority_evidence",
  "operator_note",
  "none",
] as const;

export type SocialPublicationExecutionRowActor =
  (typeof PUBLICATION_EXECUTION_ROW_ACTORS)[number];

export type SocialPublicationExecutionRowSource =
  (typeof PUBLICATION_EXECUTION_ROW_SOURCES)[number];

export type SocialPublicationExecutionEvidenceKind =
  (typeof PUBLICATION_EXECUTION_EVIDENCE_KINDS)[number];

export type SocialPublicationExecutionEvidenceRecord = Readonly<{
  evidence_id: SocialPublicationExecutionEvidenceId;
  execution_intent_id: SocialPublicationExecutionIntentId;
  execution_result_id: SocialPublicationExecutionResultId | null;
  evidence_kind: SocialPublicationExecutionEvidenceKind;
  notes: string | null;
  evidence: PublicationExecutionJsonObject;
  scope: SocialPublicationExecutionScope;
  recorded_at: string;
  recorded_by_actor: SocialPublicationExecutionRowActor;
  recorded_source: SocialPublicationExecutionRowSource;
  contains_full_payload: false;
  contains_secrets: false;
  proves_execution: false;
  append_only: true;
  immutable: true;
}>;

export type SocialPublicationExecutionIntentRow = Readonly<{
  execution_intent_id: string;
  execution_job_id: string;
  intent_type: string;
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
  metric_observation_id: string | null;
  learning_insight_id: string | null;
  campaign_memory_id: string | null;
  decision_history_id: string | null;
  owner_approval_satisfied: boolean;
  publisher_authority_satisfied: boolean;
  preflight_id: string | null;
  preflight_status: string | null;
  preflight_block_reasons: readonly string[];
  preflight_evaluated_at: string | null;
  evidence_id: string | null;
  requested_at: string;
  updated_at: string;
  recorded_by_actor: string;
  recorded_source: string;
  contract_only: boolean;
  model_authority_only: boolean;
  references_only: boolean;
  executes_nothing: boolean;
  publishes_nothing: boolean;
  calls_no_external_apis: boolean;
  uses_no_sdks: boolean;
  uses_no_network: boolean;
  starts_no_workers: boolean;
  starts_no_timers: boolean;
  creates_no_queues: boolean;
  exposes_no_api_routes: boolean;
  exposes_no_admin_ui: boolean;
  mutates_no_sql: boolean;
  mutates_no_storage: boolean;
  mutates_no_lower_layers: boolean;
  records_no_metrics: boolean;
  performs_no_learning: boolean;
  grants_execution_permission: boolean;
  append_only: boolean;
  immutable: boolean;
  idempotency_key: string | null;
}>;

export type SocialPublicationExecutionResultRow = Readonly<{
  execution_result_id: string;
  execution_intent_id: string;
  execution_job_id: string;
  result_type: string;
  result_status: string;
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
  metric_observation_id: string | null;
  learning_insight_id: string | null;
  campaign_memory_id: string | null;
  decision_history_id: string | null;
  block_reasons: readonly string[];
  evidence_id: string | null;
  recorded_at: string;
  updated_at: string;
  recorded_by_actor: string;
  recorded_source: string;
  contract_only: boolean;
  model_authority_only: boolean;
  references_only: boolean;
  executes_nothing: boolean;
  publishes_nothing: boolean;
  calls_no_external_apis: boolean;
  uses_no_sdks: boolean;
  uses_no_network: boolean;
  persists_nothing: boolean;
  mutates_no_lower_layers: boolean;
  current_execution_status_authority: boolean;
  records_no_metrics: boolean;
  performs_no_learning: boolean;
  grants_execution_permission: boolean;
  append_only: boolean;
  immutable: boolean;
  idempotency_key: string | null;
}>;

export type SocialPublicationExecutionEvidenceRow = Readonly<{
  evidence_id: string;
  execution_intent_id: string;
  execution_result_id: string | null;
  evidence_kind: string;
  notes: string | null;
  evidence: PublicationExecutionJsonObject;
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
  metric_observation_id: string | null;
  learning_insight_id: string | null;
  campaign_memory_id: string | null;
  decision_history_id: string | null;
  recorded_at: string;
  recorded_by_actor: string;
  recorded_source: string;
  contains_full_payload: boolean;
  contains_secrets: boolean;
  proves_execution: boolean;
  append_only: boolean;
  immutable: boolean;
  idempotency_key: string | null;
}>;

export type SocialPublicationExecutionRowsModel = Readonly<{
  intents: readonly SocialPublicationExecutionIntentRow[];
  results: readonly SocialPublicationExecutionResultRow[];
  evidence: readonly SocialPublicationExecutionEvidenceRow[];
}>;

export type SocialPublicationExecutionRowsPersistenceModel = Readonly<{
  intents: readonly SocialPublicationExecutionIntentRecord[];
  results: readonly SocialPublicationExecutionResultRecord[];
  evidence: readonly SocialPublicationExecutionEvidenceRecord[];
}>;

export const SOCIAL_PUBLICATION_EXECUTION_ROW_ERROR_CODES = [
  "required_field_missing",
  "field_shape_invalid",
  "identity_invalid",
  "identity_not_separated",
  "intent_type_invalid",
  "result_type_invalid",
  "preflight_status_invalid",
  "block_reason_invalid",
  "evidence_kind_invalid",
  "audit_field_invalid",
  "summary_shape_invalid",
  "idempotency_key_invalid",
  "relationship_invalid",
  "serialization_invalid",
  "unsafe_recursive_state_forbidden",
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

export type SocialPublicationExecutionRowErrorCode =
  (typeof SOCIAL_PUBLICATION_EXECUTION_ROW_ERROR_CODES)[number];

export type SocialPublicationExecutionRowError = Readonly<{
  code: SocialPublicationExecutionRowErrorCode;
  path: string;
  message: string;
}>;

export type SocialPublicationExecutionRowValidationResult = Readonly<
  | {
      ok: true;
      errors: readonly [];
    }
  | {
      ok: false;
      errors: readonly SocialPublicationExecutionRowError[];
    }
>;

export type SocialPublicationExecutionRowResult<T> = Readonly<
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      errors: readonly SocialPublicationExecutionRowError[];
    }
>;

export type SocialPublicationExecutionIntentRowOptions = Readonly<{
  recorded_by_actor?: SocialPublicationExecutionRowActor;
  recorded_source?: SocialPublicationExecutionRowSource;
  idempotency_key?: string | null;
}>;

export type SocialPublicationExecutionResultRowOptions =
  SocialPublicationExecutionIntentRowOptions;

export type SocialPublicationExecutionEvidenceRowOptions =
  SocialPublicationExecutionIntentRowOptions;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const INTENT_TYPE_SET = new Set<string>(PUBLICATION_EXECUTION_INTENT_TYPES);
const RESULT_TYPE_SET = new Set<string>(PUBLICATION_EXECUTION_RESULT_TYPES);
const PREFLIGHT_STATUS_SET = new Set<string>(PUBLICATION_EXECUTION_PREFLIGHT_STATUSES);
const RESULT_STATUS_SET = new Set<string>(PUBLICATION_EXECUTION_RESULT_STATUSES);
const ACTOR_SET = new Set<string>(PUBLICATION_EXECUTION_ROW_ACTORS);
const SOURCE_SET = new Set<string>(PUBLICATION_EXECUTION_ROW_SOURCES);
const EVIDENCE_KIND_SET = new Set<string>(PUBLICATION_EXECUTION_EVIDENCE_KINDS);

const DEFAULT_ROW_ACTOR: SocialPublicationExecutionRowActor = "model";
const DEFAULT_ROW_SOURCE: SocialPublicationExecutionRowSource =
  "publication_execution_domain";

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
  "googleApi",
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

export function validateSocialPublicationExecutionIntentRow(
  row: unknown,
): SocialPublicationExecutionRowValidationResult {
  const errors: SocialPublicationExecutionRowError[] = [];

  if (!isRecord(row)) {
    return validationResult([
      rowError("field_shape_invalid", "intent", "Execution intent row must be an object."),
    ]);
  }

  validateIntentRowShape(row, "intent", errors);
  return validationResult(errors);
}

export function validateSocialPublicationExecutionResultRow(
  row: unknown,
): SocialPublicationExecutionRowValidationResult {
  const errors: SocialPublicationExecutionRowError[] = [];

  if (!isRecord(row)) {
    return validationResult([
      rowError("field_shape_invalid", "result", "Execution result row must be an object."),
    ]);
  }

  validateResultRowShape(row, "result", errors);
  return validationResult(errors);
}

export function validateSocialPublicationExecutionEvidenceRow(
  row: unknown,
): SocialPublicationExecutionRowValidationResult {
  const errors: SocialPublicationExecutionRowError[] = [];

  if (!isRecord(row)) {
    return validationResult([
      rowError("field_shape_invalid", "evidence", "Execution evidence row must be an object."),
    ]);
  }

  validateEvidenceRowShape(row, "evidence", errors);
  return validationResult(errors);
}

export function validateSocialPublicationExecutionRowsModel(
  model: unknown,
): SocialPublicationExecutionRowValidationResult {
  const errors: SocialPublicationExecutionRowError[] = [];

  if (!isRecord(model)) {
    return validationResult([
      rowError("field_shape_invalid", "model", "Execution rows model must be an object."),
    ]);
  }

  const intents = getArray(model, "intents");
  const results = getArray(model, "results");
  const evidence = getArray(model, "evidence");

  if (!intents) {
    errors.push(
      rowError("required_field_missing", "model.intents", "Execution rows model must include intent rows."),
    );
  }
  if (!results) {
    errors.push(
      rowError("required_field_missing", "model.results", "Execution rows model must include result rows."),
    );
  }
  if (!evidence) {
    errors.push(
      rowError("required_field_missing", "model.evidence", "Execution rows model must include evidence rows."),
    );
  }

  const intentIds = new Set<string>();
  intents?.forEach((row, index) => {
    const validation = validateSocialPublicationExecutionIntentRow(row);
    if (!validation.ok) errors.push(...withPathPrefix(validation.errors, `intents.${index}`));

    const intentId = getText(row as UnknownRecord, "execution_intent_id");
    if (intentId) {
      if (intentIds.has(intentId)) {
        errors.push(
          rowError(
            "identity_not_separated",
            `intents.${index}.execution_intent_id`,
            "Execution intent identities must be unique within the model.",
          ),
        );
      }
      intentIds.add(intentId);
    }
  });

  results?.forEach((row, index) => {
    const validation = validateSocialPublicationExecutionResultRow(row);
    if (!validation.ok) errors.push(...withPathPrefix(validation.errors, `results.${index}`));

    const intentId = getText(row as UnknownRecord, "execution_intent_id");
    if (intentId && !intentIds.has(intentId)) {
      errors.push(
        rowError(
          "relationship_invalid",
          `results.${index}.execution_intent_id`,
          "Execution result must reference an intent present in the model.",
        ),
      );
    }
  });

  evidence?.forEach((row, index) => {
    const validation = validateSocialPublicationExecutionEvidenceRow(row);
    if (!validation.ok) errors.push(...withPathPrefix(validation.errors, `evidence.${index}`));

    const intentId = getText(row as UnknownRecord, "execution_intent_id");
    if (intentId && !intentIds.has(intentId)) {
      errors.push(
        rowError(
          "relationship_invalid",
          `evidence.${index}.execution_intent_id`,
          "Execution evidence must reference an intent present in the model.",
        ),
      );
    }
  });

  return validationResult(errors);
}

export function mapSocialPublicationExecutionIntentRowToRecord(
  row: SocialPublicationExecutionIntentRow,
): SocialPublicationExecutionRowResult<SocialPublicationExecutionIntentRecord> {
  const validation = validateSocialPublicationExecutionIntentRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(intentRecordFromRow(row)) };
}

export function mapSocialPublicationExecutionIntentRecordToRow(
  record: SocialPublicationExecutionIntentRecord,
  options: SocialPublicationExecutionIntentRowOptions = {},
): SocialPublicationExecutionRowResult<SocialPublicationExecutionIntentRow> {
  const row = intentRowFromRecord(record, options);
  const validation = validateSocialPublicationExecutionIntentRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(row) };
}

export function mapSocialPublicationExecutionResultRowToRecord(
  row: SocialPublicationExecutionResultRow,
): SocialPublicationExecutionRowResult<SocialPublicationExecutionResultRecord> {
  const validation = validateSocialPublicationExecutionResultRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(resultRecordFromRow(row)) };
}

export function mapSocialPublicationExecutionResultRecordToRow(
  record: SocialPublicationExecutionResultRecord,
  options: SocialPublicationExecutionResultRowOptions = {},
): SocialPublicationExecutionRowResult<SocialPublicationExecutionResultRow> {
  const row = resultRowFromRecord(record, options);
  const validation = validateSocialPublicationExecutionResultRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(row) };
}

export function mapSocialPublicationExecutionEvidenceRowToRecord(
  row: SocialPublicationExecutionEvidenceRow,
): SocialPublicationExecutionRowResult<SocialPublicationExecutionEvidenceRecord> {
  const validation = validateSocialPublicationExecutionEvidenceRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(evidenceRecordFromRow(row)) };
}

export function mapSocialPublicationExecutionEvidenceRecordToRow(
  record: SocialPublicationExecutionEvidenceRecord,
  options: SocialPublicationExecutionEvidenceRowOptions = {},
): SocialPublicationExecutionRowResult<SocialPublicationExecutionEvidenceRow> {
  const row = evidenceRowFromRecord(record, options);
  const validation = validateSocialPublicationExecutionEvidenceRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(row) };
}

export function mapSocialPublicationExecutionRowsToPersistenceModel(
  rows: SocialPublicationExecutionRowsModel,
): SocialPublicationExecutionRowResult<SocialPublicationExecutionRowsPersistenceModel> {
  const validation = validateSocialPublicationExecutionRowsModel(rows);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return {
    ok: true,
    value: immutableClone({
      intents: sortIntentRows(rows.intents).map(intentRecordFromRow),
      results: sortResultRows(rows.results).map(resultRecordFromRow),
      evidence: sortEvidenceRows(rows.evidence).map(evidenceRecordFromRow),
    }),
  };
}

export function serializeSocialPublicationExecutionRowsModel(
  rows: SocialPublicationExecutionRowsModel,
): string {
  const validation = validateSocialPublicationExecutionRowsModel(rows);
  if (!validation.ok) {
    throw new Error("Publication execution rows model failed validation.");
  }

  return stableStringify(sortRowsModel(rows));
}

export function hydrateSocialPublicationExecutionRowsModel(
  serialized: string,
): SocialPublicationExecutionRowResult<SocialPublicationExecutionRowsModel> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    return {
      ok: false,
      errors: [
        rowError(
          "serialization_invalid",
          "serialized",
          "Serialized execution rows model must be valid JSON.",
        ),
      ],
    };
  }

  const validation = validateSocialPublicationExecutionRowsModel(parsed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return {
    ok: true,
    value: immutableClone(sortRowsModel(parsed as SocialPublicationExecutionRowsModel)),
  };
}

function validateIntentRowShape(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationExecutionRowError[],
): void {
  validateUuid(row.execution_intent_id, `${path}.execution_intent_id`, errors);
  validateUuid(row.execution_job_id, `${path}.execution_job_id`, errors);
  validateEnum(row.intent_type, INTENT_TYPE_SET, `${path}.intent_type`, "intent_type_invalid", errors);
  validateScopeColumns(row, path, errors);

  if (typeof row.owner_approval_satisfied !== "boolean") {
    errors.push(
      rowError(
        "field_shape_invalid",
        `${path}.owner_approval_satisfied`,
        "Owner approval satisfied flag must be a boolean.",
      ),
    );
  }
  if (typeof row.publisher_authority_satisfied !== "boolean") {
    errors.push(
      rowError(
        "field_shape_invalid",
        `${path}.publisher_authority_satisfied`,
        "Publisher authority satisfied flag must be a boolean.",
      ),
    );
  }

  validatePreflightFields(row, path, errors);
  validateOptionalUuid(row.evidence_id, `${path}.evidence_id`, errors);
  validateTimestamp(row.requested_at, `${path}.requested_at`, errors);
  validateTimestamp(row.updated_at, `${path}.updated_at`, errors);
  validateAuditFields(row, path, errors);
  validateIdempotencyKey(row.idempotency_key, `${path}.idempotency_key`, errors);
  validateIdentitySeparation(
    path,
    errors,
    row.execution_intent_id,
    row.execution_job_id,
    row.social_post_id,
    row.publication_target_id,
  );

  if (
    row.contract_only !== true ||
    row.model_authority_only !== true ||
    row.references_only !== true ||
    row.executes_nothing !== true ||
    row.publishes_nothing !== true ||
    row.calls_no_external_apis !== true ||
    row.uses_no_sdks !== true ||
    row.uses_no_network !== true ||
    row.starts_no_workers !== true ||
    row.starts_no_timers !== true ||
    row.creates_no_queues !== true ||
    row.exposes_no_api_routes !== true ||
    row.exposes_no_admin_ui !== true ||
    row.mutates_no_sql !== true ||
    row.mutates_no_storage !== true ||
    row.mutates_no_lower_layers !== true ||
    row.records_no_metrics !== true ||
    row.performs_no_learning !== true ||
    row.grants_execution_permission !== false ||
    row.append_only !== true ||
    row.immutable !== true
  ) {
    errors.push(
      rowError(
        "field_shape_invalid",
        path,
        "Execution intent rows must remain contract-only, references-only, and non-executable.",
      ),
    );
  }

  rejectUnsafeState(row, path, errors);
}

function validateResultRowShape(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationExecutionRowError[],
): void {
  validateUuid(row.execution_result_id, `${path}.execution_result_id`, errors);
  validateUuid(row.execution_intent_id, `${path}.execution_intent_id`, errors);
  validateUuid(row.execution_job_id, `${path}.execution_job_id`, errors);
  validateEnum(row.result_type, RESULT_TYPE_SET, `${path}.result_type`, "result_type_invalid", errors);
  validateEnum(row.result_status, RESULT_STATUS_SET, `${path}.result_status`, "result_type_invalid", errors);
  validateScopeColumns(row, path, errors);
  validateBlockReasonsField(row.block_reasons, `${path}.block_reasons`, errors);

  if (hasText(row.result_status) && isPublicationExecutionResultStatusText(row.result_status)) {
    if (row.result_status === "blocked" && Array.isArray(row.block_reasons) && row.block_reasons.length === 0) {
      errors.push(
        rowError(
          "block_reason_invalid",
          `${path}.block_reasons`,
          "Blocked execution results require at least one block reason.",
        ),
      );
    }
    if (row.result_status === "completed" && Array.isArray(row.block_reasons) && row.block_reasons.length > 0) {
      errors.push(
        rowError(
          "block_reason_invalid",
          `${path}.block_reasons`,
          "Completed execution results must not carry block reasons.",
        ),
      );
    }
    if ((row.result_status === "blocked" || row.result_status === "failed") && !hasText(row.evidence_id)) {
      errors.push(
        rowError(
          "required_field_missing",
          `${path}.evidence_id`,
          "Blocked or failed execution results require evidence.",
        ),
      );
    }
  }

  validateOptionalUuid(row.evidence_id, `${path}.evidence_id`, errors);
  validateTimestamp(row.recorded_at, `${path}.recorded_at`, errors);
  validateTimestamp(row.updated_at, `${path}.updated_at`, errors);
  validateAuditFields(row, path, errors);
  validateIdempotencyKey(row.idempotency_key, `${path}.idempotency_key`, errors);
  validateIdentitySeparation(
    path,
    errors,
    row.execution_result_id,
    row.execution_intent_id,
    row.execution_job_id,
    row.social_post_id,
    row.publication_target_id,
  );

  if (
    row.contract_only !== true ||
    row.model_authority_only !== true ||
    row.references_only !== true ||
    row.executes_nothing !== true ||
    row.publishes_nothing !== true ||
    row.calls_no_external_apis !== true ||
    row.uses_no_sdks !== true ||
    row.uses_no_network !== true ||
    row.persists_nothing !== true ||
    row.mutates_no_lower_layers !== true ||
    row.current_execution_status_authority !== false ||
    row.records_no_metrics !== true ||
    row.performs_no_learning !== true ||
    row.grants_execution_permission !== false ||
    row.append_only !== true ||
    row.immutable !== true
  ) {
    errors.push(
      rowError(
        "field_shape_invalid",
        path,
        "Execution result rows must remain contract-only, references-only, and non-executable.",
      ),
    );
  }

  rejectUnsafeState(row, path, errors);
}

function validateEvidenceRowShape(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationExecutionRowError[],
): void {
  validateUuid(row.evidence_id, `${path}.evidence_id`, errors);
  validateUuid(row.execution_intent_id, `${path}.execution_intent_id`, errors);
  validateOptionalUuid(row.execution_result_id, `${path}.execution_result_id`, errors);
  validateEnum(row.evidence_kind, EVIDENCE_KIND_SET, `${path}.evidence_kind`, "evidence_kind_invalid", errors);
  validateOptionalText(row.notes, `${path}.notes`, errors);
  validateJsonObject(row.evidence, `${path}.evidence`, errors);
  validateScopeColumns(row, path, errors);
  validateTimestamp(row.recorded_at, `${path}.recorded_at`, errors);
  validateAuditFields(row, path, errors);
  validateIdempotencyKey(row.idempotency_key, `${path}.idempotency_key`, errors);
  validateIdentitySeparation(
    path,
    errors,
    row.evidence_id,
    row.execution_intent_id,
    row.execution_result_id,
    row.social_post_id,
    row.publication_target_id,
  );

  if (
    row.contains_full_payload !== false ||
    row.contains_secrets !== false ||
    row.proves_execution !== false ||
    row.append_only !== true ||
    row.immutable !== true
  ) {
    errors.push(
      rowError(
        "field_shape_invalid",
        path,
        "Execution evidence rows must remain sanitized, append-only, and non-execution evidence.",
      ),
    );
  }

  rejectUnsafeState(row, path, errors);
}

function validateScopeColumns(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationExecutionRowError[],
): void {
  validateUuid(row.social_post_id, `${path}.social_post_id`, errors);
  validateUuid(row.publication_target_id, `${path}.publication_target_id`, errors);
  validateOptionalUuid(row.publisher_request_id, `${path}.publisher_request_id`, errors);
  validateOptionalUuid(row.publisher_result_id, `${path}.publisher_result_id`, errors);
  validateOptionalUuid(row.publisher_job_id, `${path}.publisher_job_id`, errors);
  validateOptionalUuid(row.schedule_id, `${path}.schedule_id`, errors);
  validateOptionalUuid(row.ledger_entry_id, `${path}.ledger_entry_id`, errors);
  validateOptionalText(row.publication_manifest_id, `${path}.publication_manifest_id`, errors);
  validateOptionalUuid(row.owner_approval_id, `${path}.owner_approval_id`, errors);
  validateOptionalUuid(row.approval_id, `${path}.approval_id`, errors);
  validateOptionalUuid(row.metric_observation_id, `${path}.metric_observation_id`, errors);
  validateOptionalUuid(row.learning_insight_id, `${path}.learning_insight_id`, errors);
  validateOptionalUuid(row.campaign_memory_id, `${path}.campaign_memory_id`, errors);
  validateOptionalUuid(row.decision_history_id, `${path}.decision_history_id`, errors);
}

function validatePreflightFields(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationExecutionRowError[],
): void {
  const status = row.preflight_status;
  if (status !== null && status !== undefined) {
    if (typeof status !== "string" || !PREFLIGHT_STATUS_SET.has(status)) {
      errors.push(
        rowError("preflight_status_invalid", `${path}.preflight_status`, "Execution preflight status is not supported."),
      );
    }
    validateOptionalUuid(row.preflight_id, `${path}.preflight_id`, errors);
    validateOptionalText(row.preflight_evaluated_at, `${path}.preflight_evaluated_at`, errors);
  }
  validateBlockReasonsField(row.preflight_block_reasons, `${path}.preflight_block_reasons`, errors);
}

function validateBlockReasonsField(
  value: unknown,
  path: string,
  errors: SocialPublicationExecutionRowError[],
): void {
  if (!Array.isArray(value)) {
    errors.push(rowError("block_reason_invalid", path, "Execution block reasons must be an array."));
    return;
  }
  value.forEach((reason, index) => {
    if (typeof reason !== "string" || !isPublicationExecutionBlockReason(reason)) {
      errors.push(rowError("block_reason_invalid", `${path}.${index}`, "Execution block reason is not supported."));
    }
  });
}

function validateAuditFields(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationExecutionRowError[],
): void {
  if (!hasText(row.recorded_by_actor) || !ACTOR_SET.has(row.recorded_by_actor)) {
    errors.push(
      rowError("audit_field_invalid", `${path}.recorded_by_actor`, "Recorded actor must use the execution actor vocabulary."),
    );
  }
  if (!hasText(row.recorded_source) || !SOURCE_SET.has(row.recorded_source)) {
    errors.push(
      rowError("audit_field_invalid", `${path}.recorded_source`, "Recorded source must use the execution source vocabulary."),
    );
  }
}

function validateEnum(
  value: unknown,
  allowed: ReadonlySet<string>,
  path: string,
  code: SocialPublicationExecutionRowErrorCode,
  errors: SocialPublicationExecutionRowError[],
): void {
  if (!hasText(value) || !allowed.has(value)) {
    errors.push(rowError(code, path, "Execution row enum value is not supported."));
  }
}

function validateJsonObject(
  value: unknown,
  path: string,
  errors: SocialPublicationExecutionRowError[],
): void {
  if (!isJsonObject(value)) {
    errors.push(rowError("summary_shape_invalid", path, "Value must be a JSON object."));
  }
}

function validateUuid(
  value: unknown,
  path: string,
  errors: SocialPublicationExecutionRowError[],
): void {
  if (!hasText(value)) {
    errors.push(rowError("required_field_missing", path, "Required UUID field is missing."));
    return;
  }

  if (!UUID_PATTERN.test(value)) {
    errors.push(rowError("identity_invalid", path, "Field must be a UUID string."));
  }
}

function validateOptionalUuid(
  value: unknown,
  path: string,
  errors: SocialPublicationExecutionRowError[],
): void {
  if (value === null || value === undefined) return;
  if (!hasText(value) || !UUID_PATTERN.test(value)) {
    errors.push(rowError("identity_invalid", path, "Optional UUID field must be null or UUID text."));
  }
}

function validateOptionalText(
  value: unknown,
  path: string,
  errors: SocialPublicationExecutionRowError[],
): void {
  if (value === null || value === undefined) return;
  if (!hasText(value)) {
    errors.push(rowError("required_field_missing", path, "Optional text field must be null or non-empty text."));
  }
}

function validateTimestamp(
  value: unknown,
  path: string,
  errors: SocialPublicationExecutionRowError[],
): void {
  if (!hasText(value) || Number.isNaN(Date.parse(value))) {
    errors.push(rowError("audit_field_invalid", path, "Timestamp must be a parseable ISO string."));
  }
}

function validateIdempotencyKey(
  value: unknown,
  path: string,
  errors: SocialPublicationExecutionRowError[],
): void {
  if (value !== null && !hasText(value)) {
    errors.push(rowError("idempotency_key_invalid", path, "Idempotency key must be null or non-empty text."));
  }
}

function validateIdentitySeparation(
  path: string,
  errors: SocialPublicationExecutionRowError[],
  ...values: readonly unknown[]
): void {
  const textValues = values.filter(hasText);
  if (new Set(textValues).size !== textValues.length) {
    errors.push(
      rowError(
        "identity_not_separated",
        path,
        "Execution row identities and scope identities must remain separated.",
      ),
    );
  }
}

function rejectUnsafeState(
  value: unknown,
  path: string,
  errors: SocialPublicationExecutionRowError[],
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
  code: SocialPublicationExecutionRowErrorCode,
  errors: SocialPublicationExecutionRowError[],
  seen = new WeakSet<object>(),
): void {
  if (!value || typeof value !== "object") return;

  if (seen.has(value)) {
    errors.push(rowError("unsafe_recursive_state_forbidden", path, "Execution row JSON must be acyclic."));
    return;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      rejectForbiddenKeys(item, `${path}.${index}`, forbiddenKeys, code, errors, seen),
    );
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (forbiddenKeys.has(key)) {
      errors.push(rowError(code, childPath, "Execution rows must not store unsafe execution state."));
    }
    rejectForbiddenKeys(child, childPath, forbiddenKeys, code, errors, seen);
  }
}

function intentRecordFromRow(
  row: SocialPublicationExecutionIntentRow,
): SocialPublicationExecutionIntentRecord {
  return {
    execution_intent_id: row.execution_intent_id as SocialPublicationExecutionIntentId,
    execution_job_id: row.execution_job_id as SocialPublicationExecutionJobId,
    intent_type: row.intent_type as PublicationExecutionIntentType,
    scope: scopeFromRow(row),
    owner_approval_satisfied: row.owner_approval_satisfied,
    publisher_authority_satisfied: row.publisher_authority_satisfied,
    preflight_id: row.preflight_id as SocialPublicationExecutionPreflightId | null,
    preflight_status: row.preflight_status as PublicationExecutionPreflightStatus | null,
    preflight_block_reasons: row.preflight_block_reasons.filter(isPublicationExecutionBlockReason),
    preflight_evaluated_at: row.preflight_evaluated_at,
    evidence_id: row.evidence_id as SocialPublicationExecutionEvidenceId | null,
    requested_at: row.requested_at,
    updated_at: row.updated_at,
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
  };
}

function intentRowFromRecord(
  record: SocialPublicationExecutionIntentRecord,
  options: SocialPublicationExecutionIntentRowOptions,
): SocialPublicationExecutionIntentRow {
  return {
    execution_intent_id: record.execution_intent_id,
    execution_job_id: record.execution_job_id,
    intent_type: record.intent_type,
    ...scopeColumnsFromRecord(record.scope),
    owner_approval_satisfied: record.owner_approval_satisfied,
    publisher_authority_satisfied: record.publisher_authority_satisfied,
    preflight_id: record.preflight_id,
    preflight_status: record.preflight_status,
    preflight_block_reasons: record.preflight_block_reasons,
    preflight_evaluated_at: record.preflight_evaluated_at,
    evidence_id: record.evidence_id,
    requested_at: record.requested_at,
    updated_at: record.updated_at,
    recorded_by_actor: options.recorded_by_actor ?? DEFAULT_ROW_ACTOR,
    recorded_source: options.recorded_source ?? DEFAULT_ROW_SOURCE,
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
    append_only: true,
    immutable: true,
    idempotency_key: options.idempotency_key ?? null,
  };
}

function resultRecordFromRow(
  row: SocialPublicationExecutionResultRow,
): SocialPublicationExecutionResultRecord {
  return {
    execution_result_id: row.execution_result_id as SocialPublicationExecutionResultId,
    execution_intent_id: row.execution_intent_id as SocialPublicationExecutionIntentId,
    execution_job_id: row.execution_job_id as SocialPublicationExecutionJobId,
    result_type: row.result_type as PublicationExecutionResultType,
    result_status: row.result_status as PublicationExecutionResultStatus,
    scope: scopeFromRow(row),
    block_reasons: row.block_reasons.filter(isPublicationExecutionBlockReason),
    evidence_id: row.evidence_id as SocialPublicationExecutionEvidenceId | null,
    recorded_at: row.recorded_at,
    updated_at: row.updated_at,
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
  };
}

function resultRowFromRecord(
  record: SocialPublicationExecutionResultRecord,
  options: SocialPublicationExecutionResultRowOptions,
): SocialPublicationExecutionResultRow {
  return {
    execution_result_id: record.execution_result_id,
    execution_intent_id: record.execution_intent_id,
    execution_job_id: record.execution_job_id,
    result_type: record.result_type,
    result_status: record.result_status,
    ...scopeColumnsFromRecord(record.scope),
    block_reasons: record.block_reasons,
    evidence_id: record.evidence_id,
    recorded_at: record.recorded_at,
    updated_at: record.updated_at,
    recorded_by_actor: options.recorded_by_actor ?? DEFAULT_ROW_ACTOR,
    recorded_source: options.recorded_source ?? DEFAULT_ROW_SOURCE,
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
    append_only: true,
    immutable: true,
    idempotency_key: options.idempotency_key ?? null,
  };
}

function evidenceRecordFromRow(
  row: SocialPublicationExecutionEvidenceRow,
): SocialPublicationExecutionEvidenceRecord {
  return {
    evidence_id: row.evidence_id as SocialPublicationExecutionEvidenceId,
    execution_intent_id: row.execution_intent_id as SocialPublicationExecutionIntentId,
    execution_result_id: row.execution_result_id as SocialPublicationExecutionResultId | null,
    evidence_kind: row.evidence_kind as SocialPublicationExecutionEvidenceKind,
    notes: row.notes,
    evidence: row.evidence,
    scope: scopeFromRow(row),
    recorded_at: row.recorded_at,
    recorded_by_actor: row.recorded_by_actor as SocialPublicationExecutionRowActor,
    recorded_source: row.recorded_source as SocialPublicationExecutionRowSource,
    contains_full_payload: false,
    contains_secrets: false,
    proves_execution: false,
    append_only: true,
    immutable: true,
  };
}

function evidenceRowFromRecord(
  record: SocialPublicationExecutionEvidenceRecord,
  options: SocialPublicationExecutionEvidenceRowOptions,
): SocialPublicationExecutionEvidenceRow {
  return {
    evidence_id: record.evidence_id,
    execution_intent_id: record.execution_intent_id,
    execution_result_id: record.execution_result_id,
    evidence_kind: record.evidence_kind,
    notes: record.notes,
    evidence: record.evidence,
    ...scopeColumnsFromRecord(record.scope),
    recorded_at: record.recorded_at,
    recorded_by_actor: options.recorded_by_actor ?? record.recorded_by_actor ?? DEFAULT_ROW_ACTOR,
    recorded_source: options.recorded_source ?? record.recorded_source ?? DEFAULT_ROW_SOURCE,
    contains_full_payload: false,
    contains_secrets: false,
    proves_execution: false,
    append_only: true,
    immutable: true,
    idempotency_key: options.idempotency_key ?? null,
  };
}

function scopeFromRow(
  row:
    | SocialPublicationExecutionIntentRow
    | SocialPublicationExecutionResultRow
    | SocialPublicationExecutionEvidenceRow,
): SocialPublicationExecutionScope {
  return {
    social_post_id: row.social_post_id as SocialPublicationExecutionSocialPostId,
    publication_target_id: row.publication_target_id as SocialPublicationExecutionTargetId,
    publisher_request_id: row.publisher_request_id as SocialPublicationExecutionPublisherRequestId | null,
    publisher_result_id: row.publisher_result_id as SocialPublicationExecutionPublisherResultId | null,
    publisher_job_id: row.publisher_job_id as SocialPublicationExecutionPublisherJobId | null,
    schedule_id: row.schedule_id as SocialPublicationExecutionScheduleId | null,
    ledger_entry_id: row.ledger_entry_id as SocialPublicationExecutionLedgerEntryId | null,
    publication_manifest_id: row.publication_manifest_id as SocialPublicationExecutionManifestId | null,
    owner_approval_id: row.owner_approval_id as SocialPublicationExecutionOwnerApprovalId | null,
    approval_id: row.approval_id as SocialPublicationExecutionApprovalId | null,
    metric_observation_id: row.metric_observation_id as SocialPublicationExecutionMetricObservationId | null,
    learning_insight_id: row.learning_insight_id as SocialPublicationExecutionLearningInsightId | null,
    campaign_memory_id: row.campaign_memory_id as SocialPublicationExecutionCampaignMemoryId | null,
    decision_history_id: row.decision_history_id as SocialPublicationExecutionDecisionHistoryId | null,
  };
}

function scopeColumnsFromRecord(scope: SocialPublicationExecutionScope): {
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
  metric_observation_id: string | null;
  learning_insight_id: string | null;
  campaign_memory_id: string | null;
  decision_history_id: string | null;
} {
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
    metric_observation_id: scope.metric_observation_id,
    learning_insight_id: scope.learning_insight_id,
    campaign_memory_id: scope.campaign_memory_id,
    decision_history_id: scope.decision_history_id,
  };
}

function isPublicationExecutionResultStatusText(
  value: string,
): value is PublicationExecutionResultStatus {
  return RESULT_STATUS_SET.has(value);
}

function sortIntentRows(
  rows: readonly SocialPublicationExecutionIntentRow[],
): SocialPublicationExecutionIntentRow[] {
  return [...rows].sort(
    (left, right) =>
      left.requested_at.localeCompare(right.requested_at) ||
      left.execution_intent_id.localeCompare(right.execution_intent_id),
  );
}

function sortResultRows(
  rows: readonly SocialPublicationExecutionResultRow[],
): SocialPublicationExecutionResultRow[] {
  return [...rows].sort(
    (left, right) =>
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.execution_result_id.localeCompare(right.execution_result_id),
  );
}

function sortEvidenceRows(
  rows: readonly SocialPublicationExecutionEvidenceRow[],
): SocialPublicationExecutionEvidenceRow[] {
  return [...rows].sort(
    (left, right) =>
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.evidence_id.localeCompare(right.evidence_id),
  );
}

function sortRowsModel(
  rows: SocialPublicationExecutionRowsModel,
): SocialPublicationExecutionRowsModel {
  return {
    intents: sortIntentRows(rows.intents),
    results: sortResultRows(rows.results),
    evidence: sortEvidenceRows(rows.evidence),
  };
}

function withPathPrefix(
  errors: readonly SocialPublicationExecutionRowError[],
  prefix: string,
): readonly SocialPublicationExecutionRowError[] {
  return errors.map((error) => ({ ...error, path: `${prefix}.${error.path}` }));
}

function rowError(
  code: SocialPublicationExecutionRowErrorCode,
  path: string,
  message: string,
): SocialPublicationExecutionRowError {
  return { code, path, message };
}

function validationResult(
  errors: SocialPublicationExecutionRowError[],
): SocialPublicationExecutionRowValidationResult {
  if (errors.length === 0) return { ok: true, errors: [] };
  return { ok: false, errors };
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

function getArray(record: UnknownRecord, key: string): readonly unknown[] | null {
  const value = record[key];
  return Array.isArray(value) ? value : null;
}

function getText(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  return hasText(value) ? value : null;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isJsonObject(value: unknown): value is PublicationExecutionJsonObject {
  return isRecord(value);
}
