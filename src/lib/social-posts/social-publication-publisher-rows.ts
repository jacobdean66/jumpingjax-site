import {
  type SocialPublicationPublisherApprovalId,
  type SocialPublicationPublisherAttemptId,
  type SocialPublicationPublisherChannelId,
  type SocialPublicationPublisherJobId,
  type SocialPublicationPublisherLedgerEntryId,
  type SocialPublicationPublisherManifestId,
  type SocialPublicationPublisherOwnerApprovalId,
  type SocialPublicationPublisherProposalId,
  type SocialPublicationPublisherRequestId,
  type SocialPublicationPublisherRequestRecord,
  type SocialPublicationPublisherResultId,
  type SocialPublicationPublisherResultRecord,
  type SocialPublicationPublisherScheduleId,
  type SocialPublicationPublisherScope,
  type SocialPublicationPublisherSocialPostId,
  type SocialPublicationPublisherTargetId,
} from "./social-publication-publisher-repository";
import {
  PUBLICATION_PUBLISHER_CHANNEL_PLATFORMS,
  PUBLICATION_PUBLISHER_CHANNEL_TYPES,
  PUBLICATION_PUBLISHER_REQUEST_TYPES,
  PUBLICATION_PUBLISHER_RESULT_TYPES,
  type PublicationPublisherChannelPlatform,
  type PublicationPublisherChannelType,
  type PublicationPublisherJsonObject,
  type PublicationPublisherRequestType,
  type PublicationPublisherResultType,
} from "./social-publication-publisher";

type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

type UnknownRecord = Readonly<Record<string, unknown>>;

export type SocialPublicationPublisherEvidenceId = Brand<
  string,
  "SocialPublicationPublisherEvidenceId"
>;

export const PUBLICATION_PUBLISHER_ROW_ACTORS = [
  "system",
  "owner",
  "admin",
  "scheduler",
  "publisher",
  "test",
] as const;

export const PUBLICATION_PUBLISHER_ROW_SOURCES = [
  "publication_publisher_domain",
  "manual_admin",
  "test",
] as const;

export const PUBLICATION_PUBLISHER_EVIDENCE_KINDS = [
  "request_contract",
  "result_contract",
  "error_contract",
  "authority_check",
  "operator_note",
  "none",
] as const;

export type SocialPublicationPublisherRowActor =
  (typeof PUBLICATION_PUBLISHER_ROW_ACTORS)[number];

export type SocialPublicationPublisherRowSource =
  (typeof PUBLICATION_PUBLISHER_ROW_SOURCES)[number];

export type SocialPublicationPublisherEvidenceKind =
  (typeof PUBLICATION_PUBLISHER_EVIDENCE_KINDS)[number];

export type SocialPublicationPublisherEvidenceRecord = Readonly<{
  evidence_id: SocialPublicationPublisherEvidenceId;
  publisher_request_id: SocialPublicationPublisherRequestId;
  publisher_result_id: SocialPublicationPublisherResultId | null;
  evidence_kind: SocialPublicationPublisherEvidenceKind;
  notes: string | null;
  evidence: PublicationPublisherJsonObject;
  scope: SocialPublicationPublisherScope;
  recorded_at: string;
  recorded_by_actor: SocialPublicationPublisherRowActor;
  recorded_source: SocialPublicationPublisherRowSource;
  contains_full_payload: false;
  contains_full_response: false;
  contains_secrets: false;
  proves_execution: false;
  append_only: true;
  immutable: true;
}>;

export type SocialPublicationPublisherRequestRow = Readonly<{
  publisher_request_id: string;
  publisher_job_id: string;
  request_type: string;
  channel_id: string;
  channel_platform: string;
  channel_type: string;
  social_post_id: string;
  publication_target_id: string;
  publication_manifest_id: string | null;
  schedule_id: string | null;
  ledger_entry_id: string | null;
  publication_attempt_id: string | null;
  owner_approval_id: string | null;
  approval_id: string | null;
  proposal_id: string | null;
  owner_approval_satisfied: boolean;
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
  append_only: boolean;
  immutable: boolean;
  idempotency_key: string | null;
}>;

