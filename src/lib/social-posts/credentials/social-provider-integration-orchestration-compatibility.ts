import {
  SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION,
  type SocialCredentialRuntimeOrchestrationPlan,
  type SocialCredentialRuntimeOrchestratorProviderJob,
} from "./social-credential-runtime-orchestrator";
import {
  SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION,
  createSocialProviderIntegrationPlanningBundle,
  detectForbiddenProviderIntegrationState,
  serializeSocialProviderIntegrationPlanningBundle,
  validateSocialProviderIntegrationPlanningBundle,
  type SocialProviderIntegrationPlanningBundle,
  type SocialProviderIntegrationPlanningDiagnostic,
} from "./social-provider-integration-planning";
import {
  SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS,
  type SocialPlatformCredentialProvider,
} from "../social-platform-credential-boundary";

export const SOCIAL_PROVIDER_INTEGRATION_ORCHESTRATION_COMPATIBILITY_VERSION =
  SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION;

export const SOCIAL_PROVIDER_INTEGRATION_COMPATIBILITY_STATUSES = [
  "compatible",
  "waiting",
  "incompatible",
  "forbidden",
] as const;

export const SOCIAL_PROVIDER_INTEGRATION_COMPATIBILITY_ERROR_CODES = [
  "orchestrator_plan_missing",
  "orchestrator_version_mismatch",
  "provider_job_missing",
  "planning_bundle_invalid",
  "forbidden_capability_enabled",
  "orchestration_contract_mismatch",
  "readiness_impact_blocked",
  "serialization_invalid",
] as const;

export type SocialProviderIntegrationCompatibilityStatus =
  (typeof SOCIAL_PROVIDER_INTEGRATION_COMPATIBILITY_STATUSES)[number];

export type SocialProviderIntegrationCompatibilityErrorCode =
  (typeof SOCIAL_PROVIDER_INTEGRATION_COMPATIBILITY_ERROR_CODES)[number];

export type SocialProviderIntegrationCompatibilityDiagnostic = Readonly<{
  code: SocialProviderIntegrationCompatibilityErrorCode;
  path: string;
  message: string;
  severity: "error" | "warning" | "block";
}>;

export type SocialProviderIntegrationContractSnapshot = Readonly<{
  snapshotId: string;
  provider: SocialPlatformCredentialProvider;
  planningVersion: typeof SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION;
  orchestratorVersion: typeof SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION;
  serializedBundle: string;
  supportedCapabilityCount: number;
  unsupportedCapabilityCount: number;
  forbiddenCapabilityCount: number;
  deterministic: true;
  replayCompatible: true;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
}>;

