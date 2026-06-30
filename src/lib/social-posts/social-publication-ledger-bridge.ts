import { isSupabaseServiceConfigured } from "../supabase/admin";

import type { SocialPublicationLedgerMappedEntry } from "./social-publication-ledger-mapper";
import {
  createSocialPublicationLedgerRepository,
  type SocialPublicationLedgerRepository,
  type SocialPublicationLedgerRepositoryError,
} from "./social-publication-ledger-repository";
import {
  fetchPublicationLedgerRecordsByManifest,
  fetchPublicationLedgerRecordsByPost,
  fetchPublicationLedgerRecordsByPublicationTarget,
  insertPublicationLedgerAttempt,
  insertPublicationLedgerEvidence,
  insertPublicationLedgerMappedEntry,
  insertPublicationLedgerOutcome,
  type SocialPublicationLedgerStoreError,
  type SocialPublicationLedgerStoreWriteOptions,
} from "./social-publication-ledger-store";
import {
  validateSocialPublicationLedgerAttemptRecord,
  validateSocialPublicationLedgerEvidenceRecord,
  validateSocialPublicationLedgerOutcomeRecord,
  validateSocialPublicationLedgerPersistenceModel,
  type SocialPublicationLedgerAttemptRecord,
  type SocialPublicationLedgerEvidenceRecord,
  type SocialPublicationLedgerOutcomeRecord,
  type SocialPublicationLedgerPersistenceError,
  type SocialPublicationLedgerPersistenceModel,
} from "./social-publication-ledger-persistence";

export const SOCIAL_PUBLICATION_LEDGER_BRIDGE_MODES = [
  "environment",
  "reference",
  "production",
] as const;

export type SocialPublicationLedgerBridgeMode =
  (typeof SOCIAL_PUBLICATION_LEDGER_BRIDGE_MODES)[number];

export const SOCIAL_PUBLICATION_LEDGER_BRIDGE_ERROR_CODES = [
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

export type SocialPublicationLedgerBridgeErrorCode =
  (typeof SOCIAL_PUBLICATION_LEDGER_BRIDGE_ERROR_CODES)[number];

export type SocialPublicationLedgerBridgeError = Readonly<{
  code: SocialPublicationLedgerBridgeErrorCode;
  message: string;
  repositoryError?: SocialPublicationLedgerRepositoryError;
  storeError?: SocialPublicationLedgerStoreError;
  validationErrors?: readonly SocialPublicationLedgerPersistenceError[];
}>;

export type SocialPublicationLedgerBridgeResult<T> = Readonly<
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: SocialPublicationLedgerBridgeError;
    }
>;

export type SocialPublicationLedgerBridgeRuntimeEnvironment =
  | "development"
  | "production"
  | "test";

export type SocialPublicationLedgerBridgeConfig = Readonly<{
  mode?: SocialPublicationLedgerBridgeMode;
  runtimeEnvironment?: SocialPublicationLedgerBridgeRuntimeEnvironment;
  productionStoreConfigured?: boolean;
  seed?: SocialPublicationLedgerPersistenceModel;
  implementation?: SocialPublicationLedgerBridgeImplementation;
}>;

export type SocialPublicationLedgerBridgeImplementation =
  | SocialPublicationLedgerBridge
  | Readonly<{
      appendAttempt(
        record: SocialPublicationLedgerAttemptRecord,
        options?: SocialPublicationLedgerStoreWriteOptions,
      ): Promise<SocialPublicationLedgerBridgeResult<SocialPublicationLedgerAttemptRecord>>;
      appendOutcome(
        record: SocialPublicationLedgerOutcomeRecord,
        options?: SocialPublicationLedgerStoreWriteOptions,
      ): Promise<SocialPublicationLedgerBridgeResult<SocialPublicationLedgerOutcomeRecord>>;
      appendEvidence(
        record: SocialPublicationLedgerEvidenceRecord,
        options?: SocialPublicationLedgerStoreWriteOptions,
      ): Promise<SocialPublicationLedgerBridgeResult<SocialPublicationLedgerEvidenceRecord>>;
      appendMappedEntry(
        mappedEntry: SocialPublicationLedgerMappedEntry,
        options?: SocialPublicationLedgerStoreWriteOptions,
      ): Promise<SocialPublicationLedgerBridgeResult<SocialPublicationLedgerPersistenceModel>>;
      loadByPost(
        socialPostId: string,
      ): Promise<SocialPublicationLedgerBridgeResult<SocialPublicationLedgerPersistenceModel>>;
      loadByManifest(
        publicationManifestId: string,
      ): Promise<SocialPublicationLedgerBridgeResult<SocialPublicationLedgerPersistenceModel>>;
      loadByPublicationTarget(
        publicationTargetId: string,
      ): Promise<SocialPublicationLedgerBridgeResult<SocialPublicationLedgerPersistenceModel>>;
    }>;

