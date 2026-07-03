import {
  SOCIAL_CREDENTIAL_DOMAIN_VERSION,
  SOCIAL_CREDENTIAL_KEY_VERSION_STATUSES,
  type SocialCredentialKeyVersionStatus,
} from "./social-credential-domain";
import {
  SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
  SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS,
  type SocialPlatformCredentialProvider,
  isSocialPlatformCredentialProvider,
} from "../social-platform-credential-boundary";

export const SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION = "d13-w4-v1" as const;

export const SOCIAL_CREDENTIAL_CIPHER_ALGORITHMS = [
  "aes-256-gcm",
] as const;

export const SOCIAL_CREDENTIAL_ENVELOPE_FORMAT_VERSIONS = [
  "d13-envelope-v1",
] as const;

export const SOCIAL_CREDENTIAL_KEY_REFERENCE_KINDS = [
  "master_key_ref",
  "data_key_ref",
  "retired_key_ref",
] as const;

export const SOCIAL_CREDENTIAL_KEY_REFERENCE_STATUSES = [
  "registered",
  "active",
  "retired",
] as const;

export const SOCIAL_CREDENTIAL_ENCRYPTION_CAPABILITY_FLAGS = [
  "encryption_architecture_only",
  "encryption_implementation_blocked",
  "decryption_implementation_blocked",
  "key_material_blocked",
  "ciphertext_blocked",
  "plaintext_blocked",
  "crypto_library_blocked",
  "network_blocked",
  "execution_blocked",
] as const;

export const SOCIAL_CREDENTIAL_ENCRYPTION_ERROR_CODES = [
  "algorithm_unknown",
  "envelope_version_unknown",
  "key_reference_kind_unknown",
  "key_reference_status_unknown",
  "key_version_status_unknown",
  "key_reference_id_required",
  "key_version_required",
  "envelope_id_required",
  "nonce_ref_required",
  "tag_ref_required",
  "ciphertext_ref_required",
  "cipher_metadata_invalid",
  "provider_unknown",
  "contract_invariant_failed",
  "secret_forbidden",
  "key_material_forbidden",
  "ciphertext_forbidden",
  "plaintext_forbidden",
  "crypto_forbidden",
  "serialization_invalid",
  "capabilities_invalid",
  "safety_requirements_invalid",
] as const;

export type SocialCredentialCipherAlgorithm =
  (typeof SOCIAL_CREDENTIAL_CIPHER_ALGORITHMS)[number];

export type SocialCredentialEnvelopeFormatVersion =
  (typeof SOCIAL_CREDENTIAL_ENVELOPE_FORMAT_VERSIONS)[number];

export type SocialCredentialKeyReferenceKind =
  (typeof SOCIAL_CREDENTIAL_KEY_REFERENCE_KINDS)[number];

export type SocialCredentialKeyReferenceStatus =
  (typeof SOCIAL_CREDENTIAL_KEY_REFERENCE_STATUSES)[number];

export type SocialCredentialEncryptionCapabilityFlag =
  (typeof SOCIAL_CREDENTIAL_ENCRYPTION_CAPABILITY_FLAGS)[number];

export type SocialCredentialEncryptionErrorCode =
  (typeof SOCIAL_CREDENTIAL_ENCRYPTION_ERROR_CODES)[number];

export type SocialCredentialEncryptionDiagnostic = Readonly<{
  code: SocialCredentialEncryptionErrorCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning";
}>;

export type SocialCredentialEncryptionValidationResult = Readonly<{
  valid: boolean;
  diagnostics: readonly SocialCredentialEncryptionDiagnostic[];
}>;

