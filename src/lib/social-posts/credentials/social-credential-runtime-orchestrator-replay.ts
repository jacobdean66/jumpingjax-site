import {
  buildSocialCredentialRuntimeOrchestrationPlan,
  SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_PIPELINE_ORDER,
  SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION,
  type SocialCredentialRuntimeAuditIntegration,
  type SocialCredentialRuntimeCapabilityAggregation,
  type SocialCredentialRuntimeOrchestrationPlan,
  type SocialCredentialRuntimeOrchestratorDependencyNode,
  type SocialCredentialRuntimeOrchestratorPipelinePhase,
  type SocialCredentialRuntimeOrchestratorProviderJob,
  type SocialCredentialRuntimeReadinessAggregation,
  type SocialCredentialRuntimeResolutionFlow,
  type SocialCredentialRuntimeResolutionStep,
} from "./social-credential-runtime-orchestrator";
import { replaySocialCredentialAdminDiagnostics } from "./social-credential-diagnostics-replay";
import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  type SocialCredentialPersistenceModel,
} from "./social-credential-repository";
import {
  replaySocialCredentialReadiness,
  type SocialCredentialProviderReadinessProjection,
} from "./social-credential-readiness-replay";
import {
  platformsForProvider,
  requiredCredentialKindsForProvider,
  SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS,
  type SocialPlatformCredentialProvider,
} from "../social-platform-credential-boundary";
import { replaySocialPlatformCredentialBoundary } from "../social-platform-credential-boundary-replay";
import { replaySocialPlatformReadinessGate } from "../social-platform-readiness-gate-replay";
import {
  evaluateSocialProviderIntegrationOrchestrationCompatibility,
  type SocialProviderIntegrationOrchestrationCompatibilityResult,
} from "./social-provider-integration-orchestration-compatibility";

export const SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_REPLAY_VERSION =
  SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION;

export const SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_REPLAY_DIAGNOSTIC_CODES = [
  "readiness_replay_error",
  "admin_diagnostics_replay_error",
  "credential_boundary_replay_error",
  "readiness_gate_replay_error",
  "orchestration_validation_error",
] as const;