export type SocialPublicationLedgerBridge = Readonly<{
  mode: Exclude<SocialPublicationLedgerBridgeMode, "environment">;
  appendAttempt(
    record: SocialPublicationLedgerAttemptRecord,
    options?: SocialPublicationLedgerStoreWriteOptions,
  ): Promise<SocialPublicationLedgerBridgeResult<SocialPublicationLedgerAttemptRecord>>;
  appendOutcome(
    record: SocialPublicationLedgerOutcomeRecord,
    options?: SocialPublicationLedgerStoreWriteOptions,
  ): Promise<SocialPublicationLedgerBridgeResult<SocialPublicationLedgerOutcomeRecord>>;
  appendEvidence(
    record: SocialPublicationLedgerEvidenceRecord,
    options?: SocialPublicationLedgerStoreWriteOptions,
  ): Promise<SocialPublicationLedgerBridgeResult<SocialPublicationLedgerEvidenceRecord>>;
  appendMappedEntry(
    mappedEntry: SocialPublicationLedgerMappedEntry,
    options?: SocialPublicationLedgerStoreWriteOptions,
  ): Promise<SocialPublicationLedgerBridgeResult<SocialPublicationLedgerPersistenceModel>>;
  loadByPost(
    socialPostId: string,
  ): Promise<SocialPublicationLedgerBridgeResult<SocialPublicationLedgerPersistenceModel>>;
  loadByManifest(
    publicationManifestId: string,
  ): Promise<SocialPublicationLedgerBridgeResult<SocialPublicationLedgerPersistenceModel>>;
  loadByPublicationTarget(
    publicationTargetId: string,
  ): Promise<SocialPublicationLedgerBridgeResult<SocialPublicationLedgerPersistenceModel>>;
}>;

export function createSocialPublicationLedgerBridge(
  config: SocialPublicationLedgerBridgeConfig = {},
): SocialPublicationLedgerBridgeResult<SocialPublicationLedgerBridge> {
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
      "Publication ledger production store is not configured.",
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

export function resolveSocialPublicationLedgerBridgeMode(
  config: SocialPublicationLedgerBridgeConfig = {},
): SocialPublicationLedgerBridgeResult<
  Readonly<{
    mode: Exclude<SocialPublicationLedgerBridgeMode, "environment">;
    runtimeEnvironment: SocialPublicationLedgerBridgeRuntimeEnvironment;
  }>
> {
  return resolveBridgeMode(config);
}

function resolveBridgeMode(
  config: SocialPublicationLedgerBridgeConfig,
): SocialPublicationLedgerBridgeResult<
  Readonly<{
    mode: Exclude<SocialPublicationLedgerBridgeMode, "environment">;
    runtimeEnvironment: SocialPublicationLedgerBridgeRuntimeEnvironment;
  }>
> {
  const runtimeEnvironment =
    config.runtimeEnvironment ?? currentRuntimeEnvironment();
  const requestedMode = config.mode ?? "environment";

  if (!SOCIAL_PUBLICATION_LEDGER_BRIDGE_MODES.includes(requestedMode)) {
    return failure("configuration_invalid", "Publication ledger bridge mode is invalid.");
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
      "Reference publication ledger persistence is not allowed in production.",
    );
  }

  return { ok: true, value: { mode, runtimeEnvironment } };
}

