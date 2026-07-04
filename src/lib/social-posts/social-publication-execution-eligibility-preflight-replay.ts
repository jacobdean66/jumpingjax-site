import { EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL } from "./credentials/social-credential-repository";
import { replaySocialCredentialResolutionExecutionBridge } from "./credentials/social-credential-resolution-execution-bridge-replay";
import { replaySocialCredentialRuntimeOrchestrator } from "./credentials/social-credential-runtime-orchestrator-replay";
import { replaySocialCredentialReadiness } from "./credentials/social-credential-readiness-replay";
import type { SocialPlatformCredentialProvider } from "./social-platform-credential-boundary";
import {
  evaluateSocialPublicationExecutionEligibilityPreflight,
  SOCIAL_PUBLICATION_EXECUTION_ELIGIBILITY_PREFLIGHT_VERSION,
  type SocialPublicationExecutionEligibilityBlockedReason,
  type SocialPublicationExecutionEligibilityEvaluation,
  type SocialPublicationExecutionEligibilityPreflightContext,
  type SocialPublicationExecutionEligibilityProviderContext,
} from "./social-publication-execution-eligibility-preflight";
import { replaySocialPublicationExecution } from "./social-publication-execution-replay";
import {
  validateSocialPublicationExecutionPersistenceModel,
  type SocialPublicationExecutionIntentRecord,
  type SocialPublicationExecutionPersistenceModel,
  type SocialPublicationExecutionResultRecord,
} from "./social-publication-execution-repository";

export const SOCIAL_PUBLICATION_EXECUTION_ELIGIBILITY_PREFLIGHT_REPLAY_VERSION =
  SOCIAL_PUBLICATION_EXECUTION_ELIGIBILITY_PREFLIGHT_VERSION;

export const SOCIAL_PUBLICATION_EXECUTION_ELIGIBILITY_PREFLIGHT_REPLAY_DIAGNOSTIC_CODES = [
  "persistence_validation_failed",
  "credential_readiness_replay_error",
  "orchestration_replay_error",
  "resolution_bridge_replay_error",
] as const;