export type SocialPublicationPublisherResultRow = Readonly<{
  publisher_result_id: string;
  publisher_request_id: string;
  publisher_job_id: string;
  result_type: string;
  result_status: string;
  channel_id: string;
  channel_platform: string;
  channel_type: string;
  social_post_id: string;
  publication_target_id: string;
  publication_manifest_id: string | null;
  schedule_id: string | null;
  ledger_entry_id: string | null;
  publication_attempt_id: string | null;
  owner_approval_id: string | null;
  approval_id: string | null;
  proposal_id: string | null;
  result_code: string | null;
  error_code: string | null;
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
  current_publish_status_authority: boolean;
  records_no_metrics: boolean;
  performs_no_learning: boolean;
  append_only: boolean;
  immutable: boolean;
  idempotency_key: string | null;
}>;

export type SocialPublicationPublisherEvidenceRow = Readonly<{
  evidence_id: string;
  publisher_request_id: string;
  publisher_result_id: string | null;
  evidence_kind: string;
  notes: string | null;
  evidence: PublicationPublisherJsonObject;
  social_post_id: string;
  publication_target_id: string;
  publication_manifest_id: string | null;
  schedule_id: string | null;
  ledger_entry_id: string | null;
  publication_attempt_id: string | null;
  owner_approval_id: string | null;
  approval_id: string | null;
  proposal_id: string | null;
  recorded_at: string;
  recorded_by_actor: string;
  recorded_source: string;
  contains_full_payload: boolean;
  contains_full_response: boolean;
  contains_secrets: boolean;
  proves_execution: boolean;
  append_only: boolean;
  immutable: boolean;
  idempotency_key: string | null;
}>;

export type SocialPublicationPublisherRowsModel = Readonly<{
  requests: readonly SocialPublicationPublisherRequestRow[];
  results: readonly SocialPublicationPublisherResultRow[];
  evidence: readonly SocialPublicationPublisherEvidenceRow[];
}>;

export type SocialPublicationPublisherRowsPersistenceModel = Readonly<{
  requests: readonly SocialPublicationPublisherRequestRecord[];
  results: readonly SocialPublicationPublisherResultRecord[];
  evidence: readonly SocialPublicationPublisherEvidenceRecord[];
}>;

export const SOCIAL_PUBLICATION_PUBLISHER_ROW_ERROR_CODES = [
  "required_field_missing",
  "field_shape_invalid",
  "identity_invalid",
  "identity_not_separated",
  "channel_invalid",
  "request_type_invalid",
  "result_type_invalid",
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
  "publish_execution_forbidden",
  "metrics_state_forbidden",
  "learning_state_forbidden",
  "mutable_publish_state_forbidden",
] as const;

export type SocialPublicationPublisherRowErrorCode =
  (typeof SOCIAL_PUBLICATION_PUBLISHER_ROW_ERROR_CODES)[number];

export type SocialPublicationPublisherRowError = Readonly<{
  code: SocialPublicationPublisherRowErrorCode;
  path: string;
  message: string;
}>;

export type SocialPublicationPublisherRowValidationResult = Readonly<
  | {
      ok: true;
      errors: readonly [];
    }
  | {
      ok: false;
      errors: readonly SocialPublicationPublisherRowError[];
    }
>;

export type SocialPublicationPublisherRowResult<T> = Readonly<
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      errors: readonly SocialPublicationPublisherRowError[];
    }
>;

export type SocialPublicationPublisherRequestRowOptions = Readonly<{
  recorded_by_actor?: SocialPublicationPublisherRowActor;
  recorded_source?: SocialPublicationPublisherRowSource;
  idempotency_key?: string | null;
}>;

export type SocialPublicationPublisherResultRowOptions =
  SocialPublicationPublisherRequestRowOptions;

export type SocialPublicationPublisherEvidenceRowOptions =
  SocialPublicationPublisherRequestRowOptions;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TYPE_SET = new Set<string>(PUBLICATION_PUBLISHER_REQUEST_TYPES);
const RESULT_TYPE_SET = new Set<string>(PUBLICATION_PUBLISHER_RESULT_TYPES);
const CHANNEL_PLATFORM_SET = new Set<string>(PUBLICATION_PUBLISHER_CHANNEL_PLATFORMS);
const CHANNEL_TYPE_SET = new Set<string>(PUBLICATION_PUBLISHER_CHANNEL_TYPES);
const ACTOR_SET = new Set<string>(PUBLICATION_PUBLISHER_ROW_ACTORS);
const SOURCE_SET = new Set<string>(PUBLICATION_PUBLISHER_ROW_SOURCES);
const EVIDENCE_KIND_SET = new Set<string>(PUBLICATION_PUBLISHER_EVIDENCE_KINDS);

