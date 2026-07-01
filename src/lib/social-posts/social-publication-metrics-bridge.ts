import { isSupabaseServiceConfigured } from "../supabase/admin";

import {
  appendSocialPublicationMetricObservation,
  fetchSocialPublicationMetricRecords,
  type SocialPublicationMetricStoreError,
  type SocialPublicationMetricStoreWriteOptions,
} from "./social-publication-metrics-store";
import {
  createReferenceSocialPublicationMetricRepository,
  validateSocialPublicationMetricObservationRecord,
  validateSocialPublicationMetricPersistenceModel,
  type SocialPublicationMetricObservationRecord,
  type SocialPublicationMetricPersistenceModel,
  type SocialPublicationMetricRecordError,
  type SocialPublicationMetricRepositoryError,
  type SocialPublicationMetricRepositoryIdentity,
} from "./social-publication-metrics-repository";

export const SOCIAL_PUBLICATION_METRIC_BRIDGE_MODES = [
  "environment",
  "reference",
  "production",
] as const;

export type SocialPublicationMetricBridgeMode =
  (typeof SOCIAL_PUBLICATION_METRIC_BRIDGE_MODES)[number];

export const SOCIAL_PUBLICATION_METRIC_BRIDGE_ERROR_CODES = [
  "configuration_invalid",
  "production_unavailable",
  "unsafe_reference_in_production",
  "validation_failed",
  "storage_error",
  "identity_collision",
  "storage_inconsistent",
] as const;

export type SocialPublicationMetricBridgeErrorCode =
  (typeof SOCIAL_PUBLICATION_METRIC_BRIDGE_ERROR_CODES)[number];

export type SocialPublicationMetricBridgeError = Readonly<{
  code: SocialPublicationMetricBridgeErrorCode;
  message: string;
  repositoryError?: SocialPublicationMetricRepositoryError;
  storeError?: SocialPublicationMetricStoreError;
  validationErrors?: readonly SocialPublicationMetricRecordError[];
}>;

export type SocialPublicationMetricBridgeResult<T> = Readonly<
  | { ok: true; value: T }
  | { ok: false; error: SocialPublicationMetricBridgeError }
>;

export type SocialPublicationMetricBridgeRuntimeEnvironment =
  | "development"
  | "production"
  | "test";

export type SocialPublicationMetricBridgeConfig = Readonly<{
  mode?: SocialPublicationMetricBridgeMode;
  runtimeEnvironment?: SocialPublicationMetricBridgeRuntimeEnvironment;
  productionStoreConfigured?: boolean;
  seed?: SocialPublicationMetricPersistenceModel;
}>;

export type SocialPublicationMetricBridge = Readonly<{
  mode: Exclude<SocialPublicationMetricBridgeMode, "environment">;
  appendMetricObservation(
    record: SocialPublicationMetricObservationRecord,
    options?: SocialPublicationMetricStoreWriteOptions,
  ): Promise<SocialPublicationMetricBridgeResult<SocialPublicationMetricObservationRecord>>;
  listMetricRecords(
    identity?: SocialPublicationMetricRepositoryIdentity,
  ): Promise<SocialPublicationMetricBridgeResult<SocialPublicationMetricPersistenceModel>>;
  listMetricObservations(
    identity?: SocialPublicationMetricRepositoryIdentity,
  ): Promise<SocialPublicationMetricBridgeResult<readonly SocialPublicationMetricObservationRecord[]>>;
}>;

export function createSocialPublicationMetricBridge(
  config: SocialPublicationMetricBridgeConfig = {},
): SocialPublicationMetricBridgeResult<SocialPublicationMetricBridge> {
  const resolved = resolveSocialPublicationMetricBridgeMode(config);
  if (!resolved.ok) return resolved;

  if (resolved.value.mode === "reference") {
    return createReferenceBridge(config.seed);
  }

  const configured =
    config.productionStoreConfigured ?? isSupabaseServiceConfigured();
  if (!configured) {
    return failure("production_unavailable", "Publication metrics production store is not configured.");
  }

  return { ok: true, value: createProductionBridge() };
}

export function resolveSocialPublicationMetricBridgeMode(
  config: SocialPublicationMetricBridgeConfig = {},
): SocialPublicationMetricBridgeResult<
  Readonly<{
    mode: Exclude<SocialPublicationMetricBridgeMode, "environment">;
    runtimeEnvironment: SocialPublicationMetricBridgeRuntimeEnvironment;
  }>
> {
  const runtimeEnvironment =
    config.runtimeEnvironment ?? currentRuntimeEnvironment();
  const requestedMode = config.mode ?? "environment";

  if (!SOCIAL_PUBLICATION_METRIC_BRIDGE_MODES.includes(requestedMode)) {
    return failure("configuration_invalid", "Publication metrics bridge mode is invalid.");
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
      "Reference publication metrics persistence is not allowed in production.",
    );
  }

  return { ok: true, value: { mode, runtimeEnvironment } };
}

