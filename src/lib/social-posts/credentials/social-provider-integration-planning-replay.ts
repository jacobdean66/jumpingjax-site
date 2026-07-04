import type { SocialCredentialPersistenceModel } from "./social-credential-repository";
import { EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL } from "./social-credential-repository";
import { replaySocialCredentialRuntimeOrchestrator } from "./social-credential-runtime-orchestrator-replay";
import {
  SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION,
  SOCIAL_PROVIDER_INTEGRATION_PLANNING_BUNDLES,
  createSocialProviderIntegrationPlanningBundle,
  detectForbiddenProviderIntegrationState,
  validateSocialProviderIntegrationPlanningBundle,
  type SocialProviderIntegrationPlanningBundle,
} from "./social-provider-integration-planning";
import {
  evaluateSocialProviderIntegrationOrchestrationCompatibility,
  buildSocialProviderIntegrationContractSnapshot,
  SOCIAL_PROVIDER_INTEGRATION_ORCHESTRATION_COMPATIBILITY_VERSION,
  type SocialProviderIntegrationCompatibilityDiagnostic,
  type SocialProviderIntegrationContractSnapshot,
  type SocialProviderIntegrationOrchestrationCompatibility,
  type SocialProviderIntegrationOrchestrationCompatibilityResult,
  type SocialProviderIntegrationOrchestrationContractSummary,
} from "./social-provider-integration-orchestration-compatibility";
import {
  SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS,
  type SocialPlatformCredentialProvider,
} from "../social-platform-credential-boundary";

export const SOCIAL_PROVIDER_INTEGRATION_PLANNING_REPLAY_VERSION =
  SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION;

export const SOCIAL_PROVIDER_INTEGRATION_PLANNING_REPLAY_DIAGNOSTIC_CODES = [
  "planning_bundle_invalid",
  "forbidden_integration_state",
  "orchestration_compatibility_error",
  "unsupported_capability_present",
  "forbidden_capability_present",
] as const;