function createReferenceBridge(
  seed?: SocialPublicationLedgerPersistenceModel,
): SocialPublicationLedgerBridgeResult<SocialPublicationLedgerBridge> {
  const repositoryResult = createSocialPublicationLedgerRepository(seed);
  if (!repositoryResult.ok) {
    return {
      ok: false,
      error: mapRepositoryError(repositoryResult.error),
    };
  }

  const repository = repositoryResult.value;

  return {
    ok: true,
    value: Object.freeze({
      mode: "reference",
      appendAttempt(record) {
        return Promise.resolve(
          mapRepositoryResult(repository.appendAttempt({ attempt: record })),
        );
      },
      appendOutcome(record) {
        return Promise.resolve(
          mapRepositoryResult(repository.appendOutcome({ outcome: record })),
        );
      },
      appendEvidence(record) {
        return Promise.resolve(
          mapRepositoryResult(repository.appendEvidence({ evidence: record })),
        );
      },
      appendMappedEntry(mappedEntry) {
        return Promise.resolve(appendMappedEntryToRepository(repository, mappedEntry));
      },
      loadByPost(socialPostId) {
        return Promise.resolve(
          mapRepositoryResult(
            repository.getLedgerByIdentity({ social_post_id: socialPostId }),
          ),
        );
      },
      loadByManifest(publicationManifestId) {
        return Promise.resolve(
          mapRepositoryResult(
            repository.getLedgerByIdentity({
              publication_manifest_id: publicationManifestId,
            }),
          ),
        );
      },
      loadByPublicationTarget(publicationTargetId) {
        return Promise.resolve(
          mapRepositoryResult(
            repository.getLedgerByIdentity({
              publication_target_id: publicationTargetId,
            }),
          ),
        );
      },
    }),
  };
}

function createProductionBridge(): SocialPublicationLedgerBridge {
  return Object.freeze({
    mode: "production",
    async appendAttempt(record, options) {
      const validation = validateSocialPublicationLedgerAttemptRecord(record);
      if (!validation.ok) {
        return validationFailure(
          "Publication ledger attempt failed bridge validation.",
          validation.errors,
        );
      }

      return mapStoreResult(await insertPublicationLedgerAttempt(record, options));
    },
    async appendOutcome(record, options) {
      const validation = validateSocialPublicationLedgerOutcomeRecord(record);
      if (!validation.ok) {
        return validationFailure(
          "Publication ledger outcome failed bridge validation.",
          validation.errors,
        );
      }

      return mapStoreResult(await insertPublicationLedgerOutcome(record, options));
    },
    async appendEvidence(record, options) {
      const validation = validateSocialPublicationLedgerEvidenceRecord(record);
      if (!validation.ok) {
        return validationFailure(
          "Publication ledger evidence failed bridge validation.",
          validation.errors,
        );
      }

      return mapStoreResult(await insertPublicationLedgerEvidence(record, options));
    },
    async appendMappedEntry(mappedEntry, options) {
      return mapStoreResult(
        await insertPublicationLedgerMappedEntry(mappedEntry, options),
      );
    },
    async loadByPost(socialPostId) {
      return mapStoreResult(await fetchPublicationLedgerRecordsByPost(socialPostId));
    },
    async loadByManifest(publicationManifestId) {
      return mapStoreResult(
        await fetchPublicationLedgerRecordsByManifest(publicationManifestId),
      );
    },
    async loadByPublicationTarget(publicationTargetId) {
      return mapStoreResult(
        await fetchPublicationLedgerRecordsByPublicationTarget(publicationTargetId),
      );
    },
  });
}

