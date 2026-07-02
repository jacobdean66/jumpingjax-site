import {
  SOCIAL_CREDENTIAL_AUDIT_ACTIONS,
  SOCIAL_CREDENTIAL_AUDIT_OUTCOMES,
  SOCIAL_CREDENTIAL_DOMAIN_VERSION,
  SOCIAL_CREDENTIAL_KEY_VERSION_STATUSES,
  SOCIAL_CREDENTIAL_LIFECYCLE_PHASES,
  SOCIAL_CREDENTIAL_PROVIDER_ACCOUNT_STATUSES,
  validateSocialCredentialLifecycleState,
  validateSocialCredentialProviderAccountReference,
  validateSocialCredentialVaultRecordMetadata,
  type SocialCredentialAuditAction,
  type SocialCredentialAuditOutcome,
  type SocialCredentialKeyVersionStatus,
  type SocialCredentialLifecyclePhase,
  type SocialCredentialLifecycleState,
  type SocialCredentialProviderAccountReference,
  type SocialCredentialProviderAccountStatus,
  type SocialCredentialVaultRecordMetadata,
} from "./social-credential-domain";
import {
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

export const SOCIAL_CREDENTIAL_REPOSITORY_VERSION = "d13-w1-v1" as const;

export const SOCIAL_CREDENTIAL_REPOSITORY_ERROR_CODES = [
  "validation_failed",
  "identity_required",
  "identity_collision",
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
  credential_ref_id?: string;
  publication_target_id?: string;
  provider?: SocialPlatformCredentialProvider;
  account_ref_id?: string;
}>;

export type SocialCredentialRepositorySnapshot = SocialCredentialPersistenceModel;

export type SocialCredentialStorageContract = Readonly<{
  contractVersion: typeof SOCIAL_CREDENTIAL_REPOSITORY_VERSION;
  domainVersion: typeof SOCIAL_CREDENTIAL_DOMAIN_VERSION;
  referenceOnly: true;
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
  implementsNothing: true,
  allowsSql: false,
  allowsSupabase: false,
  allowsEncryption: false,
  allowsDecryption: false,
  grantsExecutionPermission: false,
  executesNothing: true,
  publishesNothing: true,
});

export type SocialCredentialRepository = Readonly<{
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

  if (Array.isArray(model.provider_accounts)) {
    model.provider_accounts.forEach((record, index) => {
      const result = validateSocialCredentialProviderAccountRecord(record, `provider_accounts.${index}`);
      if (!result.ok) errors.push(...result.errors);
    });
  }
  if (Array.isArray(model.vault_records)) {
    model.vault_records.forEach((record, index) => {
      const result = validateSocialCredentialVaultRecordRow(record, `vault_records.${index}`);
      if (!result.ok) errors.push(...result.errors);
    });
  }
  if (Array.isArray(model.lifecycle_states)) {
    model.lifecycle_states.forEach((record, index) => {
      const result = validateSocialCredentialLifecycleStateRecord(record, `lifecycle_states.${index}`);
      if (!result.ok) errors.push(...result.errors);
    });
  }
  if (Array.isArray(model.audit_events)) {
    model.audit_events.forEach((record, index) => {
      const result = validateSocialCredentialAuditEventRecord(record, `audit_events.${index}`);
      if (!result.ok) errors.push(...result.errors);
    });
  }
  if (Array.isArray(model.key_versions)) {
    model.key_versions.forEach((record, index) => {
      const result = validateSocialCredentialKeyVersionRecord(record, `key_versions.${index}`);
      if (!result.ok) errors.push(...result.errors);
    });
  }

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
    const domainValidation = validateSocialCredentialVaultRecordMetadata(metadata);
    if (!domainValidation.valid) {
      for (const diagnostic of domainValidation.diagnostics) {
        errors.push(persistenceError("contract_invariant_failed", `vault_records.${index}`, diagnostic.message));
      }
    }
  }

  for (const [index, record] of model.lifecycle_states.entries()) {
    const state = mapLifecycleStateRecordToDomain(record);
    const domainValidation = validateSocialCredentialLifecycleState(state);
    if (!domainValidation.valid) {
      for (const diagnostic of domainValidation.diagnostics) {
        errors.push(persistenceError("contract_invariant_failed", `lifecycle_states.${index}`, diagnostic.message));
      }
    }
  }

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
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
