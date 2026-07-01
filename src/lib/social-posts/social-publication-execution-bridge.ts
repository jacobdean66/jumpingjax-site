import { isSupabaseServiceConfigured } from "../supabase/admin";

import {
  appendSocialPublicationExecutionResult,
  createSocialPublicationExecutionIntent,
  fetchSocialPublicationExecutionRecords,
  type SocialPublicationExecutionReadFilter,
  type SocialPublicationExecutionStoreError,
  type SocialPublicationExecutionStoreWriteOptions,
} from "./social-publication-execution-store";
import {
  createReferenceSocialPublicationExecutionRepository,
  validateSocialPublicationExecutionAppendResultRequest,
  validateSocialPublicationExecutionCreateIntentRequest,
  validateSocialPublicationExecutionPersistenceModel,
  validateSocialPublicationExecutionRepositoryIdentity,
  type SocialPublicationExecutionIntentRecord,
  type SocialPublicationExecutionPersistenceModel,
  type SocialPublicationExecutionRecordError,
  type SocialPublicationExecutionRepositoryError,
  type SocialPublicationExecutionRepositoryIdentity,
  type SocialPublicationExecutionResultRecord,
} from "./social-publication-execution-repository";

export const SOCIAL_PUBLICATION_EXECUTION_BRIDGE_MODES = [
  "environment",
  "reference",
  "production",
] as const;

export type SocialPublicationExecutionBridgeMode =
  (typeof SOCIAL_PUBLICATION_EXECUTION_BRIDGE_MODES)[number];

