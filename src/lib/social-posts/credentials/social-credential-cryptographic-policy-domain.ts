import {
  SOCIAL_CREDENTIAL_DOMAIN_VERSION,
  SOCIAL_CREDENTIAL_KEY_VERSION_STATUSES,
} from "./social-credential-domain";
import {
  SOCIAL_CREDENTIAL_CIPHER_ALGORITHMS,
  SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION,
  SOCIAL_CREDENTIAL_ENVELOPE_FORMAT_VERSIONS,
  SOCIAL_CREDENTIAL_KEY_REFERENCE_KINDS,
  type SocialCredentialCipherAlgorithm,
  type SocialCredentialEnvelopeFormatVersion,
  type SocialCredentialKeyReferenceKind,
  type SocialCredentialKeyReferenceStatus,
  isSocialCredentialCipherAlgorithm,
  isSocialCredentialEnvelopeFormatVersion,
  isSocialCredentialKeyReferenceKind,
  isSocialCredentialKeyReferenceStatus,
} from "./social-credential-encryption-domain";
import {
  SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
  SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS,
  type SocialPlatformCredentialProvider,
  isSocialPlatformCredentialProvider,
} from "../social-platform-credential-boundary";

export const SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_VERSION = "d13-w5-v1" as const;

export const SOCIAL_CREDENTIAL_POLICY_SELECTION_STRATEGIES = [
  "provider_scope_match",
  "algorithm_capability_match",
  "deterministic_priority",
] as const;

export const SOCIAL_CREDENTIAL_KEY_LIFECYCLE_PHASES = [
  "registered",
  "active",
  "rotation_due",
  "retired",
] as const;

export const SOCIAL_CREDENTIAL_ROTATION_POLICY_KINDS = [
  "manual_review",
  "key_version_retirement",
  "provider_reassignment",
] as const;

export const SOCIAL_CREDENTIAL_KEY_LIFECYCLE_VERSION_STATUSES = [
  ...SOCIAL_CREDENTIAL_KEY_VERSION_STATUSES,
  "unregistered",
] as const;

export const SOCIAL_CREDENTIAL_CRYPTO_POLICY_CAPABILITY_FLAGS = [
  "policy_metadata_only",
  "human_approval_required",
  "provider_selection_reference_only",
  "key_lifecycle_projection_only",
  "rotation_execution_blocked",
  "crypto_implementation_blocked",
  "execution_blocked",
] as const;

export const SOCIAL_CREDENTIAL_CRYPTO_POLICY_ERROR_CODES = [
  "algorithm_unknown",
  "envelope_version_unknown",
  "key_reference_kind_unknown",
  "key_reference_status_unknown",
  "key_version_status_unknown",
  "lifecycle_phase_unknown",
  "rotation_policy_kind_unknown",
  "selection_strategy_unknown",
  "provider_unknown",
  "policy_id_required",
  "rotation_policy_id_required",
  "lifecycle_model_id_required",
  "key_reference_id_required",
  "key_version_required",
  "timestamp_invalid",
  "rotation_limit_invalid",
  "capabilities_invalid",
  "safety_requirements_invalid",
  "contract_invariant_failed",
  "serialization_invalid",
  "secret_forbidden",
  "human_approval_required",
] as const;

export type SocialCredentialPolicySelectionStrategy =
  (typeof SOCIAL_CREDENTIAL_POLICY_SELECTION_STRATEGIES)[number];

export type SocialCredentialKeyLifecyclePhase =
  (typeof SOCIAL_CREDENTIAL_KEY_LIFECYCLE_PHASES)[number];

export type SocialCredentialRotationPolicyKind =
  (typeof SOCIAL_CREDENTIAL_ROTATION_POLICY_KINDS)[number];

export type SocialCredentialKeyLifecycleVersionStatus =
  (typeof SOCIAL_CREDENTIAL_KEY_LIFECYCLE_VERSION_STATUSES)[number];

export type SocialCredentialCryptoPolicyCapabilityFlag =
  (typeof SOCIAL_CREDENTIAL_CRYPTO_POLICY_CAPABILITY_FLAGS)[number];

