import { isSupabaseServiceConfigured } from "../supabase/admin";

import {
  appendSocialPublicationScheduleIntent,
  createSocialPublicationScheduleIntent,
  fetchSocialPublicationScheduleRecords,
  type SocialPublicationSchedulerReadFilter,
  type SocialPublicationSchedulerStoreError,
  type SocialPublicationSchedulerStoreWriteOptions,
} from "./social-publication-scheduler-store";
import {
  validateSocialPublicationSchedulerAppendRequest,
  validateSocialPublicationSchedulerCreateRequest,
  validateSocialPublicationSchedulerPersistenceModel,
  validateSocialPublicationSchedulerRepositoryIdentity,
  type SocialPublicationSchedulerPersistenceError,
  type SocialPublicationSchedulerPersistenceModel,
  type SocialPublicationSchedulerRepositoryError,
  type SocialPublicationSchedulerRepositoryIdentity,
  type SocialPublicationSchedulerScheduleRecord,
} from "./social-publication-scheduler-repository";

export const SOCIAL_PUBLICATION_SCHEDULER_BRIDGE_MODES = [
  "environment",
  "reference",
  "production",
] as const;

export type SocialPublicationSchedulerBridgeMode =
  (typeof SOCIAL_PUBLICATION_SCHEDULER_BRIDGE_MODES)[number];

export const SOCIAL_PUBLICATION_SCHEDULER_BRIDGE_ERROR_CODES = [
  "configuration_invalid",
  "production_unavailable",
  "unsafe_reference_in_production",
  "validation_failed",
  "storage_error",
  "not_found",
  "identity_collision",
  "relationship_invalid",
  "storage_inconsistent",
] as const;

export type SocialPublicationSchedulerBridgeErrorCode =
  (typeof SOCIAL_PUBLICATION_SCHEDULER_BRIDGE_ERROR_CODES)[number];

export type SocialPublicationSchedulerBridgeError = Readonly<{
  code: SocialPublicationSchedulerBridgeErrorCode;
  message: string;
  repositoryError?: SocialPublicationSchedulerRepositoryError;
  storeError?: SocialPublicationSchedulerStoreError;
  validationErrors?: readonly SocialPublicationSchedulerPersistenceError[];
}>;

export type SocialPublicationSchedulerBridgeResult<T> = Readonly<
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: SocialPublicationSchedulerBridgeError;
    }
>;

export type SocialPublicationSchedulerBridgeRuntimeEnvironment =
  | "development"
  | "production"
  | "test";

export type SocialPublicationSchedulerBridgeConfig = Readonly<{
  mode?: SocialPublicationSchedulerBridgeMode;
  runtimeEnvironment?: SocialPublicationSchedulerBridgeRuntimeEnvironment;
  productionStoreConfigured?: boolean;
  seed?: SocialPublicationSchedulerPersistenceModel;
  implementation?: SocialPublicationSchedulerBridgeImplementation;
}>;

export type SocialPublicationSchedulerBridgeImplementation =
  | SocialPublicationSchedulerBridge
  | Readonly<{
      createScheduleIntent(
        record: SocialPublicationSchedulerScheduleRecord,
        options?: SocialPublicationSchedulerStoreWriteOptions,
      ): Promise<SocialPublicationSchedulerBridgeResult<SocialPublicationSchedulerScheduleRecord>>;
      appendScheduleIntent(
        record: SocialPublicationSchedulerScheduleRecord,
        options?: SocialPublicationSchedulerStoreWriteOptions,
      ): Promise<SocialPublicationSchedulerBridgeResult<SocialPublicationSchedulerScheduleRecord>>;
      listScheduleIntents(
        filter?: SocialPublicationSchedulerReadFilter,
      ): Promise<SocialPublicationSchedulerBridgeResult<readonly SocialPublicationSchedulerScheduleRecord[]>>;
      loadByIdentity(
        identity: SocialPublicationSchedulerRepositoryIdentity,
      ): Promise<SocialPublicationSchedulerBridgeResult<SocialPublicationSchedulerPersistenceModel>>;
    }>;

export type SocialPublicationSchedulerBridge = Readonly<{
  mode: Exclude<SocialPublicationSchedulerBridgeMode, "environment">;
  createScheduleIntent(
    record: SocialPublicationSchedulerScheduleRecord,
    options?: SocialPublicationSchedulerStoreWriteOptions,
  ): Promise<SocialPublicationSchedulerBridgeResult<SocialPublicationSchedulerScheduleRecord>>;
  appendScheduleIntent(
    record: SocialPublicationSchedulerScheduleRecord,
    options?: SocialPublicationSchedulerStoreWriteOptions,
  ): Promise<SocialPublicationSchedulerBridgeResult<SocialPublicationSchedulerScheduleRecord>>;
  listScheduleIntents(
    filter?: SocialPublicationSchedulerReadFilter,
  ): Promise<SocialPublicationSchedulerBridgeResult<readonly SocialPublicationSchedulerScheduleRecord[]>>;
  loadByIdentity(
    identity: SocialPublicationSchedulerRepositoryIdentity,
  ): Promise<SocialPublicationSchedulerBridgeResult<SocialPublicationSchedulerPersistenceModel>>;
}>;