const DEFAULT_ROW_ACTOR: SocialPublicationPublisherRowActor = "publisher";
const DEFAULT_ROW_SOURCE: SocialPublicationPublisherRowSource =
  "publication_publisher_domain";

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

export function validateSocialPublicationPublisherRequestRow(
  row: unknown,
): SocialPublicationPublisherRowValidationResult {
  const errors: SocialPublicationPublisherRowError[] = [];

  if (!isRecord(row)) {
    return validationResult([
      rowError("field_shape_invalid", "request", "Publisher request row must be an object."),
    ]);
  }

  validateRequestRowShape(row, "request", errors);
  return validationResult(errors);
}

export function validateSocialPublicationPublisherResultRow(
  row: unknown,
): SocialPublicationPublisherRowValidationResult {
  const errors: SocialPublicationPublisherRowError[] = [];

  if (!isRecord(row)) {
    return validationResult([
      rowError("field_shape_invalid", "result", "Publisher result row must be an object."),
    ]);
  }

  validateResultRowShape(row, "result", errors);
  return validationResult(errors);
}

export function validateSocialPublicationPublisherEvidenceRow(
  row: unknown,
): SocialPublicationPublisherRowValidationResult {
  const errors: SocialPublicationPublisherRowError[] = [];

  if (!isRecord(row)) {
    return validationResult([
      rowError("field_shape_invalid", "evidence", "Publisher evidence row must be an object."),
    ]);
  }

  validateEvidenceRowShape(row, "evidence", errors);
  return validationResult(errors);
}

export function validateSocialPublicationPublisherRowsModel(
  model: unknown,
): SocialPublicationPublisherRowValidationResult {
  const errors: SocialPublicationPublisherRowError[] = [];

  if (!isRecord(model)) {
    return validationResult([
      rowError("field_shape_invalid", "model", "Publisher rows model must be an object."),
    ]);
  }

  const requests = getArray(model, "requests");
  const results = getArray(model, "results");
  const evidence = getArray(model, "evidence");

  if (!requests) {
    errors.push(
      rowError("required_field_missing", "model.requests", "Publisher rows model must include request rows."),
    );
  }
  if (!results) {
    errors.push(
      rowError("required_field_missing", "model.results", "Publisher rows model must include result rows."),
    );
  }
  if (!evidence) {
    errors.push(
      rowError("required_field_missing", "model.evidence", "Publisher rows model must include evidence rows."),
    );
  }

  const requestIds = new Set<string>();
  requests?.forEach((row, index) => {
    const validation = validateSocialPublicationPublisherRequestRow(row);
    if (!validation.ok) errors.push(...withPathPrefix(validation.errors, `requests.${index}`));

    const requestId = getText(row as UnknownRecord, "publisher_request_id");
    if (requestId) {
      if (requestIds.has(requestId)) {
        errors.push(
          rowError(
            "identity_not_separated",
            `requests.${index}.publisher_request_id`,
            "Publisher request identities must be unique within the model.",
          ),
        );
      }
      requestIds.add(requestId);
    }
  });

  results?.forEach((row, index) => {
    const validation = validateSocialPublicationPublisherResultRow(row);
    if (!validation.ok) errors.push(...withPathPrefix(validation.errors, `results.${index}`));

    const requestId = getText(row as UnknownRecord, "publisher_request_id");
    if (requestId && !requestIds.has(requestId)) {
      errors.push(
        rowError(
          "relationship_invalid",
          `results.${index}.publisher_request_id`,
          "Publisher result must reference a request present in the model.",
        ),
      );
    }
  });

  evidence?.forEach((row, index) => {
    const validation = validateSocialPublicationPublisherEvidenceRow(row);
    if (!validation.ok) errors.push(...withPathPrefix(validation.errors, `evidence.${index}`));

    const requestId = getText(row as UnknownRecord, "publisher_request_id");
    if (requestId && !requestIds.has(requestId)) {
      errors.push(
        rowError(
          "relationship_invalid",
          `evidence.${index}.publisher_request_id`,
          "Publisher evidence must reference a request present in the model.",
        ),
      );
    }
  });

  return validationResult(errors);
}

