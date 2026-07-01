import {
  PUBLICATION_SCHEDULER_ACTORS,
  PUBLICATION_SCHEDULER_INTENT_TYPES,
  PUBLICATION_SCHEDULER_SOURCES,
  PUBLICATION_SCHEDULER_STATE_TYPES,
  validatePublicationScheduleIntent,
  type PublicationScheduleIntent,
  type PublicationScheduleReadContext,
  type PublicationScheduleReferences,
} from "./social-publication-scheduler";

type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

type UnknownRecord = Readonly<Record<string, unknown>>;

export type SocialPublicationScheduleId = Brand<string, "SocialPublicationScheduleId">;

export type SocialPublicationSchedulerSocialPostId = Brand<
  string,
  "SocialPublicationSchedulerSocialPostId"
>;

export type SocialPublicationSchedulerTargetId = Brand<
  string,
  "SocialPublicationSchedulerTargetId"
>;

export type SocialPublicationSchedulerManifestId = Brand<
  string,
  "SocialPublicationSchedulerManifestId"
>;

export type SocialPublicationSchedulerOwnerApprovalId = Brand<
  string,
  "SocialPublicationSchedulerOwnerApprovalId"
>;

export type SocialPublicationSchedulerApprovalId = Brand<
  string,
  "SocialPublicationSchedulerApprovalId"
>;

export type SocialPublicationSchedulerProposalId = Brand<
  string,
  "SocialPublicationSchedulerProposalId"
>;

export type SocialPublicationSchedulerScope = Readonly<{
  social_post_id: SocialPublicationSchedulerSocialPostId;
  publication_target_id: SocialPublicationSchedulerTargetId;
  publication_manifest_id: SocialPublicationSchedulerManifestId | null;
  owner_approval_id: SocialPublicationSchedulerOwnerApprovalId | null;
  approval_id: SocialPublicationSchedulerApprovalId | null;
  proposal_id: SocialPublicationSchedulerProposalId | null;
}>;

export type SocialPublicationSchedulerAuditFields = Readonly<{
  recorded_at: string;
  updated_at: string;
  recorded_by_actor: (typeof PUBLICATION_SCHEDULER_ACTORS)[number];
  recorded_source: (typeof PUBLICATION_SCHEDULER_SOURCES)[number];
}>;

export type SocialPublicationSchedulerScheduleRecord =
  SocialPublicationSchedulerAuditFields &
    Readonly<{
      schedule_id: SocialPublicationScheduleId;
      intent_type: (typeof PUBLICATION_SCHEDULER_INTENT_TYPES)[number];
      state: (typeof PUBLICATION_SCHEDULER_STATE_TYPES)[number];
      scope: SocialPublicationSchedulerScope;
      intended_publish_at: string;
      read_context: PublicationScheduleReadContext | null;
      intent_only: true;
      immutable: true;
      grants_publishing_permission: false;
      approves_nothing: true;
      publishes_nothing: true;
      executes_nothing: true;
      schedules_intent_only: true;
      mutates_ledger: false;
      mutates_approval: false;
      mutates_manifest: false;
      mutates_targets: false;
      records_no_metrics: true;
      performs_no_learning: true;
    }>;

export type SocialPublicationSchedulerPersistenceModel = Readonly<{
  schedules: readonly SocialPublicationSchedulerScheduleRecord[];
}>;

export const SOCIAL_PUBLICATION_SCHEDULER_REPOSITORY_ERROR_CODES = [
  "validation_failed",
  "not_found",
  "identity_required",
  "identity_collision",
  "serialization_invalid",
  "contract_only",
] as const;

export const SOCIAL_PUBLICATION_SCHEDULER_PERSISTENCE_ERROR_CODES = [
  "required_field_missing",
  "identity_not_separated",
  "scope_invalid",
  "intent_type_invalid",
  "state_invalid",
  "intended_publish_at_invalid",
  "intent_invariant_failed",
  "audit_field_invalid",
  "unsafe_recursive_state_forbidden",
  "lower_layer_payload_forbidden",
  "higher_layer_authority_forbidden",
] as const;

export type SocialPublicationSchedulerRepositoryErrorCode =
  (typeof SOCIAL_PUBLICATION_SCHEDULER_REPOSITORY_ERROR_CODES)[number];

export type SocialPublicationSchedulerPersistenceErrorCode =
  (typeof SOCIAL_PUBLICATION_SCHEDULER_PERSISTENCE_ERROR_CODES)[number];

