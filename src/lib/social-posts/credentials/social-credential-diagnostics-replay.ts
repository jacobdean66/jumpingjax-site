import {
  SOCIAL_CREDENTIAL_DOMAIN_VERSION,
} from "./social-credential-domain";
import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
  SOCIAL_CREDENTIAL_STORAGE_CONTRACT,
  validateDomainMappingsFromPersistenceModel,
  validateSocialCredentialPersistenceModel,
  type SocialCredentialPersistenceModel,
} from "./social-credential-repository";
import {
  replaySocialCredentialReadiness,
  type SocialCredentialReadinessReplayDiagnostic,
} from "./social-credential-readiness-replay";
import type { SocialPlatformCredentialProvider } from "../social-platform-credential-boundary";

export const SOCIAL_CREDENTIAL_ADMIN_DIAGNOSTICS_VERSION = "d13-w2-v1" as const;

export const SOCIAL_CREDENTIAL_ADMIN_DIAGNOSTIC_CODES = [
  "credential_persistence_ready",
  "credential_persistence_blocked",
  "repository_validation_failed",
  "domain_mapping_failed",
  "storage_dependency_missing",
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

export function replaySocialCredentialAdminDiagnostics(
  model: SocialCredentialPersistenceModel = EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
): SocialCredentialPersistenceReadinessSummary {
  const persistenceValidation = validateSocialCredentialPersistenceModel(model);
  const mappingValidation = validateDomainMappingsFromPersistenceModel(model);
  const readiness = replaySocialCredentialReadiness(model).value;
  const missingStorageDependencies = unique(readiness.missingDependencyReport);
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

  const credentialPersistenceReady =
    persistenceValidation.ok &&
    mappingValidation.ok &&
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

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}