export function mapSocialPublicationPublisherRequestRowToRecord(
  row: SocialPublicationPublisherRequestRow,
): SocialPublicationPublisherRowResult<SocialPublicationPublisherRequestRecord> {
  const validation = validateSocialPublicationPublisherRequestRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(requestRecordFromRow(row)) };
}

export function mapSocialPublicationPublisherRequestRecordToRow(
  record: SocialPublicationPublisherRequestRecord,
  options: SocialPublicationPublisherRequestRowOptions = {},
): SocialPublicationPublisherRowResult<SocialPublicationPublisherRequestRow> {
  const row = requestRowFromRecord(record, options);
  const validation = validateSocialPublicationPublisherRequestRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(row) };
}

export function mapSocialPublicationPublisherResultRowToRecord(
  row: SocialPublicationPublisherResultRow,
): SocialPublicationPublisherRowResult<SocialPublicationPublisherResultRecord> {
  const validation = validateSocialPublicationPublisherResultRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(resultRecordFromRow(row)) };
}

export function mapSocialPublicationPublisherResultRecordToRow(
  record: SocialPublicationPublisherResultRecord,
  options: SocialPublicationPublisherResultRowOptions = {},
): SocialPublicationPublisherRowResult<SocialPublicationPublisherResultRow> {
  const row = resultRowFromRecord(record, options);
  const validation = validateSocialPublicationPublisherResultRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(row) };
}

export function mapSocialPublicationPublisherEvidenceRowToRecord(
  row: SocialPublicationPublisherEvidenceRow,
): SocialPublicationPublisherRowResult<SocialPublicationPublisherEvidenceRecord> {
  const validation = validateSocialPublicationPublisherEvidenceRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(evidenceRecordFromRow(row)) };
}

export function mapSocialPublicationPublisherEvidenceRecordToRow(
  record: SocialPublicationPublisherEvidenceRecord,
  options: SocialPublicationPublisherEvidenceRowOptions = {},
): SocialPublicationPublisherRowResult<SocialPublicationPublisherEvidenceRow> {
  const row = evidenceRowFromRecord(record, options);
  const validation = validateSocialPublicationPublisherEvidenceRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(row) };
}

export function mapSocialPublicationPublisherRowsToPersistenceModel(
  rows: SocialPublicationPublisherRowsModel,
): SocialPublicationPublisherRowResult<SocialPublicationPublisherRowsPersistenceModel> {
  const validation = validateSocialPublicationPublisherRowsModel(rows);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return {
    ok: true,
    value: immutableClone({
      requests: sortRequestRows(rows.requests).map(requestRecordFromRow),
      results: sortResultRows(rows.results).map(resultRecordFromRow),
      evidence: sortEvidenceRows(rows.evidence).map(evidenceRecordFromRow),
    }),
  };
}

export function serializeSocialPublicationPublisherRowsModel(
  rows: SocialPublicationPublisherRowsModel,
): string {
  const validation = validateSocialPublicationPublisherRowsModel(rows);
  if (!validation.ok) {
    throw new Error("Publication publisher rows model failed validation.");
  }

  return stableStringify(sortRowsModel(rows));
}

export function hydrateSocialPublicationPublisherRowsModel(
  serialized: string,
): SocialPublicationPublisherRowResult<SocialPublicationPublisherRowsModel> {
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
          "Serialized publisher rows model must be valid JSON.",
        ),
      ],
    };
  }

  const validation = validateSocialPublicationPublisherRowsModel(parsed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return {
    ok: true,
    value: immutableClone(sortRowsModel(parsed as SocialPublicationPublisherRowsModel)),
  };
}

function validateRequestRowShape(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationPublisherRowError[],
): void {
  validateUuid(row.publisher_request_id, `${path}.publisher_request_id`, errors);
  validateUuid(row.publisher_job_id, `${path}.publisher_job_id`, errors);
  validateEnum(row.request_type, REQUEST_TYPE_SET, `${path}.request_type`, "request_type_invalid", errors);
  validateRequiredText(row.channel_id, `${path}.channel_id`, errors);
  validateChannel(row, path, errors);
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
  validateTimestamp(row.requested_at, `${path}.requested_at`, errors);
  validateTimestamp(row.updated_at, `${path}.updated_at`, errors);
  validateAuditFields(row, path, errors);
  validateIdempotencyKey(row.idempotency_key, `${path}.idempotency_key`, errors);
  validateIdentitySeparation(
    path,
    errors,
    row.publisher_request_id,
    row.publisher_job_id,
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
    row.append_only !== true ||
    row.immutable !== true
  ) {
    errors.push(
      rowError(
        "field_shape_invalid",
        path,
        "Publisher request rows must remain contract-only, references-only, and non-executable.",
      ),
    );
  }

  rejectUnsafeState(row, path, errors);
}

