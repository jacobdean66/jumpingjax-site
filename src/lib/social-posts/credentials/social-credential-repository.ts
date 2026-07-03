import {
  SOCIAL_CREDENTIAL_AUDIT_ACTIONS,
  SOCIAL_CREDENTIAL_AUDIT_OUTCOMES,
  SOCIAL_CREDENTIAL_DOMAIN_VERSION,
  SOCIAL_CREDENTIAL_KEY_VERSION_STATUSES,
  SOCIAL_CREDENTIAL_LIFECYCLE_PHASES,
  SOCIAL_CREDENTIAL_PROVIDER_ACCOUNT_STATUSES,
  validateSocialCredentialLifecycleState,
  validateSocialCredentialAuditEvent,
  validateSocialCredentialIdentity,
  validateSocialCredentialKeyVersion,
  validateSocialCredentialProviderAccountReference,
  validateSocialCredentialReference,
  validateSocialCredentialVaultRecordMetadata,
  type SocialCredentialAuditEvent,
  type SocialCredentialAuditAction,
  type SocialCredentialAuditOutcome,
  type SocialCredentialIdentity,
  type SocialCredentialKeyVersion,
  type SocialCredentialKeyVersionStatus,
  type SocialCredentialLifecyclePhase,
  type SocialCredentialLifecycleState,
  type SocialCredentialReference,
  type SocialCredentialProviderAccountReference,
  type SocialCredentialProviderAccountStatus,
  type SocialCredentialVaultRecordMetadata,
} from "./social-credential-domain";
import {
  SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
  type SocialPlatformCredentialKind,
  type SocialPlatformCredentialProvider,
  isSocialPlatformCredentialKind,
  isSocialPlatformCredentialProvider,
} from "../social-platform-credential-boundary";

type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

type UnknownRecord = Readonly<Record<string, unknown>>;

export type SocialCredentialVaultRecordId = Brand<string, "SocialCredentialVaultRecordId">;
export type SocialCredentialRefId = Brand<string, "SocialCredentialRefId">;
export type SocialCredentialProviderAccountId = Brand<string, "SocialCredentialProviderAccountId">;
export type SocialCredentialPublicationTargetId = Brand<string, "SocialCredentialPublicationTargetId">;
export type SocialCredentialLifecycleStateId = Brand<string, "SocialCredentialLifecycleStateId">;
export type SocialCredentialAuditEventId = Brand<string, "SocialCredentialAuditEventId">;
export type SocialCredentialKeyVersionId = Brand<string, "SocialCredentialKeyVersionId">;

export type SocialCredentialProviderAccountRecord = Readonly<{
  provider_account_id: SocialCredentialProviderAccountId;
  provider: SocialPlatformCredentialProvider;
  publication_target_id: SocialCredentialPublicationTargetId;
  external_account_id_redacted: string;
  display_name_redacted: string;
  status: SocialCredentialProviderAccountStatus;
  account_ref_id: string;
  created_at: string;
  references_only: true;
  contains_credentials: false;
  grants_execution_permission: false;
  executes_nothing: true;
  publishes_nothing: true;
}>;

export type SocialCredentialVaultRecordRow = Readonly<{
  vault_record_id: SocialCredentialVaultRecordId;
  credential_ref_id: SocialCredentialRefId;
  provider: SocialPlatformCredentialProvider;
  credential_kind: SocialPlatformCredentialKind;
  account_ref_id: string;
  provider_account_id: SocialCredentialProviderAccountId;
  publication_target_id: SocialCredentialPublicationTargetId;
  encrypted_payload_ref: string;
  key_version: string;
  lifecycle_phase: SocialCredentialLifecyclePhase;
  superseded_at: string | null;
  revoked_at: string | null;
  created_at: string;
  metadata_only: true;
  contains_plaintext: false;
  contains_ciphertext: false;
  grants_execution_permission: false;
  executes_nothing: true;
  publishes_nothing: true;
}>;

export type SocialCredentialLifecycleStateRecord = Readonly<{
  lifecycle_state_id: SocialCredentialLifecycleStateId;
  credential_ref_id: SocialCredentialRefId;
  account_ref_id: string;
  provider: SocialPlatformCredentialProvider;
  authorization_state: string;
  lifecycle_phase: SocialCredentialLifecyclePhase;
  issued_at: string | null;
  expires_at: string | null;
  last_rotated_at: string | null;
  revoked_at: string | null;
  scope_fingerprint_redacted: string | null;
  created_at: string;
  modeled_only: true;
  references_only: true;
  contains_credentials: false;
  grants_execution_permission: false;
  executes_nothing: true;
  publishes_nothing: true;
}>;

export type SocialCredentialAuditEventRecord = Readonly<{
  audit_event_id: SocialCredentialAuditEventId;
  credential_ref_id: SocialCredentialRefId;
  actor_admin_id: string | null;
  action: SocialCredentialAuditAction;
  outcome: SocialCredentialAuditOutcome;
  sanitized_detail: string;
  created_at: string;
  append_only: true;
  contains_secrets: false;
  grants_execution_permission: false;
  executes_nothing: true;
  publishes_nothing: true;
}>;

export type SocialCredentialKeyVersionRecord = Readonly<{
  key_version: SocialCredentialKeyVersionId;
  status: SocialCredentialKeyVersionStatus;
  activated_at: string;
  retired_at: string | null;
  metadata_only: true;
  contains_key_material: false;
  grants_execution_permission: false;
  executes_nothing: true;
  publishes_nothing: true;
}>;

export type SocialCredentialPersistenceModel = Readonly<{
  provider_accounts: readonly SocialCredentialProviderAccountRecord[];
  vault_records: readonly SocialCredentialVaultRecordRow[];
  lifecycle_states: readonly SocialCredentialLifecycleStateRecord[];
  audit_events: readonly SocialCredentialAuditEventRecord[];
  key_versions: readonly SocialCredentialKeyVersionRecord[];
}>;

export const SOCIAL_CREDENTIAL_REPOSITORY_VERSION = "d13-w3-v1" as const;

export const SOCIAL_CREDENTIAL_REPOSITORY_ERROR_CODES = [
  "validation_failed",
  "identity_required",
  "identity_collision",
  "adapter_contract_invalid",
  "adapter_unavailable",
  "serialization_invalid",
  "contract_only",
  "not_found",
] as const;

export const SOCIAL_CREDENTIAL_PERSISTENCE_ERROR_CODES = [
  "required_field_missing",
  "identity_not_separated",
  "provider_invalid",
  "credential_kind_invalid",
  "lifecycle_phase_invalid",
  "account_status_invalid",
  "audit_action_invalid",
  "audit_outcome_invalid",
  "key_version_status_invalid",
  "timestamp_invalid",
  "contract_invariant_failed",
  "secret_forbidden",
  "plaintext_forbidden",
  "ciphertext_forbidden",
  "unsafe_recursive_state_forbidden",
] as const;

