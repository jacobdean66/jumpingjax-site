export const PUBLICATION_SCHEDULER_INTENT_TYPES = [
  "publication_intent",
] as const;

export const PUBLICATION_SCHEDULER_STATE_TYPES = [
  "draft",
  "active",
  "paused",
  "completed",
  "cancelled",
] as const;

export const PUBLICATION_SCHEDULER_ACTORS = [
  "owner",
  "admin",
  "system",
  "operator",
] as const;

export const PUBLICATION_SCHEDULER_SOURCES = [
  "publication_scheduler_domain",
  "manual_admin",
  "test",
] as const;

export const PUBLICATION_SCHEDULER_ERROR_CODES = [
  "schedule_id_required",
  "social_post_id_required",
  "publication_target_id_required",
  "publication_manifest_id_invalid",
  "approval_reference_invalid",
  "intent_type_required",
  "intent_type_unknown",
  "state_required",
  "state_unknown",
  "intended_publish_at_required",
  "intended_publish_at_invalid",
  "actor_invalid",
  "source_invalid",
  "created_at_required",
  "updated_at_required",
  "intent_invariant_failed",
  "secret_forbidden",
  "publish_authority_forbidden",
  "execution_plan_forbidden",
  "cron_expression_forbidden",
  "timer_reference_forbidden",
  "metrics_state_forbidden",
  "learning_state_forbidden",
  "lower_layer_payload_forbidden",
  "ledger_mutation_forbidden",
  "approval_mutation_forbidden",
  "manifest_mutation_forbidden",
  "target_mutation_forbidden",
] as const;

export type PublicationScheduleId = string;

export type PublicationScheduleIntentType =
  (typeof PUBLICATION_SCHEDULER_INTENT_TYPES)[number];

export type PublicationScheduleState =
  (typeof PUBLICATION_SCHEDULER_STATE_TYPES)[number];

export type PublicationScheduleActor =
  (typeof PUBLICATION_SCHEDULER_ACTORS)[number];

export type PublicationScheduleSource =
  (typeof PUBLICATION_SCHEDULER_SOURCES)[number];

export type PublicationScheduleErrorCode =
  (typeof PUBLICATION_SCHEDULER_ERROR_CODES)[number];

export type PublicationScheduleValidationError = Readonly<{
  code: PublicationScheduleErrorCode;
  path: string;
  message: string;
}>;

export type PublicationScheduleValidationResult = Readonly<
  | {
      ok: true;
      errors: readonly [];
    }
  | {
      ok: false;
      errors: readonly PublicationScheduleValidationError[];
    }
>;

export type PublicationScheduleJsonPrimitive = string | number | boolean | null;

export type PublicationScheduleJsonValue =
  | PublicationScheduleJsonPrimitive
  | readonly PublicationScheduleJsonValue[]
  | { readonly [key: string]: PublicationScheduleJsonValue };

export type PublicationScheduleJsonObject = Readonly<{
  [key: string]: PublicationScheduleJsonValue;
}>;

export type PublicationScheduleReferences = Readonly<{
  socialPostId: string;
  publicationTargetId: string;
  publicationManifestId: string | null;
  ownerApprovalId: string | null;
  approvalId: string | null;
  proposalId: string | null;
}>;

export type PublicationScheduleReadContext = Readonly<{
  ledgerEntryId: string | null;
  publicationAttemptId: string | null;
  sanitizedNotes: string | null;
  sanitizedContext: PublicationScheduleJsonObject;
  containsLowerLayerPayload: false;
  containsSecrets: false;
  containsExecutionPlan: false;
  readsOnly: true;
}>;

export type PublicationScheduleIntent = Readonly<{
  scheduleId: PublicationScheduleId;
  intentType: PublicationScheduleIntentType;
  state: PublicationScheduleState;
  references: PublicationScheduleReferences;
  intendedPublishAt: string;
  readContext: PublicationScheduleReadContext | null;
  actor: PublicationScheduleActor;
  source: PublicationScheduleSource;
  createdAt: string;
  updatedAt: string;
  intentOnly: true;
  immutable: true;
  grantsPublishingPermission: false;
  approvesNothing: true;
  publishesNothing: true;
  executesNothing: true;
  schedulesIntentOnly: true;
  mutatesLedger: false;
  mutatesApproval: false;
  mutatesManifest: false;
  mutatesTargets: false;
  recordsNoMetrics: true;
  performsNoLearning: true;
}>;

type UnknownRecord = Readonly<Record<string, unknown>>;