export type SocialProviderIntegrationPlanningReplayDiagnosticCode =
  (typeof SOCIAL_PROVIDER_INTEGRATION_PLANNING_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialProviderIntegrationPlanningReplayDiagnostic = Readonly<{
  code: SocialProviderIntegrationPlanningReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialProviderIntegrationPlanningProviderProjection = Readonly<{
  provider: SocialPlatformCredentialProvider;
  bundle: SocialProviderIntegrationPlanningBundle;
  contractCoverageComplete: boolean;
  unsupportedCapabilities: readonly string[];
  forbiddenCapabilities: readonly string[];
  supportedCapabilities: readonly string[];
  orchestrationCompatibility: SocialProviderIntegrationOrchestrationCompatibility;
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialProviderIntegrationPlanningReadModel = Readonly<{
  replayVersion: typeof SOCIAL_PROVIDER_INTEGRATION_PLANNING_REPLAY_VERSION;
  planningBundles: readonly SocialProviderIntegrationPlanningBundle[];
  providerProjections: readonly SocialProviderIntegrationPlanningProviderProjection[];
  compatibleProviders: readonly SocialProviderIntegrationPlanningProviderProjection[];
  waitingProviders: readonly SocialProviderIntegrationPlanningProviderProjection[];
  incompatibleProviders: readonly SocialProviderIntegrationPlanningProviderProjection[];
  forbiddenProviders: readonly SocialProviderIntegrationPlanningProviderProjection[];
  contractSnapshots: readonly SocialProviderIntegrationContractSnapshot[];
  orchestrationCompatibility: SocialProviderIntegrationOrchestrationCompatibilityResult;
  contractSummary: SocialProviderIntegrationOrchestrationContractSummary;
  diagnostics: readonly SocialProviderIntegrationPlanningReplayDiagnostic[];
  summary: Readonly<{
    totalProviderCount: number;
    contractCoverageCompleteCount: number;
    compatibleProviderCount: number;
    waitingProviderCount: number;
    incompatibleProviderCount: number;
    forbiddenProviderCount: number;
    unsupportedCapabilityTotal: number;
    forbiddenCapabilityTotal: number;
    orchestrationAlignedCount: number;
    readinessImpactBlockedCount: number;
    diagnosticCount: number;
    errorCount: number;
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
    replayCompatible: true;
    source: "social_provider_integration_planning_replay";
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

export type SocialProviderIntegrationPlanningReplayResult = Readonly<{
  ok: true;
  value: SocialProviderIntegrationPlanningReadModel;
}>;

export function replaySocialProviderIntegrationPlanning(
  model: SocialCredentialPersistenceModel = EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  input: Readonly<{ now?: string }> = {},
): SocialProviderIntegrationPlanningReplayResult {
  const diagnostics: SocialProviderIntegrationPlanningReplayDiagnostic[] = [];
  const now = input.now ?? "2026-07-01T00:00:00.000Z";

  const orchestratorReplay = replaySocialCredentialRuntimeOrchestrator(model, { now });
  const orchestrationCompatibility = evaluateSocialProviderIntegrationOrchestrationCompatibility(
    orchestratorReplay.value.plan,
  );

  for (const diagnostic of orchestrationCompatibility.diagnostics) {
    if (diagnostic.severity === "error") {
      diagnostics.push(mapCompatibilityDiagnostic(diagnostic));
    }
  }

  const providerProjections = SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS.map((provider) => {
    const bundle = createSocialProviderIntegrationPlanningBundle(provider);
    const validation = validateSocialProviderIntegrationPlanningBundle(bundle);
    const forbidden = detectForbiddenProviderIntegrationState(bundle);
    const compatibility = orchestrationCompatibility.providerCompatibilities.find(
      (candidate) => candidate.provider === provider,
    );
    if (!compatibility) {
      diagnostics.push({
        code: "orchestration_compatibility_error",
        path: `providers.${provider}.compatibility`,
        message: "Orchestration compatibility projection is missing for provider.",
        severity: "error",
      });
    }

    if (!validation.valid) {
      diagnostics.push({
        code: "planning_bundle_invalid",
        path: `providers.${provider}.bundle`,
        message: "Provider integration planning bundle failed validation.",
        severity: "error",
      });
    }
    if (!forbidden.valid) {
      diagnostics.push({
        code: "forbidden_integration_state",
        path: `providers.${provider}.forbidden`,
        message: "Forbidden provider integration state detected in planning bundle.",
        severity: "error",
      });
    }
    if (bundle.capabilityContract.unsupportedCapabilities.length > 0) {
      diagnostics.push({
        code: "unsupported_capability_present",
        path: `providers.${provider}.capabilities.unsupported`,
        message: "Unsupported capabilities remain explicitly documented for planning coverage.",
        severity: "warning",
      });
    }
    if (bundle.capabilityContract.forbiddenCapabilities.length > 0) {
      diagnostics.push({
        code: "forbidden_capability_present",
        path: `providers.${provider}.capabilities.forbidden`,
        message: "Forbidden capabilities are documented and must remain blocked.",
        severity: "warning",
      });
    }

    const contractCoverageComplete =
      validation.valid &&
      forbidden.valid &&
      bundle.intents.every((intent) => intent.status === "planned");

    const resolvedCompatibility = compatibility ?? buildMissingCompatibility(provider);

    return deepFreeze({
      provider,
      bundle,
      contractCoverageComplete,
      unsupportedCapabilities: bundle.capabilityContract.unsupportedCapabilities,
      forbiddenCapabilities: bundle.capabilityContract.forbiddenCapabilities,
      supportedCapabilities: bundle.capabilityContract.supportedCapabilities,
      orchestrationCompatibility: resolvedCompatibility,
      blockingReasons: unique([
        ...bundle.intents.flatMap((intent) => intent.blockingReasons),
        ...resolvedCompatibility.blockingReasons,
      ]),
      computedOnly: true as const,
      readOnly: true as const,
      authoritative: false as const,
      grantsExecutionPermission: false as const,
      executesNothing: true as const,
      publishesNothing: true as const,
    });
  });

  const compatibleProviders = providerProjections.filter(
    (projection) => projection.orchestrationCompatibility.status === "compatible",
  );
  const waitingProviders = providerProjections.filter(
    (projection) => projection.orchestrationCompatibility.status === "waiting",
  );
  const incompatibleProviders = providerProjections.filter(
    (projection) => projection.orchestrationCompatibility.status === "incompatible",
  );
  const forbiddenProviders = providerProjections.filter(
    (projection) => projection.orchestrationCompatibility.status === "forbidden",
  );
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;

  return {
    ok: true,
    value: deepFreeze({
      replayVersion: SOCIAL_PROVIDER_INTEGRATION_PLANNING_REPLAY_VERSION,
      planningBundles: [...SOCIAL_PROVIDER_INTEGRATION_PLANNING_BUNDLES],
      providerProjections,
      compatibleProviders,
      waitingProviders,
      incompatibleProviders,
      forbiddenProviders,
      contractSnapshots: orchestrationCompatibility.contractSnapshots,
      orchestrationCompatibility,
      contractSummary: orchestrationCompatibility.contractSummary,
      diagnostics,
      summary: {
        totalProviderCount: providerProjections.length,
        contractCoverageCompleteCount: providerProjections.filter(
          (projection) => projection.contractCoverageComplete,
        ).length,
        compatibleProviderCount: compatibleProviders.length,
        waitingProviderCount: waitingProviders.length,
        incompatibleProviderCount: incompatibleProviders.length,
        forbiddenProviderCount: forbiddenProviders.length,
        unsupportedCapabilityTotal: orchestrationCompatibility.contractSummary.unsupportedCapabilityTotal,
        forbiddenCapabilityTotal: orchestrationCompatibility.contractSummary.forbiddenCapabilityTotal,
        orchestrationAlignedCount: orchestrationCompatibility.contractSummary.orchestrationAlignedCount,
        readinessImpactBlockedCount:
          orchestrationCompatibility.contractSummary.readinessImpactBlockedCount,
        diagnosticCount: diagnostics.length,
        errorCount,
        computedOnly: true,
        readOnly: true,
        authoritative: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
      replayIntegrity: {
        valid: errorCount === 0,
        deterministic: true,
        replayCompatible: true,
        source: "social_provider_integration_planning_replay",
        computedOnly: true,
        authoritative: false,
      },
      computedOnly: true,
      readOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    }),
  };
}

function mapCompatibilityDiagnostic(
  diagnostic: SocialProviderIntegrationCompatibilityDiagnostic,
): SocialProviderIntegrationPlanningReplayDiagnostic {
  return {
    code: "orchestration_compatibility_error",
    path: diagnostic.path,
    message: diagnostic.message,
    severity: diagnostic.severity === "warning" ? "warning" : "error",
  };
}

function buildMissingCompatibility(
  provider: SocialPlatformCredentialProvider,
): SocialProviderIntegrationOrchestrationCompatibility {
  const bundle = createSocialProviderIntegrationPlanningBundle(provider);
  return deepFreeze({
    compatibilityId: `integration-orchestration-compatibility-${provider}`,
    provider,
    status: "incompatible",
    orchestratorVersion: bundle.orchestratorVersion,
    planningVersion: bundle.planningVersion,
    providerOrchestrationId: null,
    orchestrationStatus: null,
    fullyOrchestrated: false,
    contractSnapshot: buildSocialProviderIntegrationContractSnapshot(bundle),
    contractCoverageComplete: false,
    unsupportedCapabilityCount: bundle.capabilityContract.unsupportedCapabilities.length,
    forbiddenCapabilityCount: bundle.capabilityContract.forbiddenCapabilities.length,
    orchestrationContractAligned: false,
    readinessImpactBlocked: true,
    blockingReasons: ["orchestration_compatibility_missing"],
    diagnostics: [],
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
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

export { SOCIAL_PROVIDER_INTEGRATION_ORCHESTRATION_COMPATIBILITY_VERSION };