export type SocialCredentialRepositoryErrorCode =
  (typeof SOCIAL_CREDENTIAL_REPOSITORY_ERROR_CODES)[number];

export type SocialCredentialPersistenceErrorCode =
  (typeof SOCIAL_CREDENTIAL_PERSISTENCE_ERROR_CODES)[number];

export type SocialCredentialPersistenceError = Readonly<{
  code: SocialCredentialPersistenceErrorCode;
  path: string;
  message: string;
}>;

export type SocialCredentialRepositoryError = Readonly<{
  code: SocialCredentialRepositoryErrorCode;
  message: string;
  validationErrors?: readonly SocialCredentialPersistenceError[];
}>;

export type SocialCredentialRepositoryResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: SocialCredentialRepositoryError }>;

export type SocialCredentialPersistenceValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly SocialCredentialPersistenceError[] }
>;

export type SocialCredentialRepositoryIdentity = Readonly<{
  provider_account_id?: string;
  vault_record_id?: string;
  lifecycle_state_id?: string;
  audit_event_id?: string;
  key_version?: string;
  credential_ref_id?: string;
  publication_target_id?: string;
  provider?: SocialPlatformCredentialProvider;
  account_ref_id?: string;
}>;

export type SocialCredentialRepositorySnapshot = SocialCredentialPersistenceModel;

export type SocialCredentialRepositoryRecordsByIdentity = SocialCredentialPersistenceModel;

export type SocialCredentialProviderAccountMutationRequest = Readonly<{
  providerAccount: SocialCredentialProviderAccountRecord;
}>;

export type SocialCredentialVaultRecordMutationRequest = Readonly<{
  vaultRecord: SocialCredentialVaultRecordRow;
}>;

export type SocialCredentialLifecycleStateMutationRequest = Readonly<{
  lifecycleState: SocialCredentialLifecycleStateRecord;
}>;

export type SocialCredentialAppendAuditEventRequest = Readonly<{
  auditEvent: SocialCredentialAuditEventRecord;
}>;

export type SocialCredentialKeyVersionMutationRequest = Readonly<{
  keyVersion: SocialCredentialKeyVersionRecord;
}>;