export type SocialCredentialEncryptionKeyReference = Readonly<{
  keyReferenceId: string;
  keyVersion: string;
  kind: SocialCredentialKeyReferenceKind;
  status: SocialCredentialKeyReferenceStatus;
  providerScope: SocialPlatformCredentialProvider | "global";
  activatedAt: string;
  retiredAt: string | null;
  referenceOnly: true;
  containsKeyMaterial: false;
  containsSecretValue: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialCipherMetadata = Readonly<{
  algorithm: SocialCredentialCipherAlgorithm;
  keyLengthBits: 256;
  nonceLengthBytes: 12;
  tagLengthBytes: 16;
  envelopeFormatVersion: SocialCredentialEnvelopeFormatVersion;
  metadataOnly: true;
  implementsCipher: false;
  containsKeyMaterial: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialEnvelopeStructure = Readonly<{
  envelopeId: string;
  envelopeFormatVersion: SocialCredentialEnvelopeFormatVersion;
  encryptionDomainVersion: typeof SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION;
  keyVersion: string;
  keyReferenceId: string;
  nonceRef: string;
  tagRef: string;
  ciphertextRef: string;
  credentialRefId: string;
  structureOnly: true;
  containsCiphertext: false;
  containsPlaintext: false;
  containsKeyMaterial: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialEncryptionDomainCapabilities = Readonly<{
  supportedAlgorithms: readonly SocialCredentialCipherAlgorithm[];
  supportedEnvelopeVersions: readonly SocialCredentialEnvelopeFormatVersion[];
  supportedKeyReferenceKinds: readonly SocialCredentialKeyReferenceKind[];
  supportedProviders: readonly SocialPlatformCredentialProvider[];
  capabilityFlags: readonly SocialCredentialEncryptionCapabilityFlag[];
  allowsEncryption: false;
  allowsDecryption: false;
  allowsKeyMaterial: false;
  allowsCiphertext: false;
  allowsPlaintext: false;
  allowsCryptoLibraries: false;
  allowsNetwork: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialEncryptionDomainSafetyRequirements = Readonly<{
  contractOnly: true;
  architectureOnly: true;
  referencesOnly: true;
  callsNoExternalApis: true;
  usesNoSdks: true;
  usesNoNetwork: true;
  usesNoOAuth: true;
  usesNoCredentials: true;
  storesNoSecrets: true;
  storesNoKeyMaterial: true;
  storesNoPlaintext: true;
  storesNoCiphertext: true;
  usesNoNodeCrypto: true;
  usesNoWebCrypto: true;
  startsNoWorkers: true;
  startsNoTimers: true;
  createsNoQueues: true;
  exposesNoApiRoutes: true;
  mutatesNoSql: true;
  mutatesNoStorage: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialEncryptionDomainIdentity = Readonly<{
  domainId: string;
  encryptionDomainVersion: typeof SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION;
  credentialDomainVersion: typeof SOCIAL_CREDENTIAL_DOMAIN_VERSION;
  credentialBoundaryVersion: typeof SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION;
  displayName: string;
  layer: "credential_encryption_domain";
  contractOnly: true;
  implementsNothing: true;
  containsKeyMaterial: false;
  containsCiphertext: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialEncryptionDomainContract = Readonly<{
  identity: SocialCredentialEncryptionDomainIdentity;
  capabilities: SocialCredentialEncryptionDomainCapabilities;
  safety: SocialCredentialEncryptionDomainSafetyRequirements;
  defaultCipherMetadata: SocialCredentialCipherMetadata;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

const ALGORITHM_SET = new Set<string>(SOCIAL_CREDENTIAL_CIPHER_ALGORITHMS);
const ENVELOPE_VERSION_SET = new Set<string>(SOCIAL_CREDENTIAL_ENVELOPE_FORMAT_VERSIONS);
const KEY_REFERENCE_KIND_SET = new Set<string>(SOCIAL_CREDENTIAL_KEY_REFERENCE_KINDS);
const KEY_REFERENCE_STATUS_SET = new Set<string>(SOCIAL_CREDENTIAL_KEY_REFERENCE_STATUSES);
const KEY_VERSION_STATUS_SET = new Set<string>(SOCIAL_CREDENTIAL_KEY_VERSION_STATUSES);

const SHARED_CAPABILITY_FLAGS: readonly SocialCredentialEncryptionCapabilityFlag[] = [
  "encryption_architecture_only",
  "encryption_implementation_blocked",
  "decryption_implementation_blocked",
  "key_material_blocked",
  "ciphertext_blocked",
  "plaintext_blocked",
  "crypto_library_blocked",
  "network_blocked",
  "execution_blocked",
];

const SHARED_SAFETY: SocialCredentialEncryptionDomainSafetyRequirements = {
  contractOnly: true,
  architectureOnly: true,
  referencesOnly: true,
  callsNoExternalApis: true,
  usesNoSdks: true,
  usesNoNetwork: true,
  usesNoOAuth: true,
  usesNoCredentials: true,
  storesNoSecrets: true,
  storesNoKeyMaterial: true,
  storesNoPlaintext: true,
  storesNoCiphertext: true,
  usesNoNodeCrypto: true,
  usesNoWebCrypto: true,
  startsNoWorkers: true,
  startsNoTimers: true,
  createsNoQueues: true,
  exposesNoApiRoutes: true,
  mutatesNoSql: true,
  mutatesNoStorage: true,
  grantsExecutionPermission: false,
  executesNothing: true,
  publishesNothing: true,
};

export const SOCIAL_CREDENTIAL_DEFAULT_CIPHER_METADATA: SocialCredentialCipherMetadata = deepFreeze({
  algorithm: "aes-256-gcm",
  keyLengthBits: 256,
  nonceLengthBytes: 12,
  tagLengthBytes: 16,
  envelopeFormatVersion: "d13-envelope-v1",
  metadataOnly: true,
  implementsCipher: false,
  containsKeyMaterial: false,
  grantsExecutionPermission: false,
  executesNothing: true,
  publishesNothing: true,
});

export const SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_CONTRACT: SocialCredentialEncryptionDomainContract = deepFreeze({
  identity: {
    domainId: "credential-encryption-domain-contract",
    encryptionDomainVersion: SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION,
    credentialDomainVersion: SOCIAL_CREDENTIAL_DOMAIN_VERSION,
    credentialBoundaryVersion: SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
    displayName: "D13 credential encryption domain contract",
    layer: "credential_encryption_domain",
    contractOnly: true,
    implementsNothing: true,
    containsKeyMaterial: false,
    containsCiphertext: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  },
  capabilities: {
    supportedAlgorithms: [...SOCIAL_CREDENTIAL_CIPHER_ALGORITHMS],
    supportedEnvelopeVersions: [...SOCIAL_CREDENTIAL_ENVELOPE_FORMAT_VERSIONS],
    supportedKeyReferenceKinds: [...SOCIAL_CREDENTIAL_KEY_REFERENCE_KINDS],
    supportedProviders: [...SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS],
    capabilityFlags: SHARED_CAPABILITY_FLAGS,
    allowsEncryption: false,
    allowsDecryption: false,
    allowsKeyMaterial: false,
    allowsCiphertext: false,
    allowsPlaintext: false,
    allowsCryptoLibraries: false,
    allowsNetwork: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  },
  safety: SHARED_SAFETY,
  defaultCipherMetadata: SOCIAL_CREDENTIAL_DEFAULT_CIPHER_METADATA,
  computedOnly: true,
  readOnly: true,
  authoritative: false,
  grantsExecutionPermission: false,
  executesNothing: true,
  publishesNothing: true,
});

export function isSocialCredentialCipherAlgorithm(
  value: unknown,
): value is SocialCredentialCipherAlgorithm {
  return typeof value === "string" && ALGORITHM_SET.has(value);
}

export function isSocialCredentialEnvelopeFormatVersion(
  value: unknown,
): value is SocialCredentialEnvelopeFormatVersion {
  return typeof value === "string" && ENVELOPE_VERSION_SET.has(value);
}

export function isSocialCredentialKeyReferenceKind(
  value: unknown,
): value is SocialCredentialKeyReferenceKind {
  return typeof value === "string" && KEY_REFERENCE_KIND_SET.has(value);
}

export function isSocialCredentialKeyReferenceStatus(
  value: unknown,
): value is SocialCredentialKeyReferenceStatus {
  return typeof value === "string" && KEY_REFERENCE_STATUS_SET.has(value);
}

export function isSocialCredentialKeyVersionStatus(
  value: unknown,
): value is SocialCredentialKeyVersionStatus {
  return typeof value === "string" && KEY_VERSION_STATUS_SET.has(value);
}

export function validateSocialCredentialEncryptionDomainContract(
  contract: unknown,
): SocialCredentialEncryptionValidationResult {
  const diagnostics: SocialCredentialEncryptionDiagnostic[] = [];
  if (!isRecord(contract)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", "contract", "Encryption domain contract must be an object."),
      ],
    };
  }

  validateIdentity(contract.identity, "contract.identity", diagnostics);
  validateCapabilities(contract.capabilities, "contract.capabilities", diagnostics);
  validateSafety(contract.safety, "contract.safety", diagnostics);
  const cipherValidation = validateSocialCredentialCipherMetadata(
    contract.defaultCipherMetadata,
    "contract.defaultCipherMetadata",
  );
  diagnostics.push(...cipherValidation.diagnostics);

  if (contract.grantsExecutionPermission !== false) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      "contract.grantsExecutionPermission",
      "Encryption domain contract must not grant execution permission.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialCredentialEncryptionKeyReference(
  reference: unknown,
  path = "keyReference",
): SocialCredentialEncryptionValidationResult {
  const diagnostics: SocialCredentialEncryptionDiagnostic[] = [];
  if (!isRecord(reference)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", path, "Encryption key reference must be an object."),
      ],
    };
  }

  requireText(reference.keyReferenceId, `${path}.keyReferenceId`, "key_reference_id_required", diagnostics);
  requireText(reference.keyVersion, `${path}.keyVersion`, "key_version_required", diagnostics);
  requireTimestamp(reference.activatedAt, `${path}.activatedAt`, diagnostics);
  requireNullableTimestamp(reference.retiredAt, `${path}.retiredAt`, diagnostics);

  if (!isSocialCredentialKeyReferenceKind(reference.kind)) {
    diagnostics.push(errorDiagnostic("key_reference_kind_unknown", `${path}.kind`, "Key reference kind is not supported."));
  }
  if (!isSocialCredentialKeyReferenceStatus(reference.status)) {
    diagnostics.push(errorDiagnostic("key_reference_status_unknown", `${path}.status`, "Key reference status is not supported."));
  }
  if (
    reference.providerScope !== "global" &&
    !isSocialPlatformCredentialProvider(reference.providerScope)
  ) {
    diagnostics.push(errorDiagnostic("provider_unknown", `${path}.providerScope`, "Key reference provider scope is not supported."));
  }
  if (
    reference.referenceOnly !== true ||
    reference.containsKeyMaterial !== false ||
    reference.containsSecretValue !== false ||
    reference.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "Encryption key reference must remain reference-only without key material.",
    ));
  }
  scanForbiddenEncryptionState(reference, path, diagnostics);

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialCredentialCipherMetadata(
  metadata: unknown,
  path = "cipherMetadata",
): SocialCredentialEncryptionValidationResult {
  const diagnostics: SocialCredentialEncryptionDiagnostic[] = [];
  if (!isRecord(metadata)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("cipher_metadata_invalid", path, "Cipher metadata must be an object."),
      ],
    };
  }

  if (!isSocialCredentialCipherAlgorithm(metadata.algorithm)) {
    diagnostics.push(errorDiagnostic("algorithm_unknown", `${path}.algorithm`, "Cipher algorithm is not supported."));
  }
  if (!isSocialCredentialEnvelopeFormatVersion(metadata.envelopeFormatVersion)) {
    diagnostics.push(errorDiagnostic("envelope_version_unknown", `${path}.envelopeFormatVersion`, "Envelope format version is not supported."));
  }
  if (metadata.keyLengthBits !== 256) {
    diagnostics.push(errorDiagnostic("cipher_metadata_invalid", `${path}.keyLengthBits`, "AES-256-GCM requires 256-bit key length."));
  }
  if (metadata.nonceLengthBytes !== 12) {
    diagnostics.push(errorDiagnostic("cipher_metadata_invalid", `${path}.nonceLengthBytes`, "AES-256-GCM requires 12-byte nonce."));
  }
  if (metadata.tagLengthBytes !== 16) {
    diagnostics.push(errorDiagnostic("cipher_metadata_invalid", `${path}.tagLengthBytes`, "AES-256-GCM requires 16-byte tag."));
  }
  if (
    metadata.metadataOnly !== true ||
    metadata.implementsCipher !== false ||
    metadata.containsKeyMaterial !== false ||
    metadata.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "Cipher metadata must remain metadata-only without cipher implementation.",
    ));
  }
  scanForbiddenEncryptionState(metadata, path, diagnostics);

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialCredentialEnvelopeStructure(
  envelope: unknown,
  path = "envelope",
): SocialCredentialEncryptionValidationResult {
  const diagnostics: SocialCredentialEncryptionDiagnostic[] = [];
  if (!isRecord(envelope)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", path, "Envelope structure must be an object."),
      ],
    };
  }

  requireText(envelope.envelopeId, `${path}.envelopeId`, "envelope_id_required", diagnostics);
  requireText(envelope.keyVersion, `${path}.keyVersion`, "key_version_required", diagnostics);
  requireText(envelope.keyReferenceId, `${path}.keyReferenceId`, "key_reference_id_required", diagnostics);
  requireText(envelope.nonceRef, `${path}.nonceRef`, "nonce_ref_required", diagnostics);
  requireText(envelope.tagRef, `${path}.tagRef`, "tag_ref_required", diagnostics);
  requireText(envelope.ciphertextRef, `${path}.ciphertextRef`, "ciphertext_ref_required", diagnostics);
  requireText(envelope.credentialRefId, `${path}.credentialRefId`, "key_reference_id_required", diagnostics);

  if (!isSocialCredentialEnvelopeFormatVersion(envelope.envelopeFormatVersion)) {
    diagnostics.push(errorDiagnostic("envelope_version_unknown", `${path}.envelopeFormatVersion`, "Envelope format version is not supported."));
  }
  if (envelope.encryptionDomainVersion !== SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.encryptionDomainVersion`,
      "Envelope structure encryption domain version must match current version.",
    ));
  }
  if (
    envelope.structureOnly !== true ||
    envelope.containsCiphertext !== false ||
    envelope.containsPlaintext !== false ||
    envelope.containsKeyMaterial !== false ||
    envelope.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "Envelope structure must remain structure-only without ciphertext, plaintext, or key material.",
    ));
  }
  scanForbiddenEncryptionState(envelope, path, diagnostics);

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function serializeSocialCredentialEncryptionDomainContract(
  contract: SocialCredentialEncryptionDomainContract = SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_CONTRACT,
): string {
  return JSON.stringify(toStableValue(contract));
}

export function hydrateSocialCredentialEncryptionDomainContract(
  serialized: string,
): Readonly<{
  ok: true;
  value: SocialCredentialEncryptionDomainContract;
}> | Readonly<{
  ok: false;
  diagnostics: readonly SocialCredentialEncryptionDiagnostic[];
}> {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const validation = validateSocialCredentialEncryptionDomainContract(parsed);
    if (!validation.valid || !isRecord(parsed)) {
      return { ok: false, diagnostics: validation.diagnostics };
    }
    return { ok: true, value: deepFreeze(parsed as SocialCredentialEncryptionDomainContract) };
  } catch {
    return {
      ok: false,
      diagnostics: [
        errorDiagnostic(
          "serialization_invalid",
          "serialized",
          "Encryption domain contract serialization must be valid JSON.",
        ),
      ],
    };
  }
}

function validateIdentity(
  identity: unknown,
  path: string,
  diagnostics: SocialCredentialEncryptionDiagnostic[],
): void {
  if (!isRecord(identity)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", path, "Encryption domain identity must be an object."));
    return;
  }
  requireText(identity.domainId, `${path}.domainId`, "key_reference_id_required", diagnostics);
  if (identity.encryptionDomainVersion !== SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.encryptionDomainVersion`,
      "Encryption domain version must match current contract version.",
    ));
  }
  if (
    identity.contractOnly !== true ||
    identity.containsKeyMaterial !== false ||
    identity.grantsExecutionPermission !== false
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      path,
      "Encryption domain identity must remain contract-only and non-executing.",
    ));
  }
}