export function createSocialPublicationSchedulerBridge(
  config: SocialPublicationSchedulerBridgeConfig = {},
): SocialPublicationSchedulerBridgeResult<SocialPublicationSchedulerBridge> {
  const resolved = resolveBridgeMode(config);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  if (resolved.value.mode === "reference") {
    if (config.implementation) {
      return {
        ok: true,
        value: immutableCloneBridge(config.implementation, resolved.value.mode),
      };
    }

    return createReferenceBridge(config.seed);
  }

  const configured =
    config.productionStoreConfigured ?? isSupabaseServiceConfigured();
  if (!configured) {
    return failure(
      "production_unavailable",
      "Publication scheduler production store is not configured.",
    );
  }

  if (config.implementation) {
    return {
      ok: true,
      value: immutableCloneBridge(config.implementation, resolved.value.mode),
    };
  }

  return { ok: true, value: createProductionBridge() };
}

export function resolveSocialPublicationSchedulerBridgeMode(
  config: SocialPublicationSchedulerBridgeConfig = {},
): SocialPublicationSchedulerBridgeResult<
  Readonly<{
    mode: Exclude<SocialPublicationSchedulerBridgeMode, "environment">;
    runtimeEnvironment: SocialPublicationSchedulerBridgeRuntimeEnvironment;
  }>
> {
  return resolveBridgeMode(config);
}

function resolveBridgeMode(
  config: SocialPublicationSchedulerBridgeConfig,
): SocialPublicationSchedulerBridgeResult<
  Readonly<{
    mode: Exclude<SocialPublicationSchedulerBridgeMode, "environment">;
    runtimeEnvironment: SocialPublicationSchedulerBridgeRuntimeEnvironment;
  }>
> {
  const runtimeEnvironment =
    config.runtimeEnvironment ?? currentRuntimeEnvironment();
  const requestedMode = config.mode ?? "environment";

  if (!SOCIAL_PUBLICATION_SCHEDULER_BRIDGE_MODES.includes(requestedMode)) {
    return failure(
      "configuration_invalid",
      "Publication scheduler bridge mode is invalid.",
    );
  }

  const mode =
    requestedMode === "environment"
      ? runtimeEnvironment === "production"
        ? "production"
        : "reference"
      : requestedMode;

  if (runtimeEnvironment === "production" && mode === "reference") {
    return failure(
      "unsafe_reference_in_production",
      "Reference publication scheduler persistence is not allowed in production.",
    );
  }

  return { ok: true, value: { mode, runtimeEnvironment } };
}

function createReferenceBridge(
  seed?: SocialPublicationSchedulerPersistenceModel,
): SocialPublicationSchedulerBridgeResult<SocialPublicationSchedulerBridge> {
  const state: SocialPublicationSchedulerPersistenceModel = immutableClone(
    seed ?? { schedules: [] },
  );
  const validation = validateSocialPublicationSchedulerPersistenceModel(state);
  if (!validation.ok) {
    return validationFailure(
      "Publication scheduler seed model failed bridge validation.",
      validation.errors,
    );
  }

  const schedules = [...state.schedules];

  return {
    ok: true,
    value: Object.freeze({
      mode: "reference",
      createScheduleIntent(record) {
        return Promise.resolve(createScheduleInMemory(schedules, record));
      },
      appendScheduleIntent(record) {
        return Promise.resolve(appendScheduleInMemory(schedules, record));
      },
      listScheduleIntents(filter = {}) {
        return Promise.resolve({
          ok: true,
          value: immutableClone(sortSchedules(schedules.filter((record) => matchesFilter(record, filter)))),
        });
      },
      loadByIdentity(identity) {
        const validationResult =
          validateSocialPublicationSchedulerRepositoryIdentity(identity);
        if (!validationResult.ok) {
          return Promise.resolve({
            ok: false,
            error: mapRepositoryError(validationResult.error),
          });
        }

        return Promise.resolve({
          ok: true,
          value: immutableClone({
            schedules: sortSchedules(schedules.filter((record) => matchesIdentity(record, identity))),
          }),
        });
      },
    }),
  };
}