export type SocialPublicationExecutionEligibilityPreflightReplayDiagnosticCode =
  (typeof SOCIAL_PUBLICATION_EXECUTION_ELIGIBILITY_PREFLIGHT_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPublicationExecutionEligibilityPreflightReplayDiagnostic = Readonly<{
  code: SocialPublicationExecutionEligibilityPreflightReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPublicationExecutionEligibilityJobProjection = Readonly<{
  executionJobId: string;
  executionIntentId: string;
  executionResultId: string | null;
  publicationTargetId: string | null;
  resolvedProviders: readonly SocialPlatformCredentialProvider[];
  replayState: "pending" | "blocked" | "preflight_passed" | "failed" | "completed";
  eligibilityStatus: "pass" | "block";
  d10PreflightStatus: "pass" | "block";
  blockingReasons: readonly SocialPublicationExecutionEligibilityBlockedReason[];
  aggregatedBlockingCodes: readonly string[];
  credentialReady: boolean;
  orchestrationReady: boolean;
  providerCapabilityReady: boolean;
  auditAppendCompatible: boolean;
  couldRunLater: boolean;
  updatedAt: string;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPublicationExecutionEligibilityPreflightReplaySummary = Readonly<{
  totalJobCount: number;
  eligibilityPassJobCount: number;
  eligibilityBlockedJobCount: number;
  d10BlockedJobCount: number;
  credentialBlockedJobCount: number;
  orchestrationBlockedJobCount: number;
  providerCapabilityBlockedJobCount: number;
  providerUnresolvedJobCount: number;
  auditIncompatibleJobCount: number;
  diagnosticCount: number;
  errorCount: number;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPublicationExecutionEligibilityPreflightReadModel = Readonly<{
  replayVersion: typeof SOCIAL_PUBLICATION_EXECUTION_ELIGIBILITY_PREFLIGHT_REPLAY_VERSION;
  eligibilityPassJobs: readonly SocialPublicationExecutionEligibilityJobProjection[];
  eligibilityBlockedJobs: readonly SocialPublicationExecutionEligibilityJobProjection[];
  credentialBlockedJobs: readonly SocialPublicationExecutionEligibilityJobProjection[];
  orchestrationBlockedJobs: readonly SocialPublicationExecutionEligibilityJobProjection[];
  providerCapabilityBlockedJobs: readonly SocialPublicationExecutionEligibilityJobProjection[];
  providerUnresolvedJobs: readonly SocialPublicationExecutionEligibilityJobProjection[];
  auditIncompatibleJobs: readonly SocialPublicationExecutionEligibilityJobProjection[];
  diagnostics: readonly SocialPublicationExecutionEligibilityPreflightReplayDiagnostic[];
  summary: SocialPublicationExecutionEligibilityPreflightReplaySummary;
  replayIntegrity: Readonly<{
    valid: boolean;
    deterministic: true;
    replayCompatible: true;
    auditAppendCompatible: boolean;
    source: "publication_execution_eligibility_preflight_replay";
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

export type SocialPublicationExecutionEligibilityPreflightReplayResult = Readonly<{
  ok: true;
  value: SocialPublicationExecutionEligibilityPreflightReadModel;
}>;

export function buildSocialPublicationExecutionEligibilityPreflightContext(
  credentialModel = EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  now = "2026-07-01T00:00:00.000Z",
): Readonly<{
  context: SocialPublicationExecutionEligibilityPreflightContext;
  diagnostics: SocialPublicationExecutionEligibilityPreflightReplayDiagnostic[];
}> {
  const diagnostics: SocialPublicationExecutionEligibilityPreflightReplayDiagnostic[] = [];

  const credentialReadiness = replaySocialCredentialReadiness(credentialModel).value;
  for (const diagnostic of credentialReadiness.diagnostics) {
    if (diagnostic.severity === "warning") continue;
    diagnostics.push({
      code: "credential_readiness_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: diagnostic.severity === "block" ? "error" : diagnostic.severity,
    });
  }

  const orchestratorReplay = replaySocialCredentialRuntimeOrchestrator(credentialModel, { now }).value;
  for (const diagnostic of orchestratorReplay.diagnostics) {
    if (diagnostic.severity !== "error") continue;
    diagnostics.push({
      code: "orchestration_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: "error",
    });
  }

  const resolutionBridgeReplay = replaySocialCredentialResolutionExecutionBridge(credentialModel, {
    orchestrationPlan: orchestratorReplay.plan,
    now,
  }).value;
  for (const diagnostic of resolutionBridgeReplay.diagnostics) {
    if (diagnostic.severity !== "error") continue;
    diagnostics.push({
      code: "resolution_bridge_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: "error",
    });
  }

  const orchestratorByProvider = new Map(
    [
      ...orchestratorReplay.fullyOrchestratedProviders,
      ...orchestratorReplay.waitingProviders,
      ...orchestratorReplay.blockedProviders,
    ].map((provider) => [provider.provider, provider]),
  );
  const resolutionByProvider = new Map(
    resolutionBridgeReplay.providerProjections.map((provider) => [provider.provider, provider]),
  );
  const readinessByProvider = new Map(
    credentialReadiness.providerReadiness.map((provider) => [provider.provider, provider]),
  );

  const providerContexts: Partial<
    Record<SocialPlatformCredentialProvider, SocialPublicationExecutionEligibilityProviderContext>
  > = {};
  for (const provider of readinessByProvider.keys()) {
    providerContexts[provider] = {
      credentialReadiness: readinessByProvider.get(provider) ?? null,
      orchestratorProvider: orchestratorByProvider.get(provider) ?? null,
      resolutionProvider: resolutionByProvider.get(provider) ?? null,
    };
  }

  return {
    context: {
      credentialModel,
      providerContexts,
    },
    diagnostics,
  };
}

export function replaySocialPublicationExecutionEligibilityPreflight(
  executionModel: SocialPublicationExecutionPersistenceModel,
  credentialModel = EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  now = "2026-07-01T00:00:00.000Z",
): SocialPublicationExecutionEligibilityPreflightReplayResult {
  const diagnostics: SocialPublicationExecutionEligibilityPreflightReplayDiagnostic[] = [];
  const validation = validateSocialPublicationExecutionPersistenceModel(executionModel);
  if (!validation.ok) {
    for (const validationError of validation.errors) {
      diagnostics.push({
        code: "persistence_validation_failed",
        path: validationError.path,
        message: validationError.message,
        severity: "error",
      });
    }
  }

  const readableModel = readableExecutionModel(executionModel);
  const { context, diagnostics: contextDiagnostics } =
    buildSocialPublicationExecutionEligibilityPreflightContext(credentialModel, now);
  diagnostics.push(...contextDiagnostics);

  const executionReplay = readableModel
    ? replaySocialPublicationExecution(executionModel).value
    : null;
  const replayJobsByIntent = new Map(
    executionReplay
      ? [
          ...executionReplay.pendingJobs,
          ...executionReplay.blockedJobs,
          ...executionReplay.preflightPassedJobs,
          ...executionReplay.failedJobs,
          ...executionReplay.completedJobs,
        ].map((job) => [job.executionIntentId, job])
      : [],
  );
  const resultsByIntent = new Map<string, SocialPublicationExecutionResultRecord>();
  for (const result of readableModel?.results ?? []) {
    if (!resultsByIntent.has(result.execution_intent_id)) {
      resultsByIntent.set(result.execution_intent_id, result);
    }
  }

  const evaluations = readableModel
    ? sortEligibilityJobs(
        readableModel.intents.map((intent) => {
          const result = resultsByIntent.get(intent.execution_intent_id) ?? null;
          const evaluation = evaluateSocialPublicationExecutionEligibilityPreflight(
            intent,
            result,
            context,
          );
          const replayJob = replayJobsByIntent.get(intent.execution_intent_id);
          return projectEligibilityJob(intent, result, evaluation, replayJob?.state ?? "pending");
        }),
      )
    : [];

  const eligibilityPassJobs = evaluations.filter((job) => job.eligibilityStatus === "pass");
  const eligibilityBlockedJobs = evaluations.filter((job) => job.eligibilityStatus === "block");
  const credentialBlockedJobs = evaluations.filter((job) => !job.credentialReady);
  const orchestrationBlockedJobs = evaluations.filter((job) => !job.orchestrationReady);
  const providerCapabilityBlockedJobs = evaluations.filter((job) => !job.providerCapabilityReady);
  const providerUnresolvedJobs = evaluations.filter(
    (job) => job.resolvedProviders.length === 0,
  );
  const auditIncompatibleJobs = evaluations.filter((job) => !job.auditAppendCompatible);
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;

  return {
    ok: true,
    value: deepFreeze({
      replayVersion: SOCIAL_PUBLICATION_EXECUTION_ELIGIBILITY_PREFLIGHT_REPLAY_VERSION,
      eligibilityPassJobs,
      eligibilityBlockedJobs,
      credentialBlockedJobs,
      orchestrationBlockedJobs,
      providerCapabilityBlockedJobs,
      providerUnresolvedJobs,
      auditIncompatibleJobs,
      diagnostics,
      summary: {
        totalJobCount: evaluations.length,
        eligibilityPassJobCount: eligibilityPassJobs.length,
        eligibilityBlockedJobCount: eligibilityBlockedJobs.length,
        d10BlockedJobCount: evaluations.filter((job) => job.d10PreflightStatus === "block").length,
        credentialBlockedJobCount: credentialBlockedJobs.length,
        orchestrationBlockedJobCount: orchestrationBlockedJobs.length,
        providerCapabilityBlockedJobCount: providerCapabilityBlockedJobs.length,
        providerUnresolvedJobCount: providerUnresolvedJobs.length,
        auditIncompatibleJobCount: auditIncompatibleJobs.length,
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
        auditAppendCompatible: auditIncompatibleJobs.length === 0,
        source: "publication_execution_eligibility_preflight_replay",
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

function readableExecutionModel(
  model: SocialPublicationExecutionPersistenceModel,
): SocialPublicationExecutionPersistenceModel | null {
  const candidate = model as Readonly<{
    intents?: unknown;
    results?: unknown;
  }>;
  if (!Array.isArray(candidate.intents) || !Array.isArray(candidate.results)) {
    return null;
  }

  return {
    intents: candidate.intents as readonly SocialPublicationExecutionIntentRecord[],
    results: candidate.results as readonly SocialPublicationExecutionResultRecord[],
  };
}

function projectEligibilityJob(
  intent: SocialPublicationExecutionIntentRecord,
  result: SocialPublicationExecutionResultRecord | null,
  evaluation: SocialPublicationExecutionEligibilityEvaluation,
  replayState: SocialPublicationExecutionEligibilityJobProjection["replayState"],
): SocialPublicationExecutionEligibilityJobProjection {
  return {
    executionJobId: intent.execution_job_id,
    executionIntentId: intent.execution_intent_id,
    executionResultId: result?.execution_result_id ?? null,
    publicationTargetId: evaluation.publicationTargetId,
    resolvedProviders: evaluation.resolvedProviders,
    replayState,
    eligibilityStatus: evaluation.status,
    d10PreflightStatus: evaluation.d10Preflight.status,
    blockingReasons: evaluation.blockingReasons,
    aggregatedBlockingCodes: evaluation.aggregatedBlockingCodes,
    credentialReady: evaluation.readiness.credential.credentialReady,
    orchestrationReady:
      evaluation.readiness.orchestration.fullyOrchestrated &&
      evaluation.readiness.orchestration.orchestrationAligned,
    providerCapabilityReady: evaluation.readiness.providerCapability.capabilityReady,
    auditAppendCompatible: evaluation.readiness.auditAppendCompatible,
    couldRunLater: evaluation.couldRunLater,
    updatedAt: result?.updated_at ?? intent.updated_at,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function sortEligibilityJobs(
  jobs: readonly SocialPublicationExecutionEligibilityJobProjection[],
): SocialPublicationExecutionEligibilityJobProjection[] {
  return [...jobs].sort(
    (left, right) =>
      left.updatedAt.localeCompare(right.updatedAt) ||
      left.executionJobId.localeCompare(right.executionJobId),
  );
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }

  return Object.freeze(value);
}
