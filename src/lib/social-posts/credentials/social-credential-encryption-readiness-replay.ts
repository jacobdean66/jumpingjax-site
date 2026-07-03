import {
  SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION,
  SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_CONTRACT,
  validateSocialCredentialEncryptionDomainContract,
  validateSocialCredentialEncryptionKeyReference,
  type SocialCredentialEncryptionKeyReference,
} from "./social-credential-encryption-domain";
import {
  SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION,
  SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_CONTRACT,
  validateSocialCredentialEncryptionBoundaryContract,
  validateSocialCredentialEncryptionProviderContract,
  type SocialCredentialEncryptionProviderContract,
} from "./social-credential-encryption-boundary";
import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
  type SocialCredentialPersistenceModel,
} from "./social-credential-repository";
import {
  SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS,
  type SocialPlatformCredentialProvider,
} from "../social-platform-credential-boundary";

export const SOCIAL_CREDENTIAL_ENCRYPTION_READINESS_REPLAY_VERSION = "d13-w4-v1" as const;

export const SOCIAL_CREDENTIAL_ENCRYPTION_READINESS_DIAGNOSTIC_CODES = [
  "encryption_domain_contract_valid",
  "encryption_domain_contract_invalid",
  "encryption_boundary_contract_valid",
  "encryption_boundary_contract_invalid",
  "encryption_provider_missing",
  "encryption_provider_contract_invalid",
  "active_key_reference_missing",
  "master_key_reference_missing",
  "key_version_reference_mismatch",
  "vault_key_version_unregistered",
  "encryption_readiness_ready",
  "encryption_readiness_blocked",
  "validation_summary_computed",
] as const;

export type SocialCredentialEncryptionReadinessDiagnosticCode =
  (typeof SOCIAL_CREDENTIAL_ENCRYPTION_READINESS_DIAGNOSTIC_CODES)[number];

export type SocialCredentialEncryptionReadinessDiagnostic = Readonly<{
  code: SocialCredentialEncryptionReadinessDiagnosticCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning" | "info";
  referenceId: string | null;
}>;

