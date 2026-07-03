import {
  SOCIAL_CREDENTIAL_DOMAIN_VERSION,
  SOCIAL_CREDENTIAL_KEY_VERSION_STATUSES,
  SOCIAL_CREDENTIAL_LIFECYCLE_PHASES,
  SOCIAL_CREDENTIAL_PROVIDER_ACCOUNT_STATUSES,
  type SocialCredentialKeyVersionStatus,
  type SocialCredentialLifecyclePhase,
  type SocialCredentialProviderAccountStatus,
} from "./social-credential-domain";
import {
  SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
  type SocialPlatformCredentialKind,
  type SocialPlatformCredentialProvider,
  isSocialPlatformCredentialKind,
  isSocialPlatformCredentialProvider,
} from "../social-platform-credential-boundary";

export const SOCIAL_CREDENTIAL_STORAGE_SCHEMA_VERSION = "d13-w3-v1" as const;
export const SOCIAL_CREDENTIAL_STORAGE_METADATA_VERSION = "d13-w3-metadata-v1" as const;

export const SOCIAL_CREDENTIAL_STORAGE_SCHEMA_TABLES = [
  "social_credential_provider_accounts",
  "social_credential_records",
  "social_credential_metadata",
  "social_credential_key_versions",
] as const;

export const SOCIAL_CREDENTIAL_STORAGE_SCHEMA_ERROR_CODES = [
  "schema_version_invalid",
  "table_name_invalid",
  "provider_invalid",
  "credential_kind_invalid",
  "lifecycle_phase_invalid",
  "account_status_invalid",
  "key_version_status_invalid",
  "required_field_missing",
  "timestamp_invalid",
  "metadata_invalid",
  "contract_invariant_failed",
  "secret_forbidden",
  "token_forbidden",
  "plaintext_forbidden",
  "ciphertext_forbidden",
  "network_forbidden",
  "oauth_forbidden",
  "sql_forbidden",
  "execution_forbidden",
] as const;

export type SocialCredentialStorageSchemaVersion =
  typeof SOCIAL_CREDENTIAL_STORAGE_SCHEMA_VERSION;

export type SocialCredentialStorageMetadataVersion =
  typeof SOCIAL_CREDENTIAL_STORAGE_METADATA_VERSION;

export type SocialCredentialStorageSchemaTable =
  (typeof SOCIAL_CREDENTIAL_STORAGE_SCHEMA_TABLES)[number];

export type SocialCredentialStorageSchemaErrorCode =
  (typeof SOCIAL_CREDENTIAL_STORAGE_SCHEMA_ERROR_CODES)[number];

export type SocialCredentialStorageSchemaDiagnostic = Readonly<{
  code: SocialCredentialStorageSchemaErrorCode;
  path: string;
  message: string;
}>;

export type SocialCredentialStorageSchemaValidationResult = Readonly<
  | { ok: true; diagnostics: readonly [] }
  | { ok: false; diagnostics: readonly SocialCredentialStorageSchemaDiagnostic[] }
>;