export type SocialPublicationSchedulerPersistenceError = Readonly<{
  code: SocialPublicationSchedulerPersistenceErrorCode;
  path: string;
  message: string;
}>;

export type SocialPublicationSchedulerRepositoryError = Readonly<{
  code: SocialPublicationSchedulerRepositoryErrorCode;
  message: string;
  validationErrors?: readonly SocialPublicationSchedulerPersistenceError[];
}>;

export type SocialPublicationSchedulerRepositoryResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: SocialPublicationSchedulerRepositoryError }>;

export type SocialPublicationSchedulerPersistenceValidationResult = Readonly<
  | {
      ok: true;
      errors: readonly [];
    }
  | {
      ok: false;
      errors: readonly SocialPublicationSchedulerPersistenceError[];
    }
>;

export type SocialPublicationSchedulerRepositoryIdentity = Readonly<{
  schedule_id?: string;
  social_post_id?: string;
  publication_target_id?: string;
  publication_manifest_id?: string;
  owner_approval_id?: string;
  approval_id?: string;
  proposal_id?: string;
}>;

export type SocialPublicationSchedulerCreateRequest = Readonly<{
  schedule: SocialPublicationSchedulerScheduleRecord;
}>;

export type SocialPublicationSchedulerAppendRequest = Readonly<{
  schedule: SocialPublicationSchedulerScheduleRecord;
}>;

export type SocialPublicationSchedulerRepositorySnapshot =
  SocialPublicationSchedulerPersistenceModel;

export type SocialPublicationSchedulerRepository = Readonly<{
  createScheduleIntent(
    request: SocialPublicationSchedulerCreateRequest,
  ): SocialPublicationSchedulerRepositoryResult<SocialPublicationSchedulerScheduleRecord>;
  appendScheduleIntent(
    request: SocialPublicationSchedulerAppendRequest,
  ): SocialPublicationSchedulerRepositoryResult<SocialPublicationSchedulerScheduleRecord>;
  getSchedulesByIdentity(
    identity: SocialPublicationSchedulerRepositoryIdentity,
  ): SocialPublicationSchedulerRepositoryResult<SocialPublicationSchedulerPersistenceModel>;
  listSchedules(
    identity?: SocialPublicationSchedulerRepositoryIdentity,
  ): SocialPublicationSchedulerRepositoryResult<
    readonly SocialPublicationSchedulerScheduleRecord[]
  >;
  snapshot(): SocialPublicationSchedulerRepositoryResult<SocialPublicationSchedulerRepositorySnapshot>;
}>;

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

const FORBIDDEN_AUTHORITY_KEYS = new Set([
  "approvalAuthority",
  "canApprove",
  "canPublish",
  "canSchedule",
  "grantsPublishingPermission",
  "publisherAuthority",
  "schedulerAuthority",
]);

const FORBIDDEN_EXECUTION_KEYS = new Set([
  "cron",
  "cronExpression",
  "cron_expression",
  "executionPlan",
  "execution_plan",
  "timerId",
  "timerReference",
  "workerId",
]);

const FORBIDDEN_LOWER_LAYER_PAYLOAD_KEYS = new Set([
  "approvalPayload",
  "ledgerEntry",
  "ledgerPayload",
  "manifestPayload",
  "targetPayload",
]);

export function mapPublicationScheduleIntentToScheduleRecord(
  intent: PublicationScheduleIntent,
): SocialPublicationSchedulerScheduleRecord {
  return {
    schedule_id: intent.scheduleId as SocialPublicationScheduleId,
    intent_type: intent.intentType,
    state: intent.state,
    scope: mapReferencesToScope(intent.references),
    intended_publish_at: intent.intendedPublishAt,
    read_context: intent.readContext,
    recorded_at: intent.createdAt,
    updated_at: intent.updatedAt,
    recorded_by_actor: intent.actor,
    recorded_source: intent.source,
    intent_only: true,
    immutable: true,
    grants_publishing_permission: false,
    approves_nothing: true,
    publishes_nothing: true,
    executes_nothing: true,
    schedules_intent_only: true,
    mutates_ledger: false,
    mutates_approval: false,
    mutates_manifest: false,
    mutates_targets: false,
    records_no_metrics: true,
    performs_no_learning: true,
  };
}