const INTENT_TYPE_SET = new Set<string>(PUBLICATION_SCHEDULER_INTENT_TYPES);
const STATE_SET = new Set<string>(PUBLICATION_SCHEDULER_STATE_TYPES);
const ACTOR_SET = new Set<string>(PUBLICATION_SCHEDULER_ACTORS);
const SOURCE_SET = new Set<string>(PUBLICATION_SCHEDULER_SOURCES);

const TERMINAL_STATES = new Set<PublicationScheduleState>([
  "completed",
  "cancelled",
]);

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
  "grantsPublishingPermission",
  "publishAuthority",
  "publisherAuthority",
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

const FORBIDDEN_MUTATION_KEYS = new Set([
  "appendLedgerEntry",
  "mutateApproval",
  "mutateManifest",
  "mutateTarget",
  "updateApproval",
  "updateManifest",
  "updateTarget",
  "writeLedger",
]);

export function isPublicationScheduleState(
  value: string,
): value is PublicationScheduleState {
  return STATE_SET.has(value);
}

export function isPublicationScheduleIntentType(
  value: string,
): value is PublicationScheduleIntentType {
  return INTENT_TYPE_SET.has(value);
}

export function isPublicationScheduleStateTerminal(
  state: PublicationScheduleState,
): boolean {
  return TERMINAL_STATES.has(state);
}

export function comparePublicationScheduleIntendedPublishAt(
  left: PublicationScheduleIntent,
  right: PublicationScheduleIntent,
): number {
  const leftTime = Date.parse(left.intendedPublishAt);
  const rightTime = Date.parse(right.intendedPublishAt);

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return left.scheduleId.localeCompare(right.scheduleId);
}

export function sortPublicationScheduleIntentsByIntendedPublishAt(
  schedules: readonly PublicationScheduleIntent[],
): readonly PublicationScheduleIntent[] {
  return [...schedules].sort(comparePublicationScheduleIntendedPublishAt);
}

export function isPublicationScheduleIntentActive(
  intent: PublicationScheduleIntent,
): boolean {
  return intent.state === "active";
}

export function isPublicationScheduleIntentPaused(
  intent: PublicationScheduleIntent,
): boolean {
  return intent.state === "paused";
}

export function isPublicationScheduleIntentCompleted(
  intent: PublicationScheduleIntent,
): boolean {
  return intent.state === "completed";
}

export function isPublicationScheduleIntentOverdue(
  intent: PublicationScheduleIntent,
  asOf: string,
): boolean {
  if (intent.state !== "active") {
    return false;
  }

  const asOfTime = Date.parse(asOf);
  const intendedTime = Date.parse(intent.intendedPublishAt);

  if (!Number.isFinite(asOfTime) || !Number.isFinite(intendedTime)) {
    return false;
  }

  return intendedTime < asOfTime;
}

export function validatePublicationScheduleIntent(
  intent: PublicationScheduleIntent,
): PublicationScheduleValidationResult {
  const errors: PublicationScheduleValidationError[] = [];

  validateRequiredText(intent.scheduleId, "scheduleId", "schedule_id_required", errors);
  validateIntentType(intent.intentType, errors);
  validateState(intent.state, errors);
  validateReferences(intent.references, errors);
  validateIntendedPublishAt(intent.intendedPublishAt, errors);
  validateReadContext(intent.readContext, errors);
  validateActor(intent.actor, errors);
  validateSource(intent.source, errors);
  validateRequiredText(intent.createdAt, "createdAt", "created_at_required", errors);
  validateRequiredText(intent.updatedAt, "updatedAt", "updated_at_required", errors);
  validateIntentInvariants(intent, errors);
  rejectForbiddenStoredState(intent, errors);

  return validationResult(errors);
}

export function serializePublicationScheduleIntent(
  intent: PublicationScheduleIntent,
): string {
  const validation = validatePublicationScheduleIntent(intent);
  if (!validation.ok) {
    throw new Error("Publication schedule intent failed validation before serialization.");
  }

  return stableStringify(intent);
}

export function hydratePublicationScheduleIntent(
  serialized: string,
): PublicationScheduleValidationResult & { value?: PublicationScheduleIntent } {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    return {
      ok: false,
      errors: [
        validationError({
          code: "intent_invariant_failed",
          path: "serialized",
          message: "Publication schedule intent JSON is invalid.",
        }),
      ],
    };
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      errors: [
        validationError({
          code: "intent_invariant_failed",
          path: "serialized",
          message: "Publication schedule intent must deserialize to an object.",
        }),
      ],
    };
  }

  const validation = validatePublicationScheduleIntent(
    parsed as PublicationScheduleIntent,
  );
  if (!validation.ok) {
    return validation;
  }

  return {
    ok: true,
    errors: [],
    value: deepFreeze(immutableClone(parsed as PublicationScheduleIntent)),
  };
}