function createReferenceBridge(
  seed?: SocialPublicationMetricPersistenceModel,
): SocialPublicationMetricBridgeResult<SocialPublicationMetricBridge> {
  const model = immutableClone(seed ?? { observations: [] });
  const validation = validateSocialPublicationMetricPersistenceModel(model);
  if (!validation.ok) {
    return validationFailure("Publication metrics seed model failed bridge validation.", validation.errors);
  }

  const repository = createReferenceSocialPublicationMetricRepository(model);

  return {
    ok: true,
    value: Object.freeze({
      mode: "reference",
      appendMetricObservation(record) {
        const result = repository.appendMetricObservation({ observation: record });
        return Promise.resolve(mapRepositoryResult(result));
      },
      listMetricRecords(identity) {
        const result = repository.getMetricRecordsByIdentity(identity ?? {});
        return Promise.resolve(mapRepositoryResult(result));
      },
      listMetricObservations(identity) {
        const result = repository.listMetricObservations(identity ?? {});
        return Promise.resolve(mapRepositoryResult(result));
      },
    }),
  };
}

function createProductionBridge(): SocialPublicationMetricBridge {
  async function listMetricRecords(
    identity: SocialPublicationMetricRepositoryIdentity = {},
  ): Promise<SocialPublicationMetricBridgeResult<SocialPublicationMetricPersistenceModel>> {
    const records = await fetchSocialPublicationMetricRecords(identityToReadFilter(identity));
    if (!records.ok) return { ok: false, error: mapStoreError(records.error) };
    return { ok: true, value: immutableClone(filterModel(records.value, identity)) };
  }

  return Object.freeze({
    mode: "production",
    async appendMetricObservation(record, options) {
      const validation = validateSocialPublicationMetricObservationRecord(record);
      if (!validation.ok) {
        return validationFailure("Metric observation failed bridge validation.", validation.errors);
      }
      const result = await appendSocialPublicationMetricObservation(record, options);
      if (!result.ok) return { ok: false, error: mapStoreError(result.error) };
      return { ok: true, value: immutableClone(result.value) };
    },
    listMetricRecords,
    async listMetricObservations(identity) {
      const records = await listMetricRecords(identity);
      if (!records.ok) return records;
      return { ok: true, value: records.value.observations };
    },
  });
}

function identityToReadFilter(identity: SocialPublicationMetricRepositoryIdentity) {
  return {
    metricObservationId: identity.metric_observation_id,
    metricName: identity.metric_name,
    metricStatus: identity.metric_status,
    socialPostId: identity.social_post_id,
    publicationTargetId: identity.publication_target_id,
    publisherRequestId: identity.publisher_request_id,
    publisherResultId: identity.publisher_result_id,
    publisherJobId: identity.publisher_job_id,
    scheduleId: identity.schedule_id,
    ledgerEntryId: identity.ledger_entry_id,
    publicationManifestId: identity.publication_manifest_id,
    ownerApprovalId: identity.owner_approval_id,
  };
}

function filterModel(
  model: SocialPublicationMetricPersistenceModel,
  identity: SocialPublicationMetricRepositoryIdentity,
): SocialPublicationMetricPersistenceModel {
  const repository = createReferenceSocialPublicationMetricRepository(model);
  const result = repository.getMetricRecordsByIdentity(identity);
  if (!result.ok) return { observations: [] };
  return result.value;
}

function mapRepositoryResult<T>(
  result:
    | { ok: true; value: T }
    | { ok: false; error: SocialPublicationMetricRepositoryError },
): SocialPublicationMetricBridgeResult<T> {
  if (result.ok) return { ok: true, value: immutableClone(result.value) };
  return {
    ok: false,
    error: {
      code: result.error.code === "identity_collision" ? "identity_collision" : "validation_failed",
      message: result.error.message,
      repositoryError: result.error,
    },
  };
}

function mapStoreError(
  error: SocialPublicationMetricStoreError,
): SocialPublicationMetricBridgeError {
  if (error.code === "duplicate_identity") {
    return { code: "identity_collision", message: error.message, storeError: error };
  }
  if (error.code === "storage_inconsistent") {
    return { code: "storage_inconsistent", message: error.message, storeError: error };
  }
  if (error.code === "storage_error") {
    return { code: "storage_error", message: error.message, storeError: error };
  }
  return {
    code: "validation_failed",
    message: error.message,
    storeError: error,
    validationErrors: error.validationErrors as readonly SocialPublicationMetricRecordError[] | undefined,
  };
}

function validationFailure(
  message: string,
  validationErrors: readonly SocialPublicationMetricRecordError[],
): SocialPublicationMetricBridgeResult<never> {
  return { ok: false, error: { code: "validation_failed", message, validationErrors } };
}

function failure(
  code: SocialPublicationMetricBridgeErrorCode,
  message: string,
): SocialPublicationMetricBridgeResult<never> {
  return { ok: false, error: { code, message } };
}

function currentRuntimeEnvironment(): SocialPublicationMetricBridgeRuntimeEnvironment {
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.NODE_ENV === "test") return "test";
  return "development";
}

function immutableClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