function validateResultRowShape(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationPublisherRowError[],
): void {
  validateUuid(row.publisher_result_id, `${path}.publisher_result_id`, errors);
  validateUuid(row.publisher_request_id, `${path}.publisher_request_id`, errors);
  validateUuid(row.publisher_job_id, `${path}.publisher_job_id`, errors);
  validateEnum(row.result_type, RESULT_TYPE_SET, `${path}.result_type`, "result_type_invalid", errors);
  if (row.result_status !== "prepared" && row.result_status !== "rejected") {
    errors.push(rowError("result_type_invalid", `${path}.result_status`, "Publisher result status is invalid."));
  }
  validateRequiredText(row.channel_id, `${path}.channel_id`, errors);
  validateChannel(row, path, errors);
  validateScopeColumns(row, path, errors);
  validateOptionalText(row.result_code, `${path}.result_code`, errors);
  validateOptionalText(row.error_code, `${path}.error_code`, errors);
  validateTimestamp(row.recorded_at, `${path}.recorded_at`, errors);
  validateTimestamp(row.updated_at, `${path}.updated_at`, errors);
  validateAuditFields(row, path, errors);
  validateIdempotencyKey(row.idempotency_key, `${path}.idempotency_key`, errors);
  validateIdentitySeparation(
    path,
    errors,
    row.publisher_result_id,
    row.publisher_request_id,
    row.publisher_job_id,
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
    row.current_publish_status_authority !== false ||
    row.records_no_metrics !== true ||
    row.performs_no_learning !== true ||
    row.append_only !== true ||
    row.immutable !== true
  ) {
    errors.push(
      rowError(
        "field_shape_invalid",
        path,
        "Publisher result rows must remain contract-only, references-only, and non-executable.",
      ),
    );
  }

  rejectUnsafeState(row, path, errors);
}

function validateEvidenceRowShape(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationPublisherRowError[],
): void {
  validateUuid(row.evidence_id, `${path}.evidence_id`, errors);
  validateUuid(row.publisher_request_id, `${path}.publisher_request_id`, errors);
  validateOptionalUuid(row.publisher_result_id, `${path}.publisher_result_id`, errors);
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
    row.publisher_request_id,
    row.publisher_result_id,
    row.social_post_id,
    row.publication_target_id,
  );

  if (
    row.contains_full_payload !== false ||
    row.contains_full_response !== false ||
    row.contains_secrets !== false ||
    row.proves_execution !== false ||
    row.append_only !== true ||
    row.immutable !== true
  ) {
    errors.push(
      rowError(
        "field_shape_invalid",
        path,
        "Publisher evidence rows must remain sanitized, append-only, and non-execution evidence.",
      ),
    );
  }

  rejectUnsafeState(row, path, errors);
}

function validateChannel(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationPublisherRowError[],
): void {
  validateEnum(row.channel_platform, CHANNEL_PLATFORM_SET, `${path}.channel_platform`, "channel_invalid", errors);
  validateEnum(row.channel_type, CHANNEL_TYPE_SET, `${path}.channel_type`, "channel_invalid", errors);

  if (
    (row.channel_type === "facebook_page" && row.channel_platform !== "facebook") ||
    (row.channel_type === "instagram_business_account" && row.channel_platform !== "instagram")
  ) {
    errors.push(rowError("channel_invalid", `${path}.channel_type`, "Publisher channel type must match its platform."));
  }
}

function validateScopeColumns(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationPublisherRowError[],
): void {
  validateUuid(row.social_post_id, `${path}.social_post_id`, errors);
  validateUuid(row.publication_target_id, `${path}.publication_target_id`, errors);
  validateOptionalText(row.publication_manifest_id, `${path}.publication_manifest_id`, errors);
  validateOptionalUuid(row.schedule_id, `${path}.schedule_id`, errors);
  validateOptionalUuid(row.ledger_entry_id, `${path}.ledger_entry_id`, errors);
  validateOptionalUuid(row.publication_attempt_id, `${path}.publication_attempt_id`, errors);
  validateOptionalUuid(row.owner_approval_id, `${path}.owner_approval_id`, errors);
  validateOptionalUuid(row.approval_id, `${path}.approval_id`, errors);
  validateOptionalUuid(row.proposal_id, `${path}.proposal_id`, errors);
}

