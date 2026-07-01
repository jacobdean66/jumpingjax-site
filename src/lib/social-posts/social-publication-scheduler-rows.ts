import {
  validateSocialPublicationSchedulerScheduleRecord,
  type SocialPublicationSchedulerApprovalId,
  type SocialPublicationSchedulerManifestId,
  type SocialPublicationSchedulerOwnerApprovalId,
  type SocialPublicationSchedulerProposalId,
  type SocialPublicationSchedulerScheduleRecord,
  type SocialPublicationSchedulerScope,
  type SocialPublicationSchedulerSocialPostId,
  type SocialPublicationSchedulerTargetId,
  type SocialPublicationSchedulerPersistenceError,
} from "./social-publication-scheduler-repository";
import {
  PUBLICATION_SCHEDULER_ACTORS,
  PUBLICATION_SCHEDULER_INTENT_TYPES,
  PUBLICATION_SCHEDULER_SOURCES,
  PUBLICATION_SCHEDULER_STATE_TYPES,
  type PublicationScheduleJsonObject,
  type PublicationScheduleReadContext,
} from "./social-publication-scheduler";

type UnknownRecord = Readonly<Record<string, unknown>>;

export type SocialPublicationSchedulerScheduleRow = Readonly<{
  schedule_entry_id: string;
  schedule_id: string;
  intent_type: string;
  state: string;
  social_post_id: string;
  publication_target_id: string;
  publication_manifest_id: string | null;
  owner_approval_id: string | null;
  approval_id: string | null;
  proposal_id: string | null;
  intended_publish_at: string;
  read_context: PublicationScheduleJsonObject | null;
  recorded_at: string;
  updated_at: string;
  recorded_by_actor: string;
  recorded_source: string;
  intent_only: boolean;
  immutable: boolean;
  grants_publishing_permission: boolean;
  approves_nothing: boolean;
  publishes_nothing: boolean;
  executes_nothing: boolean;
  schedules_intent_only: boolean;
  mutates_ledger: boolean;
  mutates_approval: boolean;
  mutates_manifest: boolean;
  mutates_targets: boolean;
  records_no_metrics: boolean;
  performs_no_learning: boolean;
  idempotency_key: string | null;
}>;

export type SocialPublicationSchedulerRowsModel = Readonly<{
  schedules: readonly SocialPublicationSchedulerScheduleRow[];
}>;

export const SOCIAL_PUBLICATION_SCHEDULER_ROW_ERROR_CODES = [
  "required_field_missing",
  "field_shape_invalid",
  "identity_invalid",
  "identity_not_separated",
  "intent_type_invalid",
  "state_invalid",
  "intended_publish_at_invalid",
  "append_only_invariant_failed",
  "audit_field_invalid",
  "summary_shape_invalid",
  "idempotency_key_invalid",
  "serialization_invalid",
  "unsafe_recursive_state_forbidden",
  "secret_forbidden",
  "publish_authority_forbidden",
  "execution_plan_forbidden",
  "metrics_state_forbidden",
  "learning_state_forbidden",
  "lower_layer_payload_forbidden",
] as const;

export type SocialPublicationSchedulerRowErrorCode =
  (typeof SOCIAL_PUBLICATION_SCHEDULER_ROW_ERROR_CODES)[number];

export type SocialPublicationSchedulerRowError = Readonly<{
  code: SocialPublicationSchedulerRowErrorCode;
  path: string;
  message: string;
  persistenceErrors?: readonly SocialPublicationSchedulerPersistenceError[];
}>;

export type SocialPublicationSchedulerRowValidationResult = Readonly<
  | {
      ok: true;
      errors: readonly [];
    }
  | {
      ok: false;
      errors: readonly SocialPublicationSchedulerRowError[];
    }
>;

export type SocialPublicationSchedulerRowResult<T> = Readonly<
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      errors: readonly SocialPublicationSchedulerRowError[];
    }
>;

