import { isSupabaseServiceConfigured } from "../supabase/admin";

import {
  appendSocialPublicationPublisherResult,
  createSocialPublicationPublisherRequest,
  fetchSocialPublicationPublisherRecords,
  type SocialPublicationPublisherReadFilter,
  type SocialPublicationPublisherStoreError,
  type SocialPublicationPublisherStoreWriteOptions,
} from "./social-publication-publisher-store";
import {
  validateSocialPublicationPublisherAppendResultRequest,
  validateSocialPublicationPublisherCreateRequest,
  validateSocialPublicationPublisherPersistenceModel,
  validateSocialPublicationPublisherRepositoryIdentity,
  type SocialPublicationPublisherPersistenceModel,
  type SocialPublicationPublisherRecordError,
  type SocialPublicationPublisherRepositoryError,
  type SocialPublicationPublisherRepositoryIdentity,
  type SocialPublicationPublisherRequestRecord,
  type SocialPublicationPublisherResultRecord,
} from "./social-publication-publisher-repository";

export const SOCIAL_PUBLICATION_PUBLISHER_BRIDGE_MODES = [
  "environment",
  "reference",
  "production",
] as const;

export type SocialPublicationPublisherBridgeMode =
  (typeof SOCIAL_PUBLICATION_PUBLISHER_BRIDGE_MODES)[number];