export type SocialCredentialEncryptionProviderReadinessProjection = Readonly<{
  provider: SocialPlatformCredentialProvider;
  registeredKeyReferenceCount: number;
  activeKeyReferenceCount: number;
  vaultRecordCount: number;
  vaultRecordsWithKeyVersion: number;
  missingKeyReferences: readonly string[];
  encryptionReady: boolean;
  encryptionBlocked: boolean;
  blockingReasons: readonly string[];
  encryptionImplementationBlocked: true;
  decryptionImplementationBlocked: true;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialEncryptionValidationSummary = Readonly<{
  domainContractValid: boolean;
  boundaryContractValid: boolean;
  providerContractValid: boolean;
  activeKeyReferenceCount: number;
  missingKeyReferenceCount: number;
  missingProviderCount: number;
  vaultKeyVersionMismatchCount: number;
  diagnosticCount: number;
  blockCount: number;
  errorCount: number;
  warningCount: number;
  validForReadiness: boolean;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
}>;

export type SocialCredentialEncryptionReadinessSummary = Readonly<{
  replayVersion: typeof SOCIAL_CREDENTIAL_ENCRYPTION_READINESS_REPLAY_VERSION;
  encryptionDomainVersion: typeof SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION;
  encryptionBoundaryVersion: typeof SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION;
  repositoryVersion: typeof SOCIAL_CREDENTIAL_REPOSITORY_VERSION;
  totalProviderCount: number;
  encryptionReadyProviderCount: number;
  encryptionBlockedProviderCount: number;
  missingEncryptionProviderCount: number;
  missingKeyReferenceCount: number;
  encryptionArchitectureReady: boolean;
  encryptionImplementationBlocked: true;
  decryptionImplementationBlocked: true;
  diagnosticCount: number;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialEncryptionReadinessReplayResult = Readonly<{
  ok: true;
  value: Readonly<{
    summary: SocialCredentialEncryptionReadinessSummary;
    providerReadiness: readonly SocialCredentialEncryptionProviderReadinessProjection[];
    validationSummary: SocialCredentialEncryptionValidationSummary;
    missingKeyReferences: readonly string[];
    missingEncryptionProviders: readonly SocialPlatformCredentialProvider[];
    diagnostics: readonly SocialCredentialEncryptionReadinessDiagnostic[];
    computedOnly: true;
    readOnly: true;
    authoritative: false;
    grantsExecutionPermission: false;
    executesNothing: true;
    publishesNothing: true;
  }>;
}>;

export type SocialCredentialEncryptionReadinessReplayInput = Readonly<{
  model?: SocialCredentialPersistenceModel;
  keyReferences?: readonly SocialCredentialEncryptionKeyReference[];
  providerContracts?: readonly SocialCredentialEncryptionProviderContract[];
}>;

const REFERENCE_ENCRYPTION_PROVIDER_CONTRACT = Object.freeze({
  providerId: "reference-envelope-encryption-provider",
  providerKind: "envelope_encryption_provider",
  encryptionBoundaryVersion: SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION,
  encryptionDomainVersion: SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION,
  credentialDomainVersion: SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_CONTRACT.identity.credentialDomainVersion,
  credentialBoundaryVersion: SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_CONTRACT.identity.credentialBoundaryVersion,
  supportedProviders: [...SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS],
  capabilities: Object.freeze({
    providerKind: "envelope_encryption_provider" as const,
    contractOnly: true as const,
    implementsEncryption: false as const,
    implementsDecryption: false as const,
    implementsRotation: false as const,
    usesNoNodeCrypto: true as const,
    usesNoWebCrypto: true as const,
    usesNoNetwork: true as const,
    storesNoKeyMaterial: true as const,
    storesNoCiphertext: true as const,
    storesNoPlaintext: true as const,
    grantsExecutionPermission: false as const,
    executesNothing: true as const,
    publishesNothing: true as const,
  }),
  contractOnly: true as const,
  implementsNothing: true as const,
  grantsExecutionPermission: false as const,
  executesNothing: true as const,
  publishesNothing: true as const,
}) satisfies SocialCredentialEncryptionProviderContract;

export function replaySocialCredentialEncryptionReadiness(
  input: SocialCredentialEncryptionReadinessReplayInput = {},
): SocialCredentialEncryptionReadinessReplayResult {
  const model = input.model ?? EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL;
  const keyReferences = input.keyReferences ?? [];
  const providerContracts = input.providerContracts ?? [REFERENCE_ENCRYPTION_PROVIDER_CONTRACT];
  const diagnostics: SocialCredentialEncryptionReadinessDiagnostic[] = [];

  const domainValidation = validateSocialCredentialEncryptionDomainContract(
    SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_CONTRACT,
  );
  diagnostics.push({
    code: domainValidation.valid
      ? "encryption_domain_contract_valid"
      : "encryption_domain_contract_invalid",
    path: "encryption_domain_contract",
    message: domainValidation.valid
      ? "Encryption domain contract is valid for architecture-only diagnostics."
      : "Encryption domain contract failed validation.",
    severity: domainValidation.valid ? "info" : "error",
    referenceId: null,
  });

  const boundaryValidation = validateSocialCredentialEncryptionBoundaryContract(
    SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_CONTRACT,
  );
  diagnostics.push({
    code: boundaryValidation.valid
      ? "encryption_boundary_contract_valid"
      : "encryption_boundary_contract_invalid",
    path: "encryption_boundary_contract",
    message: boundaryValidation.valid
      ? "Encryption boundary contract is valid for contract-only diagnostics."
      : "Encryption boundary contract failed validation.",
    severity: boundaryValidation.valid ? "info" : "error",
    referenceId: null,
  });

  let providerContractValid = true;
  if (providerContracts.length === 0) {
    providerContractValid = false;
    diagnostics.push({
      code: "encryption_provider_missing",
      path: "encryption_providers",
      message: "No encryption provider contracts are registered for readiness replay.",
      severity: "error",
      referenceId: null,
    });
  }

  for (const [index, contract] of providerContracts.entries()) {
    const validation = validateSocialCredentialEncryptionProviderContract(contract);
    if (!validation.valid) {
      providerContractValid = false;
      diagnostics.push({
        code: "encryption_provider_contract_invalid",
        path: `encryption_providers.${index}`,
        message: `Encryption provider contract ${contract.providerId} failed validation.`,
        severity: "error",
        referenceId: contract.providerId,
      });
    }
  }

  const registeredKeyVersions = new Set(model.key_versions.map((version) => String(version.key_version)));
  const activeKeyReferences = keyReferences.filter((reference) => reference.status === "active");
  const masterKeyReferences = keyReferences.filter((reference) => reference.kind === "master_key_ref");
  const missingKeyReferences: string[] = [];

  if (activeKeyReferences.length === 0) {
    missingKeyReferences.push("active_key_reference:none");
    diagnostics.push({
      code: "active_key_reference_missing",
      path: "encryption_key_references",
      message: "No active encryption key references are registered for readiness replay.",
      severity: "warning",
      referenceId: "active_key_reference:none",
    });
  }

  if (masterKeyReferences.length === 0) {
    missingKeyReferences.push("master_key_reference:none");
    diagnostics.push({
      code: "master_key_reference_missing",
      path: "encryption_key_references",
      message: "No master key reference is registered for envelope encryption architecture.",
      severity: "warning",
      referenceId: "master_key_reference:none",
    });
  }

  for (const reference of keyReferences) {
    const validation = validateSocialCredentialEncryptionKeyReference(reference);
    if (!validation.valid) {
      missingKeyReferences.push(`invalid_key_reference:${reference.keyReferenceId}`);
      diagnostics.push({
        code: "key_version_reference_mismatch",
        path: `encryption_key_references.${reference.keyReferenceId}`,
        message: `Encryption key reference ${reference.keyReferenceId} failed validation.`,
        severity: "error",
        referenceId: reference.keyReferenceId,
      });
      continue;
    }
    if (!registeredKeyVersions.has(reference.keyVersion)) {
      missingKeyReferences.push(`key_version:${reference.keyVersion}`);
      diagnostics.push({
        code: "vault_key_version_unregistered",
        path: `encryption_key_references.${reference.keyReferenceId}`,
        message: `Encryption key reference ${reference.keyReferenceId} references unregistered key version ${reference.keyVersion}.`,
        severity: "warning",
        referenceId: reference.keyVersion,
      });
    }
  }

  const providerReadiness = SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS.map((provider) =>
    buildProviderEncryptionReadiness(provider, model, keyReferences, missingKeyReferences),
  );

  const missingEncryptionProviders = providerReadiness
    .filter((projection) => projection.encryptionBlocked)
    .map((projection) => projection.provider);

  const encryptionArchitectureReady =
    domainValidation.valid &&
    boundaryValidation.valid &&
    providerContractValid &&
    providerContracts.length > 0 &&
    activeKeyReferences.length > 0 &&
    masterKeyReferences.length > 0 &&
    missingKeyReferences.filter((reference) => reference.startsWith("invalid_key_reference:")).length === 0;

  diagnostics.push({
    code: encryptionArchitectureReady
      ? "encryption_readiness_ready"
      : "encryption_readiness_blocked",
    path: "encryption_readiness",
    message: encryptionArchitectureReady
      ? "Encryption architecture boundary is ready; implementation remains blocked."
      : "Encryption architecture readiness is blocked by contract or reference diagnostics.",
    severity: encryptionArchitectureReady ? "info" : "warning",
    referenceId: null,
  });

  const validationSummary = buildValidationSummary(
    domainValidation.valid,
    boundaryValidation.valid,
    providerContractValid,
    activeKeyReferences.length,
    missingKeyReferences,
    missingEncryptionProviders.length,
    model,
    diagnostics,
  );

  diagnostics.push({
    code: "validation_summary_computed",
    path: "encryption_validation_summary",
    message: `Encryption validation summary computed with ${validationSummary.diagnosticCount} diagnostic(s).`,
    severity: "info",
    referenceId: null,
  });

  const summary: SocialCredentialEncryptionReadinessSummary = Object.freeze({
    replayVersion: SOCIAL_CREDENTIAL_ENCRYPTION_READINESS_REPLAY_VERSION,
    encryptionDomainVersion: SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION,
    encryptionBoundaryVersion: SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION,
    repositoryVersion: SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
    totalProviderCount: SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS.length,
    encryptionReadyProviderCount: providerReadiness.filter((projection) => projection.encryptionReady).length,
    encryptionBlockedProviderCount: providerReadiness.filter((projection) => projection.encryptionBlocked).length,
    missingEncryptionProviderCount: missingEncryptionProviders.length,
    missingKeyReferenceCount: missingKeyReferences.length,
    encryptionArchitectureReady,
    encryptionImplementationBlocked: true,
    decryptionImplementationBlocked: true,
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
      providerReadiness: Object.freeze(providerReadiness),
      validationSummary,
      missingKeyReferences: Object.freeze([...new Set(missingKeyReferences)].sort()),
      missingEncryptionProviders: Object.freeze(missingEncryptionProviders),
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

function buildProviderEncryptionReadiness(
  provider: SocialPlatformCredentialProvider,
  model: SocialCredentialPersistenceModel,
  keyReferences: readonly SocialCredentialEncryptionKeyReference[],
  globalMissingKeyReferences: readonly string[],
): SocialCredentialEncryptionProviderReadinessProjection {
  const providerKeyReferences = keyReferences.filter(
    (reference) => reference.providerScope === provider || reference.providerScope === "global",
  );
  const vaultRecords = model.vault_records.filter((record) => record.provider === provider);
  const vaultRecordsWithKeyVersion = vaultRecords.filter((record) =>
    model.key_versions.some((version) => String(version.key_version) === record.key_version),
  ).length;

  const missingKeyReferences = [
    ...globalMissingKeyReferences,
    ...vaultRecords
      .filter((record) => !model.key_versions.some((version) => String(version.key_version) === record.key_version))
      .map((record) => `vault_key_version:${record.key_version}`),
  ];

  const blockingReasons: string[] = [];
  if (providerKeyReferences.length === 0) {
    blockingReasons.push("no_provider_key_references");
  }
  if (vaultRecords.length > 0 && vaultRecordsWithKeyVersion < vaultRecords.length) {
    blockingReasons.push("vault_key_version_unregistered");
  }

  const encryptionReady =
    providerKeyReferences.some((reference) => reference.status === "active") &&
    blockingReasons.length === 0;

  return Object.freeze({
    provider,
    registeredKeyReferenceCount: providerKeyReferences.length,
    activeKeyReferenceCount: providerKeyReferences.filter((reference) => reference.status === "active").length,
    vaultRecordCount: vaultRecords.length,
    vaultRecordsWithKeyVersion,
    missingKeyReferences: Object.freeze([...new Set(missingKeyReferences)].sort()),
    encryptionReady,
    encryptionBlocked: !encryptionReady,
    blockingReasons: Object.freeze(blockingReasons),
    encryptionImplementationBlocked: true,
    decryptionImplementationBlocked: true,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
}

function buildValidationSummary(
  domainContractValid: boolean,
  boundaryContractValid: boolean,
  providerContractValid: boolean,
  activeKeyReferenceCount: number,
  missingKeyReferences: readonly string[],
  missingProviderCount: number,
  model: SocialCredentialPersistenceModel,
  diagnostics: readonly SocialCredentialEncryptionReadinessDiagnostic[],
): SocialCredentialEncryptionValidationSummary {
  const vaultKeyVersionMismatchCount = model.vault_records.filter(
    (record) => !model.key_versions.some((version) => String(version.key_version) === record.key_version),
  ).length;

  const blockCount = diagnostics.filter((diagnostic) => diagnostic.severity === "block").length;
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;

  return Object.freeze({
    domainContractValid,
    boundaryContractValid,
    providerContractValid,
    activeKeyReferenceCount,
    missingKeyReferenceCount: missingKeyReferences.length,
    missingProviderCount,
    vaultKeyVersionMismatchCount,
    diagnosticCount: diagnostics.length,
    blockCount,
    errorCount,
    warningCount,
    validForReadiness:
      domainContractValid &&
      boundaryContractValid &&
      providerContractValid &&
      errorCount === 0,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
  });
}