export type SocialProviderIntegrationOrchestrationCompatibility = Readonly<{
  compatibilityId: string;
  provider: SocialPlatformCredentialProvider;
  status: SocialProviderIntegrationCompatibilityStatus;
  orchestratorVersion: typeof SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION;
  planningVersion: typeof SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION;
  providerOrchestrationId: string | null;
  orchestrationStatus: SocialCredentialRuntimeOrchestratorProviderJob["orchestrationStatus"] | null;
  fullyOrchestrated: boolean;
  contractSnapshot: SocialProviderIntegrationContractSnapshot;
  contractCoverageComplete: boolean;
  unsupportedCapabilityCount: number;
  forbiddenCapabilityCount: number;
  orchestrationContractAligned: boolean;
  readinessImpactBlocked: boolean;
  blockingReasons: readonly string[];
  diagnostics: readonly SocialProviderIntegrationCompatibilityDiagnostic[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialProviderIntegrationOrchestrationContractSummary = Readonly<{
  summaryId: string;
  planningVersion: typeof SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION;
  orchestratorVersion: typeof SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION;
  totalProviderCount: number;
  compatibleProviderCount: number;
  waitingProviderCount: number;
  incompatibleProviderCount: number;
  forbiddenProviderCount: number;
  contractCoverageCompleteCount: number;
  orchestrationAlignedCount: number;
  readinessImpactBlockedCount: number;
  unsupportedCapabilityTotal: number;
  forbiddenCapabilityTotal: number;
  deterministic: true;
  replayCompatible: true;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialProviderIntegrationOrchestrationCompatibilityResult = Readonly<{
  compatibilityVersion: typeof SOCIAL_PROVIDER_INTEGRATION_ORCHESTRATION_COMPATIBILITY_VERSION;
  planId: string | null;
  orchestratorVersion: typeof SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION;
  providerCompatibilities: readonly SocialProviderIntegrationOrchestrationCompatibility[];
  contractSnapshots: readonly SocialProviderIntegrationContractSnapshot[];
  contractSummary: SocialProviderIntegrationOrchestrationContractSummary;
  diagnostics: readonly SocialProviderIntegrationCompatibilityDiagnostic[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export function buildSocialProviderIntegrationContractSnapshot(
  bundle: SocialProviderIntegrationPlanningBundle,
): SocialProviderIntegrationContractSnapshot {
  return deepFreeze({
    snapshotId: `integration-contract-snapshot-${bundle.provider}`,
    provider: bundle.provider,
    planningVersion: SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION,
    orchestratorVersion: SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION,
    serializedBundle: serializeSocialProviderIntegrationPlanningBundle(bundle),
    supportedCapabilityCount: bundle.capabilityContract.supportedCapabilities.length,
    unsupportedCapabilityCount: bundle.capabilityContract.unsupportedCapabilities.length,
    forbiddenCapabilityCount: bundle.capabilityContract.forbiddenCapabilities.length,
    deterministic: true,
    replayCompatible: true,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
  });
}

export function evaluateSocialProviderIntegrationOrchestrationCompatibility(
  plan: SocialCredentialRuntimeOrchestrationPlan | null,
): SocialProviderIntegrationOrchestrationCompatibilityResult {
  const diagnostics: SocialProviderIntegrationCompatibilityDiagnostic[] = [];

  if (!plan) {
    diagnostics.push(compatibilityDiagnostic(
      "orchestrator_plan_missing",
      "plan",
      "Orchestration plan is required for integration compatibility evaluation.",
      "error",
    ));
    return emptyCompatibilityResult(diagnostics);
  }

  if (plan.orchestratorVersion !== SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION) {
    diagnostics.push(compatibilityDiagnostic(
      "orchestrator_version_mismatch",
      "plan.orchestratorVersion",
      "Orchestration plan version must match D15 Wave 1 orchestrator version.",
      "error",
    ));
  }

  const providerCompatibilities = SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS.map((provider) =>
    evaluateProviderCompatibility(provider, plan, diagnostics),
  );
  const contractSnapshots = providerCompatibilities.map(
    (compatibility) => compatibility.contractSnapshot,
  );

  const contractSummary = summarizeContractCompatibility(providerCompatibilities);

  return deepFreeze({
    compatibilityVersion: SOCIAL_PROVIDER_INTEGRATION_ORCHESTRATION_COMPATIBILITY_VERSION,
    planId: plan.planId,
    orchestratorVersion: SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION,
    providerCompatibilities,
    contractSnapshots,
    contractSummary,
    diagnostics,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
}

function evaluateProviderCompatibility(
  provider: SocialPlatformCredentialProvider,
  plan: SocialCredentialRuntimeOrchestrationPlan,
  globalDiagnostics: SocialProviderIntegrationCompatibilityDiagnostic[],
): SocialProviderIntegrationOrchestrationCompatibility {
  const diagnostics: SocialProviderIntegrationCompatibilityDiagnostic[] = [];
  const bundle = createSocialProviderIntegrationPlanningBundle(provider);
  const validation = validateSocialProviderIntegrationPlanningBundle(bundle);
  const forbidden = detectForbiddenProviderIntegrationState(bundle);

  for (const diagnostic of [...validation.diagnostics, ...forbidden.diagnostics]) {
    if (diagnostic.severity === "error" || diagnostic.severity === "block") {
      diagnostics.push(mapPlanningDiagnostic(provider, diagnostic));
    }
  }

  if (!validation.valid) {
    diagnostics.push(compatibilityDiagnostic(
      "planning_bundle_invalid",
      `providers.${provider}.bundle`,
      "Provider integration planning bundle failed validation.",
      "error",
    ));
  }

  const providerJob = plan.providerJobs.find((job) => job.provider === provider) ?? null;
  if (!providerJob) {
    diagnostics.push(compatibilityDiagnostic(
      "provider_job_missing",
      `plan.providerJobs.${provider}`,
      "Orchestration provider job is missing for integration compatibility review.",
      "warning",
    ));
  }

  const orchestrationContractAligned = providerJob
    ? providerJob.grantsExecutionPermission === false &&
      providerJob.executesNothing === true &&
      providerJob.publishesNothing === true &&
      providerJob.computedOnly === true
    : false;

  if (providerJob && !orchestrationContractAligned) {
    diagnostics.push(compatibilityDiagnostic(
      "orchestration_contract_mismatch",
      `providers.${provider}.orchestrationPlan`,
      "Orchestration provider job contract invariants do not align with integration planning boundaries.",
      "block",
    ));
  }

  const contractCoverageComplete =
    validation.valid &&
    forbidden.valid &&
    bundle.intents.length === 5 &&
    bundle.connectionContract.capabilities.allowsLiveConnection === false &&
    bundle.authorizationContract.capabilities.allowsLiveAuthorization === false &&
    bundle.communicationContract.capabilities.allowsNetwork === false;

  const unsupportedCapabilityCount =
    bundle.capabilityContract.unsupportedCapabilities.length;
  const forbiddenCapabilityCount =
    bundle.capabilityContract.forbiddenCapabilities.length;

  const readinessImpactBlocked =
    (providerJob?.readinessAggregation.credentialBlocked ?? true) ||
    (providerJob?.fullyOrchestrated === false);

  if (readinessImpactBlocked) {
    diagnostics.push(compatibilityDiagnostic(
      "readiness_impact_blocked",
      `providers.${provider}.readiness`,
      "Provider readiness remains blocked; integration planning does not clear orchestration prerequisites.",
      "warning",
    ));
  }

  const blockingReasons = unique([
    ...diagnostics.map((diagnostic) => diagnostic.code),
    ...(providerJob?.blockingReasons ?? []),
    ...bundle.capabilityContract.forbiddenCapabilities.map(
      (capability) => `forbidden_capability:${capability}`,
    ),
  ]);

  const status = resolveCompatibilityStatus(
    validation.valid && forbidden.valid,
    orchestrationContractAligned,
    forbiddenCapabilityCount > 0,
    providerJob,
    diagnostics,
  );

  const compatibility: SocialProviderIntegrationOrchestrationCompatibility = deepFreeze({
    compatibilityId: `integration-orchestration-compatibility-${provider}`,
    provider,
    status,
    orchestratorVersion: SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION,
    planningVersion: SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION,
    providerOrchestrationId: providerJob?.providerOrchestrationId ?? null,
    orchestrationStatus: providerJob?.orchestrationStatus ?? null,
    fullyOrchestrated: providerJob?.fullyOrchestrated ?? false,
    contractSnapshot: buildSocialProviderIntegrationContractSnapshot(bundle),
    contractCoverageComplete,
    unsupportedCapabilityCount,
    forbiddenCapabilityCount,
    orchestrationContractAligned,
    readinessImpactBlocked,
    blockingReasons,
    diagnostics,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });

  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "error") {
      globalDiagnostics.push(diagnostic);
    }
  }

  return compatibility;
}

function summarizeContractCompatibility(
  compatibilities: readonly SocialProviderIntegrationOrchestrationCompatibility[],
): SocialProviderIntegrationOrchestrationContractSummary {
  return deepFreeze({
    summaryId: "integration-orchestration-contract-summary",
    planningVersion: SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION,
    orchestratorVersion: SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION,
    totalProviderCount: compatibilities.length,
    compatibleProviderCount: compatibilities.filter((item) => item.status === "compatible").length,
    waitingProviderCount: compatibilities.filter((item) => item.status === "waiting").length,
    incompatibleProviderCount: compatibilities.filter((item) => item.status === "incompatible").length,
    forbiddenProviderCount: compatibilities.filter((item) => item.status === "forbidden").length,
    contractCoverageCompleteCount: compatibilities.filter((item) => item.contractCoverageComplete).length,
    orchestrationAlignedCount: compatibilities.filter((item) => item.orchestrationContractAligned).length,
    readinessImpactBlockedCount: compatibilities.filter((item) => item.readinessImpactBlocked).length,
    unsupportedCapabilityTotal: compatibilities.reduce(
      (total, item) => total + item.unsupportedCapabilityCount,
      0,
    ),
    forbiddenCapabilityTotal: compatibilities.reduce(
      (total, item) => total + item.forbiddenCapabilityCount,
      0,
    ),
    deterministic: true,
    replayCompatible: true,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
}

function resolveCompatibilityStatus(
  bundleValid: boolean,
  orchestrationContractAligned: boolean,
  hasForbiddenCapabilities: boolean,
  providerJob: SocialCredentialRuntimeOrchestratorProviderJob | null,
  diagnostics: readonly SocialProviderIntegrationCompatibilityDiagnostic[],
): SocialProviderIntegrationCompatibilityStatus {
  if (!bundleValid || diagnostics.some((diagnostic) => diagnostic.severity === "block")) {
    return "forbidden";
  }
  if (!orchestrationContractAligned || diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return "incompatible";
  }
  if (!providerJob || providerJob.orchestrationStatus === "waiting") {
    return "waiting";
  }
  if (hasForbiddenCapabilities) {
    return "compatible";
  }
  return providerJob.orchestrationStatus === "orchestrated" ? "compatible" : "waiting";
}

function mapPlanningDiagnostic(
  provider: SocialPlatformCredentialProvider,
  diagnostic: SocialProviderIntegrationPlanningDiagnostic,
): SocialProviderIntegrationCompatibilityDiagnostic {
  return compatibilityDiagnostic(
    diagnostic.code === "orchestrator_version_mismatch"
      ? "orchestrator_version_mismatch"
      : diagnostic.code === "forbidden_live_connection" ||
          diagnostic.code === "forbidden_live_authorization" ||
          diagnostic.code === "forbidden_live_communication"
        ? "forbidden_capability_enabled"
        : "planning_bundle_invalid",
    `providers.${provider}.${diagnostic.path}`,
    diagnostic.message,
    diagnostic.severity === "warning" ? "warning" : diagnostic.severity,
  );
}

function emptyCompatibilityResult(
  diagnostics: SocialProviderIntegrationCompatibilityDiagnostic[],
): SocialProviderIntegrationOrchestrationCompatibilityResult {
  return deepFreeze({
    compatibilityVersion: SOCIAL_PROVIDER_INTEGRATION_ORCHESTRATION_COMPATIBILITY_VERSION,
    planId: null,
    orchestratorVersion: SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION,
    providerCompatibilities: [],
    contractSnapshots: [],
    contractSummary: summarizeContractCompatibility([]),
    diagnostics,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
}

function compatibilityDiagnostic(
  code: SocialProviderIntegrationCompatibilityErrorCode,
  path: string,
  message: string,
  severity: "error" | "warning" | "block",
): SocialProviderIntegrationCompatibilityDiagnostic {
  return { code, path, message, severity };
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
