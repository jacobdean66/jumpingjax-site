import {
  SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION,
  SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_CONTRACT,
  type SocialCredentialCipherMetadata,
  type SocialCredentialEnvelopeStructure,
  validateSocialCredentialEncryptionDomainContract,
} from "./social-credential-encryption-domain";
import { SOCIAL_CREDENTIAL_DOMAIN_VERSION } from "./social-credential-domain";
import {
  SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
  type SocialPlatformCredentialProvider,
} from "../social-platform-credential-boundary";

export const SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION = "d13-w4-v1" as const;

export const SOCIAL_CREDENTIAL_ENCRYPTION_PROVIDER_KINDS = [
  "envelope_encryption_provider",
  "key_management_provider",
] as const;

export const SOCIAL_CREDENTIAL_ENCRYPTION_OPERATION_KINDS = [
  "encrypt",
  "decrypt",
  "rotate_key",
  "re_encrypt",
] as const;

export const SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_ERROR_CODES = [
  "provider_contract_invalid",
  "provider_id_required",
  "provider_kind_unknown",
  "operation_kind_unknown",
  "envelope_structure_invalid",
  "key_reference_invalid",
  "rotation_plan_invalid",
  "implementation_forbidden",
  "contract_invariant_failed",
  "serialization_invalid",
  "capabilities_invalid",
  "safety_requirements_invalid",
] as const;

export type SocialCredentialEncryptionProviderKind =
  (typeof SOCIAL_CREDENTIAL_ENCRYPTION_PROVIDER_KINDS)[number];

export type SocialCredentialEncryptionOperationKind =
  (typeof SOCIAL_CREDENTIAL_ENCRYPTION_OPERATION_KINDS)[number];

export type SocialCredentialEncryptionBoundaryErrorCode =
  (typeof SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_ERROR_CODES)[number];

export type SocialCredentialEncryptionBoundaryDiagnostic = Readonly<{
  code: SocialCredentialEncryptionBoundaryErrorCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning";
}>;

export type SocialCredentialEncryptionBoundaryValidationResult = Readonly<{
  valid: boolean;
  diagnostics: readonly SocialCredentialEncryptionBoundaryDiagnostic[];
}>;