export type SocialCredentialRuntimeOrchestratorReplayDiagnosticCode =
  (typeof SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialCredentialRuntimeOrchestratorReplayDiagnostic = Readonly<{
  code: SocialCredentialRuntimeOrchestratorReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialCredentialRuntimeOrchestratorProviderProjection = Readonly<{
  provider: SocialPlatformCredentialProvider;
  orchestrationStatus: SocialCredentialRuntimeOrchestratorProviderJob["orchestrationStatus"];
  orchestrationPlan: SocialCredentialRuntimeOrchestratorProviderJob;
  pipelinePhases: readonly SocialCredentialRuntimeOrchestratorPipelinePhase[];
  dependencyGraph: readonly SocialCredentialRuntimeOrchestratorDependencyNode[];
  capabilityAggregation: SocialCredentialRuntimeCapabilityAggregation;
  readinessAggregation: SocialCredentialRuntimeReadinessAggregation;
  auditIntegration: SocialCredentialRuntimeAuditIntegration;
  resolutionFlow: SocialCredentialRuntimeResolutionFlow;
  dependencyFailures: readonly string[];
  fullyOrchestrated: boolean;
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialRuntimeOrchestratorReadModel = Readonly<{
  replayVersion: typeof SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_REPLAY_VERSION;
  plan: SocialCredentialRuntimeOrchestrationPlan;
  fullyOrchestratedProviders: readonly SocialCredentialRuntimeOrchestratorProviderProjection[];
  waitingProviders: readonly SocialCredentialRuntimeOrchestratorProviderProjection[];
  blockedProviders: readonly SocialCredentialRuntimeOrchestratorProviderProjection[];
  dependencyFailureProviders: readonly SocialCredentialRuntimeOrchestratorProviderProjection[];
  resolutionCompleteProviders: readonly SocialCredentialRuntimeOrchestratorProviderProjection[];
  readinessReadyProviders: readonly SocialCredentialRuntimeOrchestratorProviderProjection[];
  auditCompatibleProviders: readonly SocialCredentialRuntimeOrchestratorProviderProjection[];
  diagnostics: readonly SocialCredentialRuntimeOrchestratorReplayDiagnostic[];
  summary: Readonly<{
    totalProviderCount: number;
    fullyOrchestratedProviderCount: number;
    waitingProviderCount: number;
    blockedProviderCount: number;
    dependencyFailureCount: number;
    resolutionCompleteCount: number;
    readinessReadyCount: number;
    auditCompatibleCount: number;
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
    source: "social_credential_runtime_orchestrator_replay";
    computedOnly: true;
    authoritative: false;
  }>;
  providerIntegrationCompatibility: SocialProviderIntegrationOrchestrationCompatibilityResult;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialRuntimeOrchestratorReplayResult = Readonly<{
  ok: true;
  value: SocialCredentialRuntimeOrchestratorReadModel;
}>;

const REQUIRED_CAPABILITY_FLAGS = [
  "credential_reference_only",
  "live_credentials_blocked",
  "live_oauth_blocked",
  "encryption_blocked",
  "network_blocked",
  "execution_blocked",
] as const;

export function replaySocialCredentialRuntimeOrchestrator(
  model: SocialCredentialPersistenceModel = EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  input: Readonly<{ now?: string }> = {},
): SocialCredentialRuntimeOrchestratorReplayResult {
  const diagnostics: SocialCredentialRuntimeOrchestratorReplayDiagnostic[] = [];
  const now = input.now ?? "2026-07-01T00:00:00.000Z";

  const readinessReplay = replaySocialCredentialReadiness(model).value;
  for (const diagnostic of readinessReplay.diagnostics) {
    if (diagnostic.severity === "warning") continue;
    diagnostics.push({
      code: "readiness_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: diagnostic.severity === "block" ? "error" : diagnostic.severity,
    });
  }

  const adminDiagnostics = replaySocialCredentialAdminDiagnostics(model);
  if (!adminDiagnostics.persistenceModelValid || !adminDiagnostics.domainMappingValid) {
    diagnostics.push({
      code: "admin_diagnostics_replay_error",
      path: "adminDiagnostics",
      message: "Credential admin diagnostics reported persistence or mapping validation failures.",
      severity: "error",
    });
  }

  const credentialBoundaryReplay = replaySocialPlatformCredentialBoundary(undefined, {
    credentialModel: model,
  }).value;
  for (const diagnostic of credentialBoundaryReplay.diagnostics) {
    if (diagnostic.severity !== "error") continue;
    diagnostics.push({
      code: "credential_boundary_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: "warning",
    });
  }

  const readinessGateReplay = replaySocialPlatformReadinessGate(undefined, {
    credentialModel: model,
  }).value;
  for (const diagnostic of readinessGateReplay.diagnostics) {
    if (diagnostic.severity !== "error") continue;
    diagnostics.push({
      code: "readiness_gate_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: "warning",
    });
  }

  const readinessByProvider = new Map(
    readinessReplay.providerReadiness.map((projection) => [projection.provider, projection]),
  );
  const boundaryByProvider = new Map(
    credentialBoundaryReplay.providerReadiness.map((projection) => [projection.provider, projection]),
  );
  const architecturallyReadyByProvider = countArchitecturallyReadyPlatforms(
    readinessGateReplay.architecturallyReadyPlatforms.map((platform) => platform.platform),
  );
  const architecturallyBlockedByProvider = countArchitecturallyBlockedPlatforms(
    readinessGateReplay.architecturallyBlockedPlatforms.map((platform) => platform.platform),
  );

  const orchestratedProviders = SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS.map((provider, index) => {
    const readinessProjection = readinessByProvider.get(provider);
    const boundaryProjection = boundaryByProvider.get(provider);
    const job = buildOrchestratedProviderJob(
      provider,
      readinessProjection,
      boundaryProjection,
      adminDiagnostics,
      architecturallyReadyByProvider.get(provider) ?? 0,
      architecturallyBlockedByProvider.get(provider) ?? 0,
      now,
    );

    if (job.blockingReasons.some((reason) => reason.startsWith("phase_blocked:"))) {
      diagnostics.push({
        code: "orchestration_validation_error",
        path: `providers.${index}`,
        message: "Credential runtime orchestration validation failed for provider projection.",
        severity: "warning",
      });
    }

    return projectOrchestratorProvider(job);
  });

  const plan = buildSocialCredentialRuntimeOrchestrationPlan({
    planId: "credential-runtime-orchestration-plan",
    createdAt: now,
    providerJobs: orchestratedProviders.map((projection) => projection.orchestrationPlan),
  });

  for (const diagnostic of plan.diagnostics) {
    if (diagnostic.severity === "error") {
      diagnostics.push({
        code: "orchestration_validation_error",
        path: diagnostic.path,
        message: diagnostic.message,
        severity: diagnostic.severity,
      });
    }
  }

  const fullyOrchestratedProviders = orchestratedProviders.filter((provider) => provider.fullyOrchestrated);
  const waitingProviders = orchestratedProviders.filter(
    (provider) => provider.orchestrationStatus === "waiting",
  );
  const blockedProviders = orchestratedProviders.filter(
    (provider) => provider.orchestrationStatus === "blocked",
  );
  const dependencyFailureProviders = orchestratedProviders.filter(
    (provider) => provider.dependencyFailures.length > 0,
  );
  const resolutionCompleteProviders = orchestratedProviders.filter(
    (provider) => provider.resolutionFlow.resolutionComplete,
  );
  const readinessReadyProviders = orchestratedProviders.filter(
    (provider) => provider.readinessAggregation.credentialReady,
  );
  const auditCompatibleProviders = orchestratedProviders.filter(
    (provider) => provider.auditIntegration.appendOnlyCompatible,
  );
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const providerIntegrationCompatibility =
    evaluateSocialProviderIntegrationOrchestrationCompatibility(plan);

  return {
    ok: true,
    value: deepFreeze({
      replayVersion: SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_REPLAY_VERSION,
      plan,
      fullyOrchestratedProviders,
      waitingProviders,
      blockedProviders,
      dependencyFailureProviders,
      resolutionCompleteProviders,
      readinessReadyProviders,
      auditCompatibleProviders,
      diagnostics,
      summary: {
        totalProviderCount: orchestratedProviders.length,
        fullyOrchestratedProviderCount: fullyOrchestratedProviders.length,
        waitingProviderCount: waitingProviders.length,
        blockedProviderCount: blockedProviders.length,
        dependencyFailureCount: dependencyFailureProviders.length,
        resolutionCompleteCount: resolutionCompleteProviders.length,
        readinessReadyCount: readinessReadyProviders.length,
        auditCompatibleCount: auditCompatibleProviders.length,
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
        valid: errorCount === 0 && plan.valid,
        deterministic: true,
        source: "social_credential_runtime_orchestrator_replay",
        computedOnly: true,
        authoritative: false,
      },
      providerIntegrationCompatibility,
      computedOnly: true,
      readOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    }),
  };
}

function buildOrchestratedProviderJob(
  provider: SocialPlatformCredentialProvider,
  readinessProjection: SocialCredentialProviderReadinessProjection | undefined,
  boundaryProjection: ReturnType<typeof replaySocialPlatformCredentialBoundary>["value"]["providerReadiness"][number] | undefined,
  adminDiagnostics: ReturnType<typeof replaySocialCredentialAdminDiagnostics>,
  architecturallyReadyPlatformCount: number,
  architecturallyBlockedPlatformCount: number,
  updatedAt: string,
): SocialCredentialRuntimeOrchestratorProviderJob {
  const persistenceValid = adminDiagnostics.persistenceModelValid;
  const domainMappingValid = adminDiagnostics.domainMappingValid;
  const dependencyGraph = buildDependencyGraph(readinessProjection, adminDiagnostics);
  const dependencyFailures = dependencyGraph
    .filter((node) => node.blocksOrchestration)
    .map((node) => node.nodeId);
  const capabilityAggregation = buildCapabilityAggregation(provider, boundaryProjection);
  const readinessAggregation = buildReadinessAggregation(
    provider,
    readinessProjection,
    architecturallyReadyPlatformCount,
    architecturallyBlockedPlatformCount,
  );
  const auditIntegration = buildAuditIntegration(provider, adminDiagnostics);
  const resolutionFlow = buildResolutionFlow(provider, readinessProjection);
  const pipelinePhases = buildPipelinePhases(
    persistenceValid,
    domainMappingValid,
    dependencyFailures,
    readinessAggregation,
    capabilityAggregation,
    auditIntegration,
    resolutionFlow,
  );
  const blockingReasons = collectProviderBlockingReasons(
    pipelinePhases,
    dependencyFailures,
    readinessAggregation,
    capabilityAggregation,
    auditIntegration,
    resolutionFlow,
  );
  const orchestrationStatus = resolveProviderOrchestrationStatus(pipelinePhases);
  const fullyOrchestrated =
    orchestrationStatus === "orchestrated" &&
    dependencyFailures.length === 0 &&
    resolutionFlow.resolutionComplete &&
    readinessAggregation.credentialReady &&
    auditIntegration.appendOnlyCompatible;

  return {
    providerOrchestrationId: `provider-orchestration-${provider}`,
    provider,
    orchestrationStatus,
    pipelinePhases,
    dependencyGraph,
    capabilityAggregation,
    readinessAggregation,
    auditIntegration,
    resolutionFlow,
    dependencyFailures,
    blockingReasons,
    fullyOrchestrated,
    updatedAt,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    mutatesNothing: true,
  };
}

function buildPipelinePhases(
  persistenceValid: boolean,
  domainMappingValid: boolean,
  dependencyFailures: readonly string[],
  readinessAggregation: SocialCredentialRuntimeReadinessAggregation,
  capabilityAggregation: SocialCredentialRuntimeCapabilityAggregation,
  auditIntegration: SocialCredentialRuntimeAuditIntegration,
  resolutionFlow: SocialCredentialRuntimeResolutionFlow,
): readonly SocialCredentialRuntimeOrchestratorPipelinePhase[] {
  const dependencyBlocked = dependencyFailures.length > 0;

  const phaseSpecs: readonly [
    SocialCredentialRuntimeOrchestratorPipelinePhase["kind"],
    string,
    string,
    SocialCredentialRuntimeOrchestratorPipelinePhase["status"],
    boolean,
  ][] = [
    [
      "persistence_validation",
      "Persistence validation",
      "Verify credential persistence model passes reference-only validation.",
      persistenceValid ? "passed" : "blocked",
      !persistenceValid,
    ],
    [
      "domain_mapping_validation",
      "Domain mapping validation",
      "Verify domain mappings from persistence rows are valid.",
      domainMappingValid ? "passed" : "blocked",
      !domainMappingValid,
    ],
    [
      "dependency_composition",
      "Dependency composition",
      "Verify required provider dependencies are composed and present.",
      dependencyBlocked ? "blocked" : persistenceValid && domainMappingValid ? "ready" : "waiting",
      dependencyBlocked,
    ],
    [
      "readiness_aggregation",
      "Readiness aggregation",
      "Aggregate provider credential readiness from D13 replay.",
      readinessAggregation.credentialReady ? "ready" : readinessAggregation.credentialBlocked ? "blocked" : "waiting",
      readinessAggregation.credentialBlocked,
    ],
    [
      "capability_aggregation",
      "Capability aggregation",
      "Aggregate provider capability flags from boundary contracts.",
      capabilityAggregation.missingCapabilityFlags.length === 0 ? "ready" : "blocked",
      capabilityAggregation.missingCapabilityFlags.length > 0,
    ],
    [
      "audit_append_compatibility",
      "Audit append compatibility",
      "Verify append-only audit integration compatibility.",
      auditIntegration.appendOnlyCompatible ? "ready" : "blocked",
      !auditIntegration.appendOnlyCompatible,
    ],
    [
      "resolution_flow",
      "Resolution flow",
      "Verify provider-agnostic credential resolution steps are complete.",
      resolutionFlow.resolutionComplete ? "ready" : "blocked",
      !resolutionFlow.resolutionComplete,
    ],
  ];

  return phaseSpecs.map(([kind, label, description, status, blocksOrchestration], index) => ({
    phaseId: `phase-${kind}`,
    order: index + 1,
    kind,
    label,
    description,
    status,
    required: true,
    blocksOrchestration,
    computedOnly: true as const,
    readOnly: true as const,
    authoritative: false as const,
    grantsExecutionPermission: false as const,
    executesNothing: true as const,
    publishesNothing: true as const,
  }));
}

function buildDependencyGraph(
  readinessProjection: SocialCredentialProviderReadinessProjection | undefined,
  adminDiagnostics: ReturnType<typeof replaySocialCredentialAdminDiagnostics>,
): readonly SocialCredentialRuntimeOrchestratorDependencyNode[] {
  const missingDependencies = readinessProjection?.missingDependencies ?? [
    "provider_account",
    "vault_record",
    "lifecycle_state",
    "key_version",
  ];
  const requiredDependencies = [
    "provider_account",
    "vault_record",
    "lifecycle_state",
    "key_version",
    "repository_contract",
    "domain_mapping",
  ] as const;

  const dependencyNodes = requiredDependencies.map((dependency) => {
    const present =
      dependency === "repository_contract"
        ? adminDiagnostics.repositoryCompletenessSummary.repositoryContractComplete
        : dependency === "domain_mapping"
          ? adminDiagnostics.domainMappingValid
          : !missingDependencies.includes(dependency);

    return {
      nodeId: dependency,
      label: `Dependency: ${dependency}`,
      dependencyType: dependency,
      present,
      blocksOrchestration: !present && dependency !== "key_version",
      computedOnly: true as const,
      readOnly: true as const,
    };
  });

  return dependencyNodes;
}

function buildCapabilityAggregation(
  provider: SocialPlatformCredentialProvider,
  boundaryProjection: ReturnType<typeof replaySocialPlatformCredentialBoundary>["value"]["providerReadiness"][number] | undefined,
): SocialCredentialRuntimeCapabilityAggregation {
  const satisfiedCapabilityFlags = REQUIRED_CAPABILITY_FLAGS.filter((flag) => {
    if (flag === "credential_reference_only") return boundaryProjection?.credentialReferenceOnly === true;
    if (flag === "live_credentials_blocked") return boundaryProjection?.liveCredentialsBlocked === true;
    if (flag === "live_oauth_blocked") return boundaryProjection?.liveOAuthBlocked === true;
    return true;
  });
  const missingCapabilityFlags = REQUIRED_CAPABILITY_FLAGS.filter(
    (flag) => !satisfiedCapabilityFlags.includes(flag),
  );
  const blockingReasons = unique([
    ...(boundaryProjection?.blockingReasons ?? ["credential_boundary_missing"]),
    ...missingCapabilityFlags.map((flag) => `missing_capability:${flag}`),
  ]);

  return {
    aggregationId: `capability-aggregation-${provider}`,
    provider,
    credentialReferenceOnly: true,
    liveCredentialsBlocked: true,
    liveOAuthBlocked: true,
    encryptionBlocked: true,
    networkBlocked: true,
    executionBlocked: true,
    satisfiedCapabilityFlags,
    missingCapabilityFlags,
    blockingReasons,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
  };
}

function buildReadinessAggregation(
  provider: SocialPlatformCredentialProvider,
  readinessProjection: SocialCredentialProviderReadinessProjection | undefined,
  architecturallyReadyPlatformCount: number,
  architecturallyBlockedPlatformCount: number,
): SocialCredentialRuntimeReadinessAggregation {
  const credentialReady = readinessProjection?.credentialReady ?? false;
  const credentialBlocked = readinessProjection?.credentialBlocked ?? true;
  const blockingReasons = unique([
    ...(readinessProjection?.blockingReasons ?? ["readiness_projection_missing"]),
    ...(readinessProjection?.missingCredentialKinds.map((kind) => `missing_kind:${kind}`) ?? []),
  ]);

  return {
    aggregationId: `readiness-aggregation-${provider}`,
    provider,
    credentialReady,
    credentialBlocked,
    architecturallyReadyPlatformCount,
    architecturallyBlockedPlatformCount,
    blockingReasons,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
  };
}

function buildAuditIntegration(
  provider: SocialPlatformCredentialProvider,
  adminDiagnostics: ReturnType<typeof replaySocialCredentialAdminDiagnostics>,
): SocialCredentialRuntimeAuditIntegration {
  const appendOnly = adminDiagnostics.repositoryCompletenessSummary.appendOnlyAuditCompatibility;
  const blockingReasons = appendOnly.complete
    ? []
    : unique([
        ...(appendOnly.forbiddenAuditMutationsPresent.map(
          (operation) => `forbidden_audit_mutation:${operation}`,
        )),
        ...(appendOnly.appendAuditEventAvailable ? [] : ["append_audit_event_unavailable"]),
        ...(appendOnly.preservesAppendOnlyHistory ? [] : ["append_only_history_not_preserved"]),
      ]);

  return {
    integrationId: `audit-integration-${provider}`,
    appendOnlyCompatible: appendOnly.complete,
    appendAuditEventAvailable: appendOnly.appendAuditEventAvailable,
    preservesAppendOnlyHistory: appendOnly.preservesAppendOnlyHistory,
    auditEventCount: adminDiagnostics.lifecycleSummary.auditEventCount,
    blockingReasons,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    mutatesNothing: true,
    grantsExecutionPermission: false,
  };
}

function buildResolutionFlow(
  provider: SocialPlatformCredentialProvider,
  readinessProjection: SocialCredentialProviderReadinessProjection | undefined,
): SocialCredentialRuntimeResolutionFlow {
  const requiredKinds = requiredCredentialKindsForProvider(provider);
  const satisfiedKinds = new Set(readinessProjection?.satisfiedCredentialKinds ?? []);
  const steps: SocialCredentialRuntimeResolutionStep[] = requiredKinds.map((kind, index) => {
    const resolved = satisfiedKinds.has(kind);
    return {
      stepId: `resolution-${provider}-${kind}`,
      order: index + 1,
      label: `Resolve ${kind} reference for ${provider}`,
      provider,
      credentialKind: kind,
      resolved,
      blocksOrchestration: !resolved,
      computedOnly: true,
      readOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
    };
  });

  const providerAgnosticStep: SocialCredentialRuntimeResolutionStep = {
    stepId: `resolution-${provider}-provider-agnostic`,
    order: steps.length + 1,
    label: `Verify provider-agnostic resolution contract for ${provider}`,
    provider,
    credentialKind: null,
    resolved: Boolean(readinessProjection && platformsForProvider(provider).length > 0),
    blocksOrchestration: platformsForProvider(provider).length === 0,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
  };

  const allSteps = [...steps, providerAgnosticStep];
  const resolvedStepCount = allSteps.filter((step) => step.resolved).length;
  const unresolvedStepCount = allSteps.length - resolvedStepCount;
  const blockingReasons = allSteps
    .filter((step) => !step.resolved)
    .map((step) =>
      step.credentialKind
        ? `unresolved_kind:${step.credentialKind}`
        : "provider_agnostic_resolution_incomplete",
    );

  return {
    flowId: `resolution-flow-${provider}`,
    provider,
    providerAgnostic: true,
    steps: allSteps,
    resolvedStepCount,
    unresolvedStepCount,
    resolutionComplete: unresolvedStepCount === 0,
    blockingReasons,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function collectProviderBlockingReasons(
  phases: readonly SocialCredentialRuntimeOrchestratorPipelinePhase[],
  dependencyFailures: readonly string[],
  readinessAggregation: SocialCredentialRuntimeReadinessAggregation,
  capabilityAggregation: SocialCredentialRuntimeCapabilityAggregation,
  auditIntegration: SocialCredentialRuntimeAuditIntegration,
  resolutionFlow: SocialCredentialRuntimeResolutionFlow,
): readonly string[] {
  const reasons = new Set<string>();

  for (const phase of phases) {
    if (phase.blocksOrchestration) {
      reasons.add(`phase_blocked:${phase.kind}`);
    }
  }
  for (const failure of dependencyFailures) {
    reasons.add(`dependency_failure:${failure}`);
  }
  for (const reason of readinessAggregation.blockingReasons) {
    reasons.add(`readiness_blocked:${reason}`);
  }
  for (const reason of capabilityAggregation.blockingReasons) {
    reasons.add(`capability_blocked:${reason}`);
  }
  for (const reason of auditIntegration.blockingReasons) {
    reasons.add(`audit_blocked:${reason}`);
  }
  for (const reason of resolutionFlow.blockingReasons) {
    reasons.add(`resolution_blocked:${reason}`);
  }

  return [...reasons];
}

function resolveProviderOrchestrationStatus(
  phases: readonly SocialCredentialRuntimeOrchestratorPipelinePhase[],
): SocialCredentialRuntimeOrchestratorProviderJob["orchestrationStatus"] {
  if (phases.some((phase) => phase.status === "blocked" && phase.blocksOrchestration)) {
    return "blocked";
  }
  if (phases.some((phase) => phase.status === "waiting")) return "waiting";
  if (phases.every((phase) => phase.status === "ready" || phase.status === "passed")) {
    return "orchestrated";
  }
  return "waiting";
}

function projectOrchestratorProvider(
  job: SocialCredentialRuntimeOrchestratorProviderJob,
): SocialCredentialRuntimeOrchestratorProviderProjection {
  return {
    provider: job.provider,
    orchestrationStatus: job.orchestrationStatus,
    orchestrationPlan: job,
    pipelinePhases: job.pipelinePhases,
    dependencyGraph: job.dependencyGraph,
    capabilityAggregation: job.capabilityAggregation,
    readinessAggregation: job.readinessAggregation,
    auditIntegration: job.auditIntegration,
    resolutionFlow: job.resolutionFlow,
    dependencyFailures: job.dependencyFailures,
    fullyOrchestrated: job.fullyOrchestrated,
    blockingReasons: job.blockingReasons,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function countArchitecturallyReadyPlatforms(
  platforms: readonly string[],
): ReadonlyMap<SocialPlatformCredentialProvider, number> {
  const counts = new Map<SocialPlatformCredentialProvider, number>();
  for (const provider of SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS) {
    counts.set(provider, 0);
  }
  for (const platform of platforms) {
    for (const provider of SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS) {
      if (platformsForProvider(provider).includes(platform as never)) {
        counts.set(provider, (counts.get(provider) ?? 0) + 1);
      }
    }
  }
  return counts;
}

function countArchitecturallyBlockedPlatforms(
  platforms: readonly string[],
): ReadonlyMap<SocialPlatformCredentialProvider, number> {
  return countArchitecturallyReadyPlatforms(platforms);
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

export { SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_PIPELINE_ORDER };
