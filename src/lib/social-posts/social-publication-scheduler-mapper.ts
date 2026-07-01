import {
  validatePublicationScheduleIntent,
  type PublicationScheduleErrorCode,
  type PublicationScheduleIntent,
  type PublicationScheduleValidationError,
} from "./social-publication-scheduler";
import {
  mapPublicationScheduleIntentToScheduleRecord as buildScheduleRecordFromIntent,
  validateSocialPublicationSchedulerScheduleRecord,
  type SocialPublicationSchedulerPersistenceError,
  type SocialPublicationSchedulerScheduleRecord,
} from "./social-publication-scheduler-repository";

export const SOCIAL_PUBLICATION_SCHEDULER_MAPPER_ERROR_CODES = [
  "domain_validation_failed",
  "persistence_validation_failed",
  "timestamp_ordering_invalid",
  "serialization_invalid",
] as const;

export type SocialPublicationSchedulerMapperErrorCode =
  (typeof SOCIAL_PUBLICATION_SCHEDULER_MAPPER_ERROR_CODES)[number];

export type SocialPublicationSchedulerMapperError = Readonly<{
  code: SocialPublicationSchedulerMapperErrorCode;
  path: string;
  message: string;
  domainErrors?: readonly PublicationScheduleValidationError[];
  persistenceErrors?: readonly SocialPublicationSchedulerPersistenceError[];
}>;

export type SocialPublicationSchedulerMapperResult<T> = Readonly<
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      errors: readonly SocialPublicationSchedulerMapperError[];
    }
>;

export type SocialPublicationSchedulerMappedIntent = Readonly<{
  sourceScheduleId: string;
  intentType: PublicationScheduleIntent["intentType"];
  state: PublicationScheduleIntent["state"];
  schedule: SocialPublicationSchedulerScheduleRecord;
  deterministic: true;
  persisted: false;
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

const FORBIDDEN_MAPPER_STATE_KEYS = new Set([
  "accessToken",
  "access_token",
  "apiKey",
  "api_key",
  "canApprove",
  "canPublish",
  "canSchedule",
  "clientSecret",
  "client_secret",
  "credential",
  "credentials",
  "cron",
  "cronExpression",
  "cron_expression",
  "executionPlan",
  "execution_plan",
  "jobId",
  "learning",
  "learningSignal",
  "metrics",
  "modelFeedback",
  "oauth",
  "password",
  "publishAuthority",
  "publisherAuthority",
  "queueName",
  "refreshToken",
  "refresh_token",
  "retryPolicy",
  "schedulerAuthority",
  "secret",
  "timerId",
  "timerReference",
  "token",
  "workerId",
]);

export function validatePublicationScheduleIntentForPersistenceMapping(
  intent: unknown,
): SocialPublicationSchedulerMapperResult<PublicationScheduleIntent> {
  const errors: SocialPublicationSchedulerMapperError[] = [];

  const domainValidation = safeValidatePublicationScheduleIntent(intent);
  if (!domainValidation.ok) {
    errors.push(
      ...domainValidation.errors.map((error) =>
        mapperError("domain_validation_failed", error.path, error.message, [error]),
      ),
    );
  }

  if (!isRecord(intent)) {
    return { ok: false, errors };
  }

  const candidate = intent as PublicationScheduleIntent;
  rejectForbiddenMapperState(candidate, "intent", errors);

  if (
    hasText(candidate.createdAt) &&
    hasText(candidate.updatedAt) &&
    Number.isFinite(Date.parse(candidate.createdAt)) &&
    Number.isFinite(Date.parse(candidate.updatedAt)) &&
    Date.parse(candidate.updatedAt) < Date.parse(candidate.createdAt)
  ) {
    errors.push(
      mapperError(
        "timestamp_ordering_invalid",
        "updatedAt",
        "Publication schedule intent updatedAt must not precede createdAt.",
      ),
    );
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: immutableClone(candidate) };
}

function safeValidatePublicationScheduleIntent(
  intent: unknown,
):
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly PublicationScheduleValidationError[] } {
  try {
    return validatePublicationScheduleIntent(intent as PublicationScheduleIntent);
  } catch {
    return {
      ok: false,
      errors: [
        {
          code: "intent_invariant_failed" as PublicationScheduleErrorCode,
          path: "intent",
          message: "Publication schedule intent must be safe, acyclic data.",
        },
      ],
    };
  }
}

export function mapPublicationScheduleIntentToScheduleRecord(
  intent: PublicationScheduleIntent,
): SocialPublicationSchedulerMapperResult<SocialPublicationSchedulerScheduleRecord> {
  const validation = validatePublicationScheduleIntentForPersistenceMapping(intent);
  if (!validation.ok) return validation;

  const record = buildScheduleRecordFromIntent(validation.value);
  const persistenceValidation = validateSocialPublicationSchedulerScheduleRecord(record);
  if (!persistenceValidation.ok) {
    return {
      ok: false,
      errors: [
        mapperError(
          "persistence_validation_failed",
          "schedule",
          "Mapped scheduler persistence record failed validation.",
          undefined,
          persistenceValidation.errors,
        ),
      ],
    };
  }

  return { ok: true, value: immutableClone(record) };
}