export function mapScheduleRecordToPublicationScheduleIntent(
  record: SocialPublicationSchedulerScheduleRecord,
): PublicationScheduleIntent {
  return {
    scheduleId: record.schedule_id,
    intentType: record.intent_type,
    state: record.state,
    references: mapScopeToReferences(record.scope),
    intendedPublishAt: record.intended_publish_at,
    readContext: record.read_context,
    actor: record.recorded_by_actor,
    source: record.recorded_source,
    createdAt: record.recorded_at,
    updatedAt: record.updated_at,
    intentOnly: true,
    immutable: true,
    grantsPublishingPermission: false,
    approvesNothing: true,
    publishesNothing: true,
    executesNothing: true,
    schedulesIntentOnly: true,
    mutatesLedger: false,
    mutatesApproval: false,
    mutatesManifest: false,
    mutatesTargets: false,
    recordsNoMetrics: true,
    performsNoLearning: true,
  };
}

export function validateSocialPublicationSchedulerScheduleRecord(
  record: SocialPublicationSchedulerScheduleRecord,
): SocialPublicationSchedulerPersistenceValidationResult {
  const errors: SocialPublicationSchedulerPersistenceError[] = [];

  validateRequiredText(
    record.schedule_id,
    "schedule_id",
    "required_field_missing",
    errors,
  );
  validateIntentType(record.intent_type, errors);
  validateState(record.state, errors);
  validateScope(record.scope, errors);
  validateIntendedPublishAt(record.intended_publish_at, errors);
  validateAuditFields(record, errors);
  validateRecordInvariants(record, errors);
  rejectForbiddenStoredState(record, errors);

  const domainValidation = validatePublicationScheduleIntent(
    mapScheduleRecordToPublicationScheduleIntent(record),
  );
  if (!domainValidation.ok) {
    for (const error of domainValidation.errors) {
      errors.push({
        code: "intent_invariant_failed",
        path: error.path,
        message: error.message,
      });
    }
  }

  return persistenceValidationResult(errors);
}

export function validateSocialPublicationSchedulerPersistenceModel(
  model: SocialPublicationSchedulerPersistenceModel,
): SocialPublicationSchedulerPersistenceValidationResult {
  const errors: SocialPublicationSchedulerPersistenceError[] = [];

  if (!Array.isArray(model.schedules)) {
    errors.push({
      code: "required_field_missing",
      path: "schedules",
      message: "Scheduler persistence model requires a schedules array.",
    });
    return persistenceValidationResult(errors);
  }

  const seenScheduleIds = new Set<string>();

  model.schedules.forEach((record, index) => {
    const recordValidation = validateSocialPublicationSchedulerScheduleRecord(record);
    if (!recordValidation.ok) {
      for (const error of recordValidation.errors) {
        errors.push({
          code: error.code,
          path: `schedules.${index}.${error.path}`,
          message: error.message,
        });
      }
    }

    const scheduleId = String(record.schedule_id);
    if (seenScheduleIds.has(scheduleId)) {
      errors.push({
        code: "identity_not_separated",
        path: `schedules.${index}.schedule_id`,
        message: "Scheduler persistence model schedule ids must remain unique.",
      });
    } else {
      seenScheduleIds.add(scheduleId);
    }
  });

  return persistenceValidationResult(errors);
}

export function validateSocialPublicationSchedulerCreateRequest(
  request: SocialPublicationSchedulerCreateRequest,
): SocialPublicationSchedulerRepositoryResult<SocialPublicationSchedulerCreateRequest> {
  const recordValidation = validateSocialPublicationSchedulerScheduleRecord(
    request.schedule,
  );
  if (!recordValidation.ok) {
    return repositoryValidationFailure(recordValidation.errors);
  }

  return { ok: true, value: request };
}

export function validateSocialPublicationSchedulerAppendRequest(
  request: SocialPublicationSchedulerAppendRequest,
): SocialPublicationSchedulerRepositoryResult<SocialPublicationSchedulerAppendRequest> {
  const recordValidation = validateSocialPublicationSchedulerScheduleRecord(
    request.schedule,
  );
  if (!recordValidation.ok) {
    return repositoryValidationFailure(recordValidation.errors);
  }

  return { ok: true, value: request };
}

export function validateSocialPublicationSchedulerRepositoryIdentity(
  identity: SocialPublicationSchedulerRepositoryIdentity,
): SocialPublicationSchedulerRepositoryResult<SocialPublicationSchedulerRepositoryIdentity> {
  const fields = Object.values(identity).filter(
    (value) => value !== undefined && hasText(value),
  );

  if (fields.length === 0) {
    return {
      ok: false,
      error: {
        code: "identity_required",
        message: "Scheduler repository identity requires at least one field.",
      },
    };
  }

  return { ok: true, value: identity };
}

