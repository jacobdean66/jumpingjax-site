import { SOCIAL_CREDENTIAL_DOMAIN_VERSION } from "./social-credential-domain";
import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
  createSocialCredentialRepository,
  validateSocialCredentialPersistenceModel,
  type SocialCredentialAppendAuditEventRequest,
  type SocialCredentialAuditEventRecord,
  type SocialCredentialKeyVersionMutationRequest,
  type SocialCredentialKeyVersionRecord,
  type SocialCredentialLifecycleStateMutationRequest,
  type SocialCredentialLifecycleStateRecord,
  type SocialCredentialPersistenceAdapterBoundary,
  type SocialCredentialPersistenceError,
  type SocialCredentialPersistenceModel,
  type SocialCredentialProviderAccountMutationRequest,
  type SocialCredentialProviderAccountRecord,
  type SocialCredentialRepository,
  type SocialCredentialRepositoryError,
  type SocialCredentialRepositoryIdentity,
  type SocialCredentialRepositoryResult,
  type SocialCredentialVaultRecordMutationRequest,
  type SocialCredentialVaultRecordRow,
} from "./social-credential-repository";
import {
  appendSocialCredentialAuditEvent,
  createSocialCredentialKeyVersion,
  createSocialCredentialLifecycleState,
  createSocialCredentialProviderAccount,
  createSocialCredentialVaultRecord,
  deleteSocialCredentialKeyVersion,
  deleteSocialCredentialLifecycleState,
  deleteSocialCredentialProviderAccount,
  deleteSocialCredentialVaultRecord,
  isSocialCredentialStoreConfigured,
  loadSocialCredentialSnapshot,
  updateSocialCredentialKeyVersion,
  updateSocialCredentialLifecycleState,
  updateSocialCredentialProviderAccount,
  updateSocialCredentialVaultRecord,
  type SocialCredentialStoreError,
  type SocialCredentialStoreResult,
} from "./social-credential-store";

export const SOCIAL_CREDENTIAL_BRIDGE_MODES = [
  "environment",
  "reference",
  "production",
] as const;

export type SocialCredentialBridgeMode =
  (typeof SOCIAL_CREDENTIAL_BRIDGE_MODES)[number];

export const SOCIAL_CREDENTIAL_BRIDGE_ERROR_CODES = [
  "configuration_invalid",
  "production_unavailable",
  "unsafe_reference_in_production",
  "validation_failed",
  "storage_error",
  "not_found",
  "identity_collision",
  "storage_inconsistent",
] as const;

export type SocialCredentialBridgeErrorCode =
  (typeof SOCIAL_CREDENTIAL_BRIDGE_ERROR_CODES)[number];

export type SocialCredentialBridgeError = Readonly<{
  code: SocialCredentialBridgeErrorCode;
  message: string;
  repositoryError?: SocialCredentialRepositoryError;
  storeError?: SocialCredentialStoreError;
  validationErrors?: readonly SocialCredentialPersistenceError[];
}>;

export type SocialCredentialBridgeResult<T> = Readonly<
  | { ok: true; value: T }
  | { ok: false; error: SocialCredentialBridgeError }
>;

export type SocialCredentialBridgeRuntimeEnvironment =
  | "development"
  | "production"
  | "test";

