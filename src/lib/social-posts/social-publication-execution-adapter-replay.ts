import {
  adapterSupportsChannelType,
  adapterSupportsPlatform,
  evaluateSocialPublicationExecutionAdapterPreflightRequirements,
  type SocialPublicationExecutionAdapterChannelType,
  type SocialPublicationExecutionAdapterContract,
  type SocialPublicationExecutionAdapterPlatform,
} from "./social-publication-execution-adapter";
import { SOCIAL_PUBLICATION_EXECUTION_DRY_RUN_ADAPTER_CONTRACTS } from "./social-publication-execution-adapter-dry-run";
import { replaySocialPublicationExecutionPlanner } from "./social-publication-execution-planner-replay";
import type { SocialPublicationExecutionPlanStep } from "./social-publication-execution-planner";
import type { SocialPublicationExecutionPersistenceModel } from "./social-publication-execution-repository";

export const SOCIAL_PUBLICATION_EXECUTION_ADAPTER_REPLAY_DIAGNOSTIC_CODES = [
  "planner_replay_error",
  "adapter_contract_invalid",
  "channel_hint_invalid",
] as const;

export type SocialPublicationExecutionAdapterReplayDiagnosticCode =
  (typeof SOCIAL_PUBLICATION_EXECUTION_ADAPTER_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPublicationExecutionAdapterReplayDiagnostic = Readonly<{
  code: SocialPublicationExecutionAdapterReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPublicationExecutionAdapterChannelHint = Readonly<{
  executionJobId: string;
  publicationTargetId: string;
  platform: SocialPublicationExecutionAdapterPlatform;
  channelId: string;
  channelType: SocialPublicationExecutionAdapterChannelType;
}>;

export type SocialPublicationExecutionAdapterJobProjection = Readonly<{
  executionJobId: string;
  executionIntentId: string;
  executionResultId: string | null;
  publicationTargetId: string;
  plannerStatus: SocialPublicationExecutionPlanStep["status"];
  requiredAdapterId: string | null;
  requiredPlatform: SocialPublicationExecutionAdapterPlatform | null;
  adapterAvailable: boolean;
  dryRunCapable: boolean;
  unsupportedChannel: boolean;
  adapterBlocked: boolean;
  adapterReady: boolean;
  blockingReasons: readonly string[];
  safetyRequirements: readonly string[];
  preflightRequirementsMissing: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPublicationExecutionAdapterReadModel = Readonly<{
  availableAdapters: readonly SocialPublicationExecutionAdapterContract[];
  missingAdapters: readonly SocialPublicationExecutionAdapterPlatform[];
  adapterReadyJobs: readonly SocialPublicationExecutionAdapterJobProjection[];
  adapterBlockedJobs: readonly SocialPublicationExecutionAdapterJobProjection[];
  dryRunCapableJobs: readonly SocialPublicationExecutionAdapterJobProjection[];
  unsupportedChannelJobs: readonly SocialPublicationExecutionAdapterJobProjection[];
  diagnostics: readonly SocialPublicationExecutionAdapterReplayDiagnostic[];
  summary: Readonly<{
    totalJobCount: number;
    availableAdapterCount: number;
    missingAdapterCount: number;
    adapterReadyJobCount: number;
    adapterBlockedJobCount: number;
    dryRunCapableJobCount: number;
    unsupportedChannelJobCount: number;
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
    source: "publication_execution_adapter_replay";
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

export type SocialPublicationExecutionAdapterReplayResult = Readonly<{
  ok: true;
  value: SocialPublicationExecutionAdapterReadModel;
}>;

export function replaySocialPublicationExecutionAdapters(
  model: SocialPublicationExecutionPersistenceModel,
  input: Readonly<{
    adapters?: readonly SocialPublicationExecutionAdapterContract[];
    channelHints?: readonly SocialPublicationExecutionAdapterChannelHint[];
  }> = {},
): SocialPublicationExecutionAdapterReplayResult {
  const diagnostics: SocialPublicationExecutionAdapterReplayDiagnostic[] = [];
  const adapters = input.adapters ?? SOCIAL_PUBLICATION_EXECUTION_DRY_RUN_ADAPTER_CONTRACTS;
  const channelHints = input.channelHints ?? [];

  for (const adapter of adapters) {
    if (adapter.grantsExecutionPermission !== false || adapter.executesNothing !== true) {
      diagnostics.push({
        code: "adapter_contract_invalid",
        path: `adapters.${adapter.identity.adapterId}`,
        message: "Adapter contract must remain non-executing.",
        severity: "error",
      });
    }
  }

  const plannerReplay = replaySocialPublicationExecutionPlanner(model).value;
  for (const diagnostic of plannerReplay.diagnostics) {
    diagnostics.push({
      code: "planner_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: diagnostic.severity,
    });
  }

  channelHints.forEach((hint, index) => {
    if (!hasText(hint.executionJobId) || !hasText(hint.publicationTargetId)) {
      diagnostics.push({
        code: "channel_hint_invalid",
        path: `channelHints.${index}`,
        message: "Adapter channel hint requires execution job and publication target ids.",
        severity: "error",
      });
    }
  });

  const hintByJobId = new Map(
    channelHints.map((hint) => [hint.executionJobId, hint]),
  );
  const hintByTargetId = new Map(
    channelHints.map((hint) => [hint.publicationTargetId, hint]),
  );
  const intentsByJobId = new Map(
    model.intents.map((intent) => [intent.execution_job_id, intent]),
  );
  const availableAdapters = [...adapters];
  const steps = plannerReplay.executionOrder;

  const projections = steps.map((step) =>
    projectAdapterJob(
      step,
      availableAdapters,
      hintByJobId,
      hintByTargetId,
      intentsByJobId,
    ),
  );

  const requiredPlatforms = uniquePlatforms(
    projections
      .map((projection) => projection.requiredPlatform)
      .filter((platform): platform is SocialPublicationExecutionAdapterPlatform => platform !== null),
  );
  const coveredPlatforms = uniquePlatforms(
    availableAdapters.flatMap((adapter) => [...adapter.capabilities.supportedPlatforms]),
  );
  const missingAdapters = requiredPlatforms.filter(
    (platform) => !coveredPlatforms.includes(platform),
  );

  const adapterReadyJobs = projections.filter((job) => job.adapterReady);
  const adapterBlockedJobs = projections.filter((job) => job.adapterBlocked);
  const dryRunCapableJobs = projections.filter((job) => job.dryRunCapable);
  const unsupportedChannelJobs = projections.filter((job) => job.unsupportedChannel);
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;

  return {
    ok: true,
    value: deepFreeze({
      availableAdapters,
      missingAdapters,
      adapterReadyJobs,
      adapterBlockedJobs,
      dryRunCapableJobs,
      unsupportedChannelJobs,
      diagnostics,
      summary: {
        totalJobCount: projections.length,
        availableAdapterCount: availableAdapters.length,
        missingAdapterCount: missingAdapters.length,
        adapterReadyJobCount: adapterReadyJobs.length,
        adapterBlockedJobCount: adapterBlockedJobs.length,
        dryRunCapableJobCount: dryRunCapableJobs.length,
        unsupportedChannelJobCount: unsupportedChannelJobs.length,
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
        source: "publication_execution_adapter_replay",
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

function projectAdapterJob(
  step: SocialPublicationExecutionPlanStep,
  adapters: readonly SocialPublicationExecutionAdapterContract[],
  hintByJobId: ReadonlyMap<string, SocialPublicationExecutionAdapterChannelHint>,
  hintByTargetId: ReadonlyMap<string, SocialPublicationExecutionAdapterChannelHint>,
  intentsByJobId: ReadonlyMap<
    string,
    SocialPublicationExecutionPersistenceModel["intents"][number]
  >,
): SocialPublicationExecutionAdapterJobProjection {
  const intent = intentsByJobId.get(step.executionJobId);
  const publicationTargetId = intent?.scope.publication_target_id ?? "unknown";
  const hint =
    hintByJobId.get(step.executionJobId) ??
    hintByTargetId.get(publicationTargetId) ??
    null;

  const requiredPlatform = hint?.platform ?? null;
  const adapter = requiredPlatform
    ? adapters.find((candidate) => adapterSupportsPlatform(candidate, requiredPlatform)) ?? null
    : null;
  const requiredAdapterId = adapter?.identity.adapterId ?? null;
  const blockingReasons: string[] = [];
  const safetyRequirements = adapter
    ? safetyRequirementLabels(adapter)
    : ["contract_only", "no_network", "no_oauth", "no_credentials"];

  const channelUnresolved = !hint;
  if (channelUnresolved) blockingReasons.push("channel_unresolved");

  const unsupportedChannel =
    Boolean(hint && adapter && !adapterSupportsChannelType(adapter, hint.channelType));
  if (unsupportedChannel) blockingReasons.push("unsupported_channel");

  const missingAdapter = Boolean(requiredPlatform && !adapter);
  if (missingAdapter) blockingReasons.push("missing_adapter");

  const preflightEvaluation = adapter
    ? evaluateSocialPublicationExecutionAdapterPreflightRequirements(adapter, {
        ownerApprovalPresent: step.presentAuthority.includes("owner_approval"),
        publisherAuthorityPresent: step.presentAuthority.includes("publisher_authority"),
        preflightPassed:
          step.replayState === "preflight_passed" ||
          step.status === "ready" ||
          step.blockingReasons.every((reason) => !reason.startsWith("missing_")),
        publicationTargetPresent: step.presentReferences.includes("publication_target"),
        publisherRequestPresent: step.presentReferences.includes("publisher_request"),
        schedulerIntentPresent: step.presentReferences.includes("scheduler_intent"),
        ledgerEvidencePresent: step.presentReferences.includes("ledger_evidence"),
        manifestReferencePresent: step.presentReferences.includes("publication_manifest"),
      })
    : null;

  if (preflightEvaluation && preflightEvaluation.status === "block") {
    blockingReasons.push(...preflightEvaluation.missingRequirements.map((item) => `preflight_missing:${item}`));
  }

  if (step.status !== "ready") {
    blockingReasons.push(`planner_status:${step.status}`);
  }
  blockingReasons.push(...step.blockingReasons);

  const adapterAvailable = Boolean(adapter);
  const dryRunCapable = Boolean(adapter?.dryRun.dryRunSupported);
  const adapterBlocked =
    channelUnresolved ||
    unsupportedChannel ||
    missingAdapter ||
    step.status !== "ready" ||
    (preflightEvaluation?.status === "block");
  const adapterReady =
    adapterAvailable &&
    dryRunCapable &&
    !unsupportedChannel &&
    !missingAdapter &&
    step.status === "ready" &&
    preflightEvaluation?.status === "pass";

  return {
    executionJobId: step.executionJobId,
    executionIntentId: step.executionIntentId,
    executionResultId: step.executionResultId,
    publicationTargetId: hint?.publicationTargetId ?? publicationTargetId,
    plannerStatus: step.status,
    requiredAdapterId,
    requiredPlatform,
    adapterAvailable,
    dryRunCapable,
    unsupportedChannel,
    adapterBlocked: Boolean(adapterBlocked),
    adapterReady,
    blockingReasons: unique(blockingReasons),
    safetyRequirements,
    preflightRequirementsMissing: preflightEvaluation?.missingRequirements ?? [],
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function safetyRequirementLabels(
  adapter: SocialPublicationExecutionAdapterContract,
): readonly string[] {
  return [
    `contract_only:${String(adapter.safety.contractOnly)}`,
    `no_network:${String(adapter.safety.usesNoNetwork)}`,
    `no_oauth:${String(adapter.safety.usesNoOAuth)}`,
    `no_credentials:${String(adapter.safety.usesNoCredentials)}`,
    `no_external_api:${String(adapter.safety.callsNoExternalApis)}`,
  ];
}

function uniquePlatforms(
  platforms: readonly SocialPublicationExecutionAdapterPlatform[],
): SocialPublicationExecutionAdapterPlatform[] {
  return [...new Set(platforms)];
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
