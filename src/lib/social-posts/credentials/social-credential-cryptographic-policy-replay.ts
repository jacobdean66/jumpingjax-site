import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
  type SocialCredentialPersistenceModel,
} from "./social-credential-repository";
import {
  SOCIAL_CREDENTIAL_DEFAULT_ROTATION_POLICY,
  SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_CONTRACT,
  SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_VERSION,
  type SocialCredentialKeyLifecycleModel,
  type SocialCredentialRotationPolicyModel,
  validateSocialCredentialCryptoPolicyDomainContract,
  validateSocialCredentialKeyLifecycleModel,
  validateSocialCredentialRotationPolicyModel,
} from "./social-credential-cryptographic-policy-domain";
import {
  SOCIAL_CREDENTIAL_CRYPTO_POLICY_BOUNDARY_CONTRACT,
  SOCIAL_CREDENTIAL_CRYPTO_POLICY_BOUNDARY_VERSION,
  SOCIAL_CREDENTIAL_CRYPTO_POLICY_PROVIDER_CAPABILITY_CONTRACTS,
  createContractOnlyCryptographicPolicyProviderSelector,
  type SocialCredentialCryptoPolicyProviderCapabilityContract,
  validateSocialCredentialCryptoPolicyBoundaryContract,
  validateSocialCredentialCryptoPolicyProviderCapabilityContract,
} from "./social-credential-cryptographic-policy-boundary";
import {
  type SocialCredentialEncryptionKeyReference,
  validateSocialCredentialEncryptionKeyReference,
} from "./social-credential-encryption-domain";
import {
  SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS,
  type SocialPlatformCredentialProvider,
} from "../social-platform-credential-boundary";

export const SOCIAL_CREDENTIAL_CRYPTO_POLICY_REPLAY_VERSION = "d13-w5-v1" as const;

export const SOCIAL_CREDENTIAL_CRYPTO_POLICY_REPLAY_DIAGNOSTIC_CODES = [
  "policy_domain_contract_valid",
  "policy_domain_contract_invalid",
  "policy_boundary_contract_valid",
  "policy_boundary_contract_invalid",
  "rotation_policy_valid",
  "rotation_policy_invalid",
  "provider_capability_contract_invalid",
  "provider_selection_ready",
  "provider_selection_blocked",
  "key_lifecycle_invalid",
  "rotation_due_key_reference",
  "human_approval_required",
  "policy_architecture_ready",
  "policy_architecture_blocked",
  "validation_summary_computed",
] as const;