export const SOCIAL_PUBLICATION_EXECUTION_BRIDGE_ERROR_CODES = [
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

export type SocialPublicationExecutionBridgeErrorCode =
  (typeof SOCIAL_PUBLICATION_EXECUTION_BRIDGE_ERROR_CODES)[number];

export type SocialPublicationExecutionBridgeError = Readonly<{
  code: SocialPublicationExecutionBridgeErrorCode;
  message: string;
  repositoryError?: SocialPublicationExecutionRepositoryError;
  storeError?: SocialPublicationExecutionStoreError;
  validationErrors?: readonly SocialPublicationExecutionRecordError[];
}>;

export type SocialPublicationExecutionBridgeResult<T> = Readonly<
  | { ok: true; value: T }
  | { ok: false; error: SocialPublicationExecutionBridgeError }
>;

export type SocialPublicationExecutionBridgeRuntimeEnvironment =
  | "development"
  | "production"
  | "test";

export type SocialPublicationExecutionBridgeImplementation =
  | SocialPublicationExecutionBridge
  | Readonly<{
      createExecutionIntent(
        record: SocialPublicationExecutionIntentRecord,
        options?: SocialPublicationExecutionStoreWriteOptions,
      ): Promise<SocialPublicationExecutionBridgeResult<SocialPublicationExecutionIntentRecord>>;
      appendExecutionResult(
        record: SocialPublicationExecutionResultRecord,
        options?: SocialPublicationExecutionStoreWriteOptions,
      ): Promise<SocialPublicationExecutionBridgeResult<SocialPublicationExecutionResultRecord>>;
      listExecutionRecords(
        identity?: SocialPublicationExecutionRepositoryIdentity,
      ): Promise<SocialPublicationExecutionBridgeResult<SocialPublicationExecutionPersistenceModel>>;
      listExecutionIntents(
        identity?: SocialPublicationExecutionRepositoryIdentity,
      ): Promise<SocialPublicationExecutionBridgeResult<readonly SocialPublicationExecutionIntentRecord[]>>;
      listExecutionResults(
        identity?: SocialPublicationExecutionRepositoryIdentity,
      ): Promise<SocialPublicationExecutionBridgeResult<readonly SocialPublicationExecutionResultRecord[]>>;
      loadByIdentity(
        identity: SocialPublicationExecutionRepositoryIdentity,
      ): Promise<SocialPublicationExecutionBridgeResult<SocialPublicationExecutionPersistenceModel>>;
      snapshot(): Promise<SocialPublicationExecutionBridgeResult<SocialPublicationExecutionPersistenceModel>>;
    }>;

export type SocialPublicationExecutionBridgeConfig = Readonly<{
  mode?: SocialPublicationExecutionBridgeMode;
  runtimeEnvironment?: SocialPublicationExecutionBridgeRuntimeEnvironment;
  productionStoreConfigured?: boolean;
  seed?: SocialPublicationExecutionPersistenceModel;
  implementation?: SocialPublicationExecutionBridgeImplementation;
}>;

export type SocialPublicationExecutionBridge = Readonly<{
  mode: Exclude<SocialPublicationExecutionBridgeMode, "environment">;
  createsNoExecution: true;
  createExecutionIntent(
    record: SocialPublicationExecutionIntentRecord,
    options?: SocialPublicationExecutionStoreWriteOptions,
  ): Promise<SocialPublicationExecutionBridgeResult<SocialPublicationExecutionIntentRecord>>;
  appendExecutionResult(
    record: SocialPublicationExecutionResultRecord,
    options?: SocialPublicationExecutionStoreWriteOptions,
  ): Promise<SocialPublicationExecutionBridgeResult<SocialPublicationExecutionResultRecord>>;
  listExecutionRecords(
    identity?: SocialPublicationExecutionRepositoryIdentity,
  ): Promise<SocialPublicationExecutionBridgeResult<SocialPublicationExecutionPersistenceModel>>;
  listExecutionIntents(
    identity?: SocialPublicationExecutionRepositoryIdentity,
  ): Promise<SocialPublicationExecutionBridgeResult<readonly SocialPublicationExecutionIntentRecord[]>>;
  listExecutionResults(
    identity?: SocialPublicationExecutionRepositoryIdentity,
  ): Promise<SocialPublicationExecutionBridgeResult<readonly SocialPublicationExecutionResultRecord[]>>;
  loadByIdentity(
    identity: SocialPublicationExecutionRepositoryIdentity,
  ): Promise<SocialPublicationExecutionBridgeResult<SocialPublicationExecutionPersistenceModel>>;
  snapshot(): Promise<SocialPublicationExecutionBridgeResult<SocialPublicationExecutionPersistenceModel>>;
}>;

export function createSocialPublicationExecutionBridge(
  config: SocialPublicationExecutionBridgeConfig = {},
): SocialPublicationExecutionBridgeResult<SocialPublicationExecutionBridge> {
  const resolved = resolveBridgeMode(config);
  if (!resolved.ok) return resolved;

  if (resolved.value.mode === "reference") {
    if (config.implementation) {
      return {
        ok: true,
        value: immutableCloneBridge(config.implementation, "reference"),
      };
    }
    return createReferenceBridge(config.seed);
  }

  const configured =
    config.productionStoreConfigured ?? isSupabaseServiceConfigured();
  if (!configured) {
    return failure(
      "production_unavailable",
      "Publication execution production store is not configured.",
    );
  }

  if (config.implementation) {
    return {
      ok: true,
      value: immutableCloneBridge(config.implementation, "production"),
    };
  }

  return { ok: true, value: createProductionBridge() };
}

export function resolveSocialPublicationExecutionBridgeMode(
  config: SocialPublicationExecutionBridgeConfig = {},
): SocialPublicationExecutionBridgeResult<
  Readonly<{
    mode: Exclude<SocialPublicationExecutionBridgeMode, "environment">;
    runtimeEnvironment: SocialPublicationExecutionBridgeRuntimeEnvironment;
  }>
> {
  return resolveBridgeMode(config);
}

export function validateSocialPublicationExecutionBridgeModel(
  model: unknown,
): SocialPublicationExecutionBridgeResult<SocialPublicationExecutionPersistenceModel> {
  const validation = validateSocialPublicationExecutionPersistenceModel(model);
  if (!validation.ok) {
    return validationFailure(
      "Publication execution bridge model failed validation.",
      validation.errors,
    );
  }

  return { ok: true, value: immutableClone(model as SocialPublicationExecutionPersistenceModel) };
}

function resolveBridgeMode(
  config: SocialPublicationExecutionBridgeConfig,
): SocialPublicationExecutionBridgeResult<
  Readonly<{
    mode: Exclude<SocialPublicationExecutionBridgeMode, "environment">;
    runtimeEnvironment: SocialPublicationExecutionBridgeRuntimeEnvironment;
  }>
> {
  const runtimeEnvironment =
    config.runtimeEnvironment ?? currentRuntimeEnvironment();
  const requestedMode = config.mode ?? "environment";

  if (!SOCIAL_PUBLICATION_EXECUTION_BRIDGE_MODES.includes(requestedMode)) {
    return failure(
      "configuration_invalid",
      "Publication execution bridge mode is invalid.",
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
      "Reference publication execution persistence is not allowed in production.",
    );
  }

  return { ok: true, value: { mode, runtimeEnvironment } };
}

function createReferenceBridge(
  seed?: SocialPublicationExecutionPersistenceModel,
): SocialPublicationExecutionBridgeResult<SocialPublicationExecutionBridge> {
  const model = immutableClone(seed ?? { intents: [], results: [] });
  const validation = validateSocialPublicationExecutionPersistenceModel(model);
  if (!validation.ok) {
    return validationFailure(
      "Publication execution seed model failed bridge validation.",
      validation.errors,
    );
  }

  const repository = createReferenceSocialPublicationExecutionRepository(model);

  return {
    ok: true,
    value: Object.freeze({
      mode: "reference",
      createsNoExecution: true,
      createExecutionIntent(record) {
        const result = repository.createExecutionIntent({ intent: record });
        return Promise.resolve(mapRepositoryResult(result));
      },
      appendExecutionResult(record) {
        const result = repository.appendExecutionResult({ result: record });
        return Promise.resolve(mapRepositoryResult(result));
      },
      listExecutionRecords(identity = {}) {
        if (hasIdentity(identity)) {
          const result = repository.getExecutionRecordsByIdentity(identity);
          return Promise.resolve(mapRepositoryResult(result));
        }
        return Promise.resolve(mapRepositoryResult(repository.snapshot()));
      },
      listExecutionIntents(identity = {}) {
        if (hasIdentity(identity)) {
          const result = repository.listExecutionIntents(identity);
          return Promise.resolve(mapRepositoryResult(result));
        }
        return Promise.resolve(
          mapModelToIntents(mapRepositoryResult(repository.snapshot())),
        );
      },
      listExecutionResults(identity = {}) {
        if (hasIdentity(identity)) {
          const result = repository.listExecutionResults(identity);
          return Promise.resolve(mapRepositoryResult(result));
        }
        return Promise.resolve(
          mapModelToResults(mapRepositoryResult(repository.snapshot())),
        );
      },
      loadByIdentity(identity) {
        const result = repository.getExecutionRecordsByIdentity(identity);
        return Promise.resolve(mapRepositoryResult(result));
      },
      snapshot() {
        return Promise.resolve(mapRepositoryResult(repository.snapshot()));
      },
    }),
  };
}

function createProductionBridge(): SocialPublicationExecutionBridge {
  async function listExecutionRecords(
    identity: SocialPublicationExecutionRepositoryIdentity = {},
  ): Promise<SocialPublicationExecutionBridgeResult<SocialPublicationExecutionPersistenceModel>> {
    const identityValidation = validateOptionalIdentity(identity);
    if (!identityValidation.ok) return identityValidation;

    const records = await fetchSocialPublicationExecutionRecords(
      identityToReadFilter(identity),
    );
    if (!records.ok) return { ok: false, error: mapStoreError(records.error) };

    return {
      ok: true,
      value: immutableClone(filterModel(records.value, identity)),
    };
  }

  return Object.freeze({
    mode: "production",
    createsNoExecution: true,
    async createExecutionIntent(record, options) {
      const validation = validateSocialPublicationExecutionCreateIntentRequest({
        intent: record,
      });
      if (!validation.ok) return { ok: false, error: mapRepositoryError(validation.error) };

      return mapStoreResult(
        await createSocialPublicationExecutionIntent(record, options),
      );
    },
    async appendExecutionResult(record, options) {
      const validation = validateSocialPublicationExecutionAppendResultRequest({
        result: record,
      });
      if (!validation.ok) return { ok: false, error: mapRepositoryError(validation.error) };

      return mapStoreResult(
        await appendSocialPublicationExecutionResult(record, options),
      );
    },
    listExecutionRecords,
    async listExecutionIntents(identity = {}) {
      return mapModelToIntents(await listExecutionRecords(identity));
    },
    async listExecutionResults(identity = {}) {
      return mapModelToResults(await listExecutionRecords(identity));
    },
    async loadByIdentity(identity) {
      const validation = validateSocialPublicationExecutionRepositoryIdentity(identity);
      if (!validation.ok) return { ok: false, error: mapRepositoryError(validation.error) };
      return listExecutionRecords(identity);
    },
    snapshot() {
      return listExecutionRecords({});
    },
  });
}

function validateOptionalIdentity(
  identity: SocialPublicationExecutionRepositoryIdentity,
): SocialPublicationExecutionBridgeResult<SocialPublicationExecutionRepositoryIdentity> {
  if (!hasIdentity(identity)) return { ok: true, value: {} };

  const validation = validateSocialPublicationExecutionRepositoryIdentity(identity);
  if (!validation.ok) return { ok: false, error: mapRepositoryError(validation.error) };
  return { ok: true, value: validation.value };
}

function identityToReadFilter(
  identity: SocialPublicationExecutionRepositoryIdentity,
): SocialPublicationExecutionReadFilter {
  return {
    executionJobId: identity.execution_job_id,
    socialPostId: identity.social_post_id,
    publicationTargetId: identity.publication_target_id,
    publicationManifestId: identity.publication_manifest_id,
    publisherRequestId: identity.publisher_request_id,
    scheduleId: identity.schedule_id,
  };
}

function filterModel(
  model: SocialPublicationExecutionPersistenceModel,
  identity: SocialPublicationExecutionRepositoryIdentity,
): SocialPublicationExecutionPersistenceModel {
  if (!hasIdentity(identity)) {
    return {
      intents: sortIntents(model.intents),
      results: sortResults(model.results),
    };
  }

  const repository = createReferenceSocialPublicationExecutionRepository({
    intents: model.intents,
    results: model.results,
  });
  const result = repository.getExecutionRecordsByIdentity(identity);
  if (!result.ok) return { intents: [], results: [] };
  return result.value;
}

function hasIdentity(identity: SocialPublicationExecutionRepositoryIdentity): boolean {
  return Object.values(identity).some((value) => value !== undefined);
}

function mapModelToIntents(
  result: SocialPublicationExecutionBridgeResult<SocialPublicationExecutionPersistenceModel>,
): SocialPublicationExecutionBridgeResult<readonly SocialPublicationExecutionIntentRecord[]> {
  if (!result.ok) return result;
  return { ok: true, value: immutableClone(sortIntents(result.value.intents)) };
}

function mapModelToResults(
  result: SocialPublicationExecutionBridgeResult<SocialPublicationExecutionPersistenceModel>,
): SocialPublicationExecutionBridgeResult<readonly SocialPublicationExecutionResultRecord[]> {
  if (!result.ok) return result;
  return { ok: true, value: immutableClone(sortResults(result.value.results)) };
}

function mapRepositoryResult<T>(
  result:
    | Readonly<{ ok: true; value: T }>
    | Readonly<{ ok: false; error: SocialPublicationExecutionRepositoryError }>,
): SocialPublicationExecutionBridgeResult<T> {
  if (result.ok) return { ok: true, value: immutableClone(result.value) };
  return { ok: false, error: mapRepositoryError(result.error) };
}

function mapStoreResult<T>(
  result:
    | Readonly<{ ok: true; value: T }>
    | Readonly<{ ok: false; error: SocialPublicationExecutionStoreError }>,
): SocialPublicationExecutionBridgeResult<T> {
  if (result.ok) return { ok: true, value: immutableClone(result.value) };
  return { ok: false, error: mapStoreError(result.error) };
}

function mapRepositoryError(
  error: SocialPublicationExecutionRepositoryError,
): SocialPublicationExecutionBridgeError {
  const code: SocialPublicationExecutionBridgeErrorCode =
    error.code === "identity_collision"
      ? "identity_collision"
      : error.code === "relationship_invalid"
        ? "relationship_invalid"
        : error.code === "identity_required"
          ? "validation_failed"
          : "validation_failed";

  return {
    code,
    message: error.message,
    repositoryError: error,
    validationErrors: error.validationErrors?.filter(isRecordError),
  };
}

function mapStoreError(
  error: SocialPublicationExecutionStoreError,
): SocialPublicationExecutionBridgeError {
  const code: SocialPublicationExecutionBridgeErrorCode =
    error.code === "duplicate_identity" ||
    error.code === "duplicate_idempotency_key"
      ? "identity_collision"
      : error.code === "parent_missing" || error.code === "scope_mismatch"
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
    validationErrors: error.validationErrors?.filter(isRecordError),
  };
}

