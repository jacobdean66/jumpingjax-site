import {
  SOCIAL_CREDENTIAL_DOMAIN_VERSION,
} from "./social-credential-domain";
import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_BOUNDARY,
  SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
  SOCIAL_CREDENTIAL_STORAGE_CONTRACT,
  createSocialCredentialRepository,
  validateDomainMappingsFromPersistenceModel,
  validateSocialCredentialPersistenceAdapterContract,
  validateSocialCredentialPersistenceModel,
  type SocialCredentialPersistenceAdapterBoundary,
  type SocialCredentialPersistenceModel,
  type SocialCredentialRepository,
} from "./social-credential-repository";
import {
  replaySocialCredentialReadiness,
  type SocialCredentialReadinessReplayDiagnostic,
} from "./social-credential-readiness-replay";
import {
  SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS,
  type SocialPlatformCredentialProvider,
} from "../social-platform-credential-boundary";

export const SOCIAL_CREDENTIAL_ADMIN_DIAGNOSTICS_VERSION = "d14-w3-v1" as const;

export const SOCIAL_CREDENTIAL_ADMIN_DIAGNOSTIC_CODES = [
  "credential_persistence_ready",
  "credential_persistence_blocked",
  "storage_schema_ready",
  "storage_schema_blocked",
  "repository_contract_complete",
  "repository_contract_incomplete",
  "repository_validation_failed",
  "domain_mapping_failed",
  "storage_dependency_missing",
  "schema_validation_summary_computed",
  "lifecycle_summary_computed",
] as const;

export type SocialCredentialAdminDiagnosticCode =
  (typeof SOCIAL_CREDENTIAL_ADMIN_DIAGNOSTIC_CODES)[number];

export type SocialCredentialAdminDiagnostic = Readonly<{
  code: SocialCredentialAdminDiagnosticCode;
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
  referenceId: string | null;
}>;

export type SocialCredentialLifecycleSummary = Readonly<{
  lifecycleStateCount: number;
  activeLifecycleStateCount: number;
  lifecyclePhaseCounts: Readonly<Record<string, number>>;
  providerLifecycleCounts: Readonly<Record<SocialPlatformCredentialProvider, number>>;
  auditEventCount: number;
  keyVersionCount: number;
  keyVersionStatusCounts: Readonly<Record<string, number>>;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
}>;

export type SocialCredentialStorageSchemaReadinessSummary = Readonly<{
  schemaVersion: typeof SOCIAL_CREDENTIAL_REPOSITORY_VERSION;
  requiredCollectionCount: number;
  presentCollectionCount: number;
  missingCollections: readonly string[];
  referenceOnlyCollections: readonly string[];
  storageSchemaReady: boolean;
  allowsSql: false;
  allowsSupabase: false;
  allowsEncryption: false;
  readOnly: true;
  authoritative: false;
}>;

export type SocialCredentialCoverageSummary = Readonly<{
  requiredCount: number;
  satisfiedCount: number;
  missingKeys: readonly string[];
  complete: boolean;
}>;

export type SocialCredentialProviderCoverageSummary = Readonly<{
  requiredCount: number;
  satisfiedCount: number;
  coveredProviders: readonly SocialPlatformCredentialProvider[];
  missingProviders: readonly SocialPlatformCredentialProvider[];
  complete: boolean;
}>;

export type SocialCredentialAdapterCoverageSummary = Readonly<{
  requiredCount: number;
  satisfiedCount: number;
  missingChecks: readonly string[];
  contractValid: boolean;
  loadSnapshotAvailable: boolean;
  persistSnapshotAvailable: boolean;
  complete: boolean;
}>;

export type SocialCredentialReplayCompatibilitySummary = Readonly<{
  deterministic: boolean;
  repositoryVersionMatchesReadiness: boolean;
  repositoryVersionMatchesStorageContract: boolean;
  storageContractMatchesReadiness: boolean;
  sourceMatchesReadinessReplay: boolean;
  complete: boolean;
}>;