export type SocialCredentialCryptoPolicyReplayDiagnosticCode =
  (typeof SOCIAL_CREDENTIAL_CRYPTO_POLICY_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialCredentialCryptoPolicyReplayDiagnostic = Readonly<{
  code: SocialCredentialCryptoPolicyReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning" | "info";
  referenceId: string | null;
}>;

export type SocialCredentialCryptoPolicyProviderSelectionProjection = Readonly<{
  provider: SocialPlatformCredentialProvider;
  selectedProviderId: string | null;
  lifecyclePhase: SocialCredentialKeyLifecycleModel["lifecyclePhase"] | null;
  activeKeyReferenceCount: number;
  rotationDueKeyReferenceCount: number;
  selectionReady: boolean;
  humanApprovalRequired: true;
  matchedCapabilityFlags: readonly string[];
  rationale: readonly string[];
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialCryptoPolicyReplaySummary = Readonly<{
  replayVersion: typeof SOCIAL_CREDENTIAL_CRYPTO_POLICY_REPLAY_VERSION;
  policyDomainVersion: typeof SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_VERSION;
  policyBoundaryVersion: typeof SOCIAL_CREDENTIAL_CRYPTO_POLICY_BOUNDARY_VERSION;
  repositoryVersion: typeof SOCIAL_CREDENTIAL_REPOSITORY_VERSION;
  totalProviderCount: number;
  validProviderCapabilityContractCount: number;
  selectionReadyProviderCount: number;
  selectionBlockedProviderCount: number;
  totalLifecycleModelCount: number;
  rotationDueKeyReferenceCount: number;
  humanApprovalRequiredProviderCount: number;
  policyArchitectureReady: boolean;
  diagnosticCount: number;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialCryptoPolicyReplayValidationSummary = Readonly<{
  domainContractValid: boolean;
  boundaryContractValid: boolean;
  rotationPolicyValid: boolean;
  providerContractValid: boolean;
  lifecycleModelCount: number;
  invalidLifecycleModelCount: number;
  selectionReadyCount: number;
  selectionBlockedCount: number;
  diagnosticCount: number;
  blockCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  validForPolicyArchitecture: boolean;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
}>;

export type SocialCredentialCryptoPolicyReplayResult = Readonly<{
  ok: true;
  value: Readonly<{
    summary: SocialCredentialCryptoPolicyReplaySummary;
    validationSummary: SocialCredentialCryptoPolicyReplayValidationSummary;
    lifecycleModels: readonly SocialCredentialKeyLifecycleModel[];
    providerSelections: readonly SocialCredentialCryptoPolicyProviderSelectionProjection[];
    rotationDueKeyReferenceIds: readonly string[];
    diagnostics: readonly SocialCredentialCryptoPolicyReplayDiagnostic[];
    computedOnly: true;
    readOnly: true;
    authoritative: false;
    grantsExecutionPermission: false;
    executesNothing: true;
    publishesNothing: true;
  }>;
}>;

export type SocialCredentialCryptoPolicyReplayInput = Readonly<{
  model?: SocialCredentialPersistenceModel;
  keyReferences?: readonly SocialCredentialEncryptionKeyReference[];
  providerContracts?: readonly SocialCredentialCryptoPolicyProviderCapabilityContract[];
  rotationPolicy?: SocialCredentialRotationPolicyModel;
}>;

export function replaySocialCredentialCryptographicPolicy(
  input: SocialCredentialCryptoPolicyReplayInput = {},
): SocialCredentialCryptoPolicyReplayResult {
  const model = input.model ?? EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL;
  const keyReferences = input.keyReferences ?? [];
  const providerContracts =
    input.providerContracts ?? SOCIAL_CREDENTIAL_CRYPTO_POLICY_PROVIDER_CAPABILITY_CONTRACTS;
  const rotationPolicy = input.rotationPolicy ?? SOCIAL_CREDENTIAL_DEFAULT_ROTATION_POLICY;
  const diagnostics: SocialCredentialCryptoPolicyReplayDiagnostic[] = [];

  const domainValidation = validateSocialCredentialCryptoPolicyDomainContract(
    SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_CONTRACT,
  );
  diagnostics.push({
    code: domainValidation.valid
      ? "policy_domain_contract_valid"
      : "policy_domain_contract_invalid",
    path: "policy_domain_contract",
    message: domainValidation.valid
      ? "Cryptographic policy domain contract is valid for architecture-only diagnostics."
      : "Cryptographic policy domain contract failed validation.",
    severity: domainValidation.valid ? "info" : "error",
    referenceId: null,
  });

  const boundaryValidation = validateSocialCredentialCryptoPolicyBoundaryContract(
    SOCIAL_CREDENTIAL_CRYPTO_POLICY_BOUNDARY_CONTRACT,
  );
  diagnostics.push({
    code: boundaryValidation.valid
      ? "policy_boundary_contract_valid"
      : "policy_boundary_contract_invalid",
    path: "policy_boundary_contract",
    message: boundaryValidation.valid
      ? "Cryptographic policy boundary contract is valid for deterministic selection diagnostics."
      : "Cryptographic policy boundary contract failed validation.",
    severity: boundaryValidation.valid ? "info" : "error",
    referenceId: null,
  });

  const rotationPolicyValidation = validateSocialCredentialRotationPolicyModel(rotationPolicy);
  diagnostics.push({
    code: rotationPolicyValidation.valid
      ? "rotation_policy_valid"
      : "rotation_policy_invalid",
    path: "rotation_policy",
    message: rotationPolicyValidation.valid
      ? "Rotation policy is valid for reference-only lifecycle diagnostics."
      : "Rotation policy failed validation.",
    severity: rotationPolicyValidation.valid ? "info" : "error",
    referenceId: rotationPolicy.rotationPolicyId,
  });

  let providerContractValid = true;
  let validProviderCapabilityContractCount = 0;
  for (const [index, contract] of providerContracts.entries()) {
    const validation = validateSocialCredentialCryptoPolicyProviderCapabilityContract(contract);
    if (!validation.valid) {
      providerContractValid = false;
      diagnostics.push({
        code: "provider_capability_contract_invalid",
        path: `provider_capability_contracts.${index}`,
        message: `Provider capability contract ${contract.providerId} failed validation.`,
        severity: "error",
        referenceId: contract.providerId,
      });
    } else {
      validProviderCapabilityContractCount += 1;
    }
  }
  if (providerContracts.length === 0) {
    providerContractValid = false;
    diagnostics.push({
      code: "provider_capability_contract_invalid",
      path: "provider_capability_contracts",
      message: "No provider capability contracts were supplied for cryptographic policy replay.",
      severity: "error",
      referenceId: null,
    });
  }

  const lifecycleModels = keyReferences
    .map((reference) => buildLifecycleModel(reference, model))
    .sort((left, right) => left.keyReferenceId.localeCompare(right.keyReferenceId));

  let invalidLifecycleModelCount = 0;
  for (const lifecycleModel of lifecycleModels) {
    const validation = validateSocialCredentialKeyLifecycleModel(lifecycleModel);
    if (!validation.valid) {
      invalidLifecycleModelCount += 1;
      diagnostics.push({
        code: "key_lifecycle_invalid",
        path: `lifecycle_models.${lifecycleModel.keyReferenceId}`,
        message: `Lifecycle model ${lifecycleModel.lifecycleModelId} failed validation.`,
        severity: "error",
        referenceId: lifecycleModel.keyReferenceId,
      });
    }
    if (lifecycleModel.rotationCandidate) {
      diagnostics.push({
        code: "rotation_due_key_reference",
        path: `lifecycle_models.${lifecycleModel.keyReferenceId}`,
        message: `Key reference ${lifecycleModel.keyReferenceId} requires human-reviewed rotation before policy readiness.`,
        severity: "warning",
        referenceId: lifecycleModel.keyReferenceId,
      });
    }
  }

  const selector = createContractOnlyCryptographicPolicyProviderSelector(providerContracts);
  const providerSelections = SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS.map((provider) =>
    buildProviderSelectionProjection(provider, lifecycleModels, selector, rotationPolicy),
  );

  for (const selection of providerSelections) {
    diagnostics.push({
      code: selection.selectionReady
        ? "provider_selection_ready"
        : "provider_selection_blocked",
      path: `provider_selections.${selection.provider}`,
      message: selection.selectionReady
        ? `Deterministic provider selection is ready for ${selection.provider}; human approval remains required.`
        : `Provider selection for ${selection.provider} is blocked by lifecycle or capability diagnostics.`,
      severity: selection.selectionReady ? "info" : "warning",
      referenceId: selection.selectedProviderId,
    });
  }

  diagnostics.push({
    code: "human_approval_required",
    path: "policy_authority",
    message: "Cryptographic policy lifecycle architecture remains advisory only; humans always approve provider selection and rotation actions.",
    severity: "info",
    referenceId: null,
  });

  const policyArchitectureReady =
    domainValidation.valid &&
    boundaryValidation.valid &&
    rotationPolicyValidation.valid &&
    providerContractValid &&
    invalidLifecycleModelCount === 0 &&
    providerSelections.every((selection) => selection.selectionReady);

  diagnostics.push({
    code: policyArchitectureReady
      ? "policy_architecture_ready"
      : "policy_architecture_blocked",
    path: "policy_architecture",
    message: policyArchitectureReady
      ? "Cryptographic policy and lifecycle architecture is ready for human-reviewed usage."
      : "Cryptographic policy and lifecycle architecture is blocked by contract, lifecycle, or selection diagnostics.",
    severity: policyArchitectureReady ? "info" : "warning",
    referenceId: null,
  });

  const validationSummary = buildValidationSummary(
    domainValidation.valid,
    boundaryValidation.valid,
    rotationPolicyValidation.valid,
    providerContractValid,
    lifecycleModels.length,
    invalidLifecycleModelCount,
    providerSelections,
    diagnostics,
  );

  diagnostics.push({
    code: "validation_summary_computed",
    path: "policy_validation_summary",
    message: `Cryptographic policy validation summary computed with ${validationSummary.diagnosticCount} diagnostic(s).`,
    severity: "info",
    referenceId: null,
  });

  const rotationDueKeyReferenceIds = lifecycleModels
    .filter((lifecycleModel) => lifecycleModel.rotationCandidate)
    .map((lifecycleModel) => lifecycleModel.keyReferenceId)
    .sort();

  const summary: SocialCredentialCryptoPolicyReplaySummary = Object.freeze({
    replayVersion: SOCIAL_CREDENTIAL_CRYPTO_POLICY_REPLAY_VERSION,
    policyDomainVersion: SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_VERSION,
    policyBoundaryVersion: SOCIAL_CREDENTIAL_CRYPTO_POLICY_BOUNDARY_VERSION,
    repositoryVersion: SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
    totalProviderCount: SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS.length,
    validProviderCapabilityContractCount,
    selectionReadyProviderCount: providerSelections.filter((selection) => selection.selectionReady).length,
    selectionBlockedProviderCount: providerSelections.filter((selection) => !selection.selectionReady).length,
    totalLifecycleModelCount: lifecycleModels.length,
    rotationDueKeyReferenceCount: rotationDueKeyReferenceIds.length,
    humanApprovalRequiredProviderCount: providerSelections.length,
    policyArchitectureReady,
    diagnosticCount: diagnostics.length,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });

  return {
    ok: true,
    value: Object.freeze({
      summary,
      validationSummary,
      lifecycleModels: Object.freeze(lifecycleModels),
      providerSelections: Object.freeze(providerSelections),
      rotationDueKeyReferenceIds: Object.freeze(rotationDueKeyReferenceIds),
      diagnostics: Object.freeze(diagnostics),
      computedOnly: true,
      readOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    }),
  };
}

function buildLifecycleModel(
  reference: SocialCredentialEncryptionKeyReference,
  model: SocialCredentialPersistenceModel,
): SocialCredentialKeyLifecycleModel {
  const validation = validateSocialCredentialEncryptionKeyReference(reference);
  const keyVersionRecord = model.key_versions.find((version) => version.key_version === reference.keyVersion);
  const keyVersionStatus =
    !validation.valid || !keyVersionRecord
      ? "unregistered"
      : keyVersionRecord.status;
  const lifecyclePhase = deriveLifecyclePhase(reference, keyVersionStatus);

  return Object.freeze({
    lifecycleModelId: `lifecycle-${reference.keyReferenceId}`,
    keyReferenceId: reference.keyReferenceId,
    keyVersion: reference.keyVersion,
    providerScope: reference.providerScope,
    lifecyclePhase,
    keyReferenceStatus: reference.status,
    keyVersionStatus,
    activatedAt: reference.activatedAt,
    retiredAt: reference.retiredAt,
    rotationCandidate: lifecyclePhase === "rotation_due",
    requiresHumanApproval: true,
    referenceOnly: true,
    containsKeyMaterial: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
}

function deriveLifecyclePhase(
  reference: SocialCredentialEncryptionKeyReference,
  keyVersionStatus: SocialCredentialKeyLifecycleModel["keyVersionStatus"],
): SocialCredentialKeyLifecycleModel["lifecyclePhase"] {
  if (reference.status === "retired") return "retired";
  if (reference.status === "registered") return "registered";
  if (keyVersionStatus === "unregistered") return "rotation_due";
  if (reference.status === "active" && keyVersionStatus === "retired") return "rotation_due";
  return "active";
}

function buildProviderSelectionProjection(
  provider: SocialPlatformCredentialProvider,
  lifecycleModels: readonly SocialCredentialKeyLifecycleModel[],
  selector: ReturnType<typeof createContractOnlyCryptographicPolicyProviderSelector>,
  rotationPolicy: SocialCredentialRotationPolicyModel,
): SocialCredentialCryptoPolicyProviderSelectionProjection {
  const scopedModels = lifecycleModels.filter((lifecycleModel) =>
    lifecycleModel.providerScope === provider || lifecycleModel.providerScope === "global"
  );
  const activeCount = scopedModels.filter((lifecycleModel) => lifecycleModel.lifecyclePhase === "active").length;
  const rotationDueCount = scopedModels.filter(
    (lifecycleModel) => lifecycleModel.lifecyclePhase === "rotation_due",
  ).length;
  const lifecyclePhase = pickLifecyclePhase(scopedModels);
  const selectionResult = lifecyclePhase
    ? selector.selectProvider({
        selectionRequestId: `selection-${provider}`,
        provider,
        algorithm: SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_CONTRACT.defaultAlgorithmCapability.algorithm,
        lifecyclePhase,
        rotationPolicyId: rotationPolicy.rotationPolicyId,
        selectionStrategy: rotationPolicy.selectionStrategy,
        requiresHumanApproval: true,
        contractOnly: true,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      })
    : null;

  const blockingReasons: string[] = [];
  if (scopedModels.length === 0) {
    blockingReasons.push("no_key_lifecycle_models");
  }
  if (activeCount === 0 && rotationDueCount === 0) {
    blockingReasons.push("no_active_key_references");
  }
  if (rotationDueCount > 0) {
    blockingReasons.push("rotation_due_human_review");
  }

  let selectedProviderId: string | null = null;
  let rationale: readonly string[] = [];
  let matchedCapabilityFlags: readonly string[] = [];
  if (!selectionResult) {
    blockingReasons.push("selection_phase_unresolved");
  } else if (!selectionResult.ok) {
    blockingReasons.push(selectionResult.error.code);
  } else {
    selectedProviderId = selectionResult.value.selectedProviderId;
    rationale = selectionResult.value.rationale;
    matchedCapabilityFlags = selectionResult.value.matchedCapabilityFlags;
    const maxActiveKeyReferencesPerScope =
      selector.contracts.find((contract) => contract.providerId === selectionResult.value.selectedProviderId)
        ?.capabilities.maxActiveKeyReferencesPerScope ?? 1;
    if (activeCount > maxActiveKeyReferencesPerScope) {
      blockingReasons.push("active_key_reference_limit_exceeded");
    }
  }

  return Object.freeze({
    provider,
    selectedProviderId,
    lifecyclePhase,
    activeKeyReferenceCount: activeCount,
    rotationDueKeyReferenceCount: rotationDueCount,
    selectionReady: selectedProviderId !== null && blockingReasons.length === 0,
    humanApprovalRequired: true,
    matchedCapabilityFlags: Object.freeze([...matchedCapabilityFlags]),
    rationale: Object.freeze([...rationale]),
    blockingReasons: Object.freeze(blockingReasons),
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
}

function pickLifecyclePhase(
  lifecycleModels: readonly SocialCredentialKeyLifecycleModel[],
): SocialCredentialKeyLifecycleModel["lifecyclePhase"] | null {
  if (lifecycleModels.some((lifecycleModel) => lifecycleModel.lifecyclePhase === "rotation_due")) {
    return "rotation_due";
  }
  if (lifecycleModels.some((lifecycleModel) => lifecycleModel.lifecyclePhase === "active")) {
    return "active";
  }
  if (lifecycleModels.some((lifecycleModel) => lifecycleModel.lifecyclePhase === "registered")) {
    return "registered";
  }
  if (lifecycleModels.some((lifecycleModel) => lifecycleModel.lifecyclePhase === "retired")) {
    return "retired";
  }
  return null;
}

function buildValidationSummary(
  domainContractValid: boolean,
  boundaryContractValid: boolean,
  rotationPolicyValid: boolean,
  providerContractValid: boolean,
  lifecycleModelCount: number,
  invalidLifecycleModelCount: number,
  providerSelections: readonly SocialCredentialCryptoPolicyProviderSelectionProjection[],
  diagnostics: readonly SocialCredentialCryptoPolicyReplayDiagnostic[],
): SocialCredentialCryptoPolicyReplayValidationSummary {
  const blockCount = diagnostics.filter((diagnostic) => diagnostic.severity === "block").length;
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
  const infoCount = diagnostics.filter((diagnostic) => diagnostic.severity === "info").length;

  return Object.freeze({
    domainContractValid,
    boundaryContractValid,
    rotationPolicyValid,
    providerContractValid,
    lifecycleModelCount,
    invalidLifecycleModelCount,
    selectionReadyCount: providerSelections.filter((selection) => selection.selectionReady).length,
    selectionBlockedCount: providerSelections.filter((selection) => !selection.selectionReady).length,
    diagnosticCount: diagnostics.length,
    blockCount,
    errorCount,
    warningCount,
    infoCount,
    validForPolicyArchitecture:
      domainContractValid &&
      boundaryContractValid &&
      rotationPolicyValid &&
      providerContractValid &&
      invalidLifecycleModelCount === 0 &&
      providerSelections.every((selection) => selection.selectionReady),
    computedOnly: true,
    readOnly: true,
    authoritative: false,
  });
}
