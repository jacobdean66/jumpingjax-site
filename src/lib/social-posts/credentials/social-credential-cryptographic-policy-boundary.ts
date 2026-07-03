import { SOCIAL_CREDENTIAL_DOMAIN_VERSION } from "./social-credential-domain";
import { SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION } from "./social-credential-encryption-boundary";
import {
  SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_CONTRACT,
  SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_VERSION,
  SOCIAL_CREDENTIAL_DEFAULT_ROTATION_POLICY,
  SOCIAL_CREDENTIAL_KEY_LIFECYCLE_PHASES,
  SOCIAL_CREDENTIAL_POLICY_SELECTION_STRATEGIES,
  SOCIAL_CREDENTIAL_ROTATION_POLICY_KINDS,
  type SocialCredentialCryptoPolicyValidationResult,
  type SocialCredentialKeyLifecyclePhase,
  type SocialCredentialPolicySelectionStrategy,
  type SocialCredentialRotationPolicyKind,
  validateSocialCredentialCryptoPolicyDomainContract,
  validateSocialCredentialRotationPolicyModel,
  isSocialCredentialKeyLifecyclePhase,
  isSocialCredentialPolicySelectionStrategy,
  isSocialCredentialRotationPolicyKind,
} from "./social-credential-cryptographic-policy-domain";
import {
  type SocialCredentialCipherAlgorithm,
  isSocialCredentialCipherAlgorithm,
} from "./social-credential-encryption-domain";
import {
  SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
  type SocialPlatformCredentialProvider,
  isSocialPlatformCredentialProvider,
} from "../social-platform-credential-boundary";

export const SOCIAL_CREDENTIAL_CRYPTO_POLICY_BOUNDARY_VERSION = "d13-w5-v1" as const;

export const SOCIAL_CREDENTIAL_CRYPTO_POLICY_PROVIDER_CAPABILITY_FLAGS = [
  "selection_interface_only",
  "lifecycle_projection_only",
  "rotation_projection_only",
  "human_approval_required",
  "live_provider_execution_blocked",
] as const;

export const SOCIAL_CREDENTIAL_CRYPTO_POLICY_BOUNDARY_ERROR_CODES = [
  "provider_contract_invalid",
  "provider_id_required",
  "provider_unknown",
  "algorithm_unsupported",
  "selection_strategy_unsupported",
  "lifecycle_phase_unsupported",
  "rotation_policy_unsupported",
  "selection_request_invalid",
  "selection_decision_invalid",
  "eligible_provider_missing",
  "implementation_forbidden",
  "priority_invalid",
  "capabilities_invalid",
  "safety_requirements_invalid",
  "contract_invariant_failed",
  "serialization_invalid",
] as const;

export type SocialCredentialCryptoPolicyProviderCapabilityFlag =
  (typeof SOCIAL_CREDENTIAL_CRYPTO_POLICY_PROVIDER_CAPABILITY_FLAGS)[number];

export type SocialCredentialCryptoPolicyBoundaryErrorCode =
  (typeof SOCIAL_CREDENTIAL_CRYPTO_POLICY_BOUNDARY_ERROR_CODES)[number];

export type SocialCredentialCryptoPolicyBoundaryDiagnostic = Readonly<{
  code: SocialCredentialCryptoPolicyBoundaryErrorCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning";
}>;

export type SocialCredentialCryptoPolicyBoundaryValidationResult = Readonly<{
  valid: boolean;
  diagnostics: readonly SocialCredentialCryptoPolicyBoundaryDiagnostic[];
}>;

