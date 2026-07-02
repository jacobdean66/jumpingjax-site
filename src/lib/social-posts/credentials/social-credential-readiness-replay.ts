import {
  SOCIAL_CREDENTIAL_DOMAIN_VERSION,
  SOCIAL_CREDENTIAL_DOMAIN_CONTRACT,
  detectSocialCredentialForbiddenStates,
  validateSocialCredentialDomainContract,
  type SocialCredentialLifecycleState,
} from "./social-credential-domain";
import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
  SOCIAL_CREDENTIAL_STORAGE_CONTRACT,
  mapLifecycleStateRecordToDomain,
  mapProviderAccountRecordToReference,
  validateDomainMappingsFromPersistenceModel,
  validateSocialCredentialPersistenceModel,
  type SocialCredentialPersistenceModel,
  type SocialCredentialVaultRecordRow,
} from "./social-credential-repository";
import {
  SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS,
  createSocialPlatformCredentialBoundaryContract,
  platformsForProvider,
  requiredCredentialKindsForProvider,
  type SocialPlatformCredentialKind,
  type SocialPlatformCredentialProvider,
} from "../social-platform-credential-boundary";

export const SOCIAL_CREDENTIAL_READINESS_REPLAY_VERSION = "d13-w1-v1" as const;

export const SOCIAL_CREDENTIAL_READINESS_REPLAY_DIAGNOSTIC_CODES = [
  "persistence_validation_failed",
  "domain_mapping_failed",
  "provider_forbidden_state",
  "missing_provider_account",
  "missing_vault_record",
  "missing_lifecycle_state",
  "missing_key_version",
  "missing_dependency",
] as const;

