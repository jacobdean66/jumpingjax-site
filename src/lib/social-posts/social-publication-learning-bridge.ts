import { isSupabaseServiceConfigured } from "../supabase/admin";

import {
  createReferenceSocialPublicationLearningRepository,
  validateSocialPublicationLearningPersistenceModel,
  type SocialPublicationLearningInsightRecord,
  type SocialPublicationLearningPersistenceModel,
  type SocialPublicationLearningRecordError,
  type SocialPublicationLearningRepositoryError,
  type SocialPublicationLearningRepositoryIdentity,
} from "./social-publication-learning-repository";

export const SOCIAL_PUBLICATION_LEARNING_BRIDGE_MODES = [
  "environment",
  "reference",
  "production",
] as const;

export type SocialPublicationLearningBridgeMode =
  (typeof SOCIAL_PUBLICATION_LEARNING_BRIDGE_MODES)[number];

export const SOCIAL_PUBLICATION_LEARNING_BRIDGE_ERROR_CODES = [
  "configuration_invalid",
  "production_unavailable",
  "unsafe_reference_in_production",
  "validation_failed",
  "storage_error",
] as const;

export type SocialPublicationLearningBridgeErrorCode =
  (typeof SOCIAL_PUBLICATION_LEARNING_BRIDGE_ERROR_CODES)[number];

export type SocialPublicationLearningBridgeError = Readonly<{
  code: SocialPublicationLearningBridgeErrorCode;
  message: string;
  repositoryError?: SocialPublicationLearningRepositoryError;
  validationErrors?: readonly SocialPublicationLearningRecordError[];
}>;

export type SocialPublicationLearningBridgeResult<T> = Readonly<
  | { ok: true; value: T }
  | { ok: false; error: SocialPublicationLearningBridgeError }
>;

export type SocialPublicationLearningBridgeRuntimeEnvironment =
  | "development"
  | "production"
  | "test";

export type SocialPublicationLearningBridgeImplementation = Readonly<{
  listLearningInsights(
    identity?: SocialPublicationLearningRepositoryIdentity,
  ): Promise<
    SocialPublicationLearningBridgeResult<
      readonly SocialPublicationLearningInsightRecord[]
    >
  >;
  loadByIdentity(
    identity: SocialPublicationLearningRepositoryIdentity,
  ): Promise<
    SocialPublicationLearningBridgeResult<SocialPublicationLearningPersistenceModel>
  >;
  snapshot(): Promise<
    SocialPublicationLearningBridgeResult<SocialPublicationLearningPersistenceModel>
  >;
}>;

export type SocialPublicationLearningBridgeConfig = Readonly<{
  mode?: SocialPublicationLearningBridgeMode;
  runtimeEnvironment?: SocialPublicationLearningBridgeRuntimeEnvironment;
  productionStoreConfigured?: boolean;
  seed?: SocialPublicationLearningPersistenceModel;
  implementation?: SocialPublicationLearningBridgeImplementation;
}>;

export type SocialPublicationLearningBridge = Readonly<{
  mode: Exclude<SocialPublicationLearningBridgeMode, "environment">;
  listLearningInsights(
    identity?: SocialPublicationLearningRepositoryIdentity,
  ): Promise<
    SocialPublicationLearningBridgeResult<
      readonly SocialPublicationLearningInsightRecord[]
    >
  >;
  loadByIdentity(
    identity: SocialPublicationLearningRepositoryIdentity,
  ): Promise<
    SocialPublicationLearningBridgeResult<SocialPublicationLearningPersistenceModel>
  >;
  snapshot(): Promise<
    SocialPublicationLearningBridgeResult<SocialPublicationLearningPersistenceModel>
  >;
}>;

/**
 * Publication Learning is a read layer only. No production learning store
 * exists and none is created here. Production mode always fails closed
 * unless a test-only implementation is explicitly injected, so the admin
 * read layer must treat "storage unavailable" as an expected state rather
 * than a silent fallback.
 */
export function createSocialPublicationLearningBridge(
  config: SocialPublicationLearningBridgeConfig = {},
): SocialPublicationLearningBridgeResult<SocialPublicationLearningBridge> {
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
      "Publication learning production store is not configured.",
    );
  }

  if (config.implementation) {
    return {
      ok: true,
      value: immutableCloneBridge(config.implementation, "production"),
    };
  }

  return failure(
    "production_unavailable",
    "Publication learning has no production store implementation; the learning layer is a read-only reference bridge only.",
  );
}