export type SocialCredentialPersistenceAdapterCapabilities = Readonly<{
  adapterBoundaryOnly: true;
  referenceOnly: true;
  metadataOnly: true;
  storesNoSecrets: true;
  storesNoTokens: true;
  storesNoPlaintext: true;
  exposesNoSql: true;
  usesNoSupabase: true;
  usesNoNetwork: true;
  performsNoEncryption: true;
  performsNoDecryption: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialPersistenceAdapterContract = Readonly<{
  adapterId: string;
  repositoryVersion: typeof SOCIAL_CREDENTIAL_REPOSITORY_VERSION;
  domainVersion: typeof SOCIAL_CREDENTIAL_DOMAIN_VERSION;
  capabilities: SocialCredentialPersistenceAdapterCapabilities;
}>;

export type SocialCredentialPersistenceAdapterBoundary = Readonly<{
  contract: SocialCredentialPersistenceAdapterContract;
  loadSnapshot(): SocialCredentialRepositoryResult<SocialCredentialPersistenceModel>;
  persistSnapshot(
    model: SocialCredentialPersistenceModel,
  ): SocialCredentialRepositoryResult<SocialCredentialPersistenceModel>;
}>;

export type SocialCredentialStorageContract = Readonly<{
  contractVersion: typeof SOCIAL_CREDENTIAL_REPOSITORY_VERSION;
  domainVersion: typeof SOCIAL_CREDENTIAL_DOMAIN_VERSION;
  referenceOnly: true;
  adapterBoundaryOnly: true;
  implementsNothing: true;
  allowsSql: false;
  allowsSupabase: false;
  allowsEncryption: false;
  allowsDecryption: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export const SOCIAL_CREDENTIAL_STORAGE_CONTRACT: SocialCredentialStorageContract = Object.freeze({
  contractVersion: SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
  domainVersion: SOCIAL_CREDENTIAL_DOMAIN_VERSION,
  referenceOnly: true,
  adapterBoundaryOnly: true,
  implementsNothing: true,
  allowsSql: false,
  allowsSupabase: false,
  allowsEncryption: false,
  allowsDecryption: false,
  grantsExecutionPermission: false,
  executesNothing: true,
  publishesNothing: true,
});

export const SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_COLLECTIONS = [
  "audit_events",
] as const;

export const SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_OPERATIONS = [
  "appendAuditEvent",
] as const;

export const SOCIAL_CREDENTIAL_REPOSITORY_FORBIDDEN_AUDIT_MUTATIONS = [
  "updateAuditEvent",
  "deleteAuditEvent",
] as const;

export type SocialCredentialRepositoryAppendOnlyBoundary = Readonly<{
  version: typeof SOCIAL_CREDENTIAL_REPOSITORY_VERSION;
  appendOnlyCollections: readonly (typeof SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_COLLECTIONS)[number][];
  appendOnlyOperations: readonly (typeof SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_OPERATIONS)[number][];
  forbiddenAuditMutations: readonly (typeof SOCIAL_CREDENTIAL_REPOSITORY_FORBIDDEN_AUDIT_MUTATIONS)[number][];
  auditEventsImmutable: true;
  preservesW2AppendOnlySemantics: true;
}>;

export const SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_BOUNDARY: SocialCredentialRepositoryAppendOnlyBoundary =
  Object.freeze({
    version: SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
    appendOnlyCollections: Object.freeze([...SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_COLLECTIONS]),
    appendOnlyOperations: Object.freeze([...SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_OPERATIONS]),
    forbiddenAuditMutations: Object.freeze([...SOCIAL_CREDENTIAL_REPOSITORY_FORBIDDEN_AUDIT_MUTATIONS]),
    auditEventsImmutable: true,
    preservesW2AppendOnlySemantics: true,
  });

export type SocialCredentialRepository = Readonly<{
  createProviderAccount(
    request: SocialCredentialProviderAccountMutationRequest,
  ): SocialCredentialRepositoryResult<SocialCredentialProviderAccountRecord>;
  updateProviderAccount(
    request: SocialCredentialProviderAccountMutationRequest,
  ): SocialCredentialRepositoryResult<SocialCredentialProviderAccountRecord>;
  deleteProviderAccount(
    identity: SocialCredentialRepositoryIdentity,
  ): SocialCredentialRepositoryResult<SocialCredentialProviderAccountRecord>;
  createVaultRecordMetadata(
    request: SocialCredentialVaultRecordMutationRequest,
  ): SocialCredentialRepositoryResult<SocialCredentialVaultRecordRow>;
  updateVaultRecordMetadata(
    request: SocialCredentialVaultRecordMutationRequest,
  ): SocialCredentialRepositoryResult<SocialCredentialVaultRecordRow>;
  deleteVaultRecordMetadata(
    identity: SocialCredentialRepositoryIdentity,
  ): SocialCredentialRepositoryResult<SocialCredentialVaultRecordRow>;
  createLifecycleState(
    request: SocialCredentialLifecycleStateMutationRequest,
  ): SocialCredentialRepositoryResult<SocialCredentialLifecycleStateRecord>;
  updateLifecycleState(
    request: SocialCredentialLifecycleStateMutationRequest,
  ): SocialCredentialRepositoryResult<SocialCredentialLifecycleStateRecord>;
  deleteLifecycleState(
    identity: SocialCredentialRepositoryIdentity,
  ): SocialCredentialRepositoryResult<SocialCredentialLifecycleStateRecord>;
  appendAuditEvent(
    request: SocialCredentialAppendAuditEventRequest,
  ): SocialCredentialRepositoryResult<SocialCredentialAuditEventRecord>;
  createKeyVersion(
    request: SocialCredentialKeyVersionMutationRequest,
  ): SocialCredentialRepositoryResult<SocialCredentialKeyVersionRecord>;
  updateKeyVersion(
    request: SocialCredentialKeyVersionMutationRequest,
  ): SocialCredentialRepositoryResult<SocialCredentialKeyVersionRecord>;
  deleteKeyVersion(
    identity: SocialCredentialRepositoryIdentity,
  ): SocialCredentialRepositoryResult<SocialCredentialKeyVersionRecord>;
  getCredentialRecordsByIdentity(
    identity: SocialCredentialRepositoryIdentity,
  ): SocialCredentialRepositoryResult<SocialCredentialRepositoryRecordsByIdentity>;
  listProviderAccounts(
    identity?: SocialCredentialRepositoryIdentity,
  ): SocialCredentialRepositoryResult<readonly SocialCredentialProviderAccountRecord[]>;
  listVaultRecordMetadata(
    identity?: SocialCredentialRepositoryIdentity,
  ): SocialCredentialRepositoryResult<readonly SocialCredentialVaultRecordRow[]>;
  listLifecycleStates(
    identity?: SocialCredentialRepositoryIdentity,
  ): SocialCredentialRepositoryResult<readonly SocialCredentialLifecycleStateRecord[]>;
  listAuditEvents(
    identity?: SocialCredentialRepositoryIdentity,
  ): SocialCredentialRepositoryResult<readonly SocialCredentialAuditEventRecord[]>;
  listKeyVersions(): SocialCredentialRepositoryResult<readonly SocialCredentialKeyVersionRecord[]>;
  snapshot(): SocialCredentialRepositoryResult<SocialCredentialRepositorySnapshot>;
}>;

export const EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL: SocialCredentialPersistenceModel = Object.freeze({
  provider_accounts: [],
  vault_records: [],
  lifecycle_states: [],
  audit_events: [],
  key_versions: [],
});

export function validateSocialCredentialPersistenceAdapterContract(
  contract: unknown,
): SocialCredentialRepositoryResult<SocialCredentialPersistenceAdapterContract> {
  if (!isRecord(contract)) {
    return repositoryError("adapter_contract_invalid", "Credential persistence adapter contract must be an object.");
  }
  if (typeof contract.adapterId !== "string" || contract.adapterId.trim().length === 0) {
    return repositoryError("adapter_contract_invalid", "Credential persistence adapter contract must include adapterId.");
  }
  if (
    contract.repositoryVersion !== SOCIAL_CREDENTIAL_REPOSITORY_VERSION ||
    contract.domainVersion !== SOCIAL_CREDENTIAL_DOMAIN_VERSION ||
    !isRecord(contract.capabilities)
  ) {
    return repositoryError("adapter_contract_invalid", "Credential persistence adapter contract version or capabilities are invalid.");
  }

  const capabilities = contract.capabilities;
  const trueFlags = [
    "adapterBoundaryOnly",
    "referenceOnly",
    "metadataOnly",
    "storesNoSecrets",
    "storesNoTokens",
    "storesNoPlaintext",
    "exposesNoSql",
    "usesNoSupabase",
    "usesNoNetwork",
    "performsNoEncryption",
    "performsNoDecryption",
    "executesNothing",
    "publishesNothing",
  ] as const;

  for (const flag of trueFlags) {
    if (capabilities[flag] !== true) {
      return repositoryError("adapter_contract_invalid", `Credential persistence adapter capability ${flag} is invalid.`);
    }
  }
  if (capabilities.grantsExecutionPermission !== false) {
    return repositoryError("adapter_contract_invalid", "Credential persistence adapter must not grant execution permission.");
  }

  return ok(contract as SocialCredentialPersistenceAdapterContract);
}

export function createSocialCredentialRepository(
  adapter: SocialCredentialPersistenceAdapterBoundary,
): SocialCredentialRepository {
  const adapterValidation = validateSocialCredentialPersistenceAdapterContract(adapter.contract);
  if (!adapterValidation.ok) {
    return createUnavailableSocialCredentialRepository(adapterValidation.error);
  }

  const loaded = adapter.loadSnapshot();
  if (!loaded.ok) {
    return createUnavailableSocialCredentialRepository(loaded.error);
  }
  const loadedValidation = validateDomainMappingsFromPersistenceModel(loaded.value);
  if (!loadedValidation.ok) {
    return createUnavailableSocialCredentialRepository(repositoryErrorValue(
      "validation_failed",
      "Credential persistence adapter snapshot failed validation.",
      loadedValidation.errors,
    ));
  }

  let state = clonePersistenceModel(loaded.value);

  function commit(next: SocialCredentialPersistenceModel): SocialCredentialRepositoryResult<SocialCredentialPersistenceModel> {
    const validation = validateDomainMappingsFromPersistenceModel(next);
    if (!validation.ok) {
      return repositoryError("validation_failed", "Credential persistence model failed validation.", validation.errors);
    }
    const saved = adapter.persistSnapshot(next);
    if (!saved.ok) return saved;
    const savedValidation = validateDomainMappingsFromPersistenceModel(saved.value);
    if (!savedValidation.ok) {
      return repositoryError("validation_failed", "Credential persistence adapter returned invalid state.", savedValidation.errors);
    }
    state = clonePersistenceModel(saved.value);
    return ok(clonePersistenceModel(state));
  }

  return {
    createProviderAccount(request) {
      const validation = validateSocialCredentialProviderAccountRecord(request.providerAccount);
      if (!validation.ok) {
        return repositoryError("validation_failed", "Provider account record failed validation.", validation.errors);
      }
      if (state.provider_accounts.some((record) => record.provider_account_id === request.providerAccount.provider_account_id)) {
        return repositoryError("identity_collision", "Provider account identity already exists.");
      }
      const committed = commit({ ...state, provider_accounts: [...state.provider_accounts, request.providerAccount] });
      return committed.ok ? ok(cloneProviderAccount(request.providerAccount)) : committed;
    },
    updateProviderAccount(request) {
      const validation = validateSocialCredentialProviderAccountRecord(request.providerAccount);
      if (!validation.ok) {
        return repositoryError("validation_failed", "Provider account record failed validation.", validation.errors);
      }
      const index = state.provider_accounts.findIndex((record) => record.provider_account_id === request.providerAccount.provider_account_id);
      if (index < 0) return repositoryError("not_found", "Provider account identity was not found.");
      const providerAccounts = replaceAt(state.provider_accounts, index, request.providerAccount);
      const committed = commit({ ...state, provider_accounts: providerAccounts });
      return committed.ok ? ok(cloneProviderAccount(request.providerAccount)) : committed;
    },
    deleteProviderAccount(identity) {
      const resolved = findOne(state.provider_accounts, identity, matchesIdentity, "provider_account_id");
      if (!resolved.ok) return resolved;
      const committed = commit({
        ...state,
        provider_accounts: state.provider_accounts.filter((record) => record.provider_account_id !== resolved.value.provider_account_id),
      });
      return committed.ok ? ok(cloneProviderAccount(resolved.value)) : committed;
    },
    createVaultRecordMetadata(request) {
      const validation = validateSocialCredentialVaultRecordRow(request.vaultRecord);
      if (!validation.ok) {
        return repositoryError("validation_failed", "Vault record metadata failed validation.", validation.errors);
      }
      if (state.vault_records.some((record) => record.vault_record_id === request.vaultRecord.vault_record_id)) {
        return repositoryError("identity_collision", "Vault record identity already exists.");
      }
      const committed = commit({ ...state, vault_records: [...state.vault_records, request.vaultRecord] });
      return committed.ok ? ok(cloneVaultRecord(request.vaultRecord)) : committed;
    },
    updateVaultRecordMetadata(request) {
      const validation = validateSocialCredentialVaultRecordRow(request.vaultRecord);
      if (!validation.ok) {
        return repositoryError("validation_failed", "Vault record metadata failed validation.", validation.errors);
      }
      const index = state.vault_records.findIndex((record) => record.vault_record_id === request.vaultRecord.vault_record_id);
      if (index < 0) return repositoryError("not_found", "Vault record identity was not found.");
      const vaultRecords = replaceAt(state.vault_records, index, request.vaultRecord);
      const committed = commit({ ...state, vault_records: vaultRecords });
      return committed.ok ? ok(cloneVaultRecord(request.vaultRecord)) : committed;
    },
    deleteVaultRecordMetadata(identity) {
      const resolved = findOne(state.vault_records, identity, matchesIdentity, "vault_record_id");
      if (!resolved.ok) return resolved;
      const committed = commit({
        ...state,
        vault_records: state.vault_records.filter((record) => record.vault_record_id !== resolved.value.vault_record_id),
      });
      return committed.ok ? ok(cloneVaultRecord(resolved.value)) : committed;
    },
    createLifecycleState(request) {
      const validation = validateSocialCredentialLifecycleStateRecord(request.lifecycleState);
      if (!validation.ok) {
        return repositoryError("validation_failed", "Lifecycle state record failed validation.", validation.errors);
      }
      if (state.lifecycle_states.some((record) => record.lifecycle_state_id === request.lifecycleState.lifecycle_state_id)) {
        return repositoryError("identity_collision", "Lifecycle state identity already exists.");
      }
      const committed = commit({ ...state, lifecycle_states: [...state.lifecycle_states, request.lifecycleState] });
      return committed.ok ? ok(cloneLifecycleState(request.lifecycleState)) : committed;
    },
    updateLifecycleState(request) {
      const validation = validateSocialCredentialLifecycleStateRecord(request.lifecycleState);
      if (!validation.ok) {
        return repositoryError("validation_failed", "Lifecycle state record failed validation.", validation.errors);
      }
      const index = state.lifecycle_states.findIndex((record) => record.lifecycle_state_id === request.lifecycleState.lifecycle_state_id);
      if (index < 0) return repositoryError("not_found", "Lifecycle state identity was not found.");
      const lifecycleStates = replaceAt(state.lifecycle_states, index, request.lifecycleState);
      const committed = commit({ ...state, lifecycle_states: lifecycleStates });
      return committed.ok ? ok(cloneLifecycleState(request.lifecycleState)) : committed;
    },
    deleteLifecycleState(identity) {
      const resolved = findOne(state.lifecycle_states, identity, matchesIdentity, "lifecycle_state_id");
      if (!resolved.ok) return resolved;
      const committed = commit({
        ...state,
        lifecycle_states: state.lifecycle_states.filter((record) => record.lifecycle_state_id !== resolved.value.lifecycle_state_id),
      });
      return committed.ok ? ok(cloneLifecycleState(resolved.value)) : committed;
    },
    appendAuditEvent(request) {
      const validation = validateSocialCredentialAuditEventRecord(request.auditEvent);
      if (!validation.ok) {
        return repositoryError("validation_failed", "Audit event record failed validation.", validation.errors);
      }
      if (state.audit_events.some((record) => record.audit_event_id === request.auditEvent.audit_event_id)) {
        return repositoryError("identity_collision", "Audit event identity already exists.");
      }
      const committed = commit({ ...state, audit_events: [...state.audit_events, request.auditEvent] });
      return committed.ok ? ok(cloneAuditEvent(request.auditEvent)) : committed;
    },
    createKeyVersion(request) {
      const validation = validateSocialCredentialKeyVersionRecord(request.keyVersion);
      if (!validation.ok) {
        return repositoryError("validation_failed", "Key version record failed validation.", validation.errors);
      }
      if (state.key_versions.some((record) => record.key_version === request.keyVersion.key_version)) {
        return repositoryError("identity_collision", "Key version identity already exists.");
      }
      const committed = commit({ ...state, key_versions: [...state.key_versions, request.keyVersion] });
      return committed.ok ? ok(cloneKeyVersion(request.keyVersion)) : committed;
    },
    updateKeyVersion(request) {
      const validation = validateSocialCredentialKeyVersionRecord(request.keyVersion);
      if (!validation.ok) {
        return repositoryError("validation_failed", "Key version record failed validation.", validation.errors);
      }
      const index = state.key_versions.findIndex((record) => record.key_version === request.keyVersion.key_version);
      if (index < 0) return repositoryError("not_found", "Key version identity was not found.");
      const keyVersions = replaceAt(state.key_versions, index, request.keyVersion);
      const committed = commit({ ...state, key_versions: keyVersions });
      return committed.ok ? ok(cloneKeyVersion(request.keyVersion)) : committed;
    },
    deleteKeyVersion(identity) {
      const resolved = findOne(state.key_versions, identity, matchesIdentity, "key_version");
      if (!resolved.ok) return resolved;
      const committed = commit({
        ...state,
        key_versions: state.key_versions.filter((record) => record.key_version !== resolved.value.key_version),
      });
      return committed.ok ? ok(cloneKeyVersion(resolved.value)) : committed;
    },
    getCredentialRecordsByIdentity(identity) {
      const validation = validateRepositoryIdentity(identity, true);
      if (!validation.ok) return validation;
      return ok(filterCredentialRecords(state, identity));
    },
    listProviderAccounts(identity = {}) {
      const validation = validateRepositoryIdentity(identity, false);
      if (!validation.ok) return validation;
      return ok(state.provider_accounts.filter((record) => matchesIdentity(record, identity)).map(cloneProviderAccount));
    },
    listVaultRecordMetadata(identity = {}) {
      const validation = validateRepositoryIdentity(identity, false);
      if (!validation.ok) return validation;
      return ok(state.vault_records.filter((record) => matchesIdentity(record, identity)).map(cloneVaultRecord));
    },
    listLifecycleStates(identity = {}) {
      const validation = validateRepositoryIdentity(identity, false);
      if (!validation.ok) return validation;
      return ok(state.lifecycle_states.filter((record) => matchesIdentity(record, identity)).map(cloneLifecycleState));
    },
    listAuditEvents(identity = {}) {
      const validation = validateRepositoryIdentity(identity, false);
      if (!validation.ok) return validation;
      return ok(state.audit_events.filter((record) => matchesIdentity(record, identity)).map(cloneAuditEvent));
    },
    listKeyVersions() {
      return ok(state.key_versions.map(cloneKeyVersion));
    },
    snapshot() {
      return ok(clonePersistenceModel(state));
    },
  };
}

function createUnavailableSocialCredentialRepository(
  error: SocialCredentialRepositoryError,
): SocialCredentialRepository {
  const unavailable = <T>(): SocialCredentialRepositoryResult<T> => ({
    ok: false,
    error: error.code === "adapter_contract_invalid"
      ? error
      : repositoryErrorValue("adapter_unavailable", error.message, error.validationErrors),
  });

  return {
    createProviderAccount: unavailable,
    updateProviderAccount: unavailable,
    deleteProviderAccount: unavailable,
    createVaultRecordMetadata: unavailable,
    updateVaultRecordMetadata: unavailable,
    deleteVaultRecordMetadata: unavailable,
    createLifecycleState: unavailable,
    updateLifecycleState: unavailable,
    deleteLifecycleState: unavailable,
    appendAuditEvent: unavailable,
    createKeyVersion: unavailable,
    updateKeyVersion: unavailable,
    deleteKeyVersion: unavailable,
    getCredentialRecordsByIdentity: unavailable,
    listProviderAccounts: unavailable,
    listVaultRecordMetadata: unavailable,
    listLifecycleStates: unavailable,
    listAuditEvents: unavailable,
    listKeyVersions: unavailable,
    snapshot: unavailable,
  };
}

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
  "ciphertext",
  "plaintext",
  "encrypted_payload",
]);