export function serializeSocialPublicationSchedulerPersistenceModel(
  model: SocialPublicationSchedulerPersistenceModel,
): string {
  const validation = validateSocialPublicationSchedulerPersistenceModel(model);
  if (!validation.ok) {
    throw new Error(
      "Publication scheduler persistence model failed validation before serialization.",
    );
  }

  return stableStringify(sortModel(model));
}

export function hydrateSocialPublicationSchedulerPersistenceModel(
  serialized: string,
): SocialPublicationSchedulerRepositoryResult<SocialPublicationSchedulerPersistenceModel> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    return {
      ok: false,
      error: {
        code: "serialization_invalid",
        message: "Publication scheduler persistence model JSON is invalid.",
      },
    };
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.schedules)) {
    return {
      ok: false,
      error: {
        code: "serialization_invalid",
        message: "Publication scheduler persistence model must deserialize to schedules.",
      },
    };
  }

  const validation = validateSocialPublicationSchedulerPersistenceModel(
    parsed as SocialPublicationSchedulerPersistenceModel,
  );
  if (!validation.ok) {
    return repositoryValidationFailure(validation.errors);
  }

  return {
    ok: true,
    value: deepFreeze(
      immutableClone(parsed as SocialPublicationSchedulerPersistenceModel),
    ),
  };
}

function mapReferencesToScope(
  references: PublicationScheduleReferences,
): SocialPublicationSchedulerScope {
  return {
    social_post_id: references.socialPostId as SocialPublicationSchedulerSocialPostId,
    publication_target_id:
      references.publicationTargetId as SocialPublicationSchedulerTargetId,
    publication_manifest_id:
      references.publicationManifestId as SocialPublicationSchedulerManifestId | null,
    owner_approval_id:
      references.ownerApprovalId as SocialPublicationSchedulerOwnerApprovalId | null,
    approval_id: references.approvalId as SocialPublicationSchedulerApprovalId | null,
    proposal_id: references.proposalId as SocialPublicationSchedulerProposalId | null,
  };
}

function mapScopeToReferences(
  scope: SocialPublicationSchedulerScope,
): PublicationScheduleReferences {
  return {
    socialPostId: scope.social_post_id,
    publicationTargetId: scope.publication_target_id,
    publicationManifestId: scope.publication_manifest_id,
    ownerApprovalId: scope.owner_approval_id,
    approvalId: scope.approval_id,
    proposalId: scope.proposal_id,
  };
}

function validateIntentType(
  intentType: string,
  errors: SocialPublicationSchedulerPersistenceError[],
): void {
  if (!PUBLICATION_SCHEDULER_INTENT_TYPES.includes(intentType as never)) {
    errors.push({
      code: "intent_type_invalid",
      path: "intent_type",
      message: "Scheduler persistence record intent type is not supported.",
    });
  }
}

function validateState(
  state: string,
  errors: SocialPublicationSchedulerPersistenceError[],
): void {
  if (!PUBLICATION_SCHEDULER_STATE_TYPES.includes(state as never)) {
    errors.push({
      code: "state_invalid",
      path: "state",
      message: "Scheduler persistence record state is not supported.",
    });
  }
}

function validateScope(
  scope: SocialPublicationSchedulerScope,
  errors: SocialPublicationSchedulerPersistenceError[],
): void {
  if (!isRecord(scope)) {
    errors.push({
      code: "scope_invalid",
      path: "scope",
      message: "Scheduler persistence record scope is required.",
    });
    return;
  }

  validateRequiredText(
    scope.social_post_id,
    "scope.social_post_id",
    "required_field_missing",
    errors,
  );
  validateRequiredText(
    scope.publication_target_id,
    "scope.publication_target_id",
    "required_field_missing",
    errors,
  );
}

function validateIntendedPublishAt(
  intendedPublishAt: string,
  errors: SocialPublicationSchedulerPersistenceError[],
): void {
  if (!hasText(intendedPublishAt) || !Number.isFinite(Date.parse(intendedPublishAt))) {
    errors.push({
      code: "intended_publish_at_invalid",
      path: "intended_publish_at",
      message: "Scheduler persistence record intended publish time is invalid.",
    });
  }
}