export type SocialPublicationSchedulerRowOptions = Readonly<{
  schedule_entry_id?: string | null;
  idempotency_key?: string | null;
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const INTENT_TYPE_SET = new Set<string>(PUBLICATION_SCHEDULER_INTENT_TYPES);
const STATE_SET = new Set<string>(PUBLICATION_SCHEDULER_STATE_TYPES);
const ACTOR_SET = new Set<string>(PUBLICATION_SCHEDULER_ACTORS);
const SOURCE_SET = new Set<string>(PUBLICATION_SCHEDULER_SOURCES);

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

const FORBIDDEN_PUBLISH_AUTHORITY_KEYS = new Set([
  "canPublish",
  "canSchedule",
  "grantsPublishingPermission",
  "publishAuthority",
  "publisherAuthority",
  "schedulerAuthority",
]);

const FORBIDDEN_EXECUTION_KEYS = new Set([
  "cron",
  "cronExpression",
  "cron_expression",
  "executionPlan",
  "execution_plan",
  "jobId",
  "queueName",
  "retryPolicy",
  "timerId",
  "timerReference",
  "workerId",
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

const FORBIDDEN_LOWER_LAYER_PAYLOAD_KEYS = new Set([
  "approvalDecision",
  "approvalPayload",
  "approvalState",
  "ledgerEntry",
  "ledgerPayload",
  "manifest",
  "manifestPayload",
  "ownerApproval",
  "publicationManifest",
  "publicationTarget",
  "targetDefinition",
  "targetPayload",
]);

export function validateSocialPublicationSchedulerScheduleRow(
  row: unknown,
): SocialPublicationSchedulerRowValidationResult {
  const errors: SocialPublicationSchedulerRowError[] = [];

  if (!isRecord(row)) {
    return validationResult([
      rowError("field_shape_invalid", "schedule", "Schedule row must be an object."),
    ]);
  }

  validateScheduleRowShape(row, "schedule", errors);

  if (errors.length === 0) {
    const record = scheduleRecordFromRow(row as SocialPublicationSchedulerScheduleRow);
    appendPersistenceValidation(
      validateSocialPublicationSchedulerScheduleRecord(record),
      errors,
      "schedule",
    );
  }

  return validationResult(errors);
}

export function validateSocialPublicationSchedulerRowsModel(
  model: unknown,
): SocialPublicationSchedulerRowValidationResult {
  const errors: SocialPublicationSchedulerRowError[] = [];

  if (!isRecord(model)) {
    return validationResult([
      rowError("field_shape_invalid", "model", "Scheduler rows model must be an object."),
    ]);
  }

  const schedules = getArray(model, "schedules");

  if (!schedules) {
    errors.push(
      rowError(
        "required_field_missing",
        "model.schedules",
        "Scheduler rows model must include schedule rows.",
      ),
    );
    return validationResult(errors);
  }

  const seenEntryIds = new Set<string>();
  schedules.forEach((row, index) => {
    const validation = validateSocialPublicationSchedulerScheduleRow(row);
    if (!validation.ok) {
      errors.push(...withPathPrefix(validation.errors, `schedules.${index}`));
      return;
    }

    const entryId = getText(row as UnknownRecord, "schedule_entry_id");
    if (entryId) {
      if (seenEntryIds.has(entryId)) {
        errors.push(
          rowError(
            "identity_not_separated",
            `schedules.${index}.schedule_entry_id`,
            "Scheduler row identities must be unique within the model.",
          ),
        );
      }
      seenEntryIds.add(entryId);
    }
  });

  return validationResult(errors);
}

export function mapSocialPublicationSchedulerScheduleRowToRecord(
  row: SocialPublicationSchedulerScheduleRow,
): SocialPublicationSchedulerRowResult<SocialPublicationSchedulerScheduleRecord> {
  const validation = validateSocialPublicationSchedulerScheduleRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(scheduleRecordFromRow(row)) };
}

export function mapSocialPublicationSchedulerScheduleRecordToRow(
  record: SocialPublicationSchedulerScheduleRecord,
  options: SocialPublicationSchedulerRowOptions = {},
): SocialPublicationSchedulerRowResult<SocialPublicationSchedulerScheduleRow> {
  const row = scheduleRowFromRecord(record, options);
  const validation = validateSocialPublicationSchedulerScheduleRow(row);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return { ok: true, value: immutableClone(row) };
}

export function mapSocialPublicationSchedulerRowsToPersistenceModel(
  rows: SocialPublicationSchedulerRowsModel,
): SocialPublicationSchedulerRowResult<Readonly<{
  schedules: readonly SocialPublicationSchedulerScheduleRecord[];
}>> {
  const validation = validateSocialPublicationSchedulerRowsModel(rows);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  return {
    ok: true,
    value: immutableClone({
      schedules: sortRows(rows.schedules).map(scheduleRecordFromRow),
    }),
  };
}

export function serializeSocialPublicationSchedulerRowsModel(
  rows: SocialPublicationSchedulerRowsModel,
): string {
  const validation = validateSocialPublicationSchedulerRowsModel(rows);
  if (!validation.ok) {
    throw new Error("Publication scheduler rows model failed validation.");
  }

  return stableStringify({ schedules: sortRows(rows.schedules) });
}

export function hydrateSocialPublicationSchedulerRowsModel(
  serialized: string,
): SocialPublicationSchedulerRowResult<SocialPublicationSchedulerRowsModel> {
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
          "Serialized publication scheduler rows model must be valid JSON.",
        ),
      ],
    };
  }

  const validation = validateSocialPublicationSchedulerRowsModel(parsed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const model = parsed as SocialPublicationSchedulerRowsModel;
  return {
    ok: true,
    value: immutableClone({ schedules: sortRows(model.schedules) }),
  };
}