export type SocialCredentialCryptoPolicyErrorCode =
  (typeof SOCIAL_CREDENTIAL_CRYPTO_POLICY_ERROR_CODES)[number];

export type SocialCredentialCryptoPolicyDiagnostic = Readonly<{
  code: SocialCredentialCryptoPolicyErrorCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning";
}>;

export type SocialCredentialCryptoPolicyValidationResult = Readonly<{
  valid: boolean;
  diagnostics: readonly SocialCredentialCryptoPolicyDiagnostic[];
}>;

export type SocialCredentialCryptographicAlgorithmCapability = Readonly<{
  algorithm: SocialCredentialCipherAlgorithm;
  envelopeFormatVersion: SocialCredentialEnvelopeFormatVersion;
  supportedKeyReferenceKinds: readonly SocialCredentialKeyReferenceKind[];
  supportedProviderScopes: readonly (SocialPlatformCredentialProvider | "global")[];
  supportsProviderSelection: true;
  supportsLifecycleTracking: true;
  supportsRotationPolicy: true;
  requiresHumanApproval: true;
  metadataOnly: true;
  implementsEncryption: false;
  implementsDecryption: false;
  containsKeyMaterial: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialKeyLifecycleModel = Readonly<{
  lifecycleModelId: string;
  keyReferenceId: string;
  keyVersion: string;
  providerScope: SocialPlatformCredentialProvider | "global";
  lifecyclePhase: SocialCredentialKeyLifecyclePhase;
  keyReferenceStatus: SocialCredentialKeyReferenceStatus;
  keyVersionStatus: SocialCredentialKeyLifecycleVersionStatus;
  activatedAt: string;
  retiredAt: string | null;
  rotationCandidate: boolean;
  requiresHumanApproval: true;
  referenceOnly: true;
  containsKeyMaterial: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialRotationPolicyModel = Readonly<{
  rotationPolicyId: string;
  rotationPolicyKind: SocialCredentialRotationPolicyKind;
  algorithm: SocialCredentialCipherAlgorithm;
  selectionStrategy: SocialCredentialPolicySelectionStrategy;
  maxActiveKeyReferencesPerScope: number;
  rotationOnKeyVersionRetired: true;
  requiresHumanApproval: true;
  allowsAutomaticRotation: false;
  referenceOnly: true;
  containsKeyMaterial: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialCryptoPolicyDomainCapabilities = Readonly<{
  supportedAlgorithms: readonly SocialCredentialCipherAlgorithm[];
  supportedEnvelopeVersions: readonly SocialCredentialEnvelopeFormatVersion[];
  supportedKeyReferenceKinds: readonly SocialCredentialKeyReferenceKind[];
  supportedLifecyclePhases: readonly SocialCredentialKeyLifecyclePhase[];
  supportedRotationPolicyKinds: readonly SocialCredentialRotationPolicyKind[];
  supportedSelectionStrategies: readonly SocialCredentialPolicySelectionStrategy[];
  supportedProviders: readonly SocialPlatformCredentialProvider[];
  capabilityFlags: readonly SocialCredentialCryptoPolicyCapabilityFlag[];
  requiresHumanApproval: true;
  allowsEncryption: false;
  allowsDecryption: false;
  allowsKeyMaterial: false;
  allowsRotationExecution: false;
  allowsProviderExecution: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialCryptoPolicyDomainSafetyRequirements = Readonly<{
  contractOnly: true;
  architectureOnly: true;
  referencesOnly: true;
  requiresHumanApproval: true;
  usesNoNodeCrypto: true;
  usesNoWebCrypto: true;
  usesNoNetwork: true;
  usesNoOAuth: true;
  usesNoCredentials: true;
  storesNoSecrets: true;
  storesNoKeyMaterial: true;
  storesNoPlaintext: true;
  storesNoCiphertext: true;
  selectsNoLiveProvider: true;
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

export type SocialCredentialCryptoPolicyDomainIdentity = Readonly<{
  policyId: string;
  policyDomainVersion: typeof SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_VERSION;
  encryptionDomainVersion: typeof SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION;
  credentialDomainVersion: typeof SOCIAL_CREDENTIAL_DOMAIN_VERSION;
  credentialBoundaryVersion: typeof SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION;
  displayName: string;
  layer: "cryptographic_policy_domain";
  contractOnly: true;
  implementsNothing: true;
  requiresHumanApproval: true;
  containsKeyMaterial: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialCryptoPolicyDomainContract = Readonly<{
  identity: SocialCredentialCryptoPolicyDomainIdentity;
  capabilities: SocialCredentialCryptoPolicyDomainCapabilities;
  safety: SocialCredentialCryptoPolicyDomainSafetyRequirements;
  defaultAlgorithmCapability: SocialCredentialCryptographicAlgorithmCapability;
  defaultRotationPolicy: SocialCredentialRotationPolicyModel;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

const LIFECYCLE_PHASE_SET = new Set<string>(SOCIAL_CREDENTIAL_KEY_LIFECYCLE_PHASES);
const ROTATION_POLICY_KIND_SET = new Set<string>(SOCIAL_CREDENTIAL_ROTATION_POLICY_KINDS);
const SELECTION_STRATEGY_SET = new Set<string>(SOCIAL_CREDENTIAL_POLICY_SELECTION_STRATEGIES);
const LIFECYCLE_VERSION_STATUS_SET = new Set<string>(
  SOCIAL_CREDENTIAL_KEY_LIFECYCLE_VERSION_STATUSES,
);

const SHARED_CAPABILITY_FLAGS: readonly SocialCredentialCryptoPolicyCapabilityFlag[] = [
  "policy_metadata_only",
  "human_approval_required",
  "provider_selection_reference_only",
  "key_lifecycle_projection_only",
  "rotation_execution_blocked",
  "crypto_implementation_blocked",
  "execution_blocked",
];

const SHARED_SAFETY: SocialCredentialCryptoPolicyDomainSafetyRequirements = {
  contractOnly: true,
  architectureOnly: true,
  referencesOnly: true,
  requiresHumanApproval: true,
  usesNoNodeCrypto: true,
  usesNoWebCrypto: true,
  usesNoNetwork: true,
  usesNoOAuth: true,
  usesNoCredentials: true,
  storesNoSecrets: true,
  storesNoKeyMaterial: true,
  storesNoPlaintext: true,
  storesNoCiphertext: true,
  selectsNoLiveProvider: true,
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

export const SOCIAL_CREDENTIAL_DEFAULT_ALGORITHM_POLICY: SocialCredentialCryptographicAlgorithmCapability =
  deepFreeze({
    algorithm: "aes-256-gcm",
    envelopeFormatVersion: "d13-envelope-v1",
    supportedKeyReferenceKinds: [...SOCIAL_CREDENTIAL_KEY_REFERENCE_KINDS],
    supportedProviderScopes: ["global", ...SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS],
    supportsProviderSelection: true,
    supportsLifecycleTracking: true,
    supportsRotationPolicy: true,
    requiresHumanApproval: true,
    metadataOnly: true,
    implementsEncryption: false,
    implementsDecryption: false,
    containsKeyMaterial: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });

export const SOCIAL_CREDENTIAL_DEFAULT_ROTATION_POLICY: SocialCredentialRotationPolicyModel =
  deepFreeze({
    rotationPolicyId: "credential-key-version-retirement-policy",
    rotationPolicyKind: "key_version_retirement",
    algorithm: "aes-256-gcm",
    selectionStrategy: "provider_scope_match",
    maxActiveKeyReferencesPerScope: 1,
    rotationOnKeyVersionRetired: true,
    requiresHumanApproval: true,
    allowsAutomaticRotation: false,
    referenceOnly: true,
    containsKeyMaterial: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });

export const SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_CONTRACT: SocialCredentialCryptoPolicyDomainContract =
  deepFreeze({
    identity: {
      policyId: "credential-cryptographic-policy-domain-contract",
      policyDomainVersion: SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_VERSION,
      encryptionDomainVersion: SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION,
      credentialDomainVersion: SOCIAL_CREDENTIAL_DOMAIN_VERSION,
      credentialBoundaryVersion: SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
      displayName: "D13 cryptographic policy and lifecycle domain contract",
      layer: "cryptographic_policy_domain",
      contractOnly: true,
      implementsNothing: true,
      requiresHumanApproval: true,
      containsKeyMaterial: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    capabilities: {
      supportedAlgorithms: [...SOCIAL_CREDENTIAL_CIPHER_ALGORITHMS],
      supportedEnvelopeVersions: [...SOCIAL_CREDENTIAL_ENVELOPE_FORMAT_VERSIONS],
      supportedKeyReferenceKinds: [...SOCIAL_CREDENTIAL_KEY_REFERENCE_KINDS],
      supportedLifecyclePhases: [...SOCIAL_CREDENTIAL_KEY_LIFECYCLE_PHASES],
      supportedRotationPolicyKinds: [...SOCIAL_CREDENTIAL_ROTATION_POLICY_KINDS],
      supportedSelectionStrategies: [...SOCIAL_CREDENTIAL_POLICY_SELECTION_STRATEGIES],
      supportedProviders: [...SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS],
      capabilityFlags: SHARED_CAPABILITY_FLAGS,
      requiresHumanApproval: true,
      allowsEncryption: false,
      allowsDecryption: false,
      allowsKeyMaterial: false,
      allowsRotationExecution: false,
      allowsProviderExecution: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    safety: SHARED_SAFETY,
    defaultAlgorithmCapability: SOCIAL_CREDENTIAL_DEFAULT_ALGORITHM_POLICY,
    defaultRotationPolicy: SOCIAL_CREDENTIAL_DEFAULT_ROTATION_POLICY,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });

export function isSocialCredentialPolicySelectionStrategy(
  value: unknown,
): value is SocialCredentialPolicySelectionStrategy {
  return typeof value === "string" && SELECTION_STRATEGY_SET.has(value);
}

export function isSocialCredentialKeyLifecyclePhase(
  value: unknown,
): value is SocialCredentialKeyLifecyclePhase {
  return typeof value === "string" && LIFECYCLE_PHASE_SET.has(value);
}

export function isSocialCredentialRotationPolicyKind(
  value: unknown,
): value is SocialCredentialRotationPolicyKind {
  return typeof value === "string" && ROTATION_POLICY_KIND_SET.has(value);
}

export function isSocialCredentialKeyLifecycleVersionStatus(
  value: unknown,
): value is SocialCredentialKeyLifecycleVersionStatus {
  return typeof value === "string" && LIFECYCLE_VERSION_STATUS_SET.has(value);
}

export function validateSocialCredentialCryptographicAlgorithmCapability(
  capability: unknown,
  path = "algorithmCapability",
): SocialCredentialCryptoPolicyValidationResult {
  const diagnostics: SocialCredentialCryptoPolicyDiagnostic[] = [];
  if (!isRecord(capability)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", path, "Algorithm capability must be an object."),
      ],
    };
  }

  if (!isSocialCredentialCipherAlgorithm(capability.algorithm)) {
    diagnostics.push(errorDiagnostic("algorithm_unknown", `${path}.algorithm`, "Cryptographic policy algorithm is not supported."));
  }
  if (!isSocialCredentialEnvelopeFormatVersion(capability.envelopeFormatVersion)) {
    diagnostics.push(errorDiagnostic(
      "envelope_version_unknown",
      `${path}.envelopeFormatVersion`,
      "Cryptographic policy envelope version is not supported.",
    ));
  }

  validateKnownArray(
    capability.supportedKeyReferenceKinds,
    `${path}.supportedKeyReferenceKinds`,
    isSocialCredentialKeyReferenceKind,
    "key_reference_kind_unknown",
    diagnostics,
  );
  validateKnownArray(
    capability.supportedProviderScopes,
    `${path}.supportedProviderScopes`,
    isProviderScope,
    "provider_unknown",
    diagnostics,
  );

  const requiredTrue = [
    "supportsProviderSelection",
    "supportsLifecycleTracking",
    "supportsRotationPolicy",
    "requiresHumanApproval",
    "metadataOnly",
    "executesNothing",
    "publishesNothing",
  ] as const;
  const requiredFalse = [
    "implementsEncryption",
    "implementsDecryption",
    "containsKeyMaterial",
    "grantsExecutionPermission",
  ] as const;
  validateBooleanInvariants(capability, path, requiredTrue, true, "capabilities_invalid", diagnostics);
  validateBooleanInvariants(capability, path, requiredFalse, false, "capabilities_invalid", diagnostics);
  scanForbiddenPolicyState(capability, path, diagnostics);

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialCredentialKeyLifecycleModel(
  lifecycle: unknown,
  path = "keyLifecycle",
): SocialCredentialCryptoPolicyValidationResult {
  const diagnostics: SocialCredentialCryptoPolicyDiagnostic[] = [];
  if (!isRecord(lifecycle)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", path, "Key lifecycle model must be an object."),
      ],
    };
  }

  requireText(lifecycle.lifecycleModelId, `${path}.lifecycleModelId`, "lifecycle_model_id_required", diagnostics);
  requireText(lifecycle.keyReferenceId, `${path}.keyReferenceId`, "key_reference_id_required", diagnostics);
  requireText(lifecycle.keyVersion, `${path}.keyVersion`, "key_version_required", diagnostics);
  requireTimestamp(lifecycle.activatedAt, `${path}.activatedAt`, diagnostics);
  requireNullableTimestamp(lifecycle.retiredAt, `${path}.retiredAt`, diagnostics);

  if (!isProviderScope(lifecycle.providerScope)) {
    diagnostics.push(errorDiagnostic("provider_unknown", `${path}.providerScope`, "Key lifecycle provider scope is not supported."));
  }
  if (!isSocialCredentialKeyLifecyclePhase(lifecycle.lifecyclePhase)) {
    diagnostics.push(errorDiagnostic("lifecycle_phase_unknown", `${path}.lifecyclePhase`, "Key lifecycle phase is not supported."));
  }
  if (!isSocialCredentialKeyReferenceStatus(lifecycle.keyReferenceStatus)) {
    diagnostics.push(errorDiagnostic("key_reference_status_unknown", `${path}.keyReferenceStatus`, "Key reference status is not supported."));
  }
  if (!isSocialCredentialKeyLifecycleVersionStatus(lifecycle.keyVersionStatus)) {
    diagnostics.push(errorDiagnostic("key_version_status_unknown", `${path}.keyVersionStatus`, "Key lifecycle key version status is not supported."));
  }
  if (
    lifecycle.rotationCandidate !==
    (lifecycle.lifecyclePhase === "rotation_due")
  ) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.rotationCandidate`,
      "Rotation candidate must match the rotation_due lifecycle phase.",
    ));
  }

  const requiredTrue = [
    "requiresHumanApproval",
    "referenceOnly",
    "executesNothing",
    "publishesNothing",
  ] as const;
  const requiredFalse = [
    "containsKeyMaterial",
    "grantsExecutionPermission",
  ] as const;
  validateBooleanInvariants(lifecycle, path, requiredTrue, true, "contract_invariant_failed", diagnostics);
  validateBooleanInvariants(lifecycle, path, requiredFalse, false, "contract_invariant_failed", diagnostics);
  scanForbiddenPolicyState(lifecycle, path, diagnostics);

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialCredentialRotationPolicyModel(
  policy: unknown,
  path = "rotationPolicy",
): SocialCredentialCryptoPolicyValidationResult {
  const diagnostics: SocialCredentialCryptoPolicyDiagnostic[] = [];
  if (!isRecord(policy)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", path, "Rotation policy must be an object."),
      ],
    };
  }

  requireText(policy.rotationPolicyId, `${path}.rotationPolicyId`, "rotation_policy_id_required", diagnostics);
  if (!isSocialCredentialRotationPolicyKind(policy.rotationPolicyKind)) {
    diagnostics.push(errorDiagnostic("rotation_policy_kind_unknown", `${path}.rotationPolicyKind`, "Rotation policy kind is not supported."));
  }
  if (!isSocialCredentialCipherAlgorithm(policy.algorithm)) {
    diagnostics.push(errorDiagnostic("algorithm_unknown", `${path}.algorithm`, "Rotation policy algorithm is not supported."));
  }
  if (!isSocialCredentialPolicySelectionStrategy(policy.selectionStrategy)) {
    diagnostics.push(errorDiagnostic("selection_strategy_unknown", `${path}.selectionStrategy`, "Rotation policy selection strategy is not supported."));
  }
  const maxActiveKeyReferencesPerScope = policy.maxActiveKeyReferencesPerScope;
  if (
    typeof maxActiveKeyReferencesPerScope !== "number" ||
    !Number.isInteger(maxActiveKeyReferencesPerScope) ||
    maxActiveKeyReferencesPerScope < 1
  ) {
    diagnostics.push(errorDiagnostic(
      "rotation_limit_invalid",
      `${path}.maxActiveKeyReferencesPerScope`,
      "Rotation policy max active key references per scope must be a positive integer.",
    ));
  }

  const requiredTrue = [
    "rotationOnKeyVersionRetired",
    "requiresHumanApproval",
    "referenceOnly",
    "executesNothing",
    "publishesNothing",
  ] as const;
  const requiredFalse = [
    "allowsAutomaticRotation",
    "containsKeyMaterial",
    "grantsExecutionPermission",
  ] as const;
  validateBooleanInvariants(policy, path, requiredTrue, true, "contract_invariant_failed", diagnostics);
  validateBooleanInvariants(policy, path, requiredFalse, false, "contract_invariant_failed", diagnostics);
  scanForbiddenPolicyState(policy, path, diagnostics);

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialCredentialCryptoPolicyDomainContract(
  contract: unknown,
): SocialCredentialCryptoPolicyValidationResult {
  const diagnostics: SocialCredentialCryptoPolicyDiagnostic[] = [];
  if (!isRecord(contract)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic("serialization_invalid", "contract", "Cryptographic policy domain contract must be an object."),
      ],
    };
  }

  validateIdentity(contract.identity, "contract.identity", diagnostics);
  validateCapabilities(contract.capabilities, "contract.capabilities", diagnostics);
  validateSafety(contract.safety, "contract.safety", diagnostics);

  diagnostics.push(
    ...validateSocialCredentialCryptographicAlgorithmCapability(
      contract.defaultAlgorithmCapability,
      "contract.defaultAlgorithmCapability",
    ).diagnostics,
  );
  diagnostics.push(
    ...validateSocialCredentialRotationPolicyModel(
      contract.defaultRotationPolicy,
      "contract.defaultRotationPolicy",
    ).diagnostics,
  );

  if (contract.grantsExecutionPermission !== false) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      "contract.grantsExecutionPermission",
      "Cryptographic policy domain contract must not grant execution permission.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function serializeSocialCredentialCryptoPolicyDomainContract(
  contract: SocialCredentialCryptoPolicyDomainContract = SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_CONTRACT,
): string {
  return JSON.stringify(toStableValue(contract));
}

export function hydrateSocialCredentialCryptoPolicyDomainContract(
  serialized: string,
): Readonly<{
  ok: true;
  value: SocialCredentialCryptoPolicyDomainContract;
}> | Readonly<{
  ok: false;
  diagnostics: readonly SocialCredentialCryptoPolicyDiagnostic[];
}> {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const validation = validateSocialCredentialCryptoPolicyDomainContract(parsed);
    if (!validation.valid || !isRecord(parsed)) {
      return { ok: false, diagnostics: validation.diagnostics };
    }
    return {
      ok: true,
      value: deepFreeze(parsed as SocialCredentialCryptoPolicyDomainContract),
    };
  } catch {
    return {
      ok: false,
      diagnostics: [
        errorDiagnostic(
          "serialization_invalid",
          "serialized",
          "Cryptographic policy domain contract serialization must be valid JSON.",
        ),
      ],
    };
  }
}

function validateIdentity(
  identity: unknown,
  path: string,
  diagnostics: SocialCredentialCryptoPolicyDiagnostic[],
): void {
  if (!isRecord(identity)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", path, "Cryptographic policy identity must be an object."));
    return;
  }
  requireText(identity.policyId, `${path}.policyId`, "policy_id_required", diagnostics);
  if (identity.policyDomainVersion !== SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_VERSION) {
    diagnostics.push(errorDiagnostic(
      "contract_invariant_failed",
      `${path}.policyDomainVersion`,
      "Cryptographic policy domain version must match the current contract version.",
    ));
  }
  const requiredTrue = [
    "contractOnly",
    "implementsNothing",
    "requiresHumanApproval",
    "executesNothing",
    "publishesNothing",
  ] as const;
  const requiredFalse = [
    "containsKeyMaterial",
    "grantsExecutionPermission",
  ] as const;
  validateBooleanInvariants(identity, path, requiredTrue, true, "contract_invariant_failed", diagnostics);
  validateBooleanInvariants(identity, path, requiredFalse, false, "contract_invariant_failed", diagnostics);
}

function validateCapabilities(
  capabilities: unknown,
  path: string,
  diagnostics: SocialCredentialCryptoPolicyDiagnostic[],
): void {
  if (!isRecord(capabilities)) {
    diagnostics.push(errorDiagnostic("capabilities_invalid", path, "Cryptographic policy capabilities must be an object."));
    return;
  }

  validateKnownArray(
    capabilities.supportedAlgorithms,
    `${path}.supportedAlgorithms`,
    isSocialCredentialCipherAlgorithm,
    "algorithm_unknown",
    diagnostics,
  );
  validateKnownArray(
    capabilities.supportedEnvelopeVersions,
    `${path}.supportedEnvelopeVersions`,
    isSocialCredentialEnvelopeFormatVersion,
    "envelope_version_unknown",
    diagnostics,
  );
  validateKnownArray(
    capabilities.supportedKeyReferenceKinds,
    `${path}.supportedKeyReferenceKinds`,
    isSocialCredentialKeyReferenceKind,
    "key_reference_kind_unknown",
    diagnostics,
  );
  validateKnownArray(
    capabilities.supportedLifecyclePhases,
    `${path}.supportedLifecyclePhases`,
    isSocialCredentialKeyLifecyclePhase,
    "lifecycle_phase_unknown",
    diagnostics,
  );
  validateKnownArray(
    capabilities.supportedRotationPolicyKinds,
    `${path}.supportedRotationPolicyKinds`,
    isSocialCredentialRotationPolicyKind,
    "rotation_policy_kind_unknown",
    diagnostics,
  );
  validateKnownArray(
    capabilities.supportedSelectionStrategies,
    `${path}.supportedSelectionStrategies`,
    isSocialCredentialPolicySelectionStrategy,
    "selection_strategy_unknown",
    diagnostics,
  );
  validateKnownArray(
    capabilities.supportedProviders,
    `${path}.supportedProviders`,
    isSocialPlatformCredentialProvider,
    "provider_unknown",
    diagnostics,
  );

  const requiredTrue = [
    "requiresHumanApproval",
    "executesNothing",
    "publishesNothing",
  ] as const;
  const requiredFalse = [
    "allowsEncryption",
    "allowsDecryption",
    "allowsKeyMaterial",
    "allowsRotationExecution",
    "allowsProviderExecution",
    "grantsExecutionPermission",
  ] as const;
  validateBooleanInvariants(capabilities, path, requiredTrue, true, "capabilities_invalid", diagnostics);
  validateBooleanInvariants(capabilities, path, requiredFalse, false, "capabilities_invalid", diagnostics);
}

function validateSafety(
  safety: unknown,
  path: string,
  diagnostics: SocialCredentialCryptoPolicyDiagnostic[],
): void {
  if (!isRecord(safety)) {
    diagnostics.push(errorDiagnostic(
      "safety_requirements_invalid",
      path,
      "Cryptographic policy safety requirements must be an object.",
    ));
    return;
  }

  const requiredTrue = [
    "contractOnly",
    "architectureOnly",
    "referencesOnly",
    "requiresHumanApproval",
    "usesNoNodeCrypto",
    "usesNoWebCrypto",
    "usesNoNetwork",
    "usesNoOAuth",
    "usesNoCredentials",
    "storesNoSecrets",
    "storesNoKeyMaterial",
    "storesNoPlaintext",
    "storesNoCiphertext",
    "selectsNoLiveProvider",
    "startsNoWorkers",
    "startsNoTimers",
    "createsNoQueues",
    "exposesNoApiRoutes",
    "mutatesNoSql",
    "mutatesNoStorage",
    "executesNothing",
    "publishesNothing",
  ] as const;
  validateBooleanInvariants(safety, path, requiredTrue, true, "safety_requirements_invalid", diagnostics);
  validateBooleanInvariants(
    safety,
    path,
    ["grantsExecutionPermission"] as const,
    false,
    "safety_requirements_invalid",
    diagnostics,
  );
}

function requireText(
  value: unknown,
  path: string,
  code: SocialCredentialCryptoPolicyErrorCode,
  diagnostics: SocialCredentialCryptoPolicyDiagnostic[],
): void {
  if (typeof value === "string" && value.trim().length > 0) return;
  diagnostics.push(errorDiagnostic(code, path, "Required cryptographic policy text field is missing."));
}

function requireTimestamp(
  value: unknown,
  path: string,
  diagnostics: SocialCredentialCryptoPolicyDiagnostic[],
): void {
  if (typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value))) return;
  diagnostics.push(errorDiagnostic("timestamp_invalid", path, "Cryptographic policy timestamp is invalid."));
}

function requireNullableTimestamp(
  value: unknown,
  path: string,
  diagnostics: SocialCredentialCryptoPolicyDiagnostic[],
): void {
  if (value === null || value === undefined) return;
  requireTimestamp(value, path, diagnostics);
}

function validateKnownArray<T>(
  value: unknown,
  path: string,
  predicate: (item: unknown) => item is T,
  code: SocialCredentialCryptoPolicyErrorCode,
  diagnostics: SocialCredentialCryptoPolicyDiagnostic[],
): void {
  if (!Array.isArray(value)) {
    diagnostics.push(errorDiagnostic("capabilities_invalid", path, "Expected a known-value array for cryptographic policy validation."));
    return;
  }
  for (const [index, item] of value.entries()) {
    if (!predicate(item)) {
      diagnostics.push(errorDiagnostic(code, `${path}.${index}`, "Cryptographic policy array member is not supported."));
    }
  }
}

function validateBooleanInvariants<
  TRecord extends UnknownRecord,
  TKey extends readonly string[],
>(
  record: TRecord,
  path: string,
  keys: TKey,
  expected: boolean,
  code: SocialCredentialCryptoPolicyErrorCode,
  diagnostics: SocialCredentialCryptoPolicyDiagnostic[],
): void {
  for (const key of keys) {
    if (record[key] !== expected) {
      diagnostics.push(errorDiagnostic(code, `${path}.${key}`, "Cryptographic policy invariant failed."));
    }
  }
}

function errorDiagnostic(
  code: SocialCredentialCryptoPolicyErrorCode,
  path: string,
  message: string,
): SocialCredentialCryptoPolicyDiagnostic {
  return { code, path, message, severity: "error" };
}

function isProviderScope(
  value: unknown,
): value is SocialPlatformCredentialProvider | "global" {
  return value === "global" || isSocialPlatformCredentialProvider(value);
}

const FORBIDDEN_POLICY_KEYS = new Set([
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
  "refreshToken",
  "refresh_token",
  "secret",
  "tag",
  "token",
]);

function scanForbiddenPolicyState(
  value: unknown,
  path: string,
  diagnostics: SocialCredentialCryptoPolicyDiagnostic[],
  depth = 0,
): void {
  if (depth > 4 || !isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_POLICY_KEYS.has(key)) {
      diagnostics.push(errorDiagnostic("secret_forbidden", `${path}.${key}`, "Forbidden secret-like field detected in cryptographic policy contract."));
    }
    if (typeof nested === "string" && looksLikeSecretValue(nested)) {
      diagnostics.push(errorDiagnostic("secret_forbidden", `${path}.${key}`, "Forbidden secret-like value detected in cryptographic policy contract."));
    }
    scanForbiddenPolicyState(nested, `${path}.${key}`, diagnostics, depth + 1);
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