export type SocialCredentialStorageSchemaMetadata = Readonly<{
  schemaVersion: SocialCredentialStorageSchemaVersion;
  metadataVersion: SocialCredentialStorageMetadataVersion;
  domainVersion: typeof SOCIAL_CREDENTIAL_DOMAIN_VERSION;
  credentialBoundaryVersion: typeof SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION;
  tables: readonly SocialCredentialStorageSchemaTable[];
  modeledAt: string;
  designOnly: true;
  referenceOnly: true;
  containsSecrets: false;
  containsTokens: false;
  containsPlaintext: false;
  containsCiphertext: false;
  containsSql: false;
  connectsToSupabase: false;
  usesNetwork: false;
  usesOAuth: false;
  usesSdks: false;
  implementsEncryption: false;
  implementsDecryption: false;
  startsWorkers: false;
  createsQueues: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialProviderAccountSchemaModel = Readonly<{
  table: "social_credential_provider_accounts";
  schemaVersion: SocialCredentialStorageSchemaVersion;
  providerAccountId: string;
  provider: SocialPlatformCredentialProvider;
  publicationTargetId: string;
  externalAccountIdRedacted: string;
  displayNameRedacted: string;
  accountRefId: string;
  status: SocialCredentialProviderAccountStatus;
  createdAt: string;
  updatedAt: string;
  designOnly: true;
  referenceOnly: true;
  containsCredentials: false;
  containsOAuthTokens: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialRecordSchemaModel = Readonly<{
  table: "social_credential_records";
  schemaVersion: SocialCredentialStorageSchemaVersion;
  credentialRecordId: string;
  credentialRefId: string;
  providerAccountId: string;
  accountRefId: string;
  publicationTargetId: string;
  provider: SocialPlatformCredentialProvider;
  credentialKind: SocialPlatformCredentialKind;
  lifecyclePhase: SocialCredentialLifecyclePhase;
  encryptedPayloadRef: string;
  keyVersion: string;
  redactedHint: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  supersededByCredentialRefId: string | null;
  designOnly: true;
  metadataOnly: true;
  referenceOnly: true;
  containsSecretValue: false;
  containsTokenValue: false;
  containsRefreshToken: false;
  containsPlaintext: false;
  containsCiphertext: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialMetadataSchemaModel = Readonly<{
  table: "social_credential_metadata";
  schemaVersion: SocialCredentialStorageSchemaVersion;
  metadataVersion: SocialCredentialStorageMetadataVersion;
  metadataId: string;
  credentialRefId: string;
  providerAccountId: string;
  provider: SocialPlatformCredentialProvider;
  lifecyclePhase: SocialCredentialLifecyclePhase;
  scopeFingerprintRedacted: string | null;
  readinessFingerprintRedacted: string | null;
  lastValidatedAt: string | null;
  createdAt: string;
  designOnly: true;
  metadataOnly: true;
  referenceOnly: true;
  containsSecrets: false;
  containsTokens: false;
  containsPlaintext: false;
  containsCiphertext: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialKeyVersionSchemaModel = Readonly<{
  table: "social_credential_key_versions";
  schemaVersion: SocialCredentialStorageSchemaVersion;
  keyVersion: string;
  status: SocialCredentialKeyVersionStatus;
  activatedAt: string;
  retiredAt: string | null;
  designOnly: true;
  metadataOnly: true;
  containsKeyMaterial: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialStorageSchemaModel = Readonly<{
  metadata: SocialCredentialStorageSchemaMetadata;
  providerAccounts: readonly SocialCredentialProviderAccountSchemaModel[];
  credentialRecords: readonly SocialCredentialRecordSchemaModel[];
  credentialMetadata: readonly SocialCredentialMetadataSchemaModel[];
  keyVersions: readonly SocialCredentialKeyVersionSchemaModel[];
  designOnly: true;
  referenceOnly: true;
  containsSecrets: false;
  containsTokens: false;
  containsPlaintext: false;
  containsCiphertext: false;
  containsSql: false;
  connectsToSupabase: false;
  usesNetwork: false;
  usesOAuth: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

const TABLE_SET = new Set<string>(SOCIAL_CREDENTIAL_STORAGE_SCHEMA_TABLES);
const LIFECYCLE_PHASE_SET = new Set<string>(SOCIAL_CREDENTIAL_LIFECYCLE_PHASES);
const ACCOUNT_STATUS_SET = new Set<string>(SOCIAL_CREDENTIAL_PROVIDER_ACCOUNT_STATUSES);
const KEY_VERSION_STATUS_SET = new Set<string>(SOCIAL_CREDENTIAL_KEY_VERSION_STATUSES);

export const SOCIAL_CREDENTIAL_STORAGE_SCHEMA_METADATA: SocialCredentialStorageSchemaMetadata = deepFreeze({
  schemaVersion: SOCIAL_CREDENTIAL_STORAGE_SCHEMA_VERSION,
  metadataVersion: SOCIAL_CREDENTIAL_STORAGE_METADATA_VERSION,
  domainVersion: SOCIAL_CREDENTIAL_DOMAIN_VERSION,
  credentialBoundaryVersion: SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
  tables: [...SOCIAL_CREDENTIAL_STORAGE_SCHEMA_TABLES],
  modeledAt: "2026-07-03T00:00:00.000Z",
  designOnly: true,
  referenceOnly: true,
  containsSecrets: false,
  containsTokens: false,
  containsPlaintext: false,
  containsCiphertext: false,
  containsSql: false,
  connectsToSupabase: false,
  usesNetwork: false,
  usesOAuth: false,
  usesSdks: false,
  implementsEncryption: false,
  implementsDecryption: false,
  startsWorkers: false,
  createsQueues: false,
  grantsExecutionPermission: false,
  executesNothing: true,
  publishesNothing: true,
});

export const EMPTY_SOCIAL_CREDENTIAL_STORAGE_SCHEMA_MODEL: SocialCredentialStorageSchemaModel = deepFreeze({
  metadata: SOCIAL_CREDENTIAL_STORAGE_SCHEMA_METADATA,
  providerAccounts: [],
  credentialRecords: [],
  credentialMetadata: [],
  keyVersions: [],
  designOnly: true,
  referenceOnly: true,
  containsSecrets: false,
  containsTokens: false,
  containsPlaintext: false,
  containsCiphertext: false,
  containsSql: false,
  connectsToSupabase: false,
  usesNetwork: false,
  usesOAuth: false,
  grantsExecutionPermission: false,
  executesNothing: true,
  publishesNothing: true,
});

export function isSocialCredentialStorageSchemaTable(
  value: unknown,
): value is SocialCredentialStorageSchemaTable {
  return typeof value === "string" && TABLE_SET.has(value);
}

export function validateSocialCredentialStorageSchemaMetadata(
  metadata: unknown,
  path = "metadata",
): SocialCredentialStorageSchemaValidationResult {
  const diagnostics: SocialCredentialStorageSchemaDiagnostic[] = [];
  if (!isRecord(metadata)) {
    return invalid(diagnostic("metadata_invalid", path, "Credential storage schema metadata must be an object."));
  }

  if (metadata.schemaVersion !== SOCIAL_CREDENTIAL_STORAGE_SCHEMA_VERSION) {
    diagnostics.push(diagnostic("schema_version_invalid", `${path}.schemaVersion`, "Storage schema version is not current."));
  }
  if (metadata.metadataVersion !== SOCIAL_CREDENTIAL_STORAGE_METADATA_VERSION) {
    diagnostics.push(diagnostic("schema_version_invalid", `${path}.metadataVersion`, "Storage metadata version is not current."));
  }
  if (metadata.domainVersion !== SOCIAL_CREDENTIAL_DOMAIN_VERSION) {
    diagnostics.push(diagnostic("schema_version_invalid", `${path}.domainVersion`, "Credential domain version is not current."));
  }
  if (metadata.credentialBoundaryVersion !== SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION) {
    diagnostics.push(diagnostic("schema_version_invalid", `${path}.credentialBoundaryVersion`, "Credential boundary version is not current."));
  }
  requireTimestamp(metadata.modeledAt, `${path}.modeledAt`, diagnostics);
  validateTableList(metadata.tables, `${path}.tables`, diagnostics);
  validateDesignOnlyInvariants(metadata, path, diagnostics);
  scanForbiddenCredentialState(metadata, path, diagnostics);

  return result(diagnostics);
}

export function validateSocialCredentialProviderAccountSchemaModel(
  account: unknown,
  path = "providerAccount",
): SocialCredentialStorageSchemaValidationResult {
  const diagnostics: SocialCredentialStorageSchemaDiagnostic[] = [];
  if (!isRecord(account)) {
    return invalid(diagnostic("required_field_missing", path, "Provider account schema model must be an object."));
  }

  requireTable(account.table, "social_credential_provider_accounts", `${path}.table`, diagnostics);
  requireCurrentSchemaVersion(account.schemaVersion, `${path}.schemaVersion`, diagnostics);
  requireText(account.providerAccountId, `${path}.providerAccountId`, diagnostics);
  requireText(account.publicationTargetId, `${path}.publicationTargetId`, diagnostics);
  requireText(account.externalAccountIdRedacted, `${path}.externalAccountIdRedacted`, diagnostics);
  requireText(account.displayNameRedacted, `${path}.displayNameRedacted`, diagnostics);
  requireText(account.accountRefId, `${path}.accountRefId`, diagnostics);
  requireTimestamp(account.createdAt, `${path}.createdAt`, diagnostics);
  requireTimestamp(account.updatedAt, `${path}.updatedAt`, diagnostics);
  if (!isSocialPlatformCredentialProvider(account.provider)) {
    diagnostics.push(diagnostic("provider_invalid", `${path}.provider`, "Provider is not supported."));
  }
  if (!isAccountStatus(account.status)) {
    diagnostics.push(diagnostic("account_status_invalid", `${path}.status`, "Provider account status is not supported."));
  }
  if (
    account.designOnly !== true ||
    account.referenceOnly !== true ||
    account.containsCredentials !== false ||
    account.containsOAuthTokens !== false ||
    account.grantsExecutionPermission !== false
  ) {
    diagnostics.push(diagnostic("contract_invariant_failed", path, "Provider account schema model must stay reference-only and non-executing."));
  }
  scanForbiddenCredentialState(account, path, diagnostics);

  return result(diagnostics);
}

export function validateSocialCredentialRecordSchemaModel(
  record: unknown,
  path = "credentialRecord",
): SocialCredentialStorageSchemaValidationResult {
  const diagnostics: SocialCredentialStorageSchemaDiagnostic[] = [];
  if (!isRecord(record)) {
    return invalid(diagnostic("required_field_missing", path, "Credential record schema model must be an object."));
  }

  requireTable(record.table, "social_credential_records", `${path}.table`, diagnostics);
  requireCurrentSchemaVersion(record.schemaVersion, `${path}.schemaVersion`, diagnostics);
  requireText(record.credentialRecordId, `${path}.credentialRecordId`, diagnostics);
  requireText(record.credentialRefId, `${path}.credentialRefId`, diagnostics);
  requireText(record.providerAccountId, `${path}.providerAccountId`, diagnostics);
  requireText(record.accountRefId, `${path}.accountRefId`, diagnostics);
  requireText(record.publicationTargetId, `${path}.publicationTargetId`, diagnostics);
  requireText(record.encryptedPayloadRef, `${path}.encryptedPayloadRef`, diagnostics);
  requireText(record.keyVersion, `${path}.keyVersion`, diagnostics);
  requireText(record.redactedHint, `${path}.redactedHint`, diagnostics);
  requireTimestamp(record.createdAt, `${path}.createdAt`, diagnostics);
  requireTimestamp(record.updatedAt, `${path}.updatedAt`, diagnostics);
  requireNullableTimestamp(record.expiresAt, `${path}.expiresAt`, diagnostics);
  requireNullableTimestamp(record.revokedAt, `${path}.revokedAt`, diagnostics);
  if (!isSocialPlatformCredentialProvider(record.provider)) {
    diagnostics.push(diagnostic("provider_invalid", `${path}.provider`, "Provider is not supported."));
  }
  if (!isSocialPlatformCredentialKind(record.credentialKind)) {
    diagnostics.push(diagnostic("credential_kind_invalid", `${path}.credentialKind`, "Credential kind is not supported."));
  }
  if (!isLifecyclePhase(record.lifecyclePhase)) {
    diagnostics.push(diagnostic("lifecycle_phase_invalid", `${path}.lifecyclePhase`, "Lifecycle phase is not supported."));
  }
  if (hasText(record.redactedHint) && looksLikeSecretValue(record.redactedHint)) {
    diagnostics.push(diagnostic("secret_forbidden", `${path}.redactedHint`, "Redacted hint must not contain secret-like material."));
  }
  if (
    record.designOnly !== true ||
    record.metadataOnly !== true ||
    record.referenceOnly !== true ||
    record.containsSecretValue !== false ||
    record.containsTokenValue !== false ||
    record.containsRefreshToken !== false ||
    record.containsPlaintext !== false ||
    record.containsCiphertext !== false ||
    record.grantsExecutionPermission !== false
  ) {
    diagnostics.push(diagnostic("contract_invariant_failed", path, "Credential record schema model must remain metadata-only without values."));
  }
  scanForbiddenCredentialState(record, path, diagnostics);

  return result(diagnostics);
}

export function validateSocialCredentialMetadataSchemaModel(
  metadata: unknown,
  path = "credentialMetadata",
): SocialCredentialStorageSchemaValidationResult {
  const diagnostics: SocialCredentialStorageSchemaDiagnostic[] = [];
  if (!isRecord(metadata)) {
    return invalid(diagnostic("metadata_invalid", path, "Credential metadata schema model must be an object."));
  }

  requireTable(metadata.table, "social_credential_metadata", `${path}.table`, diagnostics);
  requireCurrentSchemaVersion(metadata.schemaVersion, `${path}.schemaVersion`, diagnostics);
  if (metadata.metadataVersion !== SOCIAL_CREDENTIAL_STORAGE_METADATA_VERSION) {
    diagnostics.push(diagnostic("schema_version_invalid", `${path}.metadataVersion`, "Storage metadata version is not current."));
  }
  requireText(metadata.metadataId, `${path}.metadataId`, diagnostics);
  requireText(metadata.credentialRefId, `${path}.credentialRefId`, diagnostics);
  requireText(metadata.providerAccountId, `${path}.providerAccountId`, diagnostics);
  requireTimestamp(metadata.createdAt, `${path}.createdAt`, diagnostics);
  requireNullableTimestamp(metadata.lastValidatedAt, `${path}.lastValidatedAt`, diagnostics);
  if (!isSocialPlatformCredentialProvider(metadata.provider)) {
    diagnostics.push(diagnostic("provider_invalid", `${path}.provider`, "Provider is not supported."));
  }
  if (!isLifecyclePhase(metadata.lifecyclePhase)) {
    diagnostics.push(diagnostic("lifecycle_phase_invalid", `${path}.lifecyclePhase`, "Lifecycle phase is not supported."));
  }
  if (
    metadata.designOnly !== true ||
    metadata.metadataOnly !== true ||
    metadata.referenceOnly !== true ||
    metadata.containsSecrets !== false ||
    metadata.containsTokens !== false ||
    metadata.containsPlaintext !== false ||
    metadata.containsCiphertext !== false ||
    metadata.grantsExecutionPermission !== false
  ) {
    diagnostics.push(diagnostic("contract_invariant_failed", path, "Credential metadata schema model must stay metadata-only and non-executing."));
  }
  scanForbiddenCredentialState(metadata, path, diagnostics);

  return result(diagnostics);
}

export function validateSocialCredentialKeyVersionSchemaModel(
  keyVersion: unknown,
  path = "keyVersion",
): SocialCredentialStorageSchemaValidationResult {
  const diagnostics: SocialCredentialStorageSchemaDiagnostic[] = [];
  if (!isRecord(keyVersion)) {
    return invalid(diagnostic("required_field_missing", path, "Key version schema model must be an object."));
  }

  requireTable(keyVersion.table, "social_credential_key_versions", `${path}.table`, diagnostics);
  requireCurrentSchemaVersion(keyVersion.schemaVersion, `${path}.schemaVersion`, diagnostics);
  requireText(keyVersion.keyVersion, `${path}.keyVersion`, diagnostics);
  requireTimestamp(keyVersion.activatedAt, `${path}.activatedAt`, diagnostics);
  requireNullableTimestamp(keyVersion.retiredAt, `${path}.retiredAt`, diagnostics);
  if (!isKeyVersionStatus(keyVersion.status)) {
    diagnostics.push(diagnostic("key_version_status_invalid", `${path}.status`, "Key version status is not supported."));
  }
  if (
    keyVersion.designOnly !== true ||
    keyVersion.metadataOnly !== true ||
    keyVersion.containsKeyMaterial !== false ||
    keyVersion.grantsExecutionPermission !== false
  ) {
    diagnostics.push(diagnostic("contract_invariant_failed", path, "Key version schema model must not contain key material."));
  }
  scanForbiddenCredentialState(keyVersion, path, diagnostics);

  return result(diagnostics);
}

export function validateSocialCredentialStorageSchemaModel(
  model: unknown,
  path = "storageSchema",
): SocialCredentialStorageSchemaValidationResult {
  const diagnostics: SocialCredentialStorageSchemaDiagnostic[] = [];
  if (!isRecord(model)) {
    return invalid(diagnostic("metadata_invalid", path, "Credential storage schema model must be an object."));
  }

  diagnostics.push(...validateSocialCredentialStorageSchemaMetadata(model.metadata, `${path}.metadata`).diagnostics);
  validateRecordArray(model.providerAccounts, `${path}.providerAccounts`, validateSocialCredentialProviderAccountSchemaModel, diagnostics);
  validateRecordArray(model.credentialRecords, `${path}.credentialRecords`, validateSocialCredentialRecordSchemaModel, diagnostics);
  validateRecordArray(model.credentialMetadata, `${path}.credentialMetadata`, validateSocialCredentialMetadataSchemaModel, diagnostics);
  validateRecordArray(model.keyVersions, `${path}.keyVersions`, validateSocialCredentialKeyVersionSchemaModel, diagnostics);
  validateDesignOnlyInvariants(model, path, diagnostics);
  scanForbiddenCredentialState(model, path, diagnostics);

  return result(diagnostics);
}

function validateDesignOnlyInvariants(
  value: UnknownRecord,
  path: string,
  diagnostics: SocialCredentialStorageSchemaDiagnostic[],
): void {
  const invariants: Readonly<Record<string, unknown>> = {
    designOnly: true,
    containsSecrets: false,
    containsTokens: false,
    containsPlaintext: false,
    containsCiphertext: false,
    usesNetwork: false,
    usesOAuth: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };

  for (const [key, expected] of Object.entries(invariants)) {
    if (key in value && value[key] !== expected) {
      diagnostics.push(diagnostic("contract_invariant_failed", `${path}.${key}`, "Storage schema model safety invariant failed."));
    }
  }

  if ("containsSql" in value && value.containsSql !== false) {
    diagnostics.push(diagnostic("sql_forbidden", `${path}.containsSql`, "Storage schema model must not include SQL."));
  }
  if ("connectsToSupabase" in value && value.connectsToSupabase !== false) {
    diagnostics.push(diagnostic("network_forbidden", `${path}.connectsToSupabase`, "Storage schema model must not connect to Supabase."));
  }
}

function validateTableList(
  value: unknown,
  path: string,
  diagnostics: SocialCredentialStorageSchemaDiagnostic[],
): void {
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic("table_name_invalid", path, "Storage schema table list must be an array."));
    return;
  }
  for (const [index, table] of value.entries()) {
    if (!isSocialCredentialStorageSchemaTable(table)) {
      diagnostics.push(diagnostic("table_name_invalid", `${path}.${index}`, "Storage schema table is not supported."));
    }
  }
}

function validateRecordArray(
  value: unknown,
  path: string,
  validator: (record: unknown, path?: string) => SocialCredentialStorageSchemaValidationResult,
  diagnostics: SocialCredentialStorageSchemaDiagnostic[],
): void {
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic("required_field_missing", path, "Storage schema collection must be an array."));
    return;
  }
  value.forEach((record, index) => {
    diagnostics.push(...validator(record, `${path}.${index}`).diagnostics);
  });
}

function requireCurrentSchemaVersion(
  value: unknown,
  path: string,
  diagnostics: SocialCredentialStorageSchemaDiagnostic[],
): void {
  if (value === SOCIAL_CREDENTIAL_STORAGE_SCHEMA_VERSION) return;
  diagnostics.push(diagnostic("schema_version_invalid", path, "Storage schema version is not current."));
}

function requireTable(
  value: unknown,
  expected: SocialCredentialStorageSchemaTable,
  path: string,
  diagnostics: SocialCredentialStorageSchemaDiagnostic[],
): void {
  if (value === expected) return;
  diagnostics.push(diagnostic("table_name_invalid", path, `Expected storage schema table ${expected}.`));
}

function requireText(
  value: unknown,
  path: string,
  diagnostics: SocialCredentialStorageSchemaDiagnostic[],
): void {
  if (hasText(value)) return;
  diagnostics.push(diagnostic("required_field_missing", path, "Required storage schema field is missing."));
}

function requireTimestamp(
  value: unknown,
  path: string,
  diagnostics: SocialCredentialStorageSchemaDiagnostic[],
): void {
  if (typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value))) return;
  diagnostics.push(diagnostic("timestamp_invalid", path, "Required storage schema timestamp is invalid."));
}