export type SocialCredentialBridgeImplementation =
  | SocialCredentialBridge
  | Readonly<{
      createProviderAccount(
        request: SocialCredentialProviderAccountMutationRequest,
      ): Promise<SocialCredentialBridgeResult<SocialCredentialProviderAccountRecord>>;
      updateProviderAccount(
        request: SocialCredentialProviderAccountMutationRequest,
      ): Promise<SocialCredentialBridgeResult<SocialCredentialProviderAccountRecord>>;
      deleteProviderAccount(
        identity: SocialCredentialRepositoryIdentity,
      ): Promise<SocialCredentialBridgeResult<SocialCredentialProviderAccountRecord>>;
      createVaultRecordMetadata(
        request: SocialCredentialVaultRecordMutationRequest,
      ): Promise<SocialCredentialBridgeResult<SocialCredentialVaultRecordRow>>;
      updateVaultRecordMetadata(
        request: SocialCredentialVaultRecordMutationRequest,
      ): Promise<SocialCredentialBridgeResult<SocialCredentialVaultRecordRow>>;
      deleteVaultRecordMetadata(
        identity: SocialCredentialRepositoryIdentity,
      ): Promise<SocialCredentialBridgeResult<SocialCredentialVaultRecordRow>>;
      createLifecycleState(
        request: SocialCredentialLifecycleStateMutationRequest,
      ): Promise<SocialCredentialBridgeResult<SocialCredentialLifecycleStateRecord>>;
      updateLifecycleState(
        request: SocialCredentialLifecycleStateMutationRequest,
      ): Promise<SocialCredentialBridgeResult<SocialCredentialLifecycleStateRecord>>;
      deleteLifecycleState(
        identity: SocialCredentialRepositoryIdentity,
      ): Promise<SocialCredentialBridgeResult<SocialCredentialLifecycleStateRecord>>;
      appendAuditEvent(
        request: SocialCredentialAppendAuditEventRequest,
      ): Promise<SocialCredentialBridgeResult<SocialCredentialAuditEventRecord>>;
      createKeyVersion(
        request: SocialCredentialKeyVersionMutationRequest,
      ): Promise<SocialCredentialBridgeResult<SocialCredentialKeyVersionRecord>>;
      updateKeyVersion(
        request: SocialCredentialKeyVersionMutationRequest,
      ): Promise<SocialCredentialBridgeResult<SocialCredentialKeyVersionRecord>>;
      deleteKeyVersion(
        identity: SocialCredentialRepositoryIdentity,
      ): Promise<SocialCredentialBridgeResult<SocialCredentialKeyVersionRecord>>;
      getCredentialRecordsByIdentity(
        identity: SocialCredentialRepositoryIdentity,
      ): Promise<SocialCredentialBridgeResult<SocialCredentialPersistenceModel>>;
      listProviderAccounts(
        identity?: SocialCredentialRepositoryIdentity,
      ): Promise<SocialCredentialBridgeResult<readonly SocialCredentialProviderAccountRecord[]>>;
      listVaultRecordMetadata(
        identity?: SocialCredentialRepositoryIdentity,
      ): Promise<SocialCredentialBridgeResult<readonly SocialCredentialVaultRecordRow[]>>;
      listLifecycleStates(
        identity?: SocialCredentialRepositoryIdentity,
      ): Promise<SocialCredentialBridgeResult<readonly SocialCredentialLifecycleStateRecord[]>>;
      listAuditEvents(
        identity?: SocialCredentialRepositoryIdentity,
      ): Promise<SocialCredentialBridgeResult<readonly SocialCredentialAuditEventRecord[]>>;
      listKeyVersions(): Promise<SocialCredentialBridgeResult<readonly SocialCredentialKeyVersionRecord[]>>;
      snapshot(): Promise<SocialCredentialBridgeResult<SocialCredentialPersistenceModel>>;
    }>;

export type SocialCredentialBridgeConfig = Readonly<{
  mode?: SocialCredentialBridgeMode;
  runtimeEnvironment?: SocialCredentialBridgeRuntimeEnvironment;
  productionStoreConfigured?: boolean;
  seed?: SocialCredentialPersistenceModel;
  implementation?: SocialCredentialBridgeImplementation;
}>;