function validateIntentType(
  intentType: PublicationScheduleIntentType,
  errors: PublicationScheduleValidationError[],
): void {
  if (!hasText(intentType)) {
    errors.push(
      validationError({
        code: "intent_type_required",
        path: "intentType",
        message: "Publication schedule intent type is required.",
      }),
    );
    return;
  }

  if (!isPublicationScheduleIntentType(intentType)) {
    errors.push(
      validationError({
        code: "intent_type_unknown",
        path: "intentType",
        message: "Publication schedule intent type is not supported.",
      }),
    );
  }
}

function validateState(
  state: PublicationScheduleState,
  errors: PublicationScheduleValidationError[],
): void {
  if (!hasText(state)) {
    errors.push(
      validationError({
        code: "state_required",
        path: "state",
        message: "Publication schedule state is required.",
      }),
    );
    return;
  }

  if (!isPublicationScheduleState(state)) {
    errors.push(
      validationError({
        code: "state_unknown",
        path: "state",
        message: "Publication schedule state is not supported.",
      }),
    );
  }
}

function validateReferences(
  references: PublicationScheduleReferences,
  errors: PublicationScheduleValidationError[],
): void {
  if (!isRecord(references)) {
    errors.push(
      validationError({
        code: "social_post_id_required",
        path: "references",
        message: "Publication schedule references are required.",
      }),
    );
    return;
  }

  validateRequiredText(
    references.socialPostId,
    "references.socialPostId",
    "social_post_id_required",
    errors,
  );
  validateRequiredText(
    references.publicationTargetId,
    "references.publicationTargetId",
    "publication_target_id_required",
    errors,
  );
  validateOptionalText(
    references.publicationManifestId,
    "references.publicationManifestId",
    "publication_manifest_id_invalid",
    errors,
  );
  validateOptionalText(
    references.ownerApprovalId,
    "references.ownerApprovalId",
    "approval_reference_invalid",
    errors,
  );
  validateOptionalText(
    references.approvalId,
    "references.approvalId",
    "approval_reference_invalid",
    errors,
  );
  validateOptionalText(
    references.proposalId,
    "references.proposalId",
    "approval_reference_invalid",
    errors,
  );
}

function validateIntendedPublishAt(
  intendedPublishAt: string,
  errors: PublicationScheduleValidationError[],
): void {
  if (!hasText(intendedPublishAt)) {
    errors.push(
      validationError({
        code: "intended_publish_at_required",
        path: "intendedPublishAt",
        message: "Publication schedule intended publish time is required.",
      }),
    );
    return;
  }

  if (!Number.isFinite(Date.parse(intendedPublishAt))) {
    errors.push(
      validationError({
        code: "intended_publish_at_invalid",
        path: "intendedPublishAt",
        message: "Publication schedule intended publish time must be a valid ISO timestamp.",
      }),
    );
  }
}

function validateReadContext(
  readContext: PublicationScheduleReadContext | null,
  errors: PublicationScheduleValidationError[],
): void {
  if (readContext === null) {
    return;
  }

  if (
    !isRecord(readContext) ||
    readContext.containsLowerLayerPayload !== false ||
    readContext.containsSecrets !== false ||
    readContext.containsExecutionPlan !== false ||
    readContext.readsOnly !== true ||
    !isJsonObject(readContext.sanitizedContext)
  ) {
    errors.push(
      validationError({
        code: "intent_invariant_failed",
        path: "readContext",
        message: "Publication schedule read context must remain sanitized and read-only.",
      }),
    );
    return;
  }

  rejectForbiddenKeys(
    readContext,
    "readContext",
    FORBIDDEN_SECRET_KEYS,
    "secret_forbidden",
    errors,
  );
  rejectForbiddenKeys(
    readContext,
    "readContext",
    FORBIDDEN_LOWER_LAYER_PAYLOAD_KEYS,
    "lower_layer_payload_forbidden",
    errors,
  );
  rejectForbiddenKeys(
    readContext,
    "readContext",
    FORBIDDEN_EXECUTION_KEYS,
    "execution_plan_forbidden",
    errors,
  );
}