function validateAuditFields(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationPublisherRowError[],
): void {
  if (!hasText(row.recorded_by_actor) || !ACTOR_SET.has(row.recorded_by_actor)) {
    errors.push(
      rowError("audit_field_invalid", `${path}.recorded_by_actor`, "Recorded actor must use the publisher actor vocabulary."),
    );
  }
  if (!hasText(row.recorded_source) || !SOURCE_SET.has(row.recorded_source)) {
    errors.push(
      rowError("audit_field_invalid", `${path}.recorded_source`, "Recorded source must use the publisher source vocabulary."),
    );
  }
}

function validateEnum(
  value: unknown,
  allowed: ReadonlySet<string>,
  path: string,
  code: SocialPublicationPublisherRowErrorCode,
  errors: SocialPublicationPublisherRowError[],
): void {
  if (!hasText(value) || !allowed.has(value)) {
    errors.push(rowError(code, path, "Publisher row enum value is not supported."));
  }
}

function validateJsonObject(
  value: unknown,
  path: string,
  errors: SocialPublicationPublisherRowError[],
): void {
  if (!isJsonObject(value)) {
    errors.push(rowError("summary_shape_invalid", path, "Value must be a JSON object."));
  }
}

function validateUuid(
  value: unknown,
  path: string,
  errors: SocialPublicationPublisherRowError[],
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
  errors: SocialPublicationPublisherRowError[],
): void {
  if (value === null || value === undefined) return;
  if (!hasText(value) || !UUID_PATTERN.test(value)) {
    errors.push(rowError("identity_invalid", path, "Optional UUID field must be null or UUID text."));
  }
}

function validateRequiredText(
  value: unknown,
  path: string,
  errors: SocialPublicationPublisherRowError[],
): void {
  if (!hasText(value)) {
    errors.push(rowError("required_field_missing", path, "Required text field is missing."));
  }
}

function validateOptionalText(
  value: unknown,
  path: string,
  errors: SocialPublicationPublisherRowError[],
): void {
  if (value === null || value === undefined) return;
  if (!hasText(value)) {
    errors.push(rowError("required_field_missing", path, "Optional text field must be null or non-empty text."));
  }
}

function validateTimestamp(
  value: unknown,
  path: string,
  errors: SocialPublicationPublisherRowError[],
): void {
  if (!hasText(value) || Number.isNaN(Date.parse(value))) {
    errors.push(rowError("audit_field_invalid", path, "Timestamp must be a parseable ISO string."));
  }
}

function validateIdempotencyKey(
  value: unknown,
  path: string,
  errors: SocialPublicationPublisherRowError[],
): void {
  if (value !== null && !hasText(value)) {
    errors.push(rowError("idempotency_key_invalid", path, "Idempotency key must be null or non-empty text."));
  }
}

function validateIdentitySeparation(
  path: string,
  errors: SocialPublicationPublisherRowError[],
  ...values: readonly unknown[]
): void {
  const textValues = values.filter(hasText);
  if (new Set(textValues).size !== textValues.length) {
    errors.push(
      rowError(
        "identity_not_separated",
        path,
        "Publisher row identities and scope identities must remain separated.",
      ),
    );
  }
}

function rejectUnsafeState(
  value: unknown,
  path: string,
  errors: SocialPublicationPublisherRowError[],
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
  code: SocialPublicationPublisherRowErrorCode,
  errors: SocialPublicationPublisherRowError[],
  seen = new WeakSet<object>(),
): void {
  if (!value || typeof value !== "object") return;

  if (seen.has(value)) {
    errors.push(rowError("unsafe_recursive_state_forbidden", path, "Publisher row JSON must be acyclic."));
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
      errors.push(rowError(code, childPath, "Publisher rows must not store unsafe execution state."));
    }
    rejectForbiddenKeys(child, childPath, forbiddenKeys, code, errors, seen);
  }
}