export type SocialCredentialCryptoPolicyProviderCapabilities = Readonly<{
  provider: SocialPlatformCredentialProvider;
  supportedAlgorithms: readonly SocialCredentialCipherAlgorithm[];
  supportedSelectionStrategies: readonly SocialCredentialPolicySelectionStrategy[];
  supportedLifecyclePhases: readonly SocialCredentialKeyLifecyclePhase[];
  supportedRotationPolicyKinds: readonly SocialCredentialRotationPolicyKind[];
  capabilityFlags: readonly SocialCredentialCryptoPolicyProviderCapabilityFlag[];
  selectionPriority: number;
  maxActiveKeyReferencesPerScope: number;
  supportsGlobalKeyReferences: true;
  supportsLifecycleProjection: true;
  supportsRotationPlanning: true;
  requiresHumanApproval: true;
  contractOnly: true;
  selectsReferenceOnly: true;
  implementsNothing: true;
  usesNoNodeCrypto: true;
  usesNoWebCrypto: true;
  usesNoNetwork: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialCryptoPolicyProviderCapabilityContract = Readonly<{
  providerId: string;
  provider: SocialPlatformCredentialProvider;
  policyBoundaryVersion: typeof SOCIAL_CREDENTIAL_CRYPTO_POLICY_BOUNDARY_VERSION;
  policyDomainVersion: typeof SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_VERSION;
  encryptionBoundaryVersion: typeof SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION;
  credentialDomainVersion: typeof SOCIAL_CREDENTIAL_DOMAIN_VERSION;
  credentialBoundaryVersion: typeof SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION;
  capabilities: SocialCredentialCryptoPolicyProviderCapabilities;
  contractOnly: true;
  implementsNothing: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialCryptoPolicyBoundarySafetyRequirements = Readonly<{
  contractOnly: true;
  boundaryOnly: true;
  referencesOnly: true;
  requiresHumanApproval: true;
  implementsNoProviderExecution: true;
  usesNoNodeCrypto: true;
  usesNoWebCrypto: true;
  usesNoNetwork: true;
  storesNoKeyMaterial: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialCryptoPolicyBoundaryContract = Readonly<{
  boundaryId: string;
  boundaryVersion: typeof SOCIAL_CREDENTIAL_CRYPTO_POLICY_BOUNDARY_VERSION;
  policyDomainVersion: typeof SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_VERSION;
  encryptionBoundaryVersion: typeof SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION;
  defaultRotationPolicyId: string;
  supportedSelectionStrategies: readonly SocialCredentialPolicySelectionStrategy[];
  safety: SocialCredentialCryptoPolicyBoundarySafetyRequirements;
  contractOnly: true;
  implementsNothing: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialCryptoPolicyProviderSelectionRequest = Readonly<{
  selectionRequestId: string;
  provider: SocialPlatformCredentialProvider;
  algorithm: SocialCredentialCipherAlgorithm;
  lifecyclePhase: SocialCredentialKeyLifecyclePhase;
  rotationPolicyId: string;
  selectionStrategy: SocialCredentialPolicySelectionStrategy;
  requiresHumanApproval: true;
  contractOnly: true;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialCryptoPolicyProviderSelectionDecision = Readonly<{
  selectionRequestId: string;
  provider: SocialPlatformCredentialProvider;
  algorithm: SocialCredentialCipherAlgorithm;
  lifecyclePhase: SocialCredentialKeyLifecyclePhase;
  rotationPolicyId: string;
  selectionStrategy: SocialCredentialPolicySelectionStrategy;
  selectedProviderId: string;
  matchedCapabilityFlags: readonly SocialCredentialCryptoPolicyProviderCapabilityFlag[];
  rationale: readonly string[];
  requiresHumanApproval: true;
  approvedByHuman: false;
  executionAuthorized: false;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialCryptoPolicySelectionResult<TValue> =
  | Readonly<{ ok: true; value: TValue }>
  | Readonly<{
      ok: false;
      error: Readonly<{
        code: SocialCredentialCryptoPolicyBoundaryErrorCode;
        message: string;
      }>;
    }>;

export type SocialCredentialCryptoPolicyProviderSelector = Readonly<{
  contracts: readonly SocialCredentialCryptoPolicyProviderCapabilityContract[];
  selectProvider(
    request: SocialCredentialCryptoPolicyProviderSelectionRequest,
  ): SocialCredentialCryptoPolicySelectionResult<SocialCredentialCryptoPolicyProviderSelectionDecision>;
}>;

const SHARED_CAPABILITY_FLAGS: readonly SocialCredentialCryptoPolicyProviderCapabilityFlag[] = [
  "selection_interface_only",
  "lifecycle_projection_only",
  "rotation_projection_only",
  "human_approval_required",
  "live_provider_execution_blocked",
];

export const SOCIAL_CREDENTIAL_CRYPTO_POLICY_BOUNDARY_CONTRACT: SocialCredentialCryptoPolicyBoundaryContract =
  deepFreeze({
    boundaryId: "credential-cryptographic-policy-boundary-contract",
    boundaryVersion: SOCIAL_CREDENTIAL_CRYPTO_POLICY_BOUNDARY_VERSION,
    policyDomainVersion: SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_VERSION,
    encryptionBoundaryVersion: SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION,
    defaultRotationPolicyId: SOCIAL_CREDENTIAL_DEFAULT_ROTATION_POLICY.rotationPolicyId,
    supportedSelectionStrategies: [...SOCIAL_CREDENTIAL_POLICY_SELECTION_STRATEGIES],
    safety: {
      contractOnly: true,
      boundaryOnly: true,
      referencesOnly: true,
      requiresHumanApproval: true,
      implementsNoProviderExecution: true,
      usesNoNodeCrypto: true,
      usesNoWebCrypto: true,
      usesNoNetwork: true,
      storesNoKeyMaterial: true,
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

function createProviderCapabilityContract(
  provider: SocialPlatformCredentialProvider,
  selectionPriority: number,
): SocialCredentialCryptoPolicyProviderCapabilityContract {
  return deepFreeze({
    providerId: `${provider}-cryptographic-policy-capability-contract`,
    provider,
    policyBoundaryVersion: SOCIAL_CREDENTIAL_CRYPTO_POLICY_BOUNDARY_VERSION,
    policyDomainVersion: SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_VERSION,
    encryptionBoundaryVersion: SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION,
    credentialDomainVersion: SOCIAL_CREDENTIAL_DOMAIN_VERSION,
    credentialBoundaryVersion: SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
    capabilities: {
      provider,
      supportedAlgorithms: [
        SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_CONTRACT.defaultAlgorithmCapability.algorithm,
      ],
      supportedSelectionStrategies: [...SOCIAL_CREDENTIAL_POLICY_SELECTION_STRATEGIES],
      supportedLifecyclePhases: [...SOCIAL_CREDENTIAL_KEY_LIFECYCLE_PHASES],
      supportedRotationPolicyKinds: [...SOCIAL_CREDENTIAL_ROTATION_POLICY_KINDS],
      capabilityFlags: SHARED_CAPABILITY_FLAGS,
      selectionPriority,
      maxActiveKeyReferencesPerScope: 1,
      supportsGlobalKeyReferences: true,
      supportsLifecycleProjection: true,
      supportsRotationPlanning: true,
      requiresHumanApproval: true,
      contractOnly: true,
      selectsReferenceOnly: true,
      implementsNothing: true,
      usesNoNodeCrypto: true,
      usesNoWebCrypto: true,
      usesNoNetwork: true,
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
}

export const SOCIAL_CREDENTIAL_CRYPTO_POLICY_PROVIDER_CAPABILITY_CONTRACTS = Object.freeze([
  createProviderCapabilityContract("meta", 10),
  createProviderCapabilityContract("tiktok", 20),
  createProviderCapabilityContract("linkedin", 30),
]);

export function validateSocialCredentialCryptoPolicyBoundaryContract(
  contract: unknown,
): SocialCredentialCryptoPolicyBoundaryValidationResult {
  const diagnostics: SocialCredentialCryptoPolicyBoundaryDiagnostic[] = [];
  if (!isRecord(contract)) {
    return {
      valid: false,
      diagnostics: [
        boundaryError("serialization_invalid", "contract", "Cryptographic policy boundary contract must be an object."),
      ],
    };
  }

  if (contract.boundaryVersion !== SOCIAL_CREDENTIAL_CRYPTO_POLICY_BOUNDARY_VERSION) {
    diagnostics.push(boundaryError(
      "contract_invariant_failed",
      "contract.boundaryVersion",
      "Cryptographic policy boundary version is not current.",
    ));
  }
  if (contract.policyDomainVersion !== SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_VERSION) {
    diagnostics.push(boundaryError(
      "contract_invariant_failed",
      "contract.policyDomainVersion",
      "Cryptographic policy domain version is not current.",
    ));
  }

  const domainValidation = validateSocialCredentialCryptoPolicyDomainContract(
    SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_CONTRACT,
  );
  appendDomainDiagnostics(domainValidation, "domain", diagnostics);
  const rotationValidation = validateSocialCredentialRotationPolicyModel(
    SOCIAL_CREDENTIAL_DEFAULT_ROTATION_POLICY,
    "defaultRotationPolicy",
  );
  appendDomainDiagnostics(rotationValidation, "rotationPolicy", diagnostics);

  validateKnownArray(
    contract.supportedSelectionStrategies,
    "contract.supportedSelectionStrategies",
    isSocialCredentialPolicySelectionStrategy,
    "selection_strategy_unsupported",
    diagnostics,
  );

  if (!isRecord(contract.safety)) {
    diagnostics.push(boundaryError(
      "safety_requirements_invalid",
      "contract.safety",
      "Cryptographic policy boundary safety requirements must be an object.",
    ));
  } else {
    validateSafety(contract.safety, "contract.safety", diagnostics);
  }

  if (
    contract.defaultRotationPolicyId !==
    SOCIAL_CREDENTIAL_DEFAULT_ROTATION_POLICY.rotationPolicyId
  ) {
    diagnostics.push(boundaryError(
      "rotation_policy_unsupported",
      "contract.defaultRotationPolicyId",
      "Cryptographic policy boundary must reference the default rotation policy.",
    ));
  }
  if (
    contract.contractOnly !== true ||
    contract.implementsNothing !== true ||
    contract.grantsExecutionPermission !== false
  ) {
    diagnostics.push(boundaryError(
      "contract_invariant_failed",
      "contract",
      "Cryptographic policy boundary contract must remain contract-only and non-executing.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialCredentialCryptoPolicyProviderCapabilityContract(
  contract: unknown,
): SocialCredentialCryptoPolicyBoundaryValidationResult {
  const diagnostics: SocialCredentialCryptoPolicyBoundaryDiagnostic[] = [];
  if (!isRecord(contract)) {
    return {
      valid: false,
      diagnostics: [
        boundaryError("provider_contract_invalid", "contract", "Cryptographic policy provider capability contract must be an object."),
      ],
    };
  }

  requireText(contract.providerId, "contract.providerId", "provider_id_required", diagnostics);
  if (!isSocialPlatformCredentialProvider(contract.provider)) {
    diagnostics.push(boundaryError("provider_unknown", "contract.provider", "Provider capability contract provider is not supported."));
  }
  if (
    contract.policyBoundaryVersion !== SOCIAL_CREDENTIAL_CRYPTO_POLICY_BOUNDARY_VERSION ||
    contract.policyDomainVersion !== SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_VERSION ||
    contract.encryptionBoundaryVersion !== SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION ||
    contract.credentialDomainVersion !== SOCIAL_CREDENTIAL_DOMAIN_VERSION ||
    contract.credentialBoundaryVersion !== SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION
  ) {
    diagnostics.push(boundaryError(
      "provider_contract_invalid",
      "contract",
      "Provider capability contract version fields are invalid.",
    ));
  }

  if (!isRecord(contract.capabilities)) {
    diagnostics.push(boundaryError(
      "capabilities_invalid",
      "contract.capabilities",
      "Provider capability contract capabilities must be an object.",
    ));
  } else {
    validateCapabilities(contract.capabilities, "contract.capabilities", diagnostics);
  }

  if (
    contract.contractOnly !== true ||
    contract.implementsNothing !== true ||
    contract.grantsExecutionPermission !== false
  ) {
    diagnostics.push(boundaryError(
      "contract_invariant_failed",
      "contract",
      "Provider capability contract must remain contract-only and non-executing.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialCredentialCryptoPolicySelectionRequest(
  request: unknown,
): SocialCredentialCryptoPolicyBoundaryValidationResult {
  const diagnostics: SocialCredentialCryptoPolicyBoundaryDiagnostic[] = [];
  if (!isRecord(request)) {
    return {
      valid: false,
      diagnostics: [
        boundaryError("selection_request_invalid", "request", "Provider selection request must be an object."),
      ],
    };
  }

  requireText(request.selectionRequestId, "request.selectionRequestId", "selection_request_invalid", diagnostics);
  requireText(request.rotationPolicyId, "request.rotationPolicyId", "selection_request_invalid", diagnostics);
  if (!isSocialPlatformCredentialProvider(request.provider)) {
    diagnostics.push(boundaryError("provider_unknown", "request.provider", "Provider selection request provider is not supported."));
  }
  if (!isSocialCredentialCipherAlgorithm(request.algorithm)) {
    diagnostics.push(boundaryError("algorithm_unsupported", "request.algorithm", "Provider selection request algorithm is not supported."));
  }
  if (!isSocialCredentialKeyLifecyclePhase(request.lifecyclePhase)) {
    diagnostics.push(boundaryError("lifecycle_phase_unsupported", "request.lifecyclePhase", "Provider selection request lifecycle phase is not supported."));
  }
  if (!isSocialCredentialPolicySelectionStrategy(request.selectionStrategy)) {
    diagnostics.push(boundaryError("selection_strategy_unsupported", "request.selectionStrategy", "Provider selection request selection strategy is not supported."));
  }
  if (
    request.requiresHumanApproval !== true ||
    request.contractOnly !== true ||
    request.grantsExecutionPermission !== false
  ) {
    diagnostics.push(boundaryError(
      "selection_request_invalid",
      "request",
      "Provider selection request must remain contract-only and human-approved.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function validateSocialCredentialCryptoPolicySelectionDecision(
  decision: unknown,
): SocialCredentialCryptoPolicyBoundaryValidationResult {
  const diagnostics: SocialCredentialCryptoPolicyBoundaryDiagnostic[] = [];
  if (!isRecord(decision)) {
    return {
      valid: false,
      diagnostics: [
        boundaryError("selection_decision_invalid", "decision", "Provider selection decision must be an object."),
      ],
    };
  }

  requireText(decision.selectionRequestId, "decision.selectionRequestId", "selection_decision_invalid", diagnostics);
  requireText(decision.rotationPolicyId, "decision.rotationPolicyId", "selection_decision_invalid", diagnostics);
  requireText(decision.selectedProviderId, "decision.selectedProviderId", "selection_decision_invalid", diagnostics);
  if (!isSocialPlatformCredentialProvider(decision.provider)) {
    diagnostics.push(boundaryError("provider_unknown", "decision.provider", "Provider selection decision provider is not supported."));
  }
  if (!isSocialCredentialCipherAlgorithm(decision.algorithm)) {
    diagnostics.push(boundaryError("algorithm_unsupported", "decision.algorithm", "Provider selection decision algorithm is not supported."));
  }
  if (!isSocialCredentialKeyLifecyclePhase(decision.lifecyclePhase)) {
    diagnostics.push(boundaryError("lifecycle_phase_unsupported", "decision.lifecyclePhase", "Provider selection decision lifecycle phase is not supported."));
  }
  if (!isSocialCredentialPolicySelectionStrategy(decision.selectionStrategy)) {
    diagnostics.push(boundaryError("selection_strategy_unsupported", "decision.selectionStrategy", "Provider selection decision selection strategy is not supported."));
  }
  if (
    decision.requiresHumanApproval !== true ||
    decision.approvedByHuman !== false ||
    decision.executionAuthorized !== false ||
    decision.grantsExecutionPermission !== false
  ) {
    diagnostics.push(boundaryError(
      "selection_decision_invalid",
      "decision",
      "Provider selection decision must remain advisory only without execution authority.",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function createContractOnlyCryptographicPolicyProviderSelector(
  contracts: readonly SocialCredentialCryptoPolicyProviderCapabilityContract[] =
    SOCIAL_CREDENTIAL_CRYPTO_POLICY_PROVIDER_CAPABILITY_CONTRACTS,
): SocialCredentialCryptoPolicyProviderSelector {
  const orderedContracts = [...contracts].sort(compareContracts);
  const unavailable = <T>(
    error: Readonly<{
      code: SocialCredentialCryptoPolicyBoundaryErrorCode;
      message: string;
    }>,
  ): SocialCredentialCryptoPolicySelectionResult<T> => ({
    ok: false,
    error,
  });

  return deepFreeze({
    contracts: orderedContracts,
    selectProvider(request) {
      const requestValidation = validateSocialCredentialCryptoPolicySelectionRequest(request);
      if (!requestValidation.valid) {
        return unavailable({
          code: "selection_request_invalid",
          message: "Cryptographic policy provider selection request failed validation.",
        });
      }

      const validContracts = orderedContracts.filter((contract) =>
        validateSocialCredentialCryptoPolicyProviderCapabilityContract(contract).valid
      );
      const eligible = validContracts.filter((contract) =>
        contract.provider === request.provider &&
        contract.capabilities.supportedAlgorithms.includes(request.algorithm) &&
        contract.capabilities.supportedSelectionStrategies.includes(request.selectionStrategy) &&
        contract.capabilities.supportedLifecyclePhases.includes(request.lifecyclePhase) &&
        contract.capabilities.supportedRotationPolicyKinds.includes(
          rotationPolicyKindForRequest(request.rotationPolicyId),
        )
      );

      if (eligible.length === 0) {
        return unavailable({
          code: "eligible_provider_missing",
          message: "No contract-only cryptographic policy provider capability matched the selection request.",
        });
      }

      const selected = eligible.sort(compareContracts)[0];
      const decision: SocialCredentialCryptoPolicyProviderSelectionDecision = deepFreeze({
        selectionRequestId: request.selectionRequestId,
        provider: request.provider,
        algorithm: request.algorithm,
        lifecyclePhase: request.lifecyclePhase,
        rotationPolicyId: request.rotationPolicyId,
        selectionStrategy: request.selectionStrategy,
        selectedProviderId: selected.providerId,
        matchedCapabilityFlags: [...selected.capabilities.capabilityFlags],
        rationale: [
          `provider:${request.provider}`,
          `algorithm:${request.algorithm}`,
          `lifecyclePhase:${request.lifecyclePhase}`,
          `selectionPriority:${selected.capabilities.selectionPriority}`,
        ],
        requiresHumanApproval: true,
        approvedByHuman: false,
        executionAuthorized: false,
        computedOnly: true,
        readOnly: true,
        authoritative: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      });
      const decisionValidation = validateSocialCredentialCryptoPolicySelectionDecision(decision);
      if (!decisionValidation.valid) {
        return unavailable({
          code: "selection_decision_invalid",
          message: "Cryptographic policy selection decision failed validation.",
        });
      }
      return { ok: true, value: decision };
    },
  });
}

function rotationPolicyKindForRequest(
  rotationPolicyId: string,
): SocialCredentialRotationPolicyKind {
  return rotationPolicyId === SOCIAL_CREDENTIAL_DEFAULT_ROTATION_POLICY.rotationPolicyId
    ? SOCIAL_CREDENTIAL_DEFAULT_ROTATION_POLICY.rotationPolicyKind
    : "manual_review";
}

function validateCapabilities(
  capabilities: UnknownRecord,
  path: string,
  diagnostics: SocialCredentialCryptoPolicyBoundaryDiagnostic[],
): void {
  if (!isSocialPlatformCredentialProvider(capabilities.provider)) {
    diagnostics.push(boundaryError("provider_unknown", `${path}.provider`, "Provider capability provider is not supported."));
  }
  validateKnownArray(
    capabilities.supportedAlgorithms,
    `${path}.supportedAlgorithms`,
    isSocialCredentialCipherAlgorithm,
    "algorithm_unsupported",
    diagnostics,
  );
  validateKnownArray(
    capabilities.supportedSelectionStrategies,
    `${path}.supportedSelectionStrategies`,
    isSocialCredentialPolicySelectionStrategy,
    "selection_strategy_unsupported",
    diagnostics,
  );
  validateKnownArray(
    capabilities.supportedLifecyclePhases,
    `${path}.supportedLifecyclePhases`,
    isSocialCredentialKeyLifecyclePhase,
    "lifecycle_phase_unsupported",
    diagnostics,
  );
  validateKnownArray(
    capabilities.supportedRotationPolicyKinds,
    `${path}.supportedRotationPolicyKinds`,
    isSocialCredentialRotationPolicyKind,
    "rotation_policy_unsupported",
    diagnostics,
  );

  const selectionPriority = capabilities.selectionPriority;
  if (
    typeof selectionPriority !== "number" ||
    !Number.isInteger(selectionPriority) ||
    selectionPriority < 1
  ) {
    diagnostics.push(boundaryError(
      "priority_invalid",
      `${path}.selectionPriority`,
      "Selection priority must be a positive integer.",
    ));
  }
  const maxActiveKeyReferencesPerScope =
    capabilities.maxActiveKeyReferencesPerScope;
  if (
    typeof maxActiveKeyReferencesPerScope !== "number" ||
    !Number.isInteger(maxActiveKeyReferencesPerScope) ||
    maxActiveKeyReferencesPerScope < 1
  ) {
    diagnostics.push(boundaryError(
      "capabilities_invalid",
      `${path}.maxActiveKeyReferencesPerScope`,
      "Max active key references per scope must be a positive integer.",
    ));
  }

  const requiredTrue = [
    "supportsGlobalKeyReferences",
    "supportsLifecycleProjection",
    "supportsRotationPlanning",
    "requiresHumanApproval",
    "contractOnly",
    "selectsReferenceOnly",
    "implementsNothing",
    "usesNoNodeCrypto",
    "usesNoWebCrypto",
    "usesNoNetwork",
    "executesNothing",
    "publishesNothing",
  ] as const;
  const requiredFalse = [
    "grantsExecutionPermission",
  ] as const;
  validateBooleanInvariants(capabilities, path, requiredTrue, true, "capabilities_invalid", diagnostics);
  validateBooleanInvariants(capabilities, path, requiredFalse, false, "capabilities_invalid", diagnostics);
}

function validateSafety(
  safety: UnknownRecord,
  path: string,
  diagnostics: SocialCredentialCryptoPolicyBoundaryDiagnostic[],
): void {
  const requiredTrue = [
    "contractOnly",
    "boundaryOnly",
    "referencesOnly",
    "requiresHumanApproval",
    "implementsNoProviderExecution",
    "usesNoNodeCrypto",
    "usesNoWebCrypto",
    "usesNoNetwork",
    "storesNoKeyMaterial",
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

function validateKnownArray<T>(
  value: unknown,
  path: string,
  predicate: (candidate: unknown) => candidate is T,
  code: SocialCredentialCryptoPolicyBoundaryErrorCode,
  diagnostics: SocialCredentialCryptoPolicyBoundaryDiagnostic[],
): void {
  if (!Array.isArray(value)) {
    diagnostics.push(boundaryError("capabilities_invalid", path, "Expected an array for cryptographic policy boundary validation."));
    return;
  }
  for (const [index, item] of value.entries()) {
    if (!predicate(item)) {
      diagnostics.push(boundaryError(code, `${path}.${index}`, "Cryptographic policy boundary array member is not supported."));
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
  code: SocialCredentialCryptoPolicyBoundaryErrorCode,
  diagnostics: SocialCredentialCryptoPolicyBoundaryDiagnostic[],
): void {
  for (const key of keys) {
    if (record[key] !== expected) {
      diagnostics.push(boundaryError(code, `${path}.${key}`, "Cryptographic policy boundary invariant failed."));
    }
  }
}

function appendDomainDiagnostics(
  validation: SocialCredentialCryptoPolicyValidationResult,
  prefix: string,
  diagnostics: SocialCredentialCryptoPolicyBoundaryDiagnostic[],
): void {
  for (const diagnostic of validation.diagnostics) {
    diagnostics.push(boundaryError(
      "provider_contract_invalid",
      `${prefix}.${diagnostic.path}`,
      diagnostic.message,
    ));
  }
}

function requireText(
  value: unknown,
  path: string,
  code: SocialCredentialCryptoPolicyBoundaryErrorCode,
  diagnostics: SocialCredentialCryptoPolicyBoundaryDiagnostic[],
): void {
  if (typeof value === "string" && value.trim().length > 0) return;
  diagnostics.push(boundaryError(code, path, "Required cryptographic policy boundary text field is missing."));
}

function boundaryError(
  code: SocialCredentialCryptoPolicyBoundaryErrorCode,
  path: string,
  message: string,
): SocialCredentialCryptoPolicyBoundaryDiagnostic {
  return { code, path, message, severity: "error" };
}

function compareContracts(
  left: SocialCredentialCryptoPolicyProviderCapabilityContract,
  right: SocialCredentialCryptoPolicyProviderCapabilityContract,
): number {
  if (left.capabilities.selectionPriority !== right.capabilities.selectionPriority) {
    return left.capabilities.selectionPriority - right.capabilities.selectionPriority;
  }
  return left.providerId.localeCompare(right.providerId);
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