function validationFailure<T>(
  message: string,
  validationErrors: readonly SocialPublicationExecutionRecordError[],
): SocialPublicationExecutionBridgeResult<T> {
  return {
    ok: false,
    error: { code: "validation_failed", message, validationErrors },
  };
}

function failure<T>(
  code: SocialPublicationExecutionBridgeErrorCode,
  message: string,
): SocialPublicationExecutionBridgeResult<T> {
  return { ok: false, error: { code, message } };
}

function immutableCloneBridge(
  implementation: SocialPublicationExecutionBridgeImplementation,
  mode: Exclude<SocialPublicationExecutionBridgeMode, "environment">,
): SocialPublicationExecutionBridge {
  return Object.freeze({
    mode,
    createsNoExecution: true,
    createExecutionIntent: implementation.createExecutionIntent,
    appendExecutionResult: implementation.appendExecutionResult,
    listExecutionRecords: implementation.listExecutionRecords,
    listExecutionIntents: implementation.listExecutionIntents,
    listExecutionResults: implementation.listExecutionResults,
    loadByIdentity: implementation.loadByIdentity,
    snapshot: implementation.snapshot,
  });
}

function sortIntents(
  intents: readonly SocialPublicationExecutionIntentRecord[],
): SocialPublicationExecutionIntentRecord[] {
  return [...intents].sort(
    (left, right) =>
      left.requested_at.localeCompare(right.requested_at) ||
      left.execution_intent_id.localeCompare(right.execution_intent_id),
  );
}

function sortResults(
  results: readonly SocialPublicationExecutionResultRecord[],
): SocialPublicationExecutionResultRecord[] {
  return [...results].sort(
    (left, right) =>
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.execution_result_id.localeCompare(right.execution_result_id),
  );
}

function currentRuntimeEnvironment(): SocialPublicationExecutionBridgeRuntimeEnvironment {
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.NODE_ENV === "test") return "test";
  return "development";
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

function isRecordError(error: unknown): error is SocialPublicationExecutionRecordError {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { path?: unknown }).path === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}