function validateScheduleRowShape(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationSchedulerRowError[],
): void {
  validateUuid(row.schedule_entry_id, `${path}.schedule_entry_id`, errors);
  validateUuid(row.schedule_id, `${path}.schedule_id`, errors);
  validateIntentType(row.intent_type, `${path}.intent_type`, errors);
  validateState(row.state, `${path}.state`, errors);
  validateUuid(row.social_post_id, `${path}.social_post_id`, errors);
  validateUuid(row.publication_target_id, `${path}.publication_target_id`, errors);
  validateOptionalText(
    row.publication_manifest_id,
    `${path}.publication_manifest_id`,
    errors,
  );
  validateOptionalUuid(row.owner_approval_id, `${path}.owner_approval_id`, errors);
  validateOptionalUuid(row.approval_id, `${path}.approval_id`, errors);
  validateOptionalUuid(row.proposal_id, `${path}.proposal_id`, errors);
  validateIntendedPublishAt(row.intended_publish_at, `${path}.intended_publish_at`, errors);
  validateReadContext(row.read_context, `${path}.read_context`, errors);
  validateCommonRowFields(row, path, errors);
  validateIdempotencyKey(row.idempotency_key, `${path}.idempotency_key`, errors);

  validateIdentitySeparation(
    path,
    errors,
    row.schedule_entry_id,
    row.schedule_id,
    row.social_post_id,
    row.publication_target_id,
    row.publication_manifest_id,
  );

  rejectUnsafeJson(row.read_context, `${path}.read_context`, errors);
}

function validateCommonRowFields(
  row: UnknownRecord,
  path: string,
  errors: SocialPublicationSchedulerRowError[],
): void {
  validateRequiredText(row.recorded_at, `${path}.recorded_at`, errors);
  if (hasText(row.recorded_at) && Number.isNaN(Date.parse(row.recorded_at))) {
    errors.push(
      rowError(
        "audit_field_invalid",
        `${path}.recorded_at`,
        "Recorded timestamp must be parseable.",
      ),
    );
  }

  validateRequiredText(row.updated_at, `${path}.updated_at`, errors);
  if (hasText(row.updated_at) && Number.isNaN(Date.parse(row.updated_at))) {
    errors.push(
      rowError(
        "audit_field_invalid",
        `${path}.updated_at`,
        "Updated timestamp must be parseable.",
      ),
    );
  }

  if (!hasText(row.recorded_by_actor) || !ACTOR_SET.has(row.recorded_by_actor)) {
    errors.push(
      rowError(
        "audit_field_invalid",
        `${path}.recorded_by_actor`,
        "Recorded actor must use the D9 M1 actor vocabulary.",
      ),
    );
  }

  if (!hasText(row.recorded_source) || !SOURCE_SET.has(row.recorded_source)) {
    errors.push(
      rowError(
        "audit_field_invalid",
        `${path}.recorded_source`,
        "Recorded source must use the D9 M1 source vocabulary.",
      ),
    );
  }

  if (
    row.intent_only !== true ||
    row.immutable !== true ||
    row.grants_publishing_permission !== false ||
    row.approves_nothing !== true ||
    row.publishes_nothing !== true ||
    row.executes_nothing !== true ||
    row.schedules_intent_only !== true ||
    row.mutates_ledger !== false ||
    row.mutates_approval !== false ||
    row.mutates_manifest !== false ||
    row.mutates_targets !== false ||
    row.records_no_metrics !== true ||
    row.performs_no_learning !== true
  ) {
    errors.push(
      rowError(
        "append_only_invariant_failed",
        path,
        "Scheduler rows must remain intent-only, immutable, and non-authoritative.",
      ),
    );
  }
}