export type SocialCredentialEncryptionProviderCapabilities = Readonly<{
  providerKind: SocialCredentialEncryptionProviderKind;
  contractOnly: true;
  implementsEncryption: false;
  implementsDecryption: false;
  implementsRotation: false;
  usesNoNodeCrypto: true;
  usesNoWebCrypto: true;
  usesNoNetwork: true;
  storesNoKeyMaterial: true;
  storesNoCiphertext: true;
  storesNoPlaintext: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialEncryptionProviderContract = Readonly<{
  providerId: string;
  providerKind: SocialCredentialEncryptionProviderKind;
  encryptionBoundaryVersion: typeof SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION;
  encryptionDomainVersion: typeof SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION;
  credentialDomainVersion: typeof SOCIAL_CREDENTIAL_DOMAIN_VERSION;
  credentialBoundaryVersion: typeof SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION;
  supportedProviders: readonly SocialPlatformCredentialProvider[];
  capabilities: SocialCredentialEncryptionProviderCapabilities;
  contractOnly: true;
  implementsNothing: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialEncryptRequest = Readonly<{
  operation: "encrypt";
  credentialRefId: string;
  keyReferenceId: string;
  keyVersion: string;
  plaintextRef: string;
  envelopeStructure: SocialCredentialEnvelopeStructure;
  contractOnly: true;
  containsPlaintext: false;
  containsCiphertext: false;
  containsKeyMaterial: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialDecryptRequest = Readonly<{
  operation: "decrypt";
  credentialRefId: string;
  envelopeStructure: SocialCredentialEnvelopeStructure;
  keyReferenceId: string;
  keyVersion: string;
  contractOnly: true;
  containsPlaintext: false;
  containsCiphertext: false;
  containsKeyMaterial: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialEncryptionOperationRequest =
  | SocialCredentialEncryptRequest
  | SocialCredentialDecryptRequest;

export type SocialCredentialEncryptionOperationResult<TValue> =
  | Readonly<{ ok: true; value: TValue }>
  | Readonly<{
      ok: false;
      error: Readonly<{
        code: SocialCredentialEncryptionBoundaryErrorCode;
        message: string;
      }>;
    }>;

export type SocialCredentialEncryptionRotationPlan = Readonly<{
  rotationPlanId: string;
  fromKeyVersion: string;
  toKeyVersion: string;
  fromKeyReferenceId: string;
  toKeyReferenceId: string;
  affectedCredentialRefIds: readonly string[];
  plannedAt: string;
  referenceOnly: true;
  performsRotation: false;
  containsKeyMaterial: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialEncryptionRotationContract = Readonly<{
  contractVersion: typeof SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION;
  supportedOperations: readonly ["rotate_key", "re_encrypt"];
  requiresAuditEvent: true;
  requiresKeyVersionRegistration: true;
  referenceOnly: true;
  implementsNothing: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialEncryptionProvider = Readonly<{
  contract: SocialCredentialEncryptionProviderContract;
  encrypt(
    request: SocialCredentialEncryptRequest,
  ): SocialCredentialEncryptionOperationResult<SocialCredentialEnvelopeStructure>;
  decrypt(
    request: SocialCredentialDecryptRequest,
  ): SocialCredentialEncryptionOperationResult<{ plaintextRef: string }>;
  planRotation(
    plan: SocialCredentialEncryptionRotationPlan,
  ): SocialCredentialEncryptionOperationResult<SocialCredentialEncryptionRotationPlan>;
}>;

export type SocialCredentialEncryptionBoundarySafetyRequirements = Readonly<{
  contractOnly: true;
  boundaryOnly: true;
  referencesOnly: true;
  implementsNoEncryption: true;
  implementsNoDecryption: true;
  implementsNoRotation: true;
  usesNoNodeCrypto: true;
  usesNoWebCrypto: true;
  usesNoNetwork: true;
  storesNoKeyMaterial: true;
  storesNoCiphertext: true;
  storesNoPlaintext: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialEncryptionBoundaryContract = Readonly<{
  boundaryId: string;
  boundaryVersion: typeof SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION;
  encryptionDomainVersion: typeof SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION;
  defaultCipherMetadata: SocialCredentialCipherMetadata;
  rotationContract: SocialCredentialEncryptionRotationContract;
  safety: SocialCredentialEncryptionBoundarySafetyRequirements;
  contractOnly: true;
  implementsNothing: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export const SOCIAL_CREDENTIAL_ENCRYPTION_ROTATION_CONTRACT: SocialCredentialEncryptionRotationContract = Object.freeze({
  contractVersion: SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION,
  supportedOperations: Object.freeze(["rotate_key", "re_encrypt"] as const),
  requiresAuditEvent: true,
  requiresKeyVersionRegistration: true,
  referenceOnly: true,
  implementsNothing: true,
  grantsExecutionPermission: false,
  executesNothing: true,
  publishesNothing: true,
});

export const SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_CONTRACT: SocialCredentialEncryptionBoundaryContract = deepFreeze({
  boundaryId: "credential-encryption-boundary-contract",
  boundaryVersion: SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION,
  encryptionDomainVersion: SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION,
  defaultCipherMetadata: SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_CONTRACT.defaultCipherMetadata,
  rotationContract: SOCIAL_CREDENTIAL_ENCRYPTION_ROTATION_CONTRACT,
  safety: {
    contractOnly: true,
    boundaryOnly: true,
    referencesOnly: true,
    implementsNoEncryption: true,
    implementsNoDecryption: true,
    implementsNoRotation: true,
    usesNoNodeCrypto: true,
    usesNoWebCrypto: true,
    usesNoNetwork: true,
    storesNoKeyMaterial: true,
    storesNoCiphertext: true,
    storesNoPlaintext: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  },
  contractOnly: true,
  implementsNothing: true,
  grantsExecutionPermission: false,
  executesNothing: true,
  publishesNothing: true,
});

const PROVIDER_KIND_SET = new Set<string>(SOCIAL_CREDENTIAL_ENCRYPTION_PROVIDER_KINDS);
const OPERATION_KIND_SET = new Set<string>(SOCIAL_CREDENTIAL_ENCRYPTION_OPERATION_KINDS);

export function isSocialCredentialEncryptionProviderKind(
  value: unknown,
): value is SocialCredentialEncryptionProviderKind {
  return typeof value === "string" && PROVIDER_KIND_SET.has(value);
}

export function isSocialCredentialEncryptionOperationKind(
  value: unknown,
): value is SocialCredentialEncryptionOperationKind {
  return typeof value === "string" && OPERATION_KIND_SET.has(value);
}

export function validateSocialCredentialEncryptionProviderContract(
  contract: unknown,
): SocialCredentialEncryptionBoundaryValidationResult {
  const diagnostics: SocialCredentialEncryptionBoundaryDiagnostic[] = [];
  if (!isRecord(contract)) {
    return {
      valid: false,
      diagnostics: [
        boundaryError("provider_contract_invalid", "contract", "Encryption provider contract must be an object."),
      ],
    };
  }

  if (typeof contract.providerId !== "string" || contract.providerId.trim().length === 0) {
    diagnostics.push(boundaryError("provider_id_required", "contract.providerId", "Encryption provider contract must include providerId."));
  }
  if (!isSocialCredentialEncryptionProviderKind(contract.providerKind)) {
    diagnostics.push(boundaryError("provider_kind_unknown", "contract.providerKind", "Encryption provider kind is not supported."));
  }
  if (
    contract.encryptionBoundaryVersion !== SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION ||
    contract.encryptionDomainVersion !== SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION ||
    contract.credentialDomainVersion !== SOCIAL_CREDENTIAL_DOMAIN_VERSION
  ) {
    diagnostics.push(boundaryError("provider_contract_invalid", "contract", "Encryption provider contract version fields are invalid."));
  }
  if (!isRecord(contract.capabilities)) {
    diagnostics.push(boundaryError("capabilities_invalid", "contract.capabilities", "Encryption provider capabilities must be an object."));
  } else {
    validateProviderCapabilities(contract.capabilities, "contract.capabilities", diagnostics);
  }
  if (contract.contractOnly !== true || contract.implementsNothing !== true || contract.grantsExecutionPermission !== false) {
    diagnostics.push(boundaryError(
      "contract_invariant_failed",
      "contract",
      "Encryption provider contract must remain contract-only and non-executing.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialCredentialEncryptionRotationPlan(
  plan: unknown,
  path = "rotationPlan",
): SocialCredentialEncryptionBoundaryValidationResult {
  const diagnostics: SocialCredentialEncryptionBoundaryDiagnostic[] = [];
  if (!isRecord(plan)) {
    return {
      valid: false,
      diagnostics: [
        boundaryError("rotation_plan_invalid", path, "Encryption rotation plan must be an object."),
      ],
    };
  }

  requireText(plan.rotationPlanId, `${path}.rotationPlanId`, diagnostics);
  requireText(plan.fromKeyVersion, `${path}.fromKeyVersion`, diagnostics);
  requireText(plan.toKeyVersion, `${path}.toKeyVersion`, diagnostics);
  requireText(plan.fromKeyReferenceId, `${path}.fromKeyReferenceId`, diagnostics);
  requireText(plan.toKeyReferenceId, `${path}.toKeyReferenceId`, diagnostics);
  requireTimestamp(plan.plannedAt, `${path}.plannedAt`, diagnostics);

  if (!Array.isArray(plan.affectedCredentialRefIds)) {
    diagnostics.push(boundaryError("rotation_plan_invalid", `${path}.affectedCredentialRefIds`, "Rotation plan affected credential refs must be an array."));
  }
  if (
    plan.referenceOnly !== true ||
    plan.performsRotation !== false ||
    plan.containsKeyMaterial !== false ||
    plan.grantsExecutionPermission !== false
  ) {
    diagnostics.push(boundaryError(
      "contract_invariant_failed",
      path,
      "Encryption rotation plan must remain reference-only without performing rotation.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialCredentialEncryptionBoundaryContract(
  contract: unknown,
): SocialCredentialEncryptionBoundaryValidationResult {
  const diagnostics: SocialCredentialEncryptionBoundaryDiagnostic[] = [];
  if (!isRecord(contract)) {
    return {
      valid: false,
      diagnostics: [
        boundaryError("provider_contract_invalid", "contract", "Encryption boundary contract must be an object."),
      ],
    };
  }

  if (contract.boundaryVersion !== SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION) {
    diagnostics.push(boundaryError("provider_contract_invalid", "contract.boundaryVersion", "Encryption boundary version is not current."));
  }
  if (contract.encryptionDomainVersion !== SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION) {
    diagnostics.push(boundaryError("provider_contract_invalid", "contract.encryptionDomainVersion", "Encryption domain version is not current."));
  }
  const domainValidation = validateSocialCredentialEncryptionDomainContract(
    SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_CONTRACT,
  );
  if (!domainValidation.valid) {
    for (const diagnostic of domainValidation.diagnostics) {
      diagnostics.push(boundaryError("provider_contract_invalid", `domain.${diagnostic.path}`, diagnostic.message));
    }
  }
  if (contract.contractOnly !== true || contract.implementsNothing !== true || contract.grantsExecutionPermission !== false) {
    diagnostics.push(boundaryError(
      "contract_invariant_failed",
      "contract",
      "Encryption boundary contract must remain contract-only and non-executing.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function createContractOnlyEncryptionProvider(
  contract: SocialCredentialEncryptionProviderContract,
): SocialCredentialEncryptionProvider {
  const validation = validateSocialCredentialEncryptionProviderContract(contract);
  if (!validation.valid) {
    return createUnavailableEncryptionProvider(
      boundaryErrorValue("provider_contract_invalid", "Encryption provider contract failed validation."),
    );
  }

  const unavailable = <T>(): SocialCredentialEncryptionOperationResult<T> => ({
    ok: false,
    error: boundaryErrorValue("implementation_forbidden", "Encryption provider implementation is forbidden in D13 Wave 4."),
  });

  return {
    contract,
    encrypt: unavailable,
    decrypt: unavailable,
    planRotation: unavailable,
  };
}

function createUnavailableEncryptionProvider(
  error: { code: SocialCredentialEncryptionBoundaryErrorCode; message: string },
): SocialCredentialEncryptionProvider {
  const unavailable = <T>(): SocialCredentialEncryptionOperationResult<T> => ({
    ok: false,
    error,
  });

  return {
    contract: {
      providerId: "unavailable-encryption-provider",
      providerKind: "envelope_encryption_provider",
      encryptionBoundaryVersion: SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION,
      encryptionDomainVersion: SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION,
      credentialDomainVersion: SOCIAL_CREDENTIAL_DOMAIN_VERSION,
      credentialBoundaryVersion: SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
      supportedProviders: [],
      capabilities: {
        providerKind: "envelope_encryption_provider",
        contractOnly: true,
        implementsEncryption: false,
        implementsDecryption: false,
        implementsRotation: false,
        usesNoNodeCrypto: true,
        usesNoWebCrypto: true,
        usesNoNetwork: true,
        storesNoKeyMaterial: true,
        storesNoCiphertext: true,
        storesNoPlaintext: true,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
      contractOnly: true,
      implementsNothing: true,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    encrypt: unavailable,
    decrypt: unavailable,
    planRotation: unavailable,
  };
}

function validateProviderCapabilities(
  capabilities: UnknownRecord,
  path: string,
  diagnostics: SocialCredentialEncryptionBoundaryDiagnostic[],
): void {
  const trueFlags = [
    "contractOnly",
    "usesNoNodeCrypto",
    "usesNoWebCrypto",
    "usesNoNetwork",
    "storesNoKeyMaterial",
    "storesNoCiphertext",
    "storesNoPlaintext",
    "executesNothing",
    "publishesNothing",
  ] as const;
  const falseFlags = [
    "implementsEncryption",
    "implementsDecryption",
    "implementsRotation",
    "grantsExecutionPermission",
  ] as const;

  for (const flag of trueFlags) {
    if (capabilities[flag] !== true) {
      diagnostics.push(boundaryError("capabilities_invalid", `${path}.${flag}`, "Encryption provider capability invariant failed."));
    }
  }
  for (const flag of falseFlags) {
    if (capabilities[flag] !== false) {
      diagnostics.push(boundaryError("capabilities_invalid", `${path}.${flag}`, "Encryption provider must not implement crypto operations."));
    }
  }
  if (!isSocialCredentialEncryptionProviderKind(capabilities.providerKind)) {
    diagnostics.push(boundaryError("provider_kind_unknown", `${path}.providerKind`, "Encryption provider kind is not supported."));
  }
}

function requireText(
  value: unknown,
  path: string,
  diagnostics: SocialCredentialEncryptionBoundaryDiagnostic[],
): void {
  if (typeof value === "string" && value.trim().length > 0) return;
  diagnostics.push(boundaryError("rotation_plan_invalid", path, "Required encryption boundary text field is missing."));
}

function requireTimestamp(
  value: unknown,
  path: string,
  diagnostics: SocialCredentialEncryptionBoundaryDiagnostic[],
): void {
  if (typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value))) return;
  diagnostics.push(boundaryError("rotation_plan_invalid", path, "Required encryption boundary timestamp is invalid."));
}

function boundaryError(
  code: SocialCredentialEncryptionBoundaryErrorCode,
  path: string,
  message: string,
): SocialCredentialEncryptionBoundaryDiagnostic {
  return { code, path, message, severity: "error" };
}

function boundaryErrorValue(
  code: SocialCredentialEncryptionBoundaryErrorCode,
  message: string,
): { code: SocialCredentialEncryptionBoundaryErrorCode; message: string } {
  return { code, message };
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