function validateActor(
  actor: PublicationScheduleActor,
  errors: PublicationScheduleValidationError[],
): void {
  if (!ACTOR_SET.has(actor)) {
    errors.push(
      validationError({
        code: "actor_invalid",
        path: "actor",
        message: "Publication schedule actor is not supported.",
      }),
    );
  }
}

function validateSource(
  source: PublicationScheduleSource,
  errors: PublicationScheduleValidationError[],
): void {
  if (!SOURCE_SET.has(source)) {
    errors.push(
      validationError({
        code: "source_invalid",
        path: "source",
        message: "Publication schedule source is not supported.",
      }),
    );
  }
}

function validateIntentInvariants(
  intent: PublicationScheduleIntent,
  errors: PublicationScheduleValidationError[],
): void {
  if (
    intent.intentOnly !== true ||
    intent.immutable !== true ||
    intent.grantsPublishingPermission !== false ||
    intent.approvesNothing !== true ||
    intent.publishesNothing !== true ||
    intent.executesNothing !== true ||
    intent.schedulesIntentOnly !== true ||
    intent.mutatesLedger !== false ||
    intent.mutatesApproval !== false ||
    intent.mutatesManifest !== false ||
    intent.mutatesTargets !== false ||
    intent.recordsNoMetrics !== true ||
    intent.performsNoLearning !== true
  ) {
    errors.push(
      validationError({
        code: "intent_invariant_failed",
        path: "intentInvariants",
        message: "Publication schedule intents must remain intent-only and non-authoritative.",
      }),
    );
  }
}

function rejectForbiddenStoredState(
  intent: PublicationScheduleIntent,
  errors: PublicationScheduleValidationError[],
): void {
  rejectForbiddenKeys(intent, "intent", FORBIDDEN_SECRET_KEYS, "secret_forbidden", errors);
  rejectForbiddenKeys(
    intent,
    "intent",
    FORBIDDEN_PUBLISH_AUTHORITY_KEYS,
    "publish_authority_forbidden",
    errors,
  );
  rejectForbiddenKeys(
    intent,
    "intent",
    FORBIDDEN_EXECUTION_KEYS,
    "execution_plan_forbidden",
    errors,
  );
  rejectForbiddenKeys(
    intent,
    "intent",
    FORBIDDEN_METRICS_KEYS,
    "metrics_state_forbidden",
    errors,
  );
  rejectForbiddenKeys(
    intent,
    "intent",
    FORBIDDEN_LEARNING_KEYS,
    "learning_state_forbidden",
    errors,
  );
  rejectForbiddenKeys(
    intent,
    "intent",
    FORBIDDEN_LOWER_LAYER_PAYLOAD_KEYS,
    "lower_layer_payload_forbidden",
    errors,
  );
  rejectForbiddenKeys(
    intent,
    "intent",
    FORBIDDEN_MUTATION_KEYS,
    "ledger_mutation_forbidden",
    errors,
  );
}

function rejectForbiddenKeys(
  value: unknown,
  path: string,
  forbiddenKeys: ReadonlySet<string>,
  code: PublicationScheduleErrorCode,
  errors: PublicationScheduleValidationError[],
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
      errors.push(
        validationError({
          code,
          path: childPath,
          message: "Publication schedule intents must not store unsafe execution state.",
        }),
      );
    }

    rejectForbiddenKeys(child, childPath, forbiddenKeys, code, errors);
  }
}

function validateRequiredText(
  value: unknown,
  path: string,
  code: PublicationScheduleErrorCode,
  errors: PublicationScheduleValidationError[],
): void {
  if (!hasText(value)) {
    errors.push(
      validationError({
        code,
        path,
        message: "Required publication schedule field is missing.",
      }),
    );
  }
}

function validateOptionalText(
  value: unknown,
  path: string,
  code: PublicationScheduleErrorCode,
  errors: PublicationScheduleValidationError[],
): void {
  if (value !== null && value !== undefined && !hasText(value)) {
    errors.push(
      validationError({
        code,
        path,
        message: "Optional publication schedule reference must be null or non-empty text.",
      }),
    );
  }
}

function validationError(input: {
  code: PublicationScheduleErrorCode;
  path: string;
  message: string;
}): PublicationScheduleValidationError {
  return input;
}

function validationResult(
  errors: PublicationScheduleValidationError[],
): PublicationScheduleValidationResult {
  if (errors.length === 0) {
    return { ok: true, errors: [] };
  }

  return { ok: false, errors };
}

function isJsonObject(value: unknown): value is PublicationScheduleJsonObject {
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