export function validateSocialCredentialProviderAccountRecord(
  record: unknown,
  path = "providerAccount",
): SocialCredentialPersistenceValidationResult {
  const errors: SocialCredentialPersistenceError[] = [];
  if (!isRecord(record)) {
    return { ok: false, errors: [persistenceError("required_field_missing", path, "Provider account record must be an object.")] };
  }

  requireText(record.provider_account_id, `${path}.provider_account_id`, errors);
  requireText(record.publication_target_id, `${path}.publication_target_id`, errors);
  requireText(record.external_account_id_redacted, `${path}.external_account_id_redacted`, errors);
  requireText(record.account_ref_id, `${path}.account_ref_id`, errors);
  requireText(record.created_at, `${path}.created_at`, errors);

  if (!isSocialPlatformCredentialProvider(record.provider)) {
    errors.push(persistenceError("provider_invalid", `${path}.provider`, "Provider is not supported."));
  }
  if (!isProviderAccountStatus(record.status)) {
    errors.push(persistenceError("account_status_invalid", `${path}.status`, "Account status is not supported."));
  }
  if (record.references_only !== true || record.contains_credentials !== false || record.grants_execution_permission !== false) {
    errors.push(persistenceError("contract_invariant_failed", path, "Provider account record must remain reference-only."));
  }

  scanForbiddenKeys(record, path, errors);
  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

export function validateSocialCredentialVaultRecordRow(
  record: unknown,
  path = "vaultRecord",
): SocialCredentialPersistenceValidationResult {
  const errors: SocialCredentialPersistenceError[] = [];
  if (!isRecord(record)) {
    return { ok: false, errors: [persistenceError("required_field_missing", path, "Vault record row must be an object.")] };
  }

  requireText(record.vault_record_id, `${path}.vault_record_id`, errors);
  requireText(record.credential_ref_id, `${path}.credential_ref_id`, errors);
  requireText(record.encrypted_payload_ref, `${path}.encrypted_payload_ref`, errors);
  requireText(record.key_version, `${path}.key_version`, errors);
  requireText(record.created_at, `${path}.created_at`, errors);

  if (!isSocialPlatformCredentialProvider(record.provider)) {
    errors.push(persistenceError("provider_invalid", `${path}.provider`, "Provider is not supported."));
  }
  if (!isSocialPlatformCredentialKind(record.credential_kind)) {
    errors.push(persistenceError("credential_kind_invalid", `${path}.credential_kind`, "Credential kind is not supported."));
  }
  if (!isLifecyclePhase(record.lifecycle_phase)) {
    errors.push(persistenceError("lifecycle_phase_invalid", `${path}.lifecycle_phase`, "Lifecycle phase is not supported."));
  }
  if (record.metadata_only !== true || record.contains_plaintext !== false || record.contains_ciphertext !== false) {
    errors.push(persistenceError("plaintext_forbidden", path, "Vault record row must not contain plaintext or ciphertext."));
  }

  scanForbiddenKeys(record, path, errors);
  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

export function validateSocialCredentialLifecycleStateRecord(
  record: unknown,
  path = "lifecycleState",
): SocialCredentialPersistenceValidationResult {
  const errors: SocialCredentialPersistenceError[] = [];
  if (!isRecord(record)) {
    return { ok: false, errors: [persistenceError("required_field_missing", path, "Lifecycle state record must be an object.")] };
  }

  requireText(record.lifecycle_state_id, `${path}.lifecycle_state_id`, errors);
  requireText(record.credential_ref_id, `${path}.credential_ref_id`, errors);
  requireText(record.account_ref_id, `${path}.account_ref_id`, errors);
  requireText(record.created_at, `${path}.created_at`, errors);

  if (!isSocialPlatformCredentialProvider(record.provider)) {
    errors.push(persistenceError("provider_invalid", `${path}.provider`, "Provider is not supported."));
  }
  if (!isLifecyclePhase(record.lifecycle_phase)) {
    errors.push(persistenceError("lifecycle_phase_invalid", `${path}.lifecycle_phase`, "Lifecycle phase is not supported."));
  }
  if (record.modeled_only !== true || record.references_only !== true || record.contains_credentials !== false) {
    errors.push(persistenceError("contract_invariant_failed", path, "Lifecycle state record must remain modeled and reference-only."));
  }

  scanForbiddenKeys(record, path, errors);
  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

export function validateSocialCredentialAuditEventRecord(
  record: unknown,
  path = "auditEvent",
): SocialCredentialPersistenceValidationResult {
  const errors: SocialCredentialPersistenceError[] = [];
  if (!isRecord(record)) {
    return { ok: false, errors: [persistenceError("required_field_missing", path, "Audit event record must be an object.")] };
  }

  requireText(record.audit_event_id, `${path}.audit_event_id`, errors);
  requireText(record.credential_ref_id, `${path}.credential_ref_id`, errors);
  requireText(record.sanitized_detail, `${path}.sanitized_detail`, errors);
  requireText(record.created_at, `${path}.created_at`, errors);

  if (!isAuditAction(record.action)) {
    errors.push(persistenceError("audit_action_invalid", `${path}.action`, "Audit action is not supported."));
  }
  if (!isAuditOutcome(record.outcome)) {
    errors.push(persistenceError("audit_outcome_invalid", `${path}.outcome`, "Audit outcome is not supported."));
  }
  if (record.append_only !== true || record.contains_secrets !== false) {
    errors.push(persistenceError("contract_invariant_failed", path, "Audit event record must remain append-only without secrets."));
  }

  scanForbiddenKeys(record, path, errors);
  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

export function validateSocialCredentialKeyVersionRecord(
  record: unknown,
  path = "keyVersion",
): SocialCredentialPersistenceValidationResult {
  const errors: SocialCredentialPersistenceError[] = [];
  if (!isRecord(record)) {
    return { ok: false, errors: [persistenceError("required_field_missing", path, "Key version record must be an object.")] };
  }

  requireText(record.key_version, `${path}.key_version`, errors);
  requireText(record.activated_at, `${path}.activated_at`, errors);

  if (!isKeyVersionStatus(record.status)) {
    errors.push(persistenceError("key_version_status_invalid", `${path}.status`, "Key version status is not supported."));
  }
  if (record.metadata_only !== true || record.contains_key_material !== false) {
    errors.push(persistenceError("contract_invariant_failed", path, "Key version record must remain metadata-only."));
  }

  scanForbiddenKeys(record, path, errors);
  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

export function validateSocialCredentialPersistenceModel(
  model: unknown,
): SocialCredentialPersistenceValidationResult {
  const errors: SocialCredentialPersistenceError[] = [];
  if (!isRecord(model)) {
    return { ok: false, errors: [persistenceError("required_field_missing", "model", "Persistence model must be an object.")] };
  }

  validateRecordArray(model.provider_accounts, "provider_accounts", validateSocialCredentialProviderAccountRecord, errors);
  validateRecordArray(model.vault_records, "vault_records", validateSocialCredentialVaultRecordRow, errors);
  validateRecordArray(model.lifecycle_states, "lifecycle_states", validateSocialCredentialLifecycleStateRecord, errors);
  validateRecordArray(model.audit_events, "audit_events", validateSocialCredentialAuditEventRecord, errors);
  validateRecordArray(model.key_versions, "key_versions", validateSocialCredentialKeyVersionRecord, errors);

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

export function mapProviderAccountRecordToReference(
  record: SocialCredentialProviderAccountRecord,
): SocialCredentialProviderAccountReference {
  return {
    providerAccountId: record.provider_account_id,
    provider: record.provider,
    publicationTargetId: record.publication_target_id,
    externalAccountIdRedacted: record.external_account_id_redacted,
    displayNameRedacted: record.display_name_redacted,
    status: record.status,
    accountRefId: record.account_ref_id,
    referencesOnly: true,
    containsCredentials: false,
    containsOAuthTokens: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

export function mapVaultRecordRowToMetadata(
  record: SocialCredentialVaultRecordRow,
): SocialCredentialVaultRecordMetadata {
  return {
    vaultRecordId: record.vault_record_id,
    credentialRefId: record.credential_ref_id,
    provider: record.provider,
    credentialKind: record.credential_kind,
    accountRefId: record.account_ref_id,
    providerAccountId: record.provider_account_id,
    publicationTargetId: record.publication_target_id,
    encryptedPayloadRef: record.encrypted_payload_ref,
    keyVersion: record.key_version,
    lifecyclePhase: record.lifecycle_phase,
    supersededAt: record.superseded_at,
    revokedAt: record.revoked_at,
    createdAt: record.created_at,
    metadataOnly: true,
    containsPlaintext: false,
    containsCiphertext: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

export function mapVaultRecordRowToCredentialIdentity(
  record: SocialCredentialVaultRecordRow,
): SocialCredentialIdentity {
  return {
    credentialRefId: record.credential_ref_id,
    provider: record.provider,
    credentialKind: record.credential_kind,
    accountRefId: record.account_ref_id,
    providerAccountId: record.provider_account_id,
    publicationTargetId: record.publication_target_id,
    domainVersion: SOCIAL_CREDENTIAL_DOMAIN_VERSION,
    credentialBoundaryVersion: SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
    referencesOnly: true,
    containsSecretValue: false,
    containsTokenValue: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

export function mapVaultRecordRowToCredentialReference(
  record: SocialCredentialVaultRecordRow,
): SocialCredentialReference {
  return {
    credentialRefId: record.credential_ref_id,
    provider: record.provider,
    credentialKind: record.credential_kind,
    accountRefId: record.account_ref_id,
    redactedHint: record.encrypted_payload_ref,
    referencesOnly: true,
    containsSecretValue: false,
    containsTokenValue: false,
    containsRefreshToken: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

export function mapLifecycleStateRecordToDomain(
  record: SocialCredentialLifecycleStateRecord,
): SocialCredentialLifecycleState {
  return {
    lifecycleStateId: record.lifecycle_state_id,
    credentialRefId: record.credential_ref_id,
    accountRefId: record.account_ref_id,
    provider: record.provider,
    authorizationState: record.authorization_state as SocialCredentialLifecycleState["authorizationState"],
    lifecyclePhase: record.lifecycle_phase,
    issuedAt: record.issued_at,
    expiresAt: record.expires_at,
    lastRotatedAt: record.last_rotated_at,
    revokedAt: record.revoked_at,
    scopeFingerprintRedacted: record.scope_fingerprint_redacted,
    modeledOnly: true,
    referencesOnly: true,
    containsCredentials: false,
    containsOAuthTokens: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

export function mapAuditEventRecordToDomain(
  record: SocialCredentialAuditEventRecord,
): SocialCredentialAuditEvent {
  return {
    auditEventId: record.audit_event_id,
    credentialRefId: record.credential_ref_id,
    actorAdminId: record.actor_admin_id,
    action: record.action,
    outcome: record.outcome,
    sanitizedDetail: record.sanitized_detail,
    createdAt: record.created_at,
    appendOnly: true,
    containsSecrets: false,
    containsTokens: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

export function mapKeyVersionRecordToDomain(
  record: SocialCredentialKeyVersionRecord,
): SocialCredentialKeyVersion {
  return {
    keyVersion: record.key_version,
    status: record.status,
    activatedAt: record.activated_at,
    retiredAt: record.retired_at,
    metadataOnly: true,
    containsKeyMaterial: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

export function validateDomainMappingsFromPersistenceModel(
  model: SocialCredentialPersistenceModel,
): SocialCredentialPersistenceValidationResult {
  const errors: SocialCredentialPersistenceError[] = [];
  const modelValidation = validateSocialCredentialPersistenceModel(model);
  if (!modelValidation.ok) return modelValidation;

  for (const [index, record] of model.provider_accounts.entries()) {
    const reference = mapProviderAccountRecordToReference(record);
    const domainValidation = validateSocialCredentialProviderAccountReference(reference);
    if (!domainValidation.valid) {
      for (const diagnostic of domainValidation.diagnostics) {
        errors.push(persistenceError("contract_invariant_failed", `provider_accounts.${index}`, diagnostic.message));
      }
    }
  }

  for (const [index, record] of model.vault_records.entries()) {
    const metadata = mapVaultRecordRowToMetadata(record);
    const identity = mapVaultRecordRowToCredentialIdentity(record);
    const reference = mapVaultRecordRowToCredentialReference(record);
    appendDomainValidationErrors(validateSocialCredentialVaultRecordMetadata(metadata), `vault_records.${index}`, errors);
    appendDomainValidationErrors(validateSocialCredentialIdentity(identity), `vault_records.${index}.identity`, errors);
    appendDomainValidationErrors(validateSocialCredentialReference(reference), `vault_records.${index}.reference`, errors);
  }

  for (const [index, record] of model.lifecycle_states.entries()) {
    const state = mapLifecycleStateRecordToDomain(record);
    appendDomainValidationErrors(validateSocialCredentialLifecycleState(state), `lifecycle_states.${index}`, errors);
  }

  for (const [index, record] of model.audit_events.entries()) {
    const auditEvent = mapAuditEventRecordToDomain(record);
    appendDomainValidationErrors(validateSocialCredentialAuditEvent(auditEvent), `audit_events.${index}`, errors);
  }

  for (const [index, record] of model.key_versions.entries()) {
    const keyVersion = mapKeyVersionRecordToDomain(record);
    appendDomainValidationErrors(validateSocialCredentialKeyVersion(keyVersion), `key_versions.${index}`, errors);
  }

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

function appendDomainValidationErrors(
  validation: { valid: boolean; diagnostics: readonly { message: string }[] },
  path: string,
  errors: SocialCredentialPersistenceError[],
): void {
  if (validation.valid) return;
  for (const diagnostic of validation.diagnostics) {
    errors.push(persistenceError("contract_invariant_failed", path, diagnostic.message));
  }
}

function validateRepositoryIdentity(
  identity: SocialCredentialRepositoryIdentity,
  requireAnyField: boolean,
): SocialCredentialRepositoryResult<SocialCredentialRepositoryIdentity> {
  if (!isRecord(identity)) {
    return repositoryError("identity_required", "Credential repository identity must be an object.");
  }

  const entries = Object.entries(identity).filter(([, value]) => value !== undefined);
  if (requireAnyField && entries.length === 0) {
    return repositoryError("identity_required", "Credential repository identity must include at least one field.");
  }

  for (const [key, value] of entries) {
    if (key === "provider") {
      if (!isSocialPlatformCredentialProvider(value)) {
        return repositoryError("validation_failed", "Credential repository provider identity is unsupported.");
      }
      continue;
    }
    if (typeof value !== "string" || value.trim().length === 0) {
      return repositoryError("identity_required", "Credential repository identity fields must be non-empty strings.");
    }
  }

  return ok(identity);
}

function filterCredentialRecords(
  model: SocialCredentialPersistenceModel,
  identity: SocialCredentialRepositoryIdentity,
): SocialCredentialPersistenceModel {
  return deepFreeze({
    provider_accounts: model.provider_accounts.filter((record) => matchesIdentity(record, identity)).map(cloneProviderAccount),
    vault_records: model.vault_records.filter((record) => matchesIdentity(record, identity)).map(cloneVaultRecord),
    lifecycle_states: model.lifecycle_states.filter((record) => matchesIdentity(record, identity)).map(cloneLifecycleState),
    audit_events: model.audit_events.filter((record) => matchesIdentity(record, identity)).map(cloneAuditEvent),
    key_versions: model.key_versions.filter((record) => matchesIdentity(record, identity)).map(cloneKeyVersion),
  });
}

function matchesIdentity(record: object, identity: SocialCredentialRepositoryIdentity): boolean {
  const values = record as Record<string, unknown>;
  if (identity.provider_account_id !== undefined && values.provider_account_id !== identity.provider_account_id) return false;
  if (identity.vault_record_id !== undefined && values.vault_record_id !== identity.vault_record_id) return false;
  if (identity.lifecycle_state_id !== undefined && values.lifecycle_state_id !== identity.lifecycle_state_id) return false;
  if (identity.audit_event_id !== undefined && values.audit_event_id !== identity.audit_event_id) return false;
  if (identity.key_version !== undefined && values.key_version !== identity.key_version) return false;
  if (identity.credential_ref_id !== undefined && values.credential_ref_id !== identity.credential_ref_id) return false;
  if (identity.publication_target_id !== undefined && values.publication_target_id !== identity.publication_target_id) return false;
  if (identity.provider !== undefined && values.provider !== identity.provider) return false;
  if (identity.account_ref_id !== undefined && values.account_ref_id !== identity.account_ref_id) return false;
  return true;
}

function findOne<TRecord extends object>(
  records: readonly TRecord[],
  identity: SocialCredentialRepositoryIdentity,
  predicate: (record: TRecord, identity: SocialCredentialRepositoryIdentity) => boolean,
  identityField: keyof TRecord & string,
): SocialCredentialRepositoryResult<TRecord> {
  const validation = validateRepositoryIdentity(identity, true);
  if (!validation.ok) return validation;

  const matches = records.filter((record) => predicate(record, identity));
  if (matches.length === 0) return repositoryError("not_found", `${identityField} was not found.`);
  if (matches.length > 1) return repositoryError("identity_collision", `${identityField} identity matched multiple records.`);
  return ok(matches[0]);
}

function replaceAt<TRecord>(
  records: readonly TRecord[],
  index: number,
  replacement: TRecord,
): readonly TRecord[] {
  return records.map((record, currentIndex) => (currentIndex === index ? replacement : record));
}

function clonePersistenceModel(model: SocialCredentialPersistenceModel): SocialCredentialPersistenceModel {
  return deepFreeze({
    provider_accounts: model.provider_accounts.map(cloneProviderAccount),
    vault_records: model.vault_records.map(cloneVaultRecord),
    lifecycle_states: model.lifecycle_states.map(cloneLifecycleState),
    audit_events: model.audit_events.map(cloneAuditEvent),
    key_versions: model.key_versions.map(cloneKeyVersion),
  });
}

function cloneProviderAccount(record: SocialCredentialProviderAccountRecord): SocialCredentialProviderAccountRecord {
  return deepFreeze({ ...record });
}

function cloneVaultRecord(record: SocialCredentialVaultRecordRow): SocialCredentialVaultRecordRow {
  return deepFreeze({ ...record });
}

function cloneLifecycleState(record: SocialCredentialLifecycleStateRecord): SocialCredentialLifecycleStateRecord {
  return deepFreeze({ ...record });
}

function cloneAuditEvent(record: SocialCredentialAuditEventRecord): SocialCredentialAuditEventRecord {
  return deepFreeze({ ...record });
}

function cloneKeyVersion(record: SocialCredentialKeyVersionRecord): SocialCredentialKeyVersionRecord {
  return deepFreeze({ ...record });
}

const LIFECYCLE_PHASE_SET = new Set<string>(SOCIAL_CREDENTIAL_LIFECYCLE_PHASES);
const ACCOUNT_STATUS_SET = new Set<string>(SOCIAL_CREDENTIAL_PROVIDER_ACCOUNT_STATUSES);
const AUDIT_ACTION_SET = new Set<string>(SOCIAL_CREDENTIAL_AUDIT_ACTIONS);
const AUDIT_OUTCOME_SET = new Set<string>(SOCIAL_CREDENTIAL_AUDIT_OUTCOMES);
const KEY_VERSION_STATUS_SET = new Set<string>(SOCIAL_CREDENTIAL_KEY_VERSION_STATUSES);

function isProviderAccountStatus(value: unknown): value is SocialCredentialProviderAccountStatus {
  return typeof value === "string" && ACCOUNT_STATUS_SET.has(value);
}

function isLifecyclePhase(value: unknown): value is SocialCredentialLifecyclePhase {
  return typeof value === "string" && LIFECYCLE_PHASE_SET.has(value);
}

function isAuditAction(value: unknown): value is SocialCredentialAuditAction {
  return typeof value === "string" && AUDIT_ACTION_SET.has(value);
}

function isAuditOutcome(value: unknown): value is SocialCredentialAuditOutcome {
  return typeof value === "string" && AUDIT_OUTCOME_SET.has(value);
}

function isKeyVersionStatus(value: unknown): value is SocialCredentialKeyVersionStatus {
  return typeof value === "string" && KEY_VERSION_STATUS_SET.has(value);
}

function persistenceError(
  code: SocialCredentialPersistenceErrorCode,
  path: string,
  message: string,
): SocialCredentialPersistenceError {
  return { code, path, message };
}

function requireText(
  value: unknown,
  path: string,
  errors: SocialCredentialPersistenceError[],
): void {
  if (typeof value === "string" && value.trim().length > 0) return;
  errors.push(persistenceError("required_field_missing", path, "Required persistence field is missing."));
}

function validateRecordArray(
  value: unknown,
  path: string,
  validator: (record: unknown, path: string) => SocialCredentialPersistenceValidationResult,
  errors: SocialCredentialPersistenceError[],
): void {
  if (!Array.isArray(value)) {
    errors.push(persistenceError("required_field_missing", path, "Persistence model collection must be an array."));
    return;
  }
  value.forEach((record, index) => {
    const result = validator(record, `${path}.${index}`);
    if (!result.ok) errors.push(...result.errors);
  });
}

function scanForbiddenKeys(
  value: unknown,
  path: string,
  errors: SocialCredentialPersistenceError[],
  depth = 0,
): void {
  if (depth > 4 || !isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_SECRET_KEYS.has(key)) {
      errors.push(persistenceError("secret_forbidden", `${path}.${key}`, "Forbidden secret-like key detected."));
    }
    scanForbiddenKeys(nested, `${path}.${key}`, errors, depth + 1);
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object" && !Object.isFrozen(nested)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function ok<T>(value: T): SocialCredentialRepositoryResult<T> {
  return { ok: true, value };
}

function repositoryError(
  code: SocialCredentialRepositoryErrorCode,
  message: string,
  validationErrors?: readonly SocialCredentialPersistenceError[],
): SocialCredentialRepositoryResult<never> {
  return { ok: false, error: repositoryErrorValue(code, message, validationErrors) };
}

function repositoryErrorValue(
  code: SocialCredentialRepositoryErrorCode,
  message: string,
  validationErrors?: readonly SocialCredentialPersistenceError[],
): SocialCredentialRepositoryError {
  return { code, message, validationErrors };
}