function validateIntentType(
  value: unknown,
  path: string,
  errors: SocialPublicationSchedulerRowError[],
): void {
  if (!hasText(value) || !INTENT_TYPE_SET.has(value)) {
    errors.push(
      rowError("intent_type_invalid", path, "Intent type must be a supported scheduler intent type."),
    );
  }
}

function validateState(
  value: unknown,
  path: string,
  errors: SocialPublicationSchedulerRowError[],
): void {
  if (!hasText(value) || !STATE_SET.has(value)) {
    errors.push(rowError("state_invalid", path, "State must be a supported scheduler state."));
  }
}

function validateIntendedPublishAt(
  value: unknown,
  path: string,
  errors: SocialPublicationSchedulerRowError[],
): void {
  if (!hasText(value) || Number.isNaN(Date.parse(value))) {
    errors.push(
      rowError(
        "intended_publish_at_invalid",
        path,
        "Intended publish time must be a valid ISO timestamp.",
      ),
    );
  }
}

function validateReadContext(
  value: unknown,
  path: string,
  errors: SocialPublicationSchedulerRowError[],
): void {
  if (value === null || value === undefined) return;

  if (!isJsonObject(value)) {
    errors.push(rowError("summary_shape_invalid", path, "Read context must be null or a JSON object."));
    return;
  }

  if (
    value.containsLowerLayerPayload !== false ||
    value.containsSecrets !== false ||
    value.containsExecutionPlan !== false ||
    value.readsOnly !== true
  ) {
    errors.push(
      rowError(
        "summary_shape_invalid",
        path,
        "Read context must remain sanitized and read-only.",
      ),
    );
  }
}

function validateUuid(
  value: unknown,
  path: string,
  errors: SocialPublicationSchedulerRowError[],
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
  errors: SocialPublicationSchedulerRowError[],
): void {
  if (value === null || value === undefined) return;
  if (!hasText(value) || !UUID_PATTERN.test(value)) {
    errors.push(rowError("identity_invalid", path, "Optional UUID field must be null or UUID text."));
  }
}

function validateRequiredText(
  value: unknown,
  path: string,
  errors: SocialPublicationSchedulerRowError[],
): void {
  if (!hasText(value)) {
    errors.push(rowError("required_field_missing", path, "Required text field is missing."));
  }
}

function validateOptionalText(
  value: unknown,
  path: string,
  errors: SocialPublicationSchedulerRowError[],
): void {
  if (value === null || value === undefined) return;
  if (!hasText(value)) {
    errors.push(
      rowError("required_field_missing", path, "Optional text field must be null or non-empty text."),
    );
  }
}

function validateIdempotencyKey(
  value: unknown,
  path: string,
  errors: SocialPublicationSchedulerRowError[],
): void {
  if (value !== null && !hasText(value)) {
    errors.push(
      rowError("idempotency_key_invalid", path, "Idempotency key must be null or non-empty text."),
    );
  }
}

function validateIdentitySeparation(
  path: string,
  errors: SocialPublicationSchedulerRowError[],
  ...values: readonly unknown[]
): void {
  const textValues = values.filter(hasText);
  if (new Set(textValues).size !== textValues.length) {
    errors.push(
      rowError(
        "identity_not_separated",
        path,
        "Scheduler row identities and scope identities must remain separated.",
      ),
    );
  }
}