export type SocialCredentialReadinessReplayDiagnosticCode =
  (typeof SOCIAL_CREDENTIAL_READINESS_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialCredentialReadinessReplayDiagnostic = Readonly<{
  code: SocialCredentialReadinessReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "block" | "error" | "warning";
  referenceId: string | null;
}>;

export type SocialCredentialProviderReadinessProjection = Readonly<{
  provider: SocialPlatformCredentialProvider;
  platforms: readonly string[];
  providerAccountCount: number;
  activeVaultRecordCount: number;
  activeLifecycleCount: number;
  requiredCredentialKinds: readonly SocialPlatformCredentialKind[];
  satisfiedCredentialKinds: readonly SocialPlatformCredentialKind[];
  missingCredentialKinds: readonly SocialPlatformCredentialKind[];
  credentialReady: boolean;
  credentialBlocked: boolean;
  missingDependencies: readonly string[];
  blockingReasons: readonly string[];
  domainVersion: typeof SOCIAL_CREDENTIAL_DOMAIN_VERSION;
  repositoryVersion: typeof SOCIAL_CREDENTIAL_REPOSITORY_VERSION;
  liveCredentialsBlocked: true;
  encryptionBlocked: true;
  persistenceBlocked: true;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialReadinessReadModel = Readonly<{
  replayVersion: typeof SOCIAL_CREDENTIAL_READINESS_REPLAY_VERSION;
  domainVersion: typeof SOCIAL_CREDENTIAL_DOMAIN_VERSION;
  repositoryVersion: typeof SOCIAL_CREDENTIAL_REPOSITORY_VERSION;
  storageContractVersion: typeof SOCIAL_CREDENTIAL_REPOSITORY_VERSION;
  providerReadiness: readonly SocialCredentialProviderReadinessProjection[];
  missingDependencyReport: readonly string[];
  validationSummary: Readonly<{
    domainContractValid: boolean;
    persistenceModelValid: boolean;
    domainMappingValid: boolean;
    allProvidersCredentialReady: boolean;
    providerCount: number;
    readyProviderCount: number;
    blockedProviderCount: number;
    diagnosticCount: number;
    blockCount: number;
    errorCount: number;
    warningCount: number;
  }>;
  diagnostics: readonly SocialCredentialReadinessReplayDiagnostic[];
  summary: Readonly<{
    totalProviderCount: number;
    credentialReadyProviderCount: number;
    credentialBlockedProviderCount: number;
    missingProviderAccountCount: number;
    missingVaultRecordCount: number;
    missingLifecycleStateCount: number;
    missingKeyVersionCount: number;
    diagnosticCount: number;
    computedOnly: true;
    readOnly: true;
    authoritative: false;
    grantsExecutionPermission: false;
    executesNothing: true;
    publishesNothing: true;
  }>;
  replayIntegrity: Readonly<{
    valid: boolean;
    deterministic: true;
    source: "social_credential_readiness_replay";
    computedOnly: true;
    authoritative: false;
  }>;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialReadinessReplayResult = Readonly<{
  ok: true;
  value: SocialCredentialReadinessReadModel;
}>;

export function replaySocialCredentialReadiness(
  model: SocialCredentialPersistenceModel = EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
): SocialCredentialReadinessReplayResult {
  const diagnostics: SocialCredentialReadinessReplayDiagnostic[] = [];
  const missingDependencyReport: string[] = [];

  const domainValidation = validateSocialCredentialDomainContract(SOCIAL_CREDENTIAL_DOMAIN_CONTRACT);
  const persistenceValidation = validateSocialCredentialPersistenceModel(model);
  const mappingValidation = validateDomainMappingsFromPersistenceModel(model);

  if (!persistenceValidation.ok) {
    for (const error of persistenceValidation.errors) {
      diagnostics.push({
        code: "persistence_validation_failed",
        path: error.path,
        message: error.message,
        severity: "error",
        referenceId: null,
      });
    }
  }

  if (!mappingValidation.ok) {
    for (const error of mappingValidation.errors) {
      diagnostics.push({
        code: "domain_mapping_failed",
        path: error.path,
        message: error.message,
        severity: "error",
        referenceId: null,
      });
    }
  }

  const providerReadiness = SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS.map((provider) =>
    projectProviderReadiness(provider, model, diagnostics, missingDependencyReport),
  );

  const readyProviderCount = providerReadiness.filter((item) => item.credentialReady).length;
  const blockedProviderCount = providerReadiness.length - readyProviderCount;

  const blockCount = diagnostics.filter((item) => item.severity === "block").length;
  const errorCount = diagnostics.filter((item) => item.severity === "error").length;
  const warningCount = diagnostics.filter((item) => item.severity === "warning").length;

  const value: SocialCredentialReadinessReadModel = Object.freeze({
    replayVersion: SOCIAL_CREDENTIAL_READINESS_REPLAY_VERSION,
    domainVersion: SOCIAL_CREDENTIAL_DOMAIN_VERSION,
    repositoryVersion: SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
    storageContractVersion: SOCIAL_CREDENTIAL_STORAGE_CONTRACT.contractVersion,
    providerReadiness,
    missingDependencyReport: Object.freeze([...missingDependencyReport]),
    validationSummary: Object.freeze({
      domainContractValid: domainValidation.valid,
      persistenceModelValid: persistenceValidation.ok,
      domainMappingValid: mappingValidation.ok,
      allProvidersCredentialReady: readyProviderCount === providerReadiness.length,
      providerCount: providerReadiness.length,
      readyProviderCount,
      blockedProviderCount,
      diagnosticCount: diagnostics.length,
      blockCount,
      errorCount,
      warningCount,
    }),
    diagnostics: Object.freeze([...diagnostics]),
    summary: Object.freeze({
      totalProviderCount: providerReadiness.length,
      credentialReadyProviderCount: readyProviderCount,
      credentialBlockedProviderCount: blockedProviderCount,
      missingProviderAccountCount: providerReadiness.filter((item) =>
        item.missingDependencies.includes("provider_account"),
      ).length,
      missingVaultRecordCount: providerReadiness.filter((item) =>
        item.missingDependencies.includes("vault_record"),
      ).length,
      missingLifecycleStateCount: providerReadiness.filter((item) =>
        item.missingDependencies.includes("lifecycle_state"),
      ).length,
      missingKeyVersionCount: model.key_versions.length === 0 ? providerReadiness.length : 0,
      diagnosticCount: diagnostics.length,
      computedOnly: true,
      readOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    }),
    replayIntegrity: Object.freeze({
      valid: errorCount === 0,
      deterministic: true,
      source: "social_credential_readiness_replay",
      computedOnly: true,
      authoritative: false,
    }),
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });

  return { ok: true, value };
}

function projectProviderReadiness(
  provider: SocialPlatformCredentialProvider,
  model: SocialCredentialPersistenceModel,
  diagnostics: SocialCredentialReadinessReplayDiagnostic[],
  missingDependencyReport: string[],
): SocialCredentialProviderReadinessProjection {
  const requiredCredentialKinds = requiredCredentialKindsForProvider(provider);
  const providerAccounts = model.provider_accounts.filter((account) => account.provider === provider);
  const vaultRecords = model.vault_records.filter(
    (record) => record.provider === provider && record.lifecycle_phase === "active",
  );
  const lifecycleStates = model.lifecycle_states
    .filter((record) => record.provider === provider)
    .map(mapLifecycleStateRecordToDomain);
  const satisfiedKinds = collectSatisfiedKinds(vaultRecords, lifecycleStates);
  const missingCredentialKinds = requiredCredentialKinds.filter((kind) => !satisfiedKinds.includes(kind));

  const missingDependencies: string[] = [];
  const blockingReasons: string[] = [];

  if (providerAccounts.length === 0) {
    missingDependencies.push("provider_account");
    blockingReasons.push("no_provider_account_registered");
    diagnostics.push({
      code: "missing_provider_account",
      path: `provider.${provider}`,
      message: `No provider account registered for ${provider}.`,
      severity: "block",
      referenceId: `provider:${provider}`,
    });
    missingDependencyReport.push(`provider_account:${provider}`);
  }

  if (vaultRecords.length === 0) {
    missingDependencies.push("vault_record");
    blockingReasons.push("no_active_vault_records");
    diagnostics.push({
      code: "missing_vault_record",
      path: `provider.${provider}`,
      message: `No active vault record metadata for ${provider}.`,
      severity: "block",
      referenceId: `provider:${provider}`,
    });
    missingDependencyReport.push(`vault_record:${provider}`);
  }

  if (lifecycleStates.length === 0) {
    missingDependencies.push("lifecycle_state");
    blockingReasons.push("no_lifecycle_states");
    diagnostics.push({
      code: "missing_lifecycle_state",
      path: `provider.${provider}`,
      message: `No lifecycle states modeled for ${provider}.`,
      severity: "block",
      referenceId: `provider:${provider}`,
    });
    missingDependencyReport.push(`lifecycle_state:${provider}`);
  }

  if (model.key_versions.length === 0) {
    missingDependencies.push("key_version");
    blockingReasons.push("no_key_versions");
    diagnostics.push({
      code: "missing_key_version",
      path: "key_versions",
      message: "No encryption key version metadata registered.",
      severity: "warning",
      referenceId: "key_version:global",
    });
    missingDependencyReport.push("key_version:global");
  }

  const forbidden = detectSocialCredentialForbiddenStates(provider, lifecycleStates, satisfiedKinds);
  for (const diagnostic of forbidden.diagnostics) {
    diagnostics.push({
      code: "provider_forbidden_state",
      path: `provider.${provider}.${diagnostic.path}`,
      message: diagnostic.message,
      severity: diagnostic.severity === "block" ? "block" : "error",
      referenceId: `provider:${provider}`,
    });
    blockingReasons.push(diagnostic.code);
  }

  for (const account of providerAccounts) {
    const reference = mapProviderAccountRecordToReference(account);
    if (reference.status === "disabled") {
      blockingReasons.push(`provider_account_disabled:${account.provider_account_id}`);
      diagnostics.push({
        code: "missing_dependency",
        path: `provider_accounts.${account.provider_account_id}`,
        message: `Provider account ${account.provider_account_id} is disabled.`,
        severity: "block",
        referenceId: account.provider_account_id,
      });
    }
  }

  const boundaryContract = createSocialPlatformCredentialBoundaryContract(provider);
  void boundaryContract;

  const credentialReady =
    missingDependencies.length === 0 &&
    missingCredentialKinds.length === 0 &&
    forbidden.valid &&
    blockingReasons.length === 0;

  return Object.freeze({
    provider,
    platforms: platformsForProvider(provider),
    providerAccountCount: providerAccounts.length,
    activeVaultRecordCount: vaultRecords.length,
    activeLifecycleCount: lifecycleStates.length,
    requiredCredentialKinds,
    satisfiedCredentialKinds: satisfiedKinds,
    missingCredentialKinds,
    credentialReady,
    credentialBlocked: !credentialReady,
    missingDependencies: Object.freeze([...missingDependencies]),
    blockingReasons: Object.freeze([...blockingReasons]),
    domainVersion: SOCIAL_CREDENTIAL_DOMAIN_VERSION,
    repositoryVersion: SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
    liveCredentialsBlocked: true,
    encryptionBlocked: true,
    persistenceBlocked: true,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
}

function collectSatisfiedKinds(
  vaultRecords: readonly SocialCredentialVaultRecordRow[],
  lifecycleStates: readonly SocialCredentialLifecycleState[],
): readonly SocialPlatformCredentialKind[] {
  const kinds = new Set<SocialPlatformCredentialKind>();
  for (const record of vaultRecords) {
    kinds.add(record.credential_kind);
  }
  for (const state of lifecycleStates) {
    if (state.lifecyclePhase === "active") {
      const vaultKind = vaultRecords.find((record) => record.credential_ref_id === state.credentialRefId);
      if (vaultKind) kinds.add(vaultKind.credential_kind);
    }
  }
  return [...kinds];
}