export function resolveSocialPublicationLearningBridgeMode(
  config: SocialPublicationLearningBridgeConfig = {},
): SocialPublicationLearningBridgeResult<
  Readonly<{
    mode: Exclude<SocialPublicationLearningBridgeMode, "environment">;
    runtimeEnvironment: SocialPublicationLearningBridgeRuntimeEnvironment;
  }>
> {
  return resolveBridgeMode(config);
}

function resolveBridgeMode(
  config: SocialPublicationLearningBridgeConfig,
): SocialPublicationLearningBridgeResult<
  Readonly<{
    mode: Exclude<SocialPublicationLearningBridgeMode, "environment">;
    runtimeEnvironment: SocialPublicationLearningBridgeRuntimeEnvironment;
  }>
> {
  const runtimeEnvironment =
    config.runtimeEnvironment ?? currentRuntimeEnvironment();
  const requestedMode = config.mode ?? "environment";

  if (!SOCIAL_PUBLICATION_LEARNING_BRIDGE_MODES.includes(requestedMode)) {
    return failure(
      "configuration_invalid",
      "Publication learning bridge mode is invalid.",
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
      "Reference publication learning persistence is not allowed in production.",
    );
  }

  return { ok: true, value: { mode, runtimeEnvironment } };
}

function createReferenceBridge(
  seed?: SocialPublicationLearningPersistenceModel,
): SocialPublicationLearningBridgeResult<SocialPublicationLearningBridge> {
  const model = immutableClone(seed ?? { insights: [] });
  const validation = validateSocialPublicationLearningPersistenceModel(model);
  if (!validation.ok) {
    return validationFailure(
      "Publication learning seed model failed bridge validation.",
      validation.errors,
    );
  }

  const repository = createReferenceSocialPublicationLearningRepository(model);

  return {
    ok: true,
    value: Object.freeze({
      mode: "reference",
      listLearningInsights(identity) {
        return Promise.resolve(
          mapRepositoryResult(repository.listLearningInsights(identity ?? {})),
        );
      },
      loadByIdentity(identity) {
        return Promise.resolve(
          mapRepositoryResult(repository.getLearningRecordsByIdentity(identity)),
        );
      },
      snapshot() {
        return Promise.resolve(mapRepositoryResult(repository.snapshot()));
      },
    }),
  };
}

function mapRepositoryResult<T>(
  result:
    | Readonly<{ ok: true; value: T }>
    | Readonly<{ ok: false; error: SocialPublicationLearningRepositoryError }>,
): SocialPublicationLearningBridgeResult<T> {
  if (result.ok) return { ok: true, value: immutableClone(result.value) };
  return { ok: false, error: mapRepositoryError(result.error) };
}

function mapRepositoryError(
  error: SocialPublicationLearningRepositoryError,
): SocialPublicationLearningBridgeError {
  return {
    code: "validation_failed",
    message: error.message,
    repositoryError: error,
    validationErrors: error.validationErrors?.filter(isRecordError),
  };
}

function isRecordError(
  error: unknown,
): error is SocialPublicationLearningRecordError {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { path?: unknown }).path === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

function validationFailure<T>(
  message: string,
  validationErrors: readonly SocialPublicationLearningRecordError[],
): SocialPublicationLearningBridgeResult<T> {
  return {
    ok: false,
    error: { code: "validation_failed", message, validationErrors },
  };
}

function failure<T>(
  code: SocialPublicationLearningBridgeErrorCode,
  message: string,
): SocialPublicationLearningBridgeResult<T> {
  return { ok: false, error: { code, message } };
}

function immutableCloneBridge(
  implementation: SocialPublicationLearningBridgeImplementation,
  mode: Exclude<SocialPublicationLearningBridgeMode, "environment">,
): SocialPublicationLearningBridge {
  return Object.freeze({
    mode,
    listLearningInsights: implementation.listLearningInsights,
    loadByIdentity: implementation.loadByIdentity,
    snapshot: implementation.snapshot,
  });
}

function currentRuntimeEnvironment(): SocialPublicationLearningBridgeRuntimeEnvironment {
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