function createProductionBridge(): SocialPublicationSchedulerBridge {
  return Object.freeze({
    mode: "production",
    async createScheduleIntent(record, options) {
      const validation = validateSocialPublicationSchedulerCreateRequest({
        schedule: record,
      });
      if (!validation.ok) {
        return validationFailure(
          "Publication scheduler create request failed bridge validation.",
          validation.error.validationErrors ?? [],
        );
      }

      return mapStoreResult(
        await createSocialPublicationScheduleIntent(record, options),
      );
    },
    async appendScheduleIntent(record, options) {
      const validation = validateSocialPublicationSchedulerAppendRequest({
        schedule: record,
      });
      if (!validation.ok) {
        return validationFailure(
          "Publication scheduler append request failed bridge validation.",
          validation.error.validationErrors ?? [],
        );
      }

      return mapStoreResult(
        await appendSocialPublicationScheduleIntent(record, options),
      );
    },
    async listScheduleIntents(filter = {}) {
      return mapStoreResult(await fetchSocialPublicationScheduleRecords(filter));
    },
    async loadByIdentity(identity) {
      const validation = validateSocialPublicationSchedulerRepositoryIdentity(identity);
      if (!validation.ok) {
        return { ok: false, error: mapRepositoryError(validation.error) };
      }

      const filter: SocialPublicationSchedulerReadFilter = {
        scheduleId: identity.schedule_id,
        socialPostId: identity.social_post_id,
        publicationTargetId: identity.publication_target_id,
        publicationManifestId: identity.publication_manifest_id,
      };
      const records = await fetchSocialPublicationScheduleRecords(filter);
      if (!records.ok) return { ok: false, error: mapStoreError(records.error) };

      return {
        ok: true,
        value: immutableClone({
          schedules: records.value.filter((record) => matchesIdentity(record, identity)),
        }),
      };
    },
  });
}

function createScheduleInMemory(
  schedules: SocialPublicationSchedulerScheduleRecord[],
  record: SocialPublicationSchedulerScheduleRecord,
): SocialPublicationSchedulerBridgeResult<SocialPublicationSchedulerScheduleRecord> {
  const validation = validateSocialPublicationSchedulerCreateRequest({ schedule: record });
  if (!validation.ok) return { ok: false, error: mapRepositoryError(validation.error) };

  if (schedules.some((item) => item.schedule_id === record.schedule_id)) {
    return failure(
      "identity_collision",
      "Publication schedule identity already exists; use append instead of create.",
    );
  }

  schedules.push(immutableClone(record));
  return { ok: true, value: immutableClone(record) };
}

function appendScheduleInMemory(
  schedules: SocialPublicationSchedulerScheduleRecord[],
  record: SocialPublicationSchedulerScheduleRecord,
): SocialPublicationSchedulerBridgeResult<SocialPublicationSchedulerScheduleRecord> {
  const validation = validateSocialPublicationSchedulerAppendRequest({ schedule: record });
  if (!validation.ok) return { ok: false, error: mapRepositoryError(validation.error) };

  const latest = latestScheduleByScheduleId(schedules, record.schedule_id);
  if (!latest) {
    return failure(
      "relationship_invalid",
      "Publication schedule append requires an existing schedule identity.",
    );
  }

  if (
    latest.scope.social_post_id !== record.scope.social_post_id ||
    latest.scope.publication_target_id !== record.scope.publication_target_id ||
    latest.intent_type !== record.intent_type
  ) {
    return failure(
      "relationship_invalid",
      "Publication schedule append scope must match the schedule's prior scope.",
    );
  }

  if (Date.parse(record.recorded_at) < Date.parse(latest.recorded_at)) {
    return failure(
      "relationship_invalid",
      "Publication schedule append must not record before the latest known state.",
    );
  }

  schedules.push(immutableClone(record));
  return { ok: true, value: immutableClone(record) };
}

function latestScheduleByScheduleId(
  schedules: readonly SocialPublicationSchedulerScheduleRecord[],
  scheduleId: string,
): SocialPublicationSchedulerScheduleRecord | null {
  const matches = schedules
    .filter((record) => record.schedule_id === scheduleId)
    .sort((left, right) => Date.parse(right.recorded_at) - Date.parse(left.recorded_at));

  return matches[0] ?? null;
}

function mapStoreResult<T>(
  result:
    | Readonly<{ ok: true; value: T }>
    | Readonly<{ ok: false; error: SocialPublicationSchedulerStoreError }>,
): SocialPublicationSchedulerBridgeResult<T> {
  if (result.ok) return { ok: true, value: immutableClone(result.value) };
  return { ok: false, error: mapStoreError(result.error) };
}

function mapRepositoryError(
  error: SocialPublicationSchedulerRepositoryError,
): SocialPublicationSchedulerBridgeError {
  const code: SocialPublicationSchedulerBridgeErrorCode =
    error.code === "not_found"
      ? "not_found"
      : error.code === "identity_collision"
        ? "identity_collision"
        : error.code === "identity_required"
          ? "validation_failed"
          : "validation_failed";

  return {
    code,
    message: error.message,
    repositoryError: error,
    validationErrors: error.validationErrors,
  };
}