function requireNullableTimestamp(
  value: unknown,
  path: string,
  diagnostics: SocialCredentialStorageSchemaDiagnostic[],
): void {
  if (value === null || value === undefined) return;
  requireTimestamp(value, path, diagnostics);
}

function isLifecyclePhase(value: unknown): value is SocialCredentialLifecyclePhase {
  return typeof value === "string" && LIFECYCLE_PHASE_SET.has(value);
}

function isAccountStatus(value: unknown): value is SocialCredentialProviderAccountStatus {
  return typeof value === "string" && ACCOUNT_STATUS_SET.has(value);
}

function isKeyVersionStatus(value: unknown): value is SocialCredentialKeyVersionStatus {
  return typeof value === "string" && KEY_VERSION_STATUS_SET.has(value);
}

function result(
  diagnostics: readonly SocialCredentialStorageSchemaDiagnostic[],
): SocialCredentialStorageSchemaValidationResult {
  return diagnostics.length === 0 ? { ok: true, diagnostics: [] } : { ok: false, diagnostics };
}

function invalid(
  diagnosticValue: SocialCredentialStorageSchemaDiagnostic,
): SocialCredentialStorageSchemaValidationResult {
  return { ok: false, diagnostics: [diagnosticValue] };
}

function diagnostic(
  code: SocialCredentialStorageSchemaErrorCode,
  path: string,
  message: string,
): SocialCredentialStorageSchemaDiagnostic {
  return { code, path, message };
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function looksLikeSecretValue(value: string): boolean {
  const trimmed = value.trim();
  if (/^Bearer\s+/i.test(trimmed)) return true;
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(trimmed)) return true;
  if (/^[A-Za-z0-9+/=]{32,}$/.test(trimmed) && !trimmed.includes("*")) return true;
  return false;
}

const FORBIDDEN_SECRET_KEYS = new Set([
  "accessToken",
  "access_token",
  "apiKey",
  "api_key",
  "authorization",
  "ciphertext",
  "clientSecret",
  "client_secret",
  "credential",
  "credentials",
  "oauth",
  "password",
  "plaintext",
  "refreshToken",
  "refresh_token",
  "secret",
  "sql",
  "token",
  "tokens",
]);

function scanForbiddenCredentialState(
  value: unknown,
  path: string,
  diagnostics: SocialCredentialStorageSchemaDiagnostic[],
  depth = 0,
): void {
  if (depth > 4 || !isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_SECRET_KEYS.has(key)) {
      diagnostics.push(diagnostic("secret_forbidden", `${path}.${key}`, "Forbidden secret, token, SQL, OAuth, plaintext, or ciphertext key detected."));
    }
    if (typeof nested === "string" && looksLikeSecretValue(nested)) {
      diagnostics.push(diagnostic("secret_forbidden", `${path}.${key}`, "Forbidden secret-like value detected."));
    }
    scanForbiddenCredentialState(nested, `${path}.${key}`, diagnostics, depth + 1);
  }
}

type UnknownRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