function rejectUnsafeJson(
  value: unknown,
  path: string,
  errors: SocialPublicationSchedulerRowError[],
): void {
  rejectForbiddenKeys(value, path, FORBIDDEN_SECRET_KEYS, "secret_forbidden", errors);
  rejectForbiddenKeys(
    value,
    path,
    FORBIDDEN_PUBLISH_AUTHORITY_KEYS,
    "publish_authority_forbidden",
    errors,
  );
  rejectForbiddenKeys(value, path, FORBIDDEN_EXECUTION_KEYS, "execution_plan_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_METRICS_KEYS, "metrics_state_forbidden", errors);
  rejectForbiddenKeys(value, path, FORBIDDEN_LEARNING_KEYS, "learning_state_forbidden", errors);
  rejectForbiddenKeys(
    value,
    path,
    FORBIDDEN_LOWER_LAYER_PAYLOAD_KEYS,
    "lower_layer_payload_forbidden",
    errors,
  );
}

function rejectForbiddenKeys(
  value: unknown,
  path: string,
  forbiddenKeys: ReadonlySet<string>,
  code: SocialPublicationSchedulerRowErrorCode,
  errors: SocialPublicationSchedulerRowError[],
  seen = new WeakSet<object>(),
): void {
  if (!value || typeof value !== "object") return;

  if (seen.has(value)) {
    errors.push(
      rowError("unsafe_recursive_state_forbidden", path, "Scheduler row JSON must be acyclic."),
    );
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
      errors.push(rowError(code, childPath, "Scheduler row JSON contains forbidden state."));
    }
    rejectForbiddenKeys(child, childPath, forbiddenKeys, code, errors, seen);
  }
}

function scheduleRecordFromRow(
  row: SocialPublicationSchedulerScheduleRow,
): SocialPublicationSchedulerScheduleRecord {
  return {
    schedule_id: row.schedule_id as SocialPublicationSchedulerScheduleRecord["schedule_id"],
    intent_type: row.intent_type as SocialPublicationSchedulerScheduleRecord["intent_type"],
    state: row.state as SocialPublicationSchedulerScheduleRecord["state"],
    scope: scopeFromRow(row),
    intended_publish_at: row.intended_publish_at,
    read_context: row.read_context as PublicationScheduleReadContext | null,
    recorded_at: row.recorded_at,
    updated_at: row.updated_at,
    recorded_by_actor:
      row.recorded_by_actor as SocialPublicationSchedulerScheduleRecord["recorded_by_actor"],
    recorded_source:
      row.recorded_source as SocialPublicationSchedulerScheduleRecord["recorded_source"],
    intent_only: row.intent_only as true,
    immutable: row.immutable as true,
    grants_publishing_permission: row.grants_publishing_permission as false,
    approves_nothing: row.approves_nothing as true,
    publishes_nothing: row.publishes_nothing as true,
    executes_nothing: row.executes_nothing as true,
    schedules_intent_only: row.schedules_intent_only as true,
    mutates_ledger: row.mutates_ledger as false,
    mutates_approval: row.mutates_approval as false,
    mutates_manifest: row.mutates_manifest as false,
    mutates_targets: row.mutates_targets as false,
    records_no_metrics: row.records_no_metrics as true,
    performs_no_learning: row.performs_no_learning as true,
  };
}

function scheduleRowFromRecord(
  record: SocialPublicationSchedulerScheduleRecord,
  options: SocialPublicationSchedulerRowOptions,
): SocialPublicationSchedulerScheduleRow {
  return {
    schedule_entry_id:
      options.schedule_entry_id ??
      deterministicScheduleEntryId(record.schedule_id, record.recorded_at, record.updated_at),
    schedule_id: record.schedule_id,
    intent_type: record.intent_type,
    state: record.state,
    ...scopeColumnsFromRecord(record.scope),
    intended_publish_at: record.intended_publish_at,
    read_context: record.read_context,
    recorded_at: record.recorded_at,
    updated_at: record.updated_at,
    recorded_by_actor: record.recorded_by_actor,
    recorded_source: record.recorded_source,
    intent_only: record.intent_only,
    immutable: record.immutable,
    grants_publishing_permission: record.grants_publishing_permission,
    approves_nothing: record.approves_nothing,
    publishes_nothing: record.publishes_nothing,
    executes_nothing: record.executes_nothing,
    schedules_intent_only: record.schedules_intent_only,
    mutates_ledger: record.mutates_ledger,
    mutates_approval: record.mutates_approval,
    mutates_manifest: record.mutates_manifest,
    mutates_targets: record.mutates_targets,
    records_no_metrics: record.records_no_metrics,
    performs_no_learning: record.performs_no_learning,
    idempotency_key: options.idempotency_key ?? null,
  };
}