export function mapPublicationScheduleIntentToPersistenceMapping(
  intent: PublicationScheduleIntent,
): SocialPublicationSchedulerMapperResult<SocialPublicationSchedulerMappedIntent> {
  const recordResult = mapPublicationScheduleIntentToScheduleRecord(intent);
  if (!recordResult.ok) return recordResult;

  return {
    ok: true,
    value: immutableClone({
      sourceScheduleId: intent.scheduleId,
      intentType: intent.intentType,
      state: intent.state,
      schedule: recordResult.value,
      deterministic: true,
      persisted: false,
      publishesNothing: true,
      executesNothing: true,
      schedulesIntentOnly: true,
      mutatesLedger: false,
      mutatesApproval: false,
      mutatesManifest: false,
      mutatesTargets: false,
      recordsNoMetrics: true,
      performsNoLearning: true,
    }),
  };
}

export function previewPublicationScheduleIntentPersistenceMapping(
  intent: PublicationScheduleIntent,
): SocialPublicationSchedulerMapperResult<SocialPublicationSchedulerMappedIntent> {
  return mapPublicationScheduleIntentToPersistenceMapping(intent);
}

export function publicationScheduleMappedIntentsEqual(
  left: SocialPublicationSchedulerMappedIntent,
  right: SocialPublicationSchedulerMappedIntent,
): boolean {
  return stableStringify(sortMappedIntent(left)) === stableStringify(sortMappedIntent(right));
}

export function serializePublicationScheduleMappedIntent(
  mapped: SocialPublicationSchedulerMappedIntent,
): string {
  return stableStringify(sortMappedIntent(mapped));
}

export function hydratePublicationScheduleMappedIntent(
  serialized: string,
): SocialPublicationSchedulerMapperResult<SocialPublicationSchedulerMappedIntent> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    return {
      ok: false,
      errors: [
        mapperError(
          "serialization_invalid",
          "serialized",
          "Serialized publication schedule mapped intent must be valid JSON.",
        ),
      ],
    };
  }

  if (!isMappedIntent(parsed)) {
    return {
      ok: false,
      errors: [
        mapperError(
          "serialization_invalid",
          "serialized",
          "Serialized publication schedule mapped intent has an invalid shape.",
        ),
      ],
    };
  }

  return { ok: true, value: immutableClone(sortMappedIntent(parsed)) };
}

function mapperError(
  code: SocialPublicationSchedulerMapperErrorCode,
  path: string,
  message: string,
  domainErrors?: readonly PublicationScheduleValidationError[],
  persistenceErrors?: readonly SocialPublicationSchedulerPersistenceError[],
): SocialPublicationSchedulerMapperError {
  return { code, path, message, domainErrors, persistenceErrors };
}

function rejectForbiddenMapperState(
  value: unknown,
  path: string,
  errors: SocialPublicationSchedulerMapperError[],
  seen = new WeakSet<object>(),
): void {
  if (!value || typeof value !== "object") return;

  if (seen.has(value)) {
    errors.push(
      mapperError(
        "domain_validation_failed",
        path,
        "Publication schedule mapper input must be acyclic.",
      ),
    );
    return;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      rejectForbiddenMapperState(item, `${path}.${index}`, errors, seen),
    );
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_MAPPER_STATE_KEYS.has(key)) {
      errors.push(
        mapperError(
          "domain_validation_failed",
          childPath,
          "Publication schedule mapper input contains forbidden execution state.",
        ),
      );
    }
    rejectForbiddenMapperState(child, childPath, errors, seen);
  }
}

function sortMappedIntent(
  mapped: SocialPublicationSchedulerMappedIntent,
): SocialPublicationSchedulerMappedIntent {
  return {
    sourceScheduleId: mapped.sourceScheduleId,
    intentType: mapped.intentType,
    state: mapped.state,
    schedule: mapped.schedule,
    deterministic: mapped.deterministic,
    persisted: mapped.persisted,
    publishesNothing: mapped.publishesNothing,
    executesNothing: mapped.executesNothing,
    schedulesIntentOnly: mapped.schedulesIntentOnly,
    mutatesLedger: mapped.mutatesLedger,
    mutatesApproval: mapped.mutatesApproval,
    mutatesManifest: mapped.mutatesManifest,
    mutatesTargets: mapped.mutatesTargets,
    recordsNoMetrics: mapped.recordsNoMetrics,
    performsNoLearning: mapped.performsNoLearning,
  };
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

function isMappedIntent(value: unknown): value is SocialPublicationSchedulerMappedIntent {
  if (!isRecord(value)) return false;

  return (
    typeof value.sourceScheduleId === "string" &&
    typeof value.intentType === "string" &&
    typeof value.state === "string" &&
    isRecord(value.schedule) &&
    value.deterministic === true &&
    value.persisted === false &&
    value.publishesNothing === true &&
    value.executesNothing === true &&
    value.schedulesIntentOnly === true &&
    value.mutatesLedger === false &&
    value.mutatesApproval === false &&
    value.mutatesManifest === false &&
    value.mutatesTargets === false &&
    value.recordsNoMetrics === true &&
    value.performsNoLearning === true
  );
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