function requestRecordFromRow(
  row: SocialPublicationPublisherRequestRow,
): SocialPublicationPublisherRequestRecord {
  return {
    publisher_request_id: row.publisher_request_id as SocialPublicationPublisherRequestId,
    publisher_job_id: row.publisher_job_id as SocialPublicationPublisherJobId,
    request_type: row.request_type as PublicationPublisherRequestType,
    channel_id: row.channel_id as SocialPublicationPublisherChannelId,
    channel_platform: row.channel_platform as PublicationPublisherChannelPlatform,
    channel_type: row.channel_type as PublicationPublisherChannelType,
    scope: scopeFromRow(row),
    owner_approval_satisfied: row.owner_approval_satisfied,
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
  };
}

function requestRowFromRecord(
  record: SocialPublicationPublisherRequestRecord,
  options: SocialPublicationPublisherRequestRowOptions,
): SocialPublicationPublisherRequestRow {
  return {
    publisher_request_id: record.publisher_request_id,
    publisher_job_id: record.publisher_job_id,
    request_type: record.request_type,
    channel_id: record.channel_id,
    channel_platform: record.channel_platform,
    channel_type: record.channel_type,
    ...scopeColumnsFromRecord(record.scope),
    owner_approval_satisfied: record.owner_approval_satisfied,
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
    append_only: true,
    immutable: true,
    idempotency_key: options.idempotency_key ?? null,
  };
}

function resultRecordFromRow(
  row: SocialPublicationPublisherResultRow,
): SocialPublicationPublisherResultRecord {
  return {
    publisher_result_id: row.publisher_result_id as SocialPublicationPublisherResultId,
    publisher_request_id: row.publisher_request_id as SocialPublicationPublisherRequestId,
    publisher_job_id: row.publisher_job_id as SocialPublicationPublisherJobId,
    result_type: row.result_type as PublicationPublisherResultType,
    result_status: row.result_status as "prepared" | "rejected",
    channel_id: row.channel_id as SocialPublicationPublisherChannelId,
    channel_platform: row.channel_platform as PublicationPublisherChannelPlatform,
    channel_type: row.channel_type as PublicationPublisherChannelType,
    scope: scopeFromRow(row),
    result_code: row.result_code,
    error_code: row.error_code,
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
    current_publish_status_authority: false,
    records_no_metrics: true,
    performs_no_learning: true,
  };
}

function resultRowFromRecord(
  record: SocialPublicationPublisherResultRecord,
  options: SocialPublicationPublisherResultRowOptions,
): SocialPublicationPublisherResultRow {
  return {
    publisher_result_id: record.publisher_result_id,
    publisher_request_id: record.publisher_request_id,
    publisher_job_id: record.publisher_job_id,
    result_type: record.result_type,
    result_status: record.result_status,
    channel_id: record.channel_id,
    channel_platform: record.channel_platform,
    channel_type: record.channel_type,
    ...scopeColumnsFromRecord(record.scope),
    result_code: record.result_code,
    error_code: record.error_code,
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
    current_publish_status_authority: false,
    records_no_metrics: true,
    performs_no_learning: true,
    append_only: true,
    immutable: true,
    idempotency_key: options.idempotency_key ?? null,
  };
}

function evidenceRecordFromRow(
  row: SocialPublicationPublisherEvidenceRow,
): SocialPublicationPublisherEvidenceRecord {
  return {
    evidence_id: row.evidence_id as SocialPublicationPublisherEvidenceId,
    publisher_request_id: row.publisher_request_id as SocialPublicationPublisherRequestId,
    publisher_result_id: row.publisher_result_id as SocialPublicationPublisherResultId | null,
    evidence_kind: row.evidence_kind as SocialPublicationPublisherEvidenceKind,
    notes: row.notes,
    evidence: row.evidence,
    scope: scopeFromRow(row),
    recorded_at: row.recorded_at,
    recorded_by_actor: row.recorded_by_actor as SocialPublicationPublisherRowActor,
    recorded_source: row.recorded_source as SocialPublicationPublisherRowSource,
    contains_full_payload: false,
    contains_full_response: false,
    contains_secrets: false,
    proves_execution: false,
    append_only: true,
    immutable: true,
  };
}

