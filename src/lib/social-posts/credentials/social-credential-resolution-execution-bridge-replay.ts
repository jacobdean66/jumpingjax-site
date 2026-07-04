import type { SocialCredentialPersistenceModel } from "./social-credential-repository";
import { EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL } from "./social-credential-repository";
import type { SocialCredentialRuntimeOrchestrationPlan } from "./social-credential-runtime-orchestrator";
import { replaySocialCredentialRuntimeOrchestrator } from "./social-credential-runtime-orchestrator-replay";
import {
  SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BRIDGE_VERSION,
  buildSocialCredentialResolutionExecutionPlan,
  type SocialCredentialResolutionExecutionDiagnostic,
  type SocialCredentialResolutionExecutionPlan,
  type SocialCredentialResolutionProviderExecutionPlan,
} from "./social-credential-resolution-execution-bridge";
import {
  SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS,
  type SocialPlatformCredentialProvider,
} from "../social-platform-credential-boundary";

export const SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BRIDGE_REPLAY_VERSION =
  SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BRIDGE_VERSION;

export const SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BRIDGE_REPLAY_DIAGNOSTIC_CODES = [
  "resolution_plan_invalid",
  "orchestration_replay_error",
  "reference_coverage_incomplete",
  "planning_incomplete",
] as const;