function appendMappedEntryToRepository(
  repository: SocialPublicationLedgerRepository,
  mappedEntry: SocialPublicationLedgerMappedEntry,
): SocialPublicationLedgerBridgeResult<SocialPublicationLedgerPersistenceModel> {
  if (mappedEntry.attempt) {
    const attemptResult = repository.appendAttempt({ attempt: mappedEntry.attempt });
    if (!attemptResult.ok) return mapRepositoryResult(attemptResult);
  }

  if (mappedEntry.outcome) {
    const outcomeResult = repository.appendOutcome({ outcome: mappedEntry.outcome });
    if (!outcomeResult.ok) return mapRepositoryResult(outcomeResult);
  }

  if (mappedEntry.evidence) {
    const evidenceResult = repository.appendEvidence({ evidence: mappedEntry.evidence });
    if (!evidenceResult.ok) return mapRepositoryResult(evidenceResult);
  }

  return mapRepositoryResult(repository.snapshot());
}

function mapRepositoryResult<T>(
  result:
    | Readonly<{ ok: true; value: T }>
    | Readonly<{ ok: false; error: SocialPublicationLedgerRepositoryError }>,
): SocialPublicationLedgerBridgeResult<T> {
  if (result.ok) return { ok: true, value: immutableClone(result.value) };
  return { ok: false, error: mapRepositoryError(result.error) };
}

function mapStoreResult<T>(
  result:
    | Readonly<{ ok: true; value: T }>
    | Readonly<{ ok: false; error: SocialPublicationLedgerStoreError }>,
): SocialPublicationLedgerBridgeResult<T> {
  if (result.ok) return { ok: true, value: immutableClone(result.value) };
  return { ok: false, error: mapStoreError(result.error) };
}

function mapRepositoryError(
  error: SocialPublicationLedgerRepositoryError,
): SocialPublicationLedgerBridgeError {
  const code: SocialPublicationLedgerBridgeErrorCode =
    error.code === "not_found"
      ? "not_found"
      : error.code === "identity_collision"
        ? "identity_collision"
        : error.code === "relationship_invalid"
          ? "relationship_invalid"
          : "validation_failed";

  return {
    code,
    message: error.message,
    repositoryError: error,
    validationErrors: error.validationErrors,
  };
}

function mapStoreError(
  error: SocialPublicationLedgerStoreError,
): SocialPublicationLedgerBridgeError {
  const code: SocialPublicationLedgerBridgeErrorCode =
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
    validationErrors: error.validationErrors?.filter(isPersistenceError),
  };
}

function validationFailure<T>(
  message: string,
  validationErrors: readonly SocialPublicationLedgerPersistenceError[],
): SocialPublicationLedgerBridgeResult<T> {
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
  code: SocialPublicationLedgerBridgeErrorCode,
  message: string,
): SocialPublicationLedgerBridgeResult<T> {
  return { ok: false, error: { code, message } };
}

function immutableCloneBridge(
  implementation: SocialPublicationLedgerBridgeImplementation,
  mode: Exclude<SocialPublicationLedgerBridgeMode, "environment">,
): SocialPublicationLedgerBridge {
  return Object.freeze({
    mode,
    appendAttempt: implementation.appendAttempt,
    appendOutcome: implementation.appendOutcome,
    appendEvidence: implementation.appendEvidence,
    appendMappedEntry: implementation.appendMappedEntry,
    loadByPost: implementation.loadByPost,
    loadByManifest: implementation.loadByManifest,
    loadByPublicationTarget: implementation.loadByPublicationTarget,
  });
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

function currentRuntimeEnvironment(): SocialPublicationLedgerBridgeRuntimeEnvironment {
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.NODE_ENV === "test") return "test";
  return "development";
}

function isPersistenceError(
  error: unknown,
): error is SocialPublicationLedgerPersistenceError {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { path?: unknown }).path === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

export function validateSocialPublicationLedgerBridgeModel(
  model: unknown,
): SocialPublicationLedgerBridgeResult<SocialPublicationLedgerPersistenceModel> {
  const validation = validateSocialPublicationLedgerPersistenceModel(model);
  if (!validation.ok) {
    return validationFailure(
      "Publication ledger bridge model failed validation.",
      validation.errors,
    );
  }

  return {
    ok: true,
    value: immutableClone(model as SocialPublicationLedgerPersistenceModel),
  };
}