export type SocialCredentialBridge = Readonly<{
  mode: Exclude<SocialCredentialBridgeMode, "environment">;
  createProviderAccount(
    request: SocialCredentialProviderAccountMutationRequest,
  ): Promise<SocialCredentialBridgeResult<SocialCredentialProviderAccountRecord>>;
  updateProviderAccount(
    request: SocialCredentialProviderAccountMutationRequest,
  ): Promise<SocialCredentialBridgeResult<SocialCredentialProviderAccountRecord>>;
  deleteProviderAccount(
    identity: SocialCredentialRepositoryIdentity,
  ): Promise<SocialCredentialBridgeResult<SocialCredentialProviderAccountRecord>>;
  createVaultRecordMetadata(
    request: SocialCredentialVaultRecordMutationRequest,
  ): Promise<SocialCredentialBridgeResult<SocialCredentialVaultRecordRow>>;
  updateVaultRecordMetadata(
    request: SocialCredentialVaultRecordMutationRequest,
  ): Promise<SocialCredentialBridgeResult<SocialCredentialVaultRecordRow>>;
  deleteVaultRecordMetadata(
    identity: SocialCredentialRepositoryIdentity,
  ): Promise<SocialCredentialBridgeResult<SocialCredentialVaultRecordRow>>;
  createLifecycleState(
    request: SocialCredentialLifecycleStateMutationRequest,
  ): Promise<SocialCredentialBridgeResult<SocialCredentialLifecycleStateRecord>>;
  updateLifecycleState(
    request: SocialCredentialLifecycleStateMutationRequest,
  ): Promise<SocialCredentialBridgeResult<SocialCredentialLifecycleStateRecord>>;
  deleteLifecycleState(
    identity: SocialCredentialRepositoryIdentity,
  ): Promise<SocialCredentialBridgeResult<SocialCredentialLifecycleStateRecord>>;
  appendAuditEvent(
    request: SocialCredentialAppendAuditEventRequest,
  ): Promise<SocialCredentialBridgeResult<SocialCredentialAuditEventRecord>>;
  createKeyVersion(
    request: SocialCredentialKeyVersionMutationRequest,
  ): Promise<SocialCredentialBridgeResult<SocialCredentialKeyVersionRecord>>;
  updateKeyVersion(
    request: SocialCredentialKeyVersionMutationRequest,
  ): Promise<SocialCredentialBridgeResult<SocialCredentialKeyVersionRecord>>;
  deleteKeyVersion(
    identity: SocialCredentialRepositoryIdentity,
  ): Promise<SocialCredentialBridgeResult<SocialCredentialKeyVersionRecord>>;
  getCredentialRecordsByIdentity(
    identity: SocialCredentialRepositoryIdentity,
  ): Promise<SocialCredentialBridgeResult<SocialCredentialPersistenceModel>>;
  listProviderAccounts(
    identity?: SocialCredentialRepositoryIdentity,
  ): Promise<SocialCredentialBridgeResult<readonly SocialCredentialProviderAccountRecord[]>>;
  listVaultRecordMetadata(
    identity?: SocialCredentialRepositoryIdentity,
  ): Promise<SocialCredentialBridgeResult<readonly SocialCredentialVaultRecordRow[]>>;
  listLifecycleStates(
    identity?: SocialCredentialRepositoryIdentity,
  ): Promise<SocialCredentialBridgeResult<readonly SocialCredentialLifecycleStateRecord[]>>;
  listAuditEvents(
    identity?: SocialCredentialRepositoryIdentity,
  ): Promise<SocialCredentialBridgeResult<readonly SocialCredentialAuditEventRecord[]>>;
  listKeyVersions(): Promise<SocialCredentialBridgeResult<readonly SocialCredentialKeyVersionRecord[]>>;
  snapshot(): Promise<SocialCredentialBridgeResult<SocialCredentialPersistenceModel>>;
}>;

const LOCAL_ADAPTER_CONTRACT = Object.freeze({
  adapterId: "credential-bridge-local-adapter",
  repositoryVersion: SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
  domainVersion: SOCIAL_CREDENTIAL_DOMAIN_VERSION,
  capabilities: {
    adapterBoundaryOnly: true as const,
    referenceOnly: true as const,
    metadataOnly: true as const,
    storesNoSecrets: true as const,
    storesNoTokens: true as const,
    storesNoPlaintext: true as const,
    exposesNoSql: true as const,
    usesNoSupabase: true as const,
    usesNoNetwork: true as const,
    performsNoEncryption: true as const,
    performsNoDecryption: true as const,
    grantsExecutionPermission: false as const,
    executesNothing: true as const,
    publishesNothing: true as const,
  },
});