function validateCapabilities(
  capabilities: unknown,
  path: string,
  diagnostics: SocialCredentialEncryptionDiagnostic[],
): void {
  if (!isRecord(capabilities)) {
    diagnostics.push(errorDiagnostic("capabilities_invalid", path, "Encryption domain capabilities must be an object."));
    return;
  }
  const falseFlags = [
    "allowsEncryption",
    "allowsDecryption",
    "allowsKeyMaterial",
    "allowsCiphertext",
    "allowsPlaintext",
    "allowsCryptoLibraries",
    "allowsNetwork",
    "grantsExecutionPermission",
  ] as const;
  for (const flag of falseFlags) {
    if (capabilities[flag] !== false) {
      diagnostics.push(errorDiagnostic(
        "capabilities_invalid",
        `${path}.${flag}`,
        "Encryption domain capabilities must forbid encryption implementation and key material.",
      ));
    }
  }
}

function validateSafety(
  safety: unknown,
  path: string,
  diagnostics: SocialCredentialEncryptionDiagnostic[],
): void {
  if (!isRecord(safety)) {
    diagnostics.push(errorDiagnostic(
      "safety_requirements_invalid",
      path,
      "Encryption domain safety requirements must be an object.",
    ));
    return;
  }
  const requiredTrue = [
    "contractOnly",
    "architectureOnly",
    "referencesOnly",
    "usesNoNodeCrypto",
    "usesNoWebCrypto",
    "storesNoKeyMaterial",
    "storesNoCiphertext",
    "storesNoPlaintext",
  ] as const;
  for (const flag of requiredTrue) {
    if (safety[flag] !== true) {
      diagnostics.push(errorDiagnostic(
        "safety_requirements_invalid",
        `${path}.${flag}`,
        "Encryption domain safety requirement invariant failed.",
      ));
    }
  }
  if (safety.grantsExecutionPermission !== false) {
    diagnostics.push(errorDiagnostic(
      "safety_requirements_invalid",
      `${path}.grantsExecutionPermission`,
      "Encryption domain must not grant execution permission.",
    ));
  }
}