function evidenceRowFromRecord(
  record: SocialPublicationPublisherEvidenceRecord,
  options: SocialPublicationPublisherEvidenceRowOptions,
): SocialPublicationPublisherEvidenceRow {
  return {
    evidence_id: record.evidence_id,
    publisher_request_id: record.publisher_request_id,
    publisher_result_id: record.publisher_result_id,
    evidence_kind: record.evidence_kind,
    notes: record.notes,
    evidence: record.evidence,
    ...scopeColumnsFromRecord(record.scope),
    recorded_at: record.recorded_at,
    recorded_by_actor: options.recorded_by_actor ?? record.recorded_by_actor ?? DEFAULT_ROW_ACTOR,
    recorded_source: options.recorded_source ?? record.recorded_source ?? DEFAULT_ROW_SOURCE,
    contains_full_payload: false,
    contains_full_response: false,
    contains_secrets: false,
    proves_execution: false,
    append_only: true,
    immutable: true,
    idempotency_key: options.idempotency_key ?? null,
  };
}

function scopeFromRow(
  row:
    | SocialPublicationPublisherRequestRow
    | SocialPublicationPublisherResultRow
    | SocialPublicationPublisherEvidenceRow,
): SocialPublicationPublisherScope {
  return {
    social_post_id: row.social_post_id as SocialPublicationPublisherSocialPostId,
    publication_target_id: row.publication_target_id as SocialPublicationPublisherTargetId,
    publication_manifest_id:
      row.publication_manifest_id as SocialPublicationPublisherManifestId | null,
    schedule_id: row.schedule_id as SocialPublicationPublisherScheduleId | null,
    ledger_entry_id: row.ledger_entry_id as SocialPublicationPublisherLedgerEntryId | null,
    publication_attempt_id:
      row.publication_attempt_id as SocialPublicationPublisherAttemptId | null,
    owner_approval_id: row.owner_approval_id as SocialPublicationPublisherOwnerApprovalId | null,
    approval_id: row.approval_id as SocialPublicationPublisherApprovalId | null,
    proposal_id: row.proposal_id as SocialPublicationPublisherProposalId | null,
  };
}

function scopeColumnsFromRecord(scope: SocialPublicationPublisherScope): {
  social_post_id: string;
  publication_target_id: string;
  publication_manifest_id: string | null;
  schedule_id: string | null;
  ledger_entry_id: string | null;
  publication_attempt_id: string | null;
  owner_approval_id: string | null;
  approval_id: string | null;
  proposal_id: string | null;
} {
  return {
    social_post_id: scope.social_post_id,
    publication_target_id: scope.publication_target_id,
    publication_manifest_id: scope.publication_manifest_id,
    schedule_id: scope.schedule_id,
    ledger_entry_id: scope.ledger_entry_id,
    publication_attempt_id: scope.publication_attempt_id,
    owner_approval_id: scope.owner_approval_id,
    approval_id: scope.approval_id,
    proposal_id: scope.proposal_id,
  };
}

function sortRequestRows(
  rows: readonly SocialPublicationPublisherRequestRow[],
): SocialPublicationPublisherRequestRow[] {
  return [...rows].sort(
    (left, right) =>
      left.requested_at.localeCompare(right.requested_at) ||
      left.publisher_request_id.localeCompare(right.publisher_request_id),
  );
}

function sortResultRows(
  rows: readonly SocialPublicationPublisherResultRow[],
): SocialPublicationPublisherResultRow[] {
  return [...rows].sort(
    (left, right) =>
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.publisher_result_id.localeCompare(right.publisher_result_id),
  );
}

function sortEvidenceRows(
  rows: readonly SocialPublicationPublisherEvidenceRow[],
): SocialPublicationPublisherEvidenceRow[] {
  return [...rows].sort(
    (left, right) =>
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.evidence_id.localeCompare(right.evidence_id),
  );
}

function sortRowsModel(
  rows: SocialPublicationPublisherRowsModel,
): SocialPublicationPublisherRowsModel {
  return {
    requests: sortRequestRows(rows.requests),
    results: sortResultRows(rows.results),
    evidence: sortEvidenceRows(rows.evidence),
  };
}

function withPathPrefix(
  errors: readonly SocialPublicationPublisherRowError[],
  prefix: string,
): readonly SocialPublicationPublisherRowError[] {
  return errors.map((error) => ({ ...error, path: `${prefix}.${error.path}` }));
}

function rowError(
  code: SocialPublicationPublisherRowErrorCode,
  path: string,
  message: string,
): SocialPublicationPublisherRowError {
  return { code, path, message };
}

function validationResult(
  errors: SocialPublicationPublisherRowError[],
): SocialPublicationPublisherRowValidationResult {
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

function isJsonObject(value: unknown): value is PublicationPublisherJsonObject {
  return isRecord(value);
}