export const SOCIAL_PUBLICATION_PUBLISHER_BRIDGE_ERROR_CODES = [
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

export type SocialPublicationPublisherBridgeErrorCode =
  (typeof SOCIAL_PUBLICATION_PUBLISHER_BRIDGE_ERROR_CODES)[number];

export type SocialPublicationPublisherBridgeError = Readonly<{
  code: SocialPublicationPublisherBridgeErrorCode;
  message: string;
  repositoryError?: SocialPublicationPublisherRepositoryError;
  storeError?: SocialPublicationPublisherStoreError;
  validationErrors?: readonly SocialPublicationPublisherRecordError[];
}>;

export type SocialPublicationPublisherBridgeResult<T> = Readonly<
  | { ok: true; value: T }
  | { ok: false; error: SocialPublicationPublisherBridgeError }
>;

export type SocialPublicationPublisherBridgeRuntimeEnvironment =
  | "development"
  | "production"
  | "test";

export type SocialPublicationPublisherBridgeConfig = Readonly<{
  mode?: SocialPublicationPublisherBridgeMode;
  runtimeEnvironment?: SocialPublicationPublisherBridgeRuntimeEnvironment;
  productionStoreConfigured?: boolean;
  seed?: SocialPublicationPublisherPersistenceModel;
  implementation?: SocialPublicationPublisherBridgeImplementation;
}>;

export type SocialPublicationPublisherBridgeImplementation =
  | SocialPublicationPublisherBridge
  | Readonly<{
      createPublisherRequest(
        record: SocialPublicationPublisherRequestRecord,
        options?: SocialPublicationPublisherStoreWriteOptions,
      ): Promise<SocialPublicationPublisherBridgeResult<SocialPublicationPublisherRequestRecord>>;
      appendPublisherResult(
        record: SocialPublicationPublisherResultRecord,
        options?: SocialPublicationPublisherStoreWriteOptions,
      ): Promise<SocialPublicationPublisherBridgeResult<SocialPublicationPublisherResultRecord>>;
      listPublisherRecords(
        identity?: SocialPublicationPublisherRepositoryIdentity,
      ): Promise<SocialPublicationPublisherBridgeResult<SocialPublicationPublisherPersistenceModel>>;
      listPublisherRequests(
        identity?: SocialPublicationPublisherRepositoryIdentity,
      ): Promise<SocialPublicationPublisherBridgeResult<readonly SocialPublicationPublisherRequestRecord[]>>;
      listPublisherResults(
        identity?: SocialPublicationPublisherRepositoryIdentity,
      ): Promise<SocialPublicationPublisherBridgeResult<readonly SocialPublicationPublisherResultRecord[]>>;
    }>;

export type SocialPublicationPublisherBridge = Readonly<{
  mode: Exclude<SocialPublicationPublisherBridgeMode, "environment">;
  createPublisherRequest(
    record: SocialPublicationPublisherRequestRecord,
    options?: SocialPublicationPublisherStoreWriteOptions,
  ): Promise<SocialPublicationPublisherBridgeResult<SocialPublicationPublisherRequestRecord>>;
  appendPublisherResult(
    record: SocialPublicationPublisherResultRecord,
    options?: SocialPublicationPublisherStoreWriteOptions,
  ): Promise<SocialPublicationPublisherBridgeResult<SocialPublicationPublisherResultRecord>>;
  listPublisherRecords(
    identity?: SocialPublicationPublisherRepositoryIdentity,
  ): Promise<SocialPublicationPublisherBridgeResult<SocialPublicationPublisherPersistenceModel>>;
  listPublisherRequests(
    identity?: SocialPublicationPublisherRepositoryIdentity,
  ): Promise<SocialPublicationPublisherBridgeResult<readonly SocialPublicationPublisherRequestRecord[]>>;
  listPublisherResults(
    identity?: SocialPublicationPublisherRepositoryIdentity,
  ): Promise<SocialPublicationPublisherBridgeResult<readonly SocialPublicationPublisherResultRecord[]>>;
}>;

export function createSocialPublicationPublisherBridge(
  config: SocialPublicationPublisherBridgeConfig = {},
): SocialPublicationPublisherBridgeResult<SocialPublicationPublisherBridge> {
  const resolved = resolveBridgeMode(config);
  if (!resolved.ok) return resolved;

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
      "Publication publisher production store is not configured.",
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

export function resolveSocialPublicationPublisherBridgeMode(
  config: SocialPublicationPublisherBridgeConfig = {},
): SocialPublicationPublisherBridgeResult<
  Readonly<{
    mode: Exclude<SocialPublicationPublisherBridgeMode, "environment">;
    runtimeEnvironment: SocialPublicationPublisherBridgeRuntimeEnvironment;
  }>
> {
  return resolveBridgeMode(config);
}

function resolveBridgeMode(
  config: SocialPublicationPublisherBridgeConfig,
): SocialPublicationPublisherBridgeResult<
  Readonly<{
    mode: Exclude<SocialPublicationPublisherBridgeMode, "environment">;
    runtimeEnvironment: SocialPublicationPublisherBridgeRuntimeEnvironment;
  }>
> {
  const runtimeEnvironment =
    config.runtimeEnvironment ?? currentRuntimeEnvironment();
  const requestedMode = config.mode ?? "environment";

  if (!SOCIAL_PUBLICATION_PUBLISHER_BRIDGE_MODES.includes(requestedMode)) {
    return failure("configuration_invalid", "Publication publisher bridge mode is invalid.");
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
      "Reference publication publisher persistence is not allowed in production.",
    );
  }

  return { ok: true, value: { mode, runtimeEnvironment } };
}

function createReferenceBridge(
  seed?: SocialPublicationPublisherPersistenceModel,
): SocialPublicationPublisherBridgeResult<SocialPublicationPublisherBridge> {
  const state = immutableClone(seed ?? { requests: [], results: [] });
  const validation = validateSocialPublicationPublisherPersistenceModel(state);
  if (!validation.ok) {
    return validationFailure(
      "Publication publisher seed model failed bridge validation.",
      validation.errors,
    );
  }

  const requests = [...state.requests];
  const results = [...state.results];

  return {
    ok: true,
    value: Object.freeze({
      mode: "reference",
      createPublisherRequest(record) {
        return Promise.resolve(createRequestInMemory(requests, record));
      },
      appendPublisherResult(record) {
        return Promise.resolve(appendResultInMemory(requests, results, record));
      },
      listPublisherRecords(identity) {
        return Promise.resolve(listRecordsInMemory(requests, results, identity));
      },
      listPublisherRequests(identity) {
        return Promise.resolve(
          mapModelToRequests(listRecordsInMemory(requests, results, identity)),
        );
      },
      listPublisherResults(identity) {
        return Promise.resolve(
          mapModelToResults(listRecordsInMemory(requests, results, identity)),
        );
      },
    }),
  };
}

function createProductionBridge(): SocialPublicationPublisherBridge {
  async function listPublisherRecords(
    identity: SocialPublicationPublisherRepositoryIdentity = {},
  ): Promise<SocialPublicationPublisherBridgeResult<SocialPublicationPublisherPersistenceModel>> {
    const identityValidation = validateOptionalIdentity(identity);
    if (!identityValidation.ok) return identityValidation;

    const records = await fetchSocialPublicationPublisherRecords(
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
    async createPublisherRequest(record, options) {
      const validation = validateSocialPublicationPublisherCreateRequest({
        request: record,
      });
      if (!validation.ok) return { ok: false, error: mapRepositoryError(validation.error) };

      return mapStoreResult(
        await createSocialPublicationPublisherRequest(record, options),
      );
    },
    async appendPublisherResult(record, options) {
      const validation = validateSocialPublicationPublisherAppendResultRequest({
        result: record,
      });
      if (!validation.ok) return { ok: false, error: mapRepositoryError(validation.error) };

      return mapStoreResult(
        await appendSocialPublicationPublisherResult(record, options),
      );
    },
    listPublisherRecords,
    async listPublisherRequests(identity = {}) {
      const records = await listPublisherRecords(identity);
      return mapModelToRequests(records);
    },
    async listPublisherResults(identity = {}) {
      const records = await listPublisherRecords(identity);
      return mapModelToResults(records);
    },
  });
}

function createRequestInMemory(
  requests: SocialPublicationPublisherRequestRecord[],
  record: SocialPublicationPublisherRequestRecord,
): SocialPublicationPublisherBridgeResult<SocialPublicationPublisherRequestRecord> {
  const validation = validateSocialPublicationPublisherCreateRequest({ request: record });
  if (!validation.ok) return { ok: false, error: mapRepositoryError(validation.error) };

  if (
    requests.some(
      (request) =>
        request.publisher_request_id === record.publisher_request_id ||
        request.publisher_job_id === record.publisher_job_id,
    )
  ) {
    return failure("identity_collision", "Publisher request identity already exists.");
  }

  requests.push(immutableClone(record));
  return { ok: true, value: immutableClone(record) };
}

function appendResultInMemory(
  requests: readonly SocialPublicationPublisherRequestRecord[],
  results: SocialPublicationPublisherResultRecord[],
  record: SocialPublicationPublisherResultRecord,
): SocialPublicationPublisherBridgeResult<SocialPublicationPublisherResultRecord> {
  const validation = validateSocialPublicationPublisherAppendResultRequest({ result: record });
  if (!validation.ok) return { ok: false, error: mapRepositoryError(validation.error) };

  const parent = requests.find(
    (request) => request.publisher_request_id === record.publisher_request_id,
  );
  if (!parent) {
    return failure("relationship_invalid", "Publisher result parent request is missing.");
  }
  if (!requestResultShareScope(parent, record)) {
    return failure("relationship_invalid", "Publisher result must match parent request scope.");
  }
  if (results.some((result) => result.publisher_result_id === record.publisher_result_id)) {
    return failure("identity_collision", "Publisher result identity already exists.");
  }

  results.push(immutableClone(record));
  return { ok: true, value: immutableClone(record) };
}

function listRecordsInMemory(
  requests: readonly SocialPublicationPublisherRequestRecord[],
  results: readonly SocialPublicationPublisherResultRecord[],
  identity: SocialPublicationPublisherRepositoryIdentity = {},
): SocialPublicationPublisherBridgeResult<SocialPublicationPublisherPersistenceModel> {
  const identityValidation = validateOptionalIdentity(identity);
  if (!identityValidation.ok) return identityValidation;

  return {
    ok: true,
    value: immutableClone({
      requests: sortRequests(requests.filter((request) => requestMatchesIdentity(request, identity))),
      results: sortResults(results.filter((result) => resultMatchesIdentity(result, identity))),
    }),
  };
}

function validateOptionalIdentity(
  identity: SocialPublicationPublisherRepositoryIdentity,
): SocialPublicationPublisherBridgeResult<SocialPublicationPublisherRepositoryIdentity> {
  const entries = Object.entries(identity).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return { ok: true, value: {} };

  const validation = validateSocialPublicationPublisherRepositoryIdentity(identity);
  if (!validation.ok) return { ok: false, error: mapRepositoryError(validation.error) };
  return { ok: true, value: validation.value };
}

function mapModelToRequests(
  result: SocialPublicationPublisherBridgeResult<SocialPublicationPublisherPersistenceModel>,
): SocialPublicationPublisherBridgeResult<readonly SocialPublicationPublisherRequestRecord[]> {
  if (!result.ok) return result;
  return { ok: true, value: immutableClone(result.value.requests) };
}

function mapModelToResults(
  result: SocialPublicationPublisherBridgeResult<SocialPublicationPublisherPersistenceModel>,
): SocialPublicationPublisherBridgeResult<readonly SocialPublicationPublisherResultRecord[]> {
  if (!result.ok) return result;
  return { ok: true, value: immutableClone(result.value.results) };
}

function identityToReadFilter(
  identity: SocialPublicationPublisherRepositoryIdentity,
): SocialPublicationPublisherReadFilter {
  return {
    publisherJobId: identity.publisher_job_id,
    socialPostId: identity.social_post_id,
    publicationTargetId: identity.publication_target_id,
    publicationManifestId: identity.publication_manifest_id,
  };
}

function filterModel(
  model: SocialPublicationPublisherPersistenceModel,
  identity: SocialPublicationPublisherRepositoryIdentity,
): SocialPublicationPublisherPersistenceModel {
  return {
    requests: sortRequests(model.requests.filter((request) => requestMatchesIdentity(request, identity))),
    results: sortResults(model.results.filter((result) => resultMatchesIdentity(result, identity))),
  };
}

function requestMatchesIdentity(
  record: SocialPublicationPublisherRequestRecord,
  identity: SocialPublicationPublisherRepositoryIdentity,
): boolean {
  return (
    (!identity.publisher_request_id ||
      record.publisher_request_id === identity.publisher_request_id) &&
    (!identity.publisher_job_id || record.publisher_job_id === identity.publisher_job_id) &&
    (!identity.channel_id || record.channel_id === identity.channel_id) &&
    scopeMatchesIdentity(record.scope, identity)
  );
}

function resultMatchesIdentity(
  record: SocialPublicationPublisherResultRecord,
  identity: SocialPublicationPublisherRepositoryIdentity,
): boolean {
  return (
    (!identity.publisher_result_id ||
      record.publisher_result_id === identity.publisher_result_id) &&
    (!identity.publisher_request_id ||
      record.publisher_request_id === identity.publisher_request_id) &&
    (!identity.publisher_job_id || record.publisher_job_id === identity.publisher_job_id) &&
    (!identity.channel_id || record.channel_id === identity.channel_id) &&
    scopeMatchesIdentity(record.scope, identity)
  );
}

function scopeMatchesIdentity(
  scope: SocialPublicationPublisherRequestRecord["scope"],
  identity: SocialPublicationPublisherRepositoryIdentity,
): boolean {
  return (
    (!identity.social_post_id || scope.social_post_id === identity.social_post_id) &&
    (!identity.publication_target_id ||
      scope.publication_target_id === identity.publication_target_id) &&
    (!identity.publication_manifest_id ||
      scope.publication_manifest_id === identity.publication_manifest_id) &&
    (!identity.schedule_id || scope.schedule_id === identity.schedule_id) &&
    (!identity.ledger_entry_id || scope.ledger_entry_id === identity.ledger_entry_id) &&
    (!identity.publication_attempt_id ||
      scope.publication_attempt_id === identity.publication_attempt_id) &&
    (!identity.owner_approval_id ||
      scope.owner_approval_id === identity.owner_approval_id) &&
    (!identity.approval_id || scope.approval_id === identity.approval_id) &&
    (!identity.proposal_id || scope.proposal_id === identity.proposal_id)
  );
}

function requestResultShareScope(
  request: SocialPublicationPublisherRequestRecord,
  result: SocialPublicationPublisherResultRecord,
): boolean {
  return (
    request.publisher_job_id === result.publisher_job_id &&
    request.channel_id === result.channel_id &&
    request.channel_platform === result.channel_platform &&
    request.channel_type === result.channel_type &&
    JSON.stringify(request.scope) === JSON.stringify(result.scope)
  );
}

function mapStoreResult<T>(
  result:
    | Readonly<{ ok: true; value: T }>
    | Readonly<{ ok: false; error: SocialPublicationPublisherStoreError }>,
): SocialPublicationPublisherBridgeResult<T> {
  if (result.ok) return { ok: true, value: immutableClone(result.value) };
  return { ok: false, error: mapStoreError(result.error) };
}

function mapRepositoryError(
  error: SocialPublicationPublisherRepositoryError,
): SocialPublicationPublisherBridgeError {
  const code: SocialPublicationPublisherBridgeErrorCode =
    error.code === "identity_collision"
      ? "identity_collision"
      : error.code === "relationship_invalid"
        ? "relationship_invalid"
        : "validation_failed";

  return {
    code,
    message: error.message,
    repositoryError: error,
    validationErrors: error.validationErrors?.filter(isRecordError),
  };
}

function mapStoreError(
  error: SocialPublicationPublisherStoreError,
): SocialPublicationPublisherBridgeError {
  const code: SocialPublicationPublisherBridgeErrorCode =
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
  validationErrors: readonly SocialPublicationPublisherRecordError[],
): SocialPublicationPublisherBridgeResult<T> {
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
  code: SocialPublicationPublisherBridgeErrorCode,
  message: string,
): SocialPublicationPublisherBridgeResult<T> {
  return { ok: false, error: { code, message } };
}

function immutableCloneBridge(
  implementation: SocialPublicationPublisherBridgeImplementation,
  mode: Exclude<SocialPublicationPublisherBridgeMode, "environment">,
): SocialPublicationPublisherBridge {
  return Object.freeze({
    mode,
    createPublisherRequest: implementation.createPublisherRequest,
    appendPublisherResult: implementation.appendPublisherResult,
    listPublisherRecords: implementation.listPublisherRecords,
    listPublisherRequests: implementation.listPublisherRequests,
    listPublisherResults: implementation.listPublisherResults,
  });
}

function sortRequests(
  requests: readonly SocialPublicationPublisherRequestRecord[],
): SocialPublicationPublisherRequestRecord[] {
  return [...requests].sort(
    (left, right) =>
      left.requested_at.localeCompare(right.requested_at) ||
      left.publisher_request_id.localeCompare(right.publisher_request_id),
  );
}

function sortResults(
  results: readonly SocialPublicationPublisherResultRecord[],
): SocialPublicationPublisherResultRecord[] {
  return [...results].sort(
    (left, right) =>
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.publisher_result_id.localeCompare(right.publisher_result_id),
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

function currentRuntimeEnvironment(): SocialPublicationPublisherBridgeRuntimeEnvironment {
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.NODE_ENV === "test") return "test";
  return "development";
}

function isRecordError(error: unknown): error is SocialPublicationPublisherRecordError {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { path?: unknown }).path === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

export function validateSocialPublicationPublisherBridgeModel(
  model: unknown,
): SocialPublicationPublisherBridgeResult<SocialPublicationPublisherPersistenceModel> {
  const validation = validateSocialPublicationPublisherPersistenceModel(model);
  if (!validation.ok) {
    return validationFailure(
      "Publication publisher bridge model failed validation.",
      validation.errors,
    );
  }

  return {
    ok: true,
    value: immutableClone(model as SocialPublicationPublisherPersistenceModel),
  };
}