function requireText(
  value: unknown,
  path: string,
  code: SocialCredentialEncryptionErrorCode,
  diagnostics: SocialCredentialEncryptionDiagnostic[],
): void {
  if (hasText(value)) return;
  diagnostics.push(errorDiagnostic(code, path, "Required encryption domain text field is missing."));
}

function requireTimestamp(
  value: unknown,
  path: string,
  diagnostics: SocialCredentialEncryptionDiagnostic[],
): void {
  if (typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value))) return;
  diagnostics.push(errorDiagnostic("serialization_invalid", path, "Required encryption domain timestamp is invalid."));
}

function requireNullableTimestamp(
  value: unknown,
  path: string,
  diagnostics: SocialCredentialEncryptionDiagnostic[],
): void {
  if (value === null || value === undefined) return;
  requireTimestamp(value, path, diagnostics);
}

function errorDiagnostic(
  code: SocialCredentialEncryptionErrorCode,
  path: string,
  message: string,
): SocialCredentialEncryptionDiagnostic {
  return { code, path, message, severity: "error" };
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const FORBIDDEN_ENCRYPTION_KEYS = new Set([
  "accessToken",
  "access_token",
  "apiKey",
  "api_key",
  "ciphertext",
  "clientSecret",
  "client_secret",
  "credential",
  "credentials",
  "encrypted_payload",
  "iv",
  "key",
  "keyMaterial",
  "key_material",
  "masterKey",
  "master_key",
  "nonce",
  "password",
  "plaintext",
  "privateKey",
  "private_key",
  "publicKey",
  "public_key",
  "refreshToken",
  "refresh_token",
  "secret",
  "tag",
  "token",
  "tokens",
]);

function scanForbiddenEncryptionState(
  value: unknown,
  path: string,
  diagnostics: SocialCredentialEncryptionDiagnostic[],
  depth = 0,
): void {
  if (depth > 4 || !isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_ENCRYPTION_KEYS.has(key)) {
      diagnostics.push(errorDiagnostic("secret_forbidden", `${path}.${key}`, "Forbidden secret, key material, or ciphertext key detected."));
    }
    if (typeof nested === "string" && looksLikeSecretValue(nested)) {
      diagnostics.push(errorDiagnostic("secret_forbidden", `${path}.${key}`, "Forbidden secret-like value detected."));
    }
    scanForbiddenEncryptionState(nested, `${path}.${key}`, diagnostics, depth + 1);
  }
}

function looksLikeSecretValue(value: string): boolean {
  const trimmed = value.trim();
  if (/^Bearer\s+/i.test(trimmed)) return true;
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(trimmed)) return true;
  if (/^[A-Za-z0-9+/=]{32,}$/.test(trimmed) && !trimmed.includes("*")) return true;
  return false;
}

type UnknownRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toStableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toStableValue);
  if (!isRecord(value)) return value;
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((output, key) => {
      output[key] = toStableValue(value[key]);
      return output;
    }, {});
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