export type SocialCredentialResolutionExecutionBridgeReplayDiagnosticCode =
  (typeof SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BRIDGE_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialCredentialResolutionExecutionBridgeReplayDiagnostic = Readonly<{
  code: SocialCredentialResolutionExecutionBridgeReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialCredentialResolutionExecutionProviderProjection = Readonly<{
  provider: SocialPlatformCredentialProvider;
  providerPlan: SocialCredentialResolutionProviderExecutionPlan;
  referenceCoverageComplete: boolean;
  planningComplete: boolean;
  orchestrationAligned: boolean;
  auditCompatible: boolean;
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialResolutionExecutionBridgeReadModel = Readonly<{
  replayVersion: typeof SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BRIDGE_REPLAY_VERSION;
  plan: SocialCredentialResolutionExecutionPlan;
  providerProjections: readonly SocialCredentialResolutionExecutionProviderProjection[];
  plannedProviders: readonly SocialCredentialResolutionExecutionProviderProjection[];
  waitingProviders: readonly SocialCredentialResolutionExecutionProviderProjection[];
  blockedProviders: readonly SocialCredentialResolutionExecutionProviderProjection[];
  referenceCoverageCompleteProviders: readonly SocialCredentialResolutionExecutionProviderProjection[];
  orchestrationAlignedProviders: readonly SocialCredentialResolutionExecutionProviderProjection[];
  diagnostics: readonly SocialCredentialResolutionExecutionBridgeReplayDiagnostic[];
  summary: Readonly<{
    totalProviderCount: number;
    plannedProviderCount: number;
    waitingProviderCount: number;
    blockedProviderCount: number;
    referenceCoverageCompleteCount: number;
    planningCompleteCount: number;
    orchestrationAlignedCount: number;
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
    replayCompatible: true;
    source: "social_credential_resolution_execution_bridge_replay";
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

export type SocialCredentialResolutionExecutionBridgeReplayResult = Readonly<{
  ok: true;
  value: SocialCredentialResolutionExecutionBridgeReadModel;
}>;

export function composeCredentialResolutionExecutionBridgeReadModel(
  model: SocialCredentialPersistenceModel,
  orchestrationPlan: SocialCredentialRuntimeOrchestrationPlan,
  now: string,
): SocialCredentialResolutionExecutionBridgeReadModel {
  const diagnostics: SocialCredentialResolutionExecutionBridgeReplayDiagnostic[] = [];

  const plan = buildSocialCredentialResolutionExecutionPlan({
    planId: "credential-resolution-execution-plan",
    createdAt: now,
    model,
    orchestrationPlan,
  });

  for (const diagnostic of plan.diagnostics) {
    if (diagnostic.severity === "error") {
      diagnostics.push(mapPlanDiagnostic(diagnostic));
    }
  }

  const providerProjections = buildProviderProjections(plan, diagnostics);
  return buildReadModel(plan, providerProjections, diagnostics);
}

export function replaySocialCredentialResolutionExecutionBridge(
  model: SocialCredentialPersistenceModel = EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  input: Readonly<{
    now?: string;
    orchestrationPlan?: SocialCredentialRuntimeOrchestrationPlan;
  }> = {},
): SocialCredentialResolutionExecutionBridgeReplayResult {
  const diagnostics: SocialCredentialResolutionExecutionBridgeReplayDiagnostic[] = [];
  const now = input.now ?? "2026-07-01T00:00:00.000Z";

  if (input.orchestrationPlan) {
    return {
      ok: true,
      value: composeCredentialResolutionExecutionBridgeReadModel(
        model,
        input.orchestrationPlan,
        now,
      ),
    };
  }

  const orchestratorReplay = replaySocialCredentialRuntimeOrchestrator(model, { now });
  for (const diagnostic of orchestratorReplay.value.diagnostics) {
    if (diagnostic.severity !== "error") continue;
    diagnostics.push({
      code: "orchestration_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: "error",
    });
  }

  const readModel = composeCredentialResolutionExecutionBridgeReadModel(
    model,
    orchestratorReplay.value.plan,
    now,
  );

  return {
    ok: true,
    value: deepFreeze({
      ...readModel,
      diagnostics: [...diagnostics, ...readModel.diagnostics],
      summary: {
        ...readModel.summary,
        diagnosticCount: diagnostics.length + readModel.summary.diagnosticCount,
        errorCount:
          diagnostics.filter((diagnostic) => diagnostic.severity === "error").length +
          readModel.summary.errorCount,
      },
      replayIntegrity: {
        ...readModel.replayIntegrity,
        valid:
          diagnostics.every((diagnostic) => diagnostic.severity !== "error") &&
          readModel.replayIntegrity.valid,
      },
    }),
  };
}

function buildProviderProjections(
  plan: SocialCredentialResolutionExecutionPlan,
  diagnostics: SocialCredentialResolutionExecutionBridgeReplayDiagnostic[],
): SocialCredentialResolutionExecutionProviderProjection[] {
  return SOCIAL_PLATFORM_CREDENTIAL_PROVIDERS.map((provider) => {
    const providerPlan = plan.providerPlans.find((candidate) => candidate.provider === provider);
    if (!providerPlan) {
      diagnostics.push({
        code: "resolution_plan_invalid",
        path: `providers.${provider}`,
        message: "Resolution provider execution plan is missing.",
        severity: "error",
      });
      return null;
    }

    if (!providerPlan.referenceCoverageComplete) {
      diagnostics.push({
        code: "reference_coverage_incomplete",
        path: `providers.${provider}.referenceCoverage`,
        message: `Provider reference coverage is incomplete for ${provider}.`,
        severity: "warning",
      });
    }
    if (!providerPlan.planningComplete) {
      diagnostics.push({
        code: "planning_incomplete",
        path: `providers.${provider}.planning`,
        message: `Resolution execution planning is incomplete for ${provider}.`,
        severity: "warning",
      });
    }

    return projectProvider(providerPlan);
  }).filter((projection): projection is SocialCredentialResolutionExecutionProviderProjection =>
    projection !== null,
  );
}

function buildReadModel(
  plan: SocialCredentialResolutionExecutionPlan,
  providerProjections: readonly SocialCredentialResolutionExecutionProviderProjection[],
  diagnostics: readonly SocialCredentialResolutionExecutionBridgeReplayDiagnostic[],
): SocialCredentialResolutionExecutionBridgeReadModel {
  const plannedProviders = providerProjections.filter((provider) => provider.providerPlan.status === "planned");
  const waitingProviders = providerProjections.filter((provider) => provider.providerPlan.status === "waiting");
  const blockedProviders = providerProjections.filter((provider) => provider.providerPlan.status === "blocked");
  const referenceCoverageCompleteProviders = providerProjections.filter(
    (provider) => provider.referenceCoverageComplete,
  );
  const orchestrationAlignedProviders = providerProjections.filter(
    (provider) => provider.orchestrationAligned,
  );
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;

  return deepFreeze({
    replayVersion: SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BRIDGE_REPLAY_VERSION,
    plan,
    providerProjections,
    plannedProviders,
    waitingProviders,
    blockedProviders,
    referenceCoverageCompleteProviders,
    orchestrationAlignedProviders,
    diagnostics,
    summary: {
      totalProviderCount: providerProjections.length,
      plannedProviderCount: plannedProviders.length,
      waitingProviderCount: waitingProviders.length,
      blockedProviderCount: blockedProviders.length,
      referenceCoverageCompleteCount: referenceCoverageCompleteProviders.length,
      planningCompleteCount: providerProjections.filter((provider) => provider.planningComplete).length,
      orchestrationAlignedCount: orchestrationAlignedProviders.length,
      auditCompatibleCount: providerProjections.filter((provider) => provider.auditCompatible).length,
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
      replayCompatible: true,
      source: "social_credential_resolution_execution_bridge_replay",
      computedOnly: true,
      authoritative: false,
    },
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
}

function projectProvider(
  providerPlan: SocialCredentialResolutionProviderExecutionPlan,
): SocialCredentialResolutionExecutionProviderProjection {
  return deepFreeze({
    provider: providerPlan.provider,
    providerPlan,
    referenceCoverageComplete: providerPlan.referenceCoverageComplete,
    planningComplete: providerPlan.planningComplete,
    orchestrationAligned: providerPlan.orchestrationReadiness.fullyOrchestrated,
    auditCompatible: providerPlan.auditCompatibility.appendOnlyCompatible,
    blockingReasons: providerPlan.blockingReasons,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
}

function mapPlanDiagnostic(
  diagnostic: SocialCredentialResolutionExecutionDiagnostic,
): SocialCredentialResolutionExecutionBridgeReplayDiagnostic {
  return {
    code: "resolution_plan_invalid",
    path: diagnostic.path,
    message: diagnostic.message,
    severity: diagnostic.severity === "block" ? "error" : diagnostic.severity,
  };
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