export function createSocialCredentialBridge(
  config: SocialCredentialBridgeConfig = {},
): SocialCredentialBridgeResult<SocialCredentialBridge> {
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
    config.productionStoreConfigured ?? isSocialCredentialStoreConfigured();
  if (!configured) {
    return failure(
      "production_unavailable",
      "Credential production store is not configured.",
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

export function resolveSocialCredentialBridgeMode(
  config: SocialCredentialBridgeConfig = {},
): SocialCredentialBridgeResult<
  Readonly<{
    mode: Exclude<SocialCredentialBridgeMode, "environment">;
    runtimeEnvironment: SocialCredentialBridgeRuntimeEnvironment;
  }>
> {
  return resolveBridgeMode(config);
}

export function validateSocialCredentialBridgeModel(
  model: unknown,
): SocialCredentialBridgeResult<SocialCredentialPersistenceModel> {
  const validation = validateSocialCredentialPersistenceModel(model);
  if (!validation.ok) {
    return validationFailure(
      "Credential bridge model failed validation.",
      validation.errors,
    );
  }
  return {
    ok: true,
    value: immutableClone(model as SocialCredentialPersistenceModel),
  };
}

function resolveBridgeMode(
  config: SocialCredentialBridgeConfig,
): SocialCredentialBridgeResult<
  Readonly<{
    mode: Exclude<SocialCredentialBridgeMode, "environment">;
    runtimeEnvironment: SocialCredentialBridgeRuntimeEnvironment;
  }>
> {
  const runtimeEnvironment =
    config.runtimeEnvironment ?? currentRuntimeEnvironment();
  const requestedMode = config.mode ?? "environment";

  if (!SOCIAL_CREDENTIAL_BRIDGE_MODES.includes(requestedMode)) {
    return failure("configuration_invalid", "Credential bridge mode is invalid.");
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
      "Reference credential persistence is not allowed in production.",
    );
  }

  return { ok: true, value: { mode, runtimeEnvironment } };
}

function createReferenceBridge(
  seed?: SocialCredentialPersistenceModel,
): SocialCredentialBridgeResult<SocialCredentialBridge> {
  const modelValidation = validateSocialCredentialBridgeModel(
    seed ?? EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  );
  if (!modelValidation.ok) return modelValidation;

  const repository = createLocalRepository(modelValidation.value);

  return {
    ok: true,
    value: Object.freeze({
      mode: "reference",
      createProviderAccount(request) {
        return Promise.resolve(mapRepositoryResult(repository.createProviderAccount(request)));
      },
      updateProviderAccount(request) {
        return Promise.resolve(mapRepositoryResult(repository.updateProviderAccount(request)));
      },
      deleteProviderAccount(identity) {
        return Promise.resolve(mapRepositoryResult(repository.deleteProviderAccount(identity)));
      },
      createVaultRecordMetadata(request) {
        return Promise.resolve(mapRepositoryResult(repository.createVaultRecordMetadata(request)));
      },
      updateVaultRecordMetadata(request) {
        return Promise.resolve(mapRepositoryResult(repository.updateVaultRecordMetadata(request)));
      },
      deleteVaultRecordMetadata(identity) {
        return Promise.resolve(mapRepositoryResult(repository.deleteVaultRecordMetadata(identity)));
      },
      createLifecycleState(request) {
        return Promise.resolve(mapRepositoryResult(repository.createLifecycleState(request)));
      },
      updateLifecycleState(request) {
        return Promise.resolve(mapRepositoryResult(repository.updateLifecycleState(request)));
      },
      deleteLifecycleState(identity) {
        return Promise.resolve(mapRepositoryResult(repository.deleteLifecycleState(identity)));
      },
      appendAuditEvent(request) {
        return Promise.resolve(mapRepositoryResult(repository.appendAuditEvent(request)));
      },
      createKeyVersion(request) {
        return Promise.resolve(mapRepositoryResult(repository.createKeyVersion(request)));
      },
      updateKeyVersion(request) {
        return Promise.resolve(mapRepositoryResult(repository.updateKeyVersion(request)));
      },
      deleteKeyVersion(identity) {
        return Promise.resolve(mapRepositoryResult(repository.deleteKeyVersion(identity)));
      },
      getCredentialRecordsByIdentity(identity) {
        return Promise.resolve(mapRepositoryResult(repository.getCredentialRecordsByIdentity(identity)));
      },
      listProviderAccounts(identity = {}) {
        return Promise.resolve(mapRepositoryResult(repository.listProviderAccounts(identity)));
      },
      listVaultRecordMetadata(identity = {}) {
        return Promise.resolve(mapRepositoryResult(repository.listVaultRecordMetadata(identity)));
      },
      listLifecycleStates(identity = {}) {
        return Promise.resolve(mapRepositoryResult(repository.listLifecycleStates(identity)));
      },
      listAuditEvents(identity = {}) {
        return Promise.resolve(mapRepositoryResult(repository.listAuditEvents(identity)));
      },
      listKeyVersions() {
        return Promise.resolve(mapRepositoryResult(repository.listKeyVersions()));
      },
      snapshot() {
        return Promise.resolve(mapRepositoryResult(repository.snapshot()));
      },
    }),
  };
}

function createProductionBridge(): SocialCredentialBridge {
  async function withRepository<T>(
    operation: (
      repository: SocialCredentialRepository,
    ) => SocialCredentialRepositoryResult<T>,
  ): Promise<SocialCredentialBridgeResult<T>> {
    const snapshot = await loadSocialCredentialSnapshot();
    if (!snapshot.ok) return { ok: false, error: mapStoreError(snapshot.error) };
    return mapRepositoryResult(operation(createLocalRepository(snapshot.value)));
  }

  return Object.freeze({
    mode: "production",
    async createProviderAccount(request) {
      const simulated = await withRepository((repository) =>
        repository.createProviderAccount(request)
      );
      if (!simulated.ok) return simulated;
      return mapStoreResult(
        await createSocialCredentialProviderAccount(request.providerAccount),
      );
    },
    async updateProviderAccount(request) {
      const simulated = await withRepository((repository) =>
        repository.updateProviderAccount(request)
      );
      if (!simulated.ok) return simulated;
      return mapStoreResult(
        await updateSocialCredentialProviderAccount(request.providerAccount),
      );
    },
    async deleteProviderAccount(identity) {
      const simulated = await withRepository((repository) =>
        repository.deleteProviderAccount(identity)
      );
      if (!simulated.ok) return simulated;
      return mapStoreResult(
        await deleteSocialCredentialProviderAccount(
          String(simulated.value.provider_account_id),
        ),
      );
    },
    async createVaultRecordMetadata(request) {
      const simulated = await withRepository((repository) =>
        repository.createVaultRecordMetadata(request)
      );
      if (!simulated.ok) return simulated;
      return mapStoreResult(
        await createSocialCredentialVaultRecord(request.vaultRecord),
      );
    },
    async updateVaultRecordMetadata(request) {
      const simulated = await withRepository((repository) =>
        repository.updateVaultRecordMetadata(request)
      );
      if (!simulated.ok) return simulated;
      return mapStoreResult(
        await updateSocialCredentialVaultRecord(request.vaultRecord),
      );
    },
    async deleteVaultRecordMetadata(identity) {
      const simulated = await withRepository((repository) =>
        repository.deleteVaultRecordMetadata(identity)
      );
      if (!simulated.ok) return simulated;
      return mapStoreResult(
        await deleteSocialCredentialVaultRecord(
          String(simulated.value.vault_record_id),
        ),
      );
    },
    async createLifecycleState(request) {
      const simulated = await withRepository((repository) =>
        repository.createLifecycleState(request)
      );
      if (!simulated.ok) return simulated;
      return mapStoreResult(
        await createSocialCredentialLifecycleState(request.lifecycleState),
      );
    },
    async updateLifecycleState(request) {
      const simulated = await withRepository((repository) =>
        repository.updateLifecycleState(request)
      );
      if (!simulated.ok) return simulated;
      return mapStoreResult(
        await updateSocialCredentialLifecycleState(request.lifecycleState),
      );
    },
    async deleteLifecycleState(identity) {
      const simulated = await withRepository((repository) =>
        repository.deleteLifecycleState(identity)
      );
      if (!simulated.ok) return simulated;
      return mapStoreResult(
        await deleteSocialCredentialLifecycleState(
          String(simulated.value.lifecycle_state_id),
        ),
      );
    },
    async appendAuditEvent(request) {
      const simulated = await withRepository((repository) =>
        repository.appendAuditEvent(request)
      );
      if (!simulated.ok) return simulated;
      return mapStoreResult(
        await appendSocialCredentialAuditEvent(request.auditEvent),
      );
    },
    async createKeyVersion(request) {
      const simulated = await withRepository((repository) =>
        repository.createKeyVersion(request)
      );
      if (!simulated.ok) return simulated;
      return mapStoreResult(
        await createSocialCredentialKeyVersion(request.keyVersion),
      );
    },
    async updateKeyVersion(request) {
      const simulated = await withRepository((repository) =>
        repository.updateKeyVersion(request)
      );
      if (!simulated.ok) return simulated;
      return mapStoreResult(
        await updateSocialCredentialKeyVersion(request.keyVersion),
      );
    },
    async deleteKeyVersion(identity) {
      const simulated = await withRepository((repository) =>
        repository.deleteKeyVersion(identity)
      );
      if (!simulated.ok) return simulated;
      return mapStoreResult(
        await deleteSocialCredentialKeyVersion(String(simulated.value.key_version)),
      );
    },
    getCredentialRecordsByIdentity(identity) {
      return withRepository((repository) =>
        repository.getCredentialRecordsByIdentity(identity)
      );
    },
    listProviderAccounts(identity = {}) {
      return withRepository((repository) =>
        repository.listProviderAccounts(identity)
      );
    },
    listVaultRecordMetadata(identity = {}) {
      return withRepository((repository) =>
        repository.listVaultRecordMetadata(identity)
      );
    },
    listLifecycleStates(identity = {}) {
      return withRepository((repository) =>
        repository.listLifecycleStates(identity)
      );
    },
    listAuditEvents(identity = {}) {
      return withRepository((repository) =>
        repository.listAuditEvents(identity)
      );
    },
    listKeyVersions() {
      return withRepository((repository) => repository.listKeyVersions());
    },
    snapshot() {
      return withRepository((repository) => repository.snapshot());
    },
  });
}

function createLocalRepository(
  seed: SocialCredentialPersistenceModel,
): SocialCredentialRepository {
  let snapshot = immutableClone(seed);
  const adapter: SocialCredentialPersistenceAdapterBoundary = {
    contract: LOCAL_ADAPTER_CONTRACT,
    loadSnapshot() {
      return { ok: true, value: snapshot };
    },
    persistSnapshot(model) {
      snapshot = immutableClone(model);
      return { ok: true, value: snapshot };
    },
  };
  return createSocialCredentialRepository(adapter);
}

function mapRepositoryResult<T>(
  result: SocialCredentialRepositoryResult<T>,
): SocialCredentialBridgeResult<T> {
  if (result.ok) {
    return { ok: true, value: immutableClone(result.value) };
  }
  return { ok: false, error: mapRepositoryError(result.error) };
}

function mapStoreResult<T>(
  result: SocialCredentialStoreResult<T>,
): SocialCredentialBridgeResult<T> {
  if (result.ok) {
    return { ok: true, value: immutableClone(result.value) };
  }
  return { ok: false, error: mapStoreError(result.error) };
}

function mapRepositoryError(
  error: SocialCredentialRepositoryError,
): SocialCredentialBridgeError {
  const code: SocialCredentialBridgeErrorCode =
    error.code === "not_found"
      ? "not_found"
      : error.code === "identity_collision"
        ? "identity_collision"
        : error.code === "adapter_contract_invalid"
          ? "storage_inconsistent"
          : error.code === "adapter_unavailable"
            ? "storage_error"
            : "validation_failed";

  return {
    code,
    message: error.message,
    repositoryError: error,
    validationErrors: error.validationErrors,
  };
}

function mapStoreError(error: SocialCredentialStoreError): SocialCredentialBridgeError {
  const code: SocialCredentialBridgeErrorCode =
    error.code === "duplicate_identity"
      ? "identity_collision"
      : error.code === "not_found"
        ? "not_found"
        : error.code === "validation_failed"
          ? "validation_failed"
          : error.code === "storage_inconsistent"
            ? "storage_inconsistent"
            : "storage_error";

  return {
    code,
    message: error.message,
    storeError: error,
    validationErrors: error.validationErrors,
  };
}

function validationFailure<T>(
  message: string,
  validationErrors: readonly SocialCredentialPersistenceError[],
): SocialCredentialBridgeResult<T> {
  return {
    ok: false,
    error: { code: "validation_failed", message, validationErrors },
  };
}

function failure<T>(
  code: SocialCredentialBridgeErrorCode,
  message: string,
): SocialCredentialBridgeResult<T> {
  return { ok: false, error: { code, message } };
}

function immutableCloneBridge(
  implementation: SocialCredentialBridgeImplementation,
  mode: Exclude<SocialCredentialBridgeMode, "environment">,
): SocialCredentialBridge {
  return Object.freeze({
    mode,
    createProviderAccount: implementation.createProviderAccount,
    updateProviderAccount: implementation.updateProviderAccount,
    deleteProviderAccount: implementation.deleteProviderAccount,
    createVaultRecordMetadata: implementation.createVaultRecordMetadata,
    updateVaultRecordMetadata: implementation.updateVaultRecordMetadata,
    deleteVaultRecordMetadata: implementation.deleteVaultRecordMetadata,
    createLifecycleState: implementation.createLifecycleState,
    updateLifecycleState: implementation.updateLifecycleState,
    deleteLifecycleState: implementation.deleteLifecycleState,
    appendAuditEvent: implementation.appendAuditEvent,
    createKeyVersion: implementation.createKeyVersion,
    updateKeyVersion: implementation.updateKeyVersion,
    deleteKeyVersion: implementation.deleteKeyVersion,
    getCredentialRecordsByIdentity: implementation.getCredentialRecordsByIdentity,
    listProviderAccounts: implementation.listProviderAccounts,
    listVaultRecordMetadata: implementation.listVaultRecordMetadata,
    listLifecycleStates: implementation.listLifecycleStates,
    listAuditEvents: implementation.listAuditEvents,
    listKeyVersions: implementation.listKeyVersions,
    snapshot: implementation.snapshot,
  });
}

function currentRuntimeEnvironment(): SocialCredentialBridgeRuntimeEnvironment {
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