export type SocialCredentialAppendOnlyAuditCompatibilitySummary = Readonly<{
  appendOnlyCollections: readonly string[];
  appendOnlyOperations: readonly string[];
  forbiddenAuditMutations: readonly string[];
  appendAuditEventAvailable: boolean;
  forbiddenAuditMutationsPresent: readonly string[];
  preservesAppendOnlyHistory: boolean;
  complete: boolean;
}>;

export type SocialCredentialGetOnlyDiagnosticsSummary = Readonly<{
  inspectedReadOperations: readonly string[];
  failedReadOperations: readonly string[];
  inspectedMutationOperationCount: 0;
  invokesMutationOperations: false;
  complete: boolean;
}>;

export type SocialCredentialRepositoryCompletenessSummary = Readonly<{
  repositoryVersion: typeof SOCIAL_CREDENTIAL_REPOSITORY_VERSION;
  requiredReadOperationCount: number;
  modeledMutationOperationCount: number;
  availableReadOperations: readonly string[];
  failingReadOperations: readonly string[];
  availableMutationOperations: readonly string[];
  missingReadOperations: readonly string[];
  missingMutationOperations: readonly string[];
  verificationIssueCount: number;
  verificationIssues: readonly string[];
  repositoryContractComplete: boolean;
  capabilityCoverage: SocialCredentialCoverageSummary;
  readinessCoverage: SocialCredentialProviderCoverageSummary;
  adapterCoverage: SocialCredentialAdapterCoverageSummary;
  replayCompatibility: SocialCredentialReplayCompatibilitySummary;
  appendOnlyAuditCompatibility: SocialCredentialAppendOnlyAuditCompatibilitySummary;
  getOnlyDiagnostics: SocialCredentialGetOnlyDiagnosticsSummary;
  readOnlyDiagnosticsOnly: true;
  invokesMutationOperations: false;
  authoritative: false;
}>;

export type SocialCredentialSchemaValidationSummary = Readonly<{
  persistenceErrorCount: number;
  domainMappingErrorCount: number;
  readinessDiagnosticCount: number;
  blockCount: number;
  errorCount: number;
  warningCount: number;
  validationErrorCodes: Readonly<Record<string, number>>;
  readinessDiagnosticCodes: Readonly<Record<string, number>>;
  validForReadiness: boolean;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
}>;