function validateAuditFields(
  record: SocialPublicationSchedulerScheduleRecord,
  errors: SocialPublicationSchedulerPersistenceError[],
): void {
  validateRequiredText(record.recorded_at, "recorded_at", "audit_field_invalid", errors);
  validateRequiredText(record.updated_at, "updated_at", "audit_field_invalid", errors);

  if (!PUBLICATION_SCHEDULER_ACTORS.includes(record.recorded_by_actor)) {
    errors.push({
      code: "audit_field_invalid",
      path: "recorded_by_actor",
      message: "Scheduler persistence record actor is not supported.",
    });
  }

  if (!PUBLICATION_SCHEDULER_SOURCES.includes(record.recorded_source)) {
    errors.push({
      code: "audit_field_invalid",
      path: "recorded_source",
      message: "Scheduler persistence record source is not supported.",
    });
  }
}

function validateRecordInvariants(
  record: SocialPublicationSchedulerScheduleRecord,
  errors: SocialPublicationSchedulerPersistenceError[],
): void {
  if (
    record.intent_only !== true ||
    record.immutable !== true ||
    record.grants_publishing_permission !== false ||
    record.approves_nothing !== true ||
    record.publishes_nothing !== true ||
    record.executes_nothing !== true ||
    record.schedules_intent_only !== true ||
    record.mutates_ledger !== false ||
    record.mutates_approval !== false ||
    record.mutates_manifest !== false ||
    record.mutates_targets !== false ||
    record.records_no_metrics !== true ||
    record.performs_no_learning !== true
  ) {
    errors.push({
      code: "intent_invariant_failed",
      path: "intentInvariants",
      message: "Scheduler persistence records must remain intent-only and non-authoritative.",
    });
  }
}

function rejectForbiddenStoredState(
  record: SocialPublicationSchedulerScheduleRecord,
  errors: SocialPublicationSchedulerPersistenceError[],
): void {
  rejectForbiddenKeys(record, "record", FORBIDDEN_SECRET_KEYS, "unsafe_recursive_state_forbidden", errors);
  rejectForbiddenKeys(record, "record", FORBIDDEN_AUTHORITY_KEYS, "higher_layer_authority_forbidden", errors);
  rejectForbiddenKeys(record, "record", FORBIDDEN_EXECUTION_KEYS, "unsafe_recursive_state_forbidden", errors);
  rejectForbiddenKeys(record, "record", FORBIDDEN_LOWER_LAYER_PAYLOAD_KEYS, "lower_layer_payload_forbidden", errors);
}

function rejectForbiddenKeys(
  value: unknown,
  path: string,
  forbiddenKeys: ReadonlySet<string>,
  code: SocialPublicationSchedulerPersistenceErrorCode,
  errors: SocialPublicationSchedulerPersistenceError[],
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
      errors.push({
        code,
        path: childPath,
        message: "Scheduler persistence records must not store unsafe execution state.",
      });
    }

    rejectForbiddenKeys(child, childPath, forbiddenKeys, code, errors);
  }
}

function validateRequiredText(
  value: unknown,
  path: string,
  code: SocialPublicationSchedulerPersistenceErrorCode,
  errors: SocialPublicationSchedulerPersistenceError[],
): void {
  if (!hasText(value)) {
    errors.push({
      code,
      path,
      message: "Required scheduler persistence field is missing.",
    });
  }
}

function repositoryValidationFailure(
  validationErrors: readonly SocialPublicationSchedulerPersistenceError[],
): SocialPublicationSchedulerRepositoryResult<never> {
  return {
    ok: false,
    error: {
      code: "validation_failed",
      message: "Publication scheduler repository request failed validation.",
      validationErrors,
    },
  };
}

function persistenceValidationResult(
  errors: SocialPublicationSchedulerPersistenceError[],
): SocialPublicationSchedulerPersistenceValidationResult {
  if (errors.length === 0) {
    return { ok: true, errors: [] };
  }

  return { ok: false, errors };
}

function sortModel(
  model: SocialPublicationSchedulerPersistenceModel,
): SocialPublicationSchedulerPersistenceModel {
  return {
    schedules: [...model.schedules].sort((left, right) => {
      const timeDelta =
        Date.parse(left.intended_publish_at) - Date.parse(right.intended_publish_at);
      if (timeDelta !== 0) {
        return timeDelta;
      }

      return String(left.schedule_id).localeCompare(String(right.schedule_id));
    }),
  };
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