function mapStoreError(
  error: SocialPublicationSchedulerStoreError,
): SocialPublicationSchedulerBridgeError {
  const code: SocialPublicationSchedulerBridgeErrorCode =
    error.code === "duplicate_identity" ||
    error.code === "duplicate_idempotency_key"
      ? "identity_collision"
      : error.code === "parent_missing" ||
          error.code === "scope_mismatch" ||
          error.code === "ordering_invalid"
        ? "relationship_invalid"
        : error.code === "validation_failed"
          ? "validation_failed"
          : error.code === "storage_inconsistent"
            ? "storage_inconsistent"
            : "storage_error";

  return {
    code,
    message: error.message,
    storeError: error,
    validationErrors: error.validationErrors?.filter(isPersistenceError),
  };
}

function validationFailure<T>(
  message: string,
  validationErrors: readonly SocialPublicationSchedulerPersistenceError[],
): SocialPublicationSchedulerBridgeResult<T> {
  return {
    ok: false,
    error: {
      code: "validation_failed",
      message,
      validationErrors,
    },
  };
}

function failure<T>(
  code: SocialPublicationSchedulerBridgeErrorCode,
  message: string,
): SocialPublicationSchedulerBridgeResult<T> {
  return { ok: false, error: { code, message } };
}

function immutableCloneBridge(
  implementation: SocialPublicationSchedulerBridgeImplementation,
  mode: Exclude<SocialPublicationSchedulerBridgeMode, "environment">,
): SocialPublicationSchedulerBridge {
  return Object.freeze({
    mode,
    createScheduleIntent: implementation.createScheduleIntent,
    appendScheduleIntent: implementation.appendScheduleIntent,
    listScheduleIntents: implementation.listScheduleIntents,
    loadByIdentity: implementation.loadByIdentity,
  });
}

function matchesFilter(
  record: SocialPublicationSchedulerScheduleRecord,
  filter: SocialPublicationSchedulerReadFilter,
): boolean {
  return (
    (!filter.scheduleId || record.schedule_id === filter.scheduleId) &&
    (!filter.socialPostId || record.scope.social_post_id === filter.socialPostId) &&
    (!filter.publicationTargetId ||
      record.scope.publication_target_id === filter.publicationTargetId) &&
    (!filter.publicationManifestId ||
      record.scope.publication_manifest_id === filter.publicationManifestId) &&
    (!filter.state || record.state === filter.state)
  );
}

function matchesIdentity(
  record: SocialPublicationSchedulerScheduleRecord,
  identity: SocialPublicationSchedulerRepositoryIdentity,
): boolean {
  return (
    (!identity.schedule_id || record.schedule_id === identity.schedule_id) &&
    (!identity.social_post_id ||
      record.scope.social_post_id === identity.social_post_id) &&
    (!identity.publication_target_id ||
      record.scope.publication_target_id === identity.publication_target_id) &&
    (!identity.publication_manifest_id ||
      record.scope.publication_manifest_id === identity.publication_manifest_id) &&
    (!identity.owner_approval_id ||
      record.scope.owner_approval_id === identity.owner_approval_id) &&
    (!identity.approval_id || record.scope.approval_id === identity.approval_id) &&
    (!identity.proposal_id || record.scope.proposal_id === identity.proposal_id)
  );
}

function sortSchedules(
  schedules: readonly SocialPublicationSchedulerScheduleRecord[],
): SocialPublicationSchedulerScheduleRecord[] {
  return [...schedules].sort(
    (left, right) =>
      Date.parse(left.intended_publish_at) - Date.parse(right.intended_publish_at) ||
      left.recorded_at.localeCompare(right.recorded_at) ||
      String(left.schedule_id).localeCompare(String(right.schedule_id)),
  );
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

function currentRuntimeEnvironment(): SocialPublicationSchedulerBridgeRuntimeEnvironment {
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.NODE_ENV === "test") return "test";
  return "development";
}

function isPersistenceError(
  error: unknown,
): error is SocialPublicationSchedulerPersistenceError {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { path?: unknown }).path === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

export function validateSocialPublicationSchedulerBridgeModel(
  model: unknown,
): SocialPublicationSchedulerBridgeResult<SocialPublicationSchedulerPersistenceModel> {
  const validation = validateSocialPublicationSchedulerPersistenceModel(
    model as SocialPublicationSchedulerPersistenceModel,
  );
  if (!validation.ok) {
    return validationFailure(
      "Publication scheduler bridge model failed validation.",
      validation.errors,
    );
  }

  return {
    ok: true,
    value: immutableClone(model as SocialPublicationSchedulerPersistenceModel),
  };
}