function scopeFromRow(row: SocialPublicationSchedulerScheduleRow): SocialPublicationSchedulerScope {
  return {
    social_post_id: row.social_post_id as SocialPublicationSchedulerSocialPostId,
    publication_target_id: row.publication_target_id as SocialPublicationSchedulerTargetId,
    publication_manifest_id:
      row.publication_manifest_id as SocialPublicationSchedulerManifestId | null,
    owner_approval_id:
      row.owner_approval_id as SocialPublicationSchedulerOwnerApprovalId | null,
    approval_id: row.approval_id as SocialPublicationSchedulerApprovalId | null,
    proposal_id: row.proposal_id as SocialPublicationSchedulerProposalId | null,
  };
}

function scopeColumnsFromRecord(scope: SocialPublicationSchedulerScope): {
  social_post_id: string;
  publication_target_id: string;
  publication_manifest_id: string | null;
  owner_approval_id: string | null;
  approval_id: string | null;
  proposal_id: string | null;
} {
  return {
    social_post_id: scope.social_post_id,
    publication_target_id: scope.publication_target_id,
    publication_manifest_id: scope.publication_manifest_id,
    owner_approval_id: scope.owner_approval_id,
    approval_id: scope.approval_id,
    proposal_id: scope.proposal_id,
  };
}

function sortRows(
  rows: readonly SocialPublicationSchedulerScheduleRow[],
): SocialPublicationSchedulerScheduleRow[] {
  return [...rows].sort(
    (left, right) =>
      Date.parse(left.intended_publish_at) - Date.parse(right.intended_publish_at) ||
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.schedule_entry_id.localeCompare(right.schedule_entry_id),
  );
}

function appendPersistenceValidation(
  result:
    | { ok: true; errors: readonly [] }
    | { ok: false; errors: readonly SocialPublicationSchedulerPersistenceError[] },
  errors: SocialPublicationSchedulerRowError[],
  path: string,
): void {
  if (result.ok) return;

  errors.push(
    ...result.errors.map((error) =>
      rowError(mapPersistenceCode(error.code), `${path}.${error.path}`, error.message, [error]),
    ),
  );
}

function mapPersistenceCode(
  code: SocialPublicationSchedulerPersistenceError["code"],
): SocialPublicationSchedulerRowErrorCode {
  if (code === "audit_field_invalid") return "audit_field_invalid";
  if (code === "intent_type_invalid") return "intent_type_invalid";
  if (code === "state_invalid") return "state_invalid";
  if (code === "intended_publish_at_invalid") return "intended_publish_at_invalid";
  if (code === "intent_invariant_failed") return "append_only_invariant_failed";
  if (code === "identity_not_separated") return "identity_not_separated";
  if (code === "unsafe_recursive_state_forbidden") return "unsafe_recursive_state_forbidden";
  if (code === "lower_layer_payload_forbidden") return "lower_layer_payload_forbidden";
  if (code === "higher_layer_authority_forbidden") return "publish_authority_forbidden";
  if (code === "scope_invalid") return "field_shape_invalid";
  return "required_field_missing";
}

function withPathPrefix(
  errors: readonly SocialPublicationSchedulerRowError[],
  prefix: string,
): readonly SocialPublicationSchedulerRowError[] {
  return errors.map((error) => ({ ...error, path: `${prefix}.${error.path}` }));
}

function rowError(
  code: SocialPublicationSchedulerRowErrorCode,
  path: string,
  message: string,
  persistenceErrors?: readonly SocialPublicationSchedulerPersistenceError[],
): SocialPublicationSchedulerRowError {
  return { code, path, message, persistenceErrors };
}

function validationResult(
  errors: SocialPublicationSchedulerRowError[],
): SocialPublicationSchedulerRowValidationResult {
  if (errors.length === 0) return { ok: true, errors: [] };
  return { ok: false, errors };
}

function deterministicScheduleEntryId(
  scheduleId: string,
  recordedAt: string,
  updatedAt: string,
): string {
  const hex = fnv1a(`social-publication-schedule-entry:${scheduleId}:${recordedAt}:${updatedAt}`)
    .padEnd(32, "0")
    .slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  const chunks: string[] = [];

  for (let index = 0; index < 4; index += 1) {
    for (let charIndex = 0; charIndex < input.length; charIndex += 1) {
      hash ^= input.charCodeAt(charIndex) + index;
      hash = Math.imul(hash, 0x01000193);
    }
    chunks.push((hash >>> 0).toString(16).padStart(8, "0"));
  }

  return chunks.join("");
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

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isJsonObject(value: unknown): value is PublicationScheduleJsonObject {
  return isRecord(value);
}

function getText(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  return hasText(value) ? value : null;
}