export type SocialCredentialPersistenceReadinessSummary = Readonly<{
  diagnosticsVersion: typeof SOCIAL_CREDENTIAL_ADMIN_DIAGNOSTICS_VERSION;
  domainVersion: typeof SOCIAL_CREDENTIAL_DOMAIN_VERSION;
  repositoryVersion: typeof SOCIAL_CREDENTIAL_REPOSITORY_VERSION;
  storageContractVersion: typeof SOCIAL_CREDENTIAL_REPOSITORY_VERSION;
  persistenceModelValid: boolean;
  domainMappingValid: boolean;
  storageContractReferenceOnly: boolean;
  storageContractAllowsSql: false;
  storageContractAllowsSupabase: false;
  storageContractAllowsEncryption: false;
  requiredDependencyCount: number;
  missingDependencyCount: number;
  missingStorageDependencies: readonly string[];
  readyProviderCount: number;
  blockedProviderCount: number;
  credentialPersistenceReady: boolean;
  storageSchemaSummary: SocialCredentialStorageSchemaReadinessSummary;
  repositoryCompletenessSummary: SocialCredentialRepositoryCompletenessSummary;
  schemaValidationSummary: SocialCredentialSchemaValidationSummary;
  lifecycleSummary: SocialCredentialLifecycleSummary;
  readinessDiagnostics: readonly SocialCredentialReadinessReplayDiagnostic[];
  diagnostics: readonly SocialCredentialAdminDiagnostic[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

const REQUIRED_SCHEMA_COLLECTIONS = [
  "provider_accounts",
  "vault_records",
  "lifecycle_states",
  "audit_events",
  "key_versions",
] as const;

const REQUIRED_REPOSITORY_READ_OPERATIONS = [
  "getCredentialRecordsByIdentity",
  "listProviderAccounts",
  "listVaultRecordMetadata",
  "listLifecycleStates",
  "listAuditEvents",
  "listKeyVersions",
  "snapshot",
] as const;

const MODELED_REPOSITORY_MUTATION_OPERATIONS = [
  "createProviderAccount",
  "updateProviderAccount",
  "deleteProviderAccount",
  "createVaultRecordMetadata",
  "updateVaultRecordMetadata",
  "deleteVaultRecordMetadata",
  "createLifecycleState",
  "updateLifecycleState",
  "deleteLifecycleState",
  "appendAuditEvent",
  "createKeyVersion",
  "updateKeyVersion",
  "deleteKeyVersion",
] as const;

const DIAGNOSTIC_ADAPTER_CONTRACT = Object.freeze({
  adapterId: "credential-diagnostics-reference-adapter",
  repositoryVersion: SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
  domainVersion: SOCIAL_CREDENTIAL_DOMAIN_VERSION,
  capabilities: {
    adapterBoundaryOnly: true as const,
    referenceOnly: true as const,
    metadataOnly: true as const,
    storesNoSecrets: true as const,
    storesNoTokens: true as const,
    storesNoPlaintext: true as const,
    exposesNoSql: true as const,
    usesNoSupabase: true as const,
    usesNoNetwork: true as const,
    performsNoEncryption: true as const,
    performsNoDecryption: true as const,
    grantsExecutionPermission: false as const,
    executesNothing: true as const,
    publishesNothing: true as const,
  },
});

const REPOSITORY_READ_OPERATION_CHECKS = [
  {
    name: "getCredentialRecordsByIdentity",
    invoke: (repository: SocialCredentialRepository) =>
      repository.getCredentialRecordsByIdentity({ provider: "meta" }),
  },
  {
    name: "listProviderAccounts",
    invoke: (repository: SocialCredentialRepository) =>
      repository.listProviderAccounts(),
  },
  {
    name: "listVaultRecordMetadata",
    invoke: (repository: SocialCredentialRepository) =>
      repository.listVaultRecordMetadata(),
  },
  {
    name: "listLifecycleStates",
    invoke: (repository: SocialCredentialRepository) =>
      repository.listLifecycleStates(),
  },
  {
    name: "listAuditEvents",
    invoke: (repository: SocialCredentialRepository) =>
      repository.listAuditEvents(),
  },
  {
    name: "listKeyVersions",
    invoke: (repository: SocialCredentialRepository) => repository.listKeyVersions(),
  },
  {
    name: "snapshot",
    invoke: (repository: SocialCredentialRepository) => repository.snapshot(),
  },
] as const;

export function replaySocialCredentialAdminDiagnostics(
  model: SocialCredentialPersistenceModel = EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
): SocialCredentialPersistenceReadinessSummary {
  const persistenceValidation = validateSocialCredentialPersistenceModel(model);
  const mappingValidation = validateDomainMappingsFromPersistenceModel(model);
  const readiness = replaySocialCredentialReadiness(model).value;
  const missingStorageDependencies = unique(readiness.missingDependencyReport);
  const storageSchemaSummary = buildStorageSchemaReadinessSummary(model);
  const repositoryCompletenessSummary = buildRepositoryCompletenessSummary(
    readiness,
  );
  const schemaValidationSummary = buildSchemaValidationSummary(
    persistenceValidation.errors,
    mappingValidation.errors,
    readiness.diagnostics,
  );
  const diagnostics: SocialCredentialAdminDiagnostic[] = [];

  if (!persistenceValidation.ok) {
    for (const error of persistenceValidation.errors) {
      diagnostics.push({
        code: "repository_validation_failed",
        severity: "error",
        path: error.path,
        message: error.message,
        referenceId: null,
      });
    }
  }

  if (!mappingValidation.ok) {
    for (const error of mappingValidation.errors) {
      diagnostics.push({
        code: "domain_mapping_failed",
        severity: "error",
        path: error.path,
        message: error.message,
        referenceId: null,
      });
    }
  }

  for (const dependency of missingStorageDependencies) {
    diagnostics.push({
      code: "storage_dependency_missing",
      severity: dependency.startsWith("key_version:") ? "warning" : "error",
      path: "credential_storage_dependencies",
      message: `Missing credential storage dependency: ${dependency}.`,
      referenceId: dependency,
    });
  }

  diagnostics.push({
    code: storageSchemaSummary.storageSchemaReady
      ? "storage_schema_ready"
      : "storage_schema_blocked",
    severity: storageSchemaSummary.storageSchemaReady ? "info" : "error",
    path: "credential_storage_schema",
    message: storageSchemaSummary.storageSchemaReady
      ? "Credential storage schema contract is ready for reference-only diagnostics."
      : `Credential storage schema contract is missing ${storageSchemaSummary.missingCollections.length} required collection(s).`,
    referenceId: null,
  });

  diagnostics.push({
    code: repositoryCompletenessSummary.repositoryContractComplete
      ? "repository_contract_complete"
      : "repository_contract_incomplete",
    severity: repositoryCompletenessSummary.repositoryContractComplete ? "info" : "error",
    path: "credential_repository_contract",
    message: repositoryCompletenessSummary.repositoryContractComplete
      ? "Credential repository verification is complete for deterministic diagnostics."
      : `Credential repository verification found ${repositoryCompletenessSummary.verificationIssueCount} issue(s).`,
    referenceId: null,
  });

  diagnostics.push({
    code: "schema_validation_summary_computed",
    severity: schemaValidationSummary.validForReadiness ? "info" : "warning",
    path: "credential_schema_validation",
    message: `Credential schema validation summary computed with ${schemaValidationSummary.persistenceErrorCount} persistence error(s), ${schemaValidationSummary.domainMappingErrorCount} mapping error(s), and ${schemaValidationSummary.readinessDiagnosticCount} readiness diagnostic(s).`,
    referenceId: null,
  });

  const credentialPersistenceReady =
    persistenceValidation.ok &&
    mappingValidation.ok &&
    storageSchemaSummary.storageSchemaReady &&
    repositoryCompletenessSummary.repositoryContractComplete &&
    readiness.validationSummary.allProvidersCredentialReady &&
    missingStorageDependencies.length === 0 &&
    SOCIAL_CREDENTIAL_STORAGE_CONTRACT.referenceOnly === true &&
    SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsSql === false &&
    SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsSupabase === false &&
    SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsEncryption === false;

  diagnostics.push({
    code: credentialPersistenceReady
      ? "credential_persistence_ready"
      : "credential_persistence_blocked",
    severity: credentialPersistenceReady ? "info" : "warning",
    path: "credential_persistence",
    message: credentialPersistenceReady
      ? "Credential persistence readiness is satisfied by the supplied reference model."
      : "Credential persistence readiness is blocked by validation or missing dependency diagnostics.",
    referenceId: null,
  });

  diagnostics.push({
    code: "lifecycle_summary_computed",
    severity: "info",
    path: "credential_lifecycle",
    message: "Credential lifecycle summary was computed from reference-only rows.",
    referenceId: null,
  });

  return Object.freeze({
    diagnosticsVersion: SOCIAL_CREDENTIAL_ADMIN_DIAGNOSTICS_VERSION,
    domainVersion: SOCIAL_CREDENTIAL_DOMAIN_VERSION,
    repositoryVersion: SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
    storageContractVersion: SOCIAL_CREDENTIAL_STORAGE_CONTRACT.contractVersion,
    persistenceModelValid: persistenceValidation.ok,
    domainMappingValid: mappingValidation.ok,
    storageContractReferenceOnly: SOCIAL_CREDENTIAL_STORAGE_CONTRACT.referenceOnly,
    storageContractAllowsSql: SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsSql,
    storageContractAllowsSupabase: SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsSupabase,
    storageContractAllowsEncryption: SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsEncryption,
    requiredDependencyCount: readiness.validationSummary.providerCount * 3 + 1,
    missingDependencyCount: missingStorageDependencies.length,
    missingStorageDependencies: Object.freeze(missingStorageDependencies),
    readyProviderCount: readiness.summary.credentialReadyProviderCount,
    blockedProviderCount: readiness.summary.credentialBlockedProviderCount,
    credentialPersistenceReady,
    storageSchemaSummary,
    repositoryCompletenessSummary,
    schemaValidationSummary,
    lifecycleSummary: buildLifecycleSummary(model),
    readinessDiagnostics: readiness.diagnostics,
    diagnostics: Object.freeze(diagnostics),
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
}

function buildStorageSchemaReadinessSummary(
  model: SocialCredentialPersistenceModel,
): SocialCredentialStorageSchemaReadinessSummary {
  const presentCollections = REQUIRED_SCHEMA_COLLECTIONS.filter((collection) =>
    Array.isArray(model[collection]),
  );
  const missingCollections = REQUIRED_SCHEMA_COLLECTIONS.filter((collection) =>
    !presentCollections.includes(collection),
  );
  const storageSchemaReady =
    missingCollections.length === 0 &&
    SOCIAL_CREDENTIAL_STORAGE_CONTRACT.referenceOnly === true &&
    SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsSql === false &&
    SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsSupabase === false &&
    SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsEncryption === false;

  return Object.freeze({
    schemaVersion: SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
    requiredCollectionCount: REQUIRED_SCHEMA_COLLECTIONS.length,
    presentCollectionCount: presentCollections.length,
    missingCollections: Object.freeze([...missingCollections]),
    referenceOnlyCollections: Object.freeze([...presentCollections]),
    storageSchemaReady,
    allowsSql: SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsSql,
    allowsSupabase: SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsSupabase,
    allowsEncryption: SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsEncryption,
    readOnly: true,
    authoritative: false,
  });
}

function buildRepositoryCompletenessSummary(
  readiness: ReturnType<typeof replaySocialCredentialReadiness>["value"],
): SocialCredentialRepositoryCompletenessSummary {
  const verificationAdapter = createDiagnosticsVerificationAdapter();
  const adapterValidation = validateSocialCredentialPersistenceAdapterContract(
    verificationAdapter.contract,
  );
  const repository = createSocialCredentialRepository(verificationAdapter);
  const repositoryRecord = repository as Record<string, unknown>;

  const readOperationResults = REPOSITORY_READ_OPERATION_CHECKS.map((operation) => {
    const available = hasFunction(repositoryRecord, operation.name);
    if (!available) {
      return { name: operation.name, available: false, ok: false };
    }
    try {
      const result = operation.invoke(repository);
      return { name: operation.name, available: true, ok: result.ok };
    } catch {
      return { name: operation.name, available: true, ok: false };
    }
  });

  const availableReadOperations = readOperationResults
    .filter((operation) => operation.available && operation.ok)
    .map((operation) => operation.name);
  const missingReadOperations = readOperationResults
    .filter((operation) => !operation.available)
    .map((operation) => operation.name);
  const failingReadOperations = readOperationResults
    .filter((operation) => operation.available && !operation.ok)
    .map((operation) => operation.name);
  const availableMutationOperations = MODELED_REPOSITORY_MUTATION_OPERATIONS.filter(
    (operation) => hasFunction(repositoryRecord, operation),
  );
  const missingMutationOperations = MODELED_REPOSITORY_MUTATION_OPERATIONS.filter(
    (operation) => !availableMutationOperations.includes(operation),
  );
  const capabilityCoverage = buildCapabilityCoverageSummary();
  const readinessCoverage = buildReadinessCoverageSummary(readiness);
  const adapterCoverage = buildAdapterCoverageSummary(
    verificationAdapter,
    adapterValidation.ok,
  );
  const replayCompatibility = buildReplayCompatibilitySummary(readiness);
  const appendOnlyAuditCompatibility = buildAppendOnlyAuditCompatibilitySummary(
    repositoryRecord,
  );
  const getOnlyDiagnostics = buildGetOnlyDiagnosticsSummary(
    availableReadOperations,
    failingReadOperations,
  );
  const verificationIssues = unique([
    ...missingReadOperations.map(
      (operation) => `missing_read_operation:${operation}`,
    ),
    ...failingReadOperations.map(
      (operation) => `failing_read_operation:${operation}`,
    ),
    ...missingMutationOperations.map(
      (operation) => `missing_mutation_operation:${operation}`,
    ),
    ...capabilityCoverage.missingKeys.map((key) => `capability:${key}`),
    ...readinessCoverage.missingProviders.map(
      (provider) => `readiness_provider:${provider}`,
    ),
    ...adapterCoverage.missingChecks.map((check) => `adapter:${check}`),
    ...(replayCompatibility.complete ? [] : ["replay_compatibility"]),
    ...(appendOnlyAuditCompatibility.complete
      ? []
      : ["append_only_audit_compatibility"]),
    ...(getOnlyDiagnostics.complete ? [] : ["get_only_diagnostics"]),
  ]);
  const repositoryContractComplete = verificationIssues.length === 0;

  return Object.freeze({
    repositoryVersion: SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
    requiredReadOperationCount: REQUIRED_REPOSITORY_READ_OPERATIONS.length,
    modeledMutationOperationCount: MODELED_REPOSITORY_MUTATION_OPERATIONS.length,
    availableReadOperations: Object.freeze([...availableReadOperations]),
    failingReadOperations: Object.freeze([...failingReadOperations]),
    availableMutationOperations: Object.freeze([...availableMutationOperations]),
    missingReadOperations: Object.freeze([...missingReadOperations]),
    missingMutationOperations: Object.freeze([...missingMutationOperations]),
    verificationIssueCount: verificationIssues.length,
    verificationIssues: Object.freeze([...verificationIssues]),
    repositoryContractComplete,
    capabilityCoverage,
    readinessCoverage,
    adapterCoverage,
    replayCompatibility,
    appendOnlyAuditCompatibility,
    getOnlyDiagnostics,
    readOnlyDiagnosticsOnly: true,
    invokesMutationOperations: false,
    authoritative: false,
  });
}

function buildCapabilityCoverageSummary(): SocialCredentialCoverageSummary {
  const checks = [
    [
      "storage.adapterBoundaryOnly",
      SOCIAL_CREDENTIAL_STORAGE_CONTRACT.adapterBoundaryOnly === true,
    ],
    [
      "storage.referenceOnly",
      SOCIAL_CREDENTIAL_STORAGE_CONTRACT.referenceOnly === true,
    ],
    [
      "storage.implementsNothing",
      SOCIAL_CREDENTIAL_STORAGE_CONTRACT.implementsNothing === true,
    ],
    ["storage.allowsSql", SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsSql === false],
    [
      "storage.allowsSupabase",
      SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsSupabase === false,
    ],
    [
      "storage.allowsEncryption",
      SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsEncryption === false,
    ],
    [
      "storage.allowsDecryption",
      SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsDecryption === false,
    ],
    [
      "storage.grantsExecutionPermission",
      SOCIAL_CREDENTIAL_STORAGE_CONTRACT.grantsExecutionPermission === false,
    ],
    [
      "storage.executesNothing",
      SOCIAL_CREDENTIAL_STORAGE_CONTRACT.executesNothing === true,
    ],
    [
      "storage.publishesNothing",
      SOCIAL_CREDENTIAL_STORAGE_CONTRACT.publishesNothing === true,
    ],
  ] as const;
  const missingKeys = checks
    .filter(([, satisfied]) => !satisfied)
    .map(([key]) => key);

  return Object.freeze({
    requiredCount: checks.length,
    satisfiedCount: checks.length - missingKeys.length,
    missingKeys: Object.freeze([...missingKeys]),
    complete: missingKeys.length === 0,
  });
}

function buildReadinessCoverageSummary(
  readiness: ReturnType<typeof replaySocialCredentialReadiness>["value"],
): SocialCredentialProviderCoverageSummary {
  const coveredProviders = SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS.filter((provider) =>
    readiness.providerReadiness.some(
      (projection) => projection.provider === provider,
    ),
  );
  const missingProviders = SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS.filter(
    (provider) => !coveredProviders.includes(provider),
  );

  return Object.freeze({
    requiredCount: SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS.length,
    satisfiedCount: coveredProviders.length,
    coveredProviders: Object.freeze([...coveredProviders]),
    missingProviders: Object.freeze([...missingProviders]),
    complete: missingProviders.length === 0,
  });
}

function buildAdapterCoverageSummary(
  adapter: SocialCredentialPersistenceAdapterBoundary,
  contractValid: boolean,
): SocialCredentialAdapterCoverageSummary {
  const loadSnapshotAvailable = typeof adapter.loadSnapshot === "function";
  const persistSnapshotAvailable = typeof adapter.persistSnapshot === "function";
  const missingChecks = [
    ...(contractValid ? [] : ["contract_valid"]),
    ...(loadSnapshotAvailable ? [] : ["loadSnapshot"]),
    ...(persistSnapshotAvailable ? [] : ["persistSnapshot"]),
  ];

  return Object.freeze({
    requiredCount: 3,
    satisfiedCount: 3 - missingChecks.length,
    missingChecks: Object.freeze([...missingChecks]),
    contractValid,
    loadSnapshotAvailable,
    persistSnapshotAvailable,
    complete: missingChecks.length === 0,
  });
}

function buildReplayCompatibilitySummary(
  readiness: ReturnType<typeof replaySocialCredentialReadiness>["value"],
): SocialCredentialReplayCompatibilitySummary {
  const deterministic = readiness.replayIntegrity.deterministic === true;
  const repositoryVersionMatchesReadiness =
    readiness.repositoryVersion === SOCIAL_CREDENTIAL_REPOSITORY_VERSION;
  const repositoryVersionMatchesStorageContract =
    SOCIAL_CREDENTIAL_STORAGE_CONTRACT.contractVersion ===
    SOCIAL_CREDENTIAL_REPOSITORY_VERSION;
  const storageContractMatchesReadiness =
    readiness.storageContractVersion ===
    SOCIAL_CREDENTIAL_STORAGE_CONTRACT.contractVersion;
  const sourceMatchesReadinessReplay =
    readiness.replayIntegrity.source === "social_credential_readiness_replay";

  return Object.freeze({
    deterministic,
    repositoryVersionMatchesReadiness,
    repositoryVersionMatchesStorageContract,
    storageContractMatchesReadiness,
    sourceMatchesReadinessReplay,
    complete:
      deterministic &&
      repositoryVersionMatchesReadiness &&
      repositoryVersionMatchesStorageContract &&
      storageContractMatchesReadiness &&
      sourceMatchesReadinessReplay,
  });
}

function buildAppendOnlyAuditCompatibilitySummary(
  repository: Readonly<Record<string, unknown>>,
): SocialCredentialAppendOnlyAuditCompatibilitySummary {
  const appendAuditEventAvailable = hasFunction(repository, "appendAuditEvent");
  const forbiddenAuditMutationsPresent =
    SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_BOUNDARY.forbiddenAuditMutations.filter(
      (operation) => hasFunction(repository, operation),
    );
  const preservesAppendOnlyHistory =
    SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_BOUNDARY.auditEventsImmutable &&
    SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_BOUNDARY.preservesW2AppendOnlySemantics;
  const complete =
    appendAuditEventAvailable &&
    forbiddenAuditMutationsPresent.length === 0 &&
    SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_BOUNDARY.appendOnlyCollections.includes(
      "audit_events",
    ) &&
    SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_BOUNDARY.appendOnlyOperations.includes(
      "appendAuditEvent",
    ) &&
    preservesAppendOnlyHistory;

  return Object.freeze({
    appendOnlyCollections: Object.freeze([
      ...SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_BOUNDARY.appendOnlyCollections,
    ]),
    appendOnlyOperations: Object.freeze([
      ...SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_BOUNDARY.appendOnlyOperations,
    ]),
    forbiddenAuditMutations: Object.freeze([
      ...SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_BOUNDARY.forbiddenAuditMutations,
    ]),
    appendAuditEventAvailable,
    forbiddenAuditMutationsPresent: Object.freeze([
      ...forbiddenAuditMutationsPresent,
    ]),
    preservesAppendOnlyHistory,
    complete,
  });
}

function buildGetOnlyDiagnosticsSummary(
  availableReadOperations: readonly string[],
  failingReadOperations: readonly string[],
): SocialCredentialGetOnlyDiagnosticsSummary {
  return Object.freeze({
    inspectedReadOperations: Object.freeze([...availableReadOperations]),
    failedReadOperations: Object.freeze([...failingReadOperations]),
    inspectedMutationOperationCount: 0,
    invokesMutationOperations: false,
    complete: failingReadOperations.length === 0,
  });
}

function buildSchemaValidationSummary(
  persistenceErrors: readonly { code: string }[],
  mappingErrors: readonly { code: string }[],
  readinessDiagnostics: readonly SocialCredentialReadinessReplayDiagnostic[],
): SocialCredentialSchemaValidationSummary {
  return Object.freeze({
    persistenceErrorCount: persistenceErrors.length,
    domainMappingErrorCount: mappingErrors.length,
    readinessDiagnosticCount: readinessDiagnostics.length,
    blockCount: readinessDiagnostics.filter((diagnostic) => diagnostic.severity === "block").length,
    errorCount:
      persistenceErrors.length +
      mappingErrors.length +
      readinessDiagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
    warningCount: readinessDiagnostics.filter((diagnostic) => diagnostic.severity === "warning").length,
    validationErrorCodes: Object.freeze(countBy([...persistenceErrors, ...mappingErrors].map((error) => error.code))),
    readinessDiagnosticCodes: Object.freeze(countBy(readinessDiagnostics.map((diagnostic) => diagnostic.code))),
    validForReadiness:
      persistenceErrors.length === 0 &&
      mappingErrors.length === 0 &&
      readinessDiagnostics.every((diagnostic) => diagnostic.severity === "warning"),
    computedOnly: true,
    readOnly: true,
    authoritative: false,
  });
}

function buildLifecycleSummary(
  model: SocialCredentialPersistenceModel,
): SocialCredentialLifecycleSummary {
  return Object.freeze({
    lifecycleStateCount: model.lifecycle_states.length,
    activeLifecycleStateCount: model.lifecycle_states.filter(
      (state) => state.lifecycle_phase === "active",
    ).length,
    lifecyclePhaseCounts: Object.freeze(countBy(model.lifecycle_states.map((state) => state.lifecycle_phase))),
    providerLifecycleCounts: Object.freeze(countBy(model.lifecycle_states.map((state) => state.provider))) as Readonly<
      Record<SocialPlatformCredentialProvider, number>
    >,
    auditEventCount: model.audit_events.length,
    keyVersionCount: model.key_versions.length,
    keyVersionStatusCounts: Object.freeze(countBy(model.key_versions.map((version) => version.status))),
    computedOnly: true,
    readOnly: true,
    authoritative: false,
  });
}

function countBy<T extends string>(values: readonly T[]): Record<T, number> {
  return values.reduce<Record<T, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}

function createDiagnosticsVerificationAdapter(): SocialCredentialPersistenceAdapterBoundary {
  let snapshot = EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL;
  return {
    contract: DIAGNOSTIC_ADAPTER_CONTRACT,
    loadSnapshot() {
      return { ok: true, value: snapshot };
    },
    persistSnapshot(model) {
      snapshot = model;
      return { ok: true, value: snapshot };
    },
  };
}

function hasFunction(
  record: Readonly<Record<string, unknown>>,
  key: string,
): boolean {
  return typeof record[key] === "function";
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}
