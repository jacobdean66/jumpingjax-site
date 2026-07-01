import {
  buildSocialPublicationExecutionCoordinationPlan,
  SOCIAL_PUBLICATION_EXECUTION_COORDINATOR_PIPELINE_ORDER,
  type SocialPublicationExecutionCoordinatorAdapterSelection,
  type SocialPublicationExecutionCoordinatorAuthorityNode,
  type SocialPublicationExecutionCoordinatorDependencyNode,
  type SocialPublicationExecutionCoordinatorJob,
  type SocialPublicationExecutionCoordinatorPipelinePhase,
  type SocialPublicationExecutionCoordinationPlan,
} from "./social-publication-execution-coordinator";
import {
  replaySocialPublicationExecutionAdapters,
  type SocialPublicationExecutionAdapterChannelHint,
  type SocialPublicationExecutionAdapterJobProjection,
} from "./social-publication-execution-adapter-replay";
import { replaySocialPublicationExecutionPreflight } from "./social-publication-execution-preflight-replay";
import type { SocialPublicationExecutionPreflightJobProjection } from "./social-publication-execution-preflight-replay";
import type { SocialPublicationExecutionPlanStep } from "./social-publication-execution-planner";
import { replaySocialPublicationExecutionPlanner } from "./social-publication-execution-planner-replay";
import {
  replaySocialPublicationExecutionRunbooks,
  type SocialPublicationExecutionRunbookJobProjection,
} from "./social-publication-execution-runbook-replay";
import type { SocialPublicationExecutionPersistenceModel } from "./social-publication-execution-repository";

export const SOCIAL_PUBLICATION_EXECUTION_COORDINATOR_REPLAY_DIAGNOSTIC_CODES = [
  "preflight_replay_error",
  "planner_replay_error",
  "adapter_replay_error",
  "runbook_replay_error",
  "coordination_validation_error",
] as const;

export type SocialPublicationExecutionCoordinatorReplayDiagnosticCode =
  (typeof SOCIAL_PUBLICATION_EXECUTION_COORDINATOR_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPublicationExecutionCoordinatorReplayDiagnostic = Readonly<{
  code: SocialPublicationExecutionCoordinatorReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPublicationExecutionCoordinatorJobProjection = Readonly<{
  executionJobId: string;
  executionIntentId: string;
  executionResultId: string | null;
  coordinationStatus: SocialPublicationExecutionCoordinatorJob["coordinationStatus"];
  coordinationPlan: SocialPublicationExecutionCoordinatorJob;
  pipelinePhases: readonly SocialPublicationExecutionCoordinatorPipelinePhase[];
  dependencyGraph: readonly SocialPublicationExecutionCoordinatorDependencyNode[];
  authorityGraph: readonly SocialPublicationExecutionCoordinatorAuthorityNode[];
  adapterSelection: SocialPublicationExecutionCoordinatorAdapterSelection;
  dependencyFailures: readonly string[];
  authorityFailures: readonly string[];
  adapterReady: boolean;
  runbookReady: boolean;
  fullyCoordinated: boolean;
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPublicationExecutionCoordinatorReadModel = Readonly<{
  plan: SocialPublicationExecutionCoordinationPlan;
  fullyCoordinatedJobs: readonly SocialPublicationExecutionCoordinatorJobProjection[];
  waitingJobs: readonly SocialPublicationExecutionCoordinatorJobProjection[];
  blockedJobs: readonly SocialPublicationExecutionCoordinatorJobProjection[];
  dependencyFailureJobs: readonly SocialPublicationExecutionCoordinatorJobProjection[];
  authorityFailureJobs: readonly SocialPublicationExecutionCoordinatorJobProjection[];
  adapterReadyJobs: readonly SocialPublicationExecutionCoordinatorJobProjection[];
  runbookReadyJobs: readonly SocialPublicationExecutionCoordinatorJobProjection[];
  diagnostics: readonly SocialPublicationExecutionCoordinatorReplayDiagnostic[];
  summary: Readonly<{
    totalJobCount: number;
    fullyCoordinatedJobCount: number;
    waitingJobCount: number;
    blockedJobCount: number;
    dependencyFailureCount: number;
    authorityFailureCount: number;
    adapterReadyCount: number;
    runbookReadyCount: number;
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
    source: "publication_execution_coordinator_replay";
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

export type SocialPublicationExecutionCoordinatorReplayResult = Readonly<{
  ok: true;
  value: SocialPublicationExecutionCoordinatorReadModel;
}>;

export function replaySocialPublicationExecutionCoordinator(
  model: SocialPublicationExecutionPersistenceModel,
  input: Readonly<{
    channelHints?: readonly SocialPublicationExecutionAdapterChannelHint[];
    now?: string;
  }> = {},
): SocialPublicationExecutionCoordinatorReplayResult {
  const diagnostics: SocialPublicationExecutionCoordinatorReplayDiagnostic[] = [];
  const now = input.now ?? "2026-07-01T00:00:00.000Z";

  const preflightReplay = replaySocialPublicationExecutionPreflight(model).value;
  for (const diagnostic of preflightReplay.diagnostics) {
    diagnostics.push({
      code: "preflight_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: diagnostic.severity,
    });
  }

  const plannerReplay = replaySocialPublicationExecutionPlanner(model, now).value;
  for (const diagnostic of plannerReplay.diagnostics) {
    diagnostics.push({
      code: "planner_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: diagnostic.severity,
    });
  }

  const adapterReplay = replaySocialPublicationExecutionAdapters(model, {
    channelHints: input.channelHints,
  }).value;
  for (const diagnostic of adapterReplay.diagnostics) {
    diagnostics.push({
      code: "adapter_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: diagnostic.severity,
    });
  }

  const runbookReplay = replaySocialPublicationExecutionRunbooks(model, {
    channelHints: input.channelHints,
    now,
  }).value;
  for (const diagnostic of runbookReplay.diagnostics) {
    diagnostics.push({
      code: "runbook_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: diagnostic.severity,
    });
  }

  const preflightByIntent = new Map(
    [
      ...preflightReplay.preflightPassJobs,
      ...preflightReplay.preflightBlockedJobs,
    ].map((job) => [job.executionIntentId, job]),
  );
  const adapterByJob = new Map(
    [
      ...adapterReplay.adapterReadyJobs,
      ...adapterReplay.adapterBlockedJobs,
      ...adapterReplay.dryRunCapableJobs,
      ...adapterReplay.unsupportedChannelJobs,
    ].map((job) => [job.executionJobId, job]),
  );
  const plannerByJob = new Map(
    plannerReplay.executionOrder.map((step) => [step.executionJobId, step]),
  );
  const runbookByJob = new Map(
    [
      ...runbookReplay.readyRunbooks,
      ...runbookReplay.blockedRunbooks,
    ].map((job) => [job.executionJobId, job]),
  );

  const coordinatedJobs = model.intents.map((intent, index) => {
    const preflightJob = preflightByIntent.get(intent.execution_intent_id);
    const adapterJob = adapterByJob.get(intent.execution_job_id);
    const plannerStep = plannerByJob.get(intent.execution_job_id);
    const runbookJob = runbookByJob.get(intent.execution_job_id);

    const job = buildCoordinatedJob(
      intent.execution_job_id,
      intent.execution_intent_id,
      preflightJob,
      plannerStep,
      adapterJob,
      runbookJob,
      now,
    );

    if (job.blockingReasons.some((reason) => reason.startsWith("phase_blocked:"))) {
      diagnostics.push({
        code: "coordination_validation_error",
        path: `intents.${index}`,
        message: "Execution coordination validation failed for job projection.",
        severity: "warning",
      });
    }

    return projectCoordinatorJob(job);
  });

  const plan = buildSocialPublicationExecutionCoordinationPlan({
    planId: "publication-execution-coordination-plan",
    createdAt: now,
    jobs: coordinatedJobs.map((projection) => projection.coordinationPlan),
  });

  for (const diagnostic of plan.diagnostics) {
    if (diagnostic.severity === "error") {
      diagnostics.push({
        code: "coordination_validation_error",
        path: diagnostic.path,
        message: diagnostic.message,
        severity: diagnostic.severity,
      });
    }
  }

  const fullyCoordinatedJobs = coordinatedJobs.filter((job) => job.fullyCoordinated);
  const waitingJobs = coordinatedJobs.filter((job) => job.coordinationStatus === "waiting");
  const blockedJobs = coordinatedJobs.filter((job) => job.coordinationStatus === "blocked");
  const dependencyFailureJobs = coordinatedJobs.filter((job) => job.dependencyFailures.length > 0);
  const authorityFailureJobs = coordinatedJobs.filter((job) => job.authorityFailures.length > 0);
  const adapterReadyJobs = coordinatedJobs.filter((job) => job.adapterReady);
  const runbookReadyJobs = coordinatedJobs.filter((job) => job.runbookReady);
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;

  return {
    ok: true,
    value: deepFreeze({
      plan,
      fullyCoordinatedJobs,
      waitingJobs,
      blockedJobs,
      dependencyFailureJobs,
      authorityFailureJobs,
      adapterReadyJobs,
      runbookReadyJobs,
      diagnostics,
      summary: {
        totalJobCount: coordinatedJobs.length,
        fullyCoordinatedJobCount: fullyCoordinatedJobs.length,
        waitingJobCount: waitingJobs.length,
        blockedJobCount: blockedJobs.length,
        dependencyFailureCount: dependencyFailureJobs.length,
        authorityFailureCount: authorityFailureJobs.length,
        adapterReadyCount: adapterReadyJobs.length,
        runbookReadyCount: runbookReadyJobs.length,
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
        source: "publication_execution_coordinator_replay",
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

function buildCoordinatedJob(
  executionJobId: string,
  executionIntentId: string,
  preflightJob: SocialPublicationExecutionPreflightJobProjection | undefined,
  plannerStep: SocialPublicationExecutionPlanStep | undefined,
  adapterJob: SocialPublicationExecutionAdapterJobProjection | undefined,
  runbookJob: SocialPublicationExecutionRunbookJobProjection | undefined,
  updatedAt: string,
): SocialPublicationExecutionCoordinatorJob {
  const preflightPassed = preflightJob?.preflightStatus === "pass";
  const plannerReady = plannerStep?.status === "ready";
  const plannerWaiting = plannerStep?.status === "waiting";
  const plannerBlocked = plannerStep?.status === "blocked" || plannerStep?.status === "completed";
  const adapterReady = adapterJob?.adapterReady ?? false;
  const runbookReady = runbookJob?.runbookStatus === "ready";

  const dependencyGraph = buildDependencyGraph(preflightJob, plannerStep);
  const authorityGraph = buildAuthorityGraph(preflightJob);
  const adapterSelection = buildAdapterSelection(executionJobId, adapterJob);
  const dependencyFailures = dependencyGraph
    .filter((node) => node.blocksCoordination)
    .map((node) => node.nodeId);
  const authorityFailures = authorityGraph
    .filter((node) => node.blocksCoordination)
    .map((node) => node.nodeId);

  const pipelinePhases = buildPipelinePhases(
    preflightPassed,
    dependencyFailures,
    authorityFailures,
    plannerReady,
    plannerWaiting,
    plannerBlocked,
    adapterReady,
    runbookReady,
  );

  const blockingReasons = collectJobBlockingReasons(
    pipelinePhases,
    dependencyFailures,
    authorityFailures,
    adapterJob,
    runbookJob,
    plannerStep,
  );
  const coordinationStatus = resolveJobCoordinationStatus(
    pipelinePhases,
    plannerStep,
    preflightJob,
  );
  const fullyCoordinated =
    coordinationStatus === "coordinated" &&
    adapterReady &&
    runbookReady &&
    dependencyFailures.length === 0 &&
    authorityFailures.length === 0;

  return {
    executionJobId,
    executionIntentId,
    executionResultId: preflightJob?.executionResultId ?? null,
    coordinationStatus,
    pipelinePhases,
    dependencyGraph,
    authorityGraph,
    adapterSelection,
    plannerStepStatus: plannerStep?.status ?? null,
    runbookStatus: runbookJob?.runbookStatus ?? null,
    preflightStatus: preflightJob?.preflightStatus ?? null,
    blockingReasons,
    fullyCoordinated,
    adapterReady,
    runbookReady,
    dependencyFailures,
    authorityFailures,
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
  preflightPassed: boolean,
  dependencyFailures: readonly string[],
  authorityFailures: readonly string[],
  plannerReady: boolean,
  plannerWaiting: boolean,
  plannerBlocked: boolean,
  adapterReady: boolean,
  runbookReady: boolean,
): readonly SocialPublicationExecutionCoordinatorPipelinePhase[] {
  const dependencyBlocked = dependencyFailures.length > 0;
  const authorityBlocked = authorityFailures.length > 0;

  const phaseSpecs: readonly [
    SocialPublicationExecutionCoordinatorPipelinePhase["kind"],
    string,
    string,
    SocialPublicationExecutionCoordinatorPipelinePhase["status"],
    boolean,
  ][] = [
    [
      "preflight_gate",
      "Preflight gate",
      "Verify preflight diagnostics pass for this job.",
      preflightPassed ? "passed" : "blocked",
      !preflightPassed,
    ],
    [
      "dependency_validation",
      "Dependency validation",
      "Verify required references and dependencies are present.",
      dependencyBlocked ? "blocked" : preflightPassed ? "ready" : "waiting",
      dependencyBlocked,
    ],
    [
      "authority_validation",
      "Authority validation",
      "Verify owner approval and publisher authority evidence.",
      authorityBlocked ? "blocked" : preflightPassed ? "ready" : "waiting",
      authorityBlocked,
    ],
    [
      "planner_planning",
      "Planner planning",
      "Verify planner marks this job as ready in execution order.",
      plannerReady ? "ready" : plannerWaiting ? "waiting" : plannerBlocked ? "blocked" : "waiting",
      plannerBlocked,
    ],
    [
      "adapter_selection",
      "Adapter selection",
      "Verify reference adapter contract is selected and ready.",
      adapterReady ? "ready" : "blocked",
      !adapterReady,
    ],
    [
      "runbook_readiness",
      "Runbook readiness",
      "Verify runbook readiness and operator checklist prerequisites.",
      runbookReady ? "ready" : "blocked",
      !runbookReady,
    ],
  ];

  return phaseSpecs.map(([kind, label, description, status, blocksCoordination], index) => ({
    phaseId: `phase-${kind}`,
    order: index + 1,
    kind,
    label,
    description,
    status,
    required: true,
    blocksCoordination,
    computedOnly: true as const,
    readOnly: true as const,
    authoritative: false as const,
    grantsExecutionPermission: false as const,
    executesNothing: true as const,
    publishesNothing: true as const,
  }));
}

function buildDependencyGraph(
  preflightJob: SocialPublicationExecutionPreflightJobProjection | undefined,
  plannerStep: SocialPublicationExecutionPlanStep | undefined,
): readonly SocialPublicationExecutionCoordinatorDependencyNode[] {
  const missingReferences = preflightJob?.missingReferences ?? [
    "owner_approval",
    "publication_target",
    "ledger_evidence",
    "publisher_request",
    "scheduler_intent",
    "publication_manifest",
  ];
  const requiredReferences = [
    "owner_approval",
    "publication_target",
    "ledger_evidence",
    "publisher_request",
    "scheduler_intent",
    "publication_manifest",
  ] as const;

  const referenceNodes = requiredReferences.map((reference) => ({
    nodeId: reference,
    label: `Reference: ${reference}`,
    dependencyType: reference,
    present: !missingReferences.includes(reference),
    blocksCoordination: missingReferences.includes(reference),
    computedOnly: true as const,
    readOnly: true as const,
  }));

  const plannerDependencies = (plannerStep?.dependencyGraph ?? []).map((dependency) => ({
    nodeId: `planner-${dependency.dependencyId}`,
    label: `Planner dependency: ${dependency.dependencyType}`,
    dependencyType: dependency.dependencyType,
    present: dependency.present,
    blocksCoordination: dependency.blocksStep,
    computedOnly: true as const,
    readOnly: true as const,
  }));

  return [...referenceNodes, ...plannerDependencies];
}

function buildAuthorityGraph(
  preflightJob: SocialPublicationExecutionPreflightJobProjection | undefined,
): readonly SocialPublicationExecutionCoordinatorAuthorityNode[] {
  const ownerPresent = preflightJob?.authorityPresent.owner ?? false;
  const publisherPresent = preflightJob?.authorityPresent.publisher ?? false;

  return [
    {
      nodeId: "owner_approval",
      label: "Owner approval authority",
      authorityType: "owner_approval" as const,
      present: ownerPresent,
      blocksCoordination: !ownerPresent,
      computedOnly: true as const,
      readOnly: true as const,
    },
    {
      nodeId: "publisher_authority",
      label: "Publisher authority",
      authorityType: "publisher_authority" as const,
      present: publisherPresent,
      blocksCoordination: !publisherPresent,
      computedOnly: true as const,
      readOnly: true as const,
    },
  ];
}

function buildAdapterSelection(
  executionJobId: string,
  adapterJob: SocialPublicationExecutionAdapterJobProjection | undefined,
): SocialPublicationExecutionCoordinatorAdapterSelection {
  return {
    selectionId: `adapter-selection-${executionJobId}`,
    adapterId: adapterJob?.requiredAdapterId ?? null,
    platform: adapterJob?.requiredPlatform ?? null,
    available: adapterJob?.adapterAvailable ?? false,
    dryRunCapable: adapterJob?.dryRunCapable ?? false,
    adapterReady: adapterJob?.adapterReady ?? false,
    unsupportedChannel: adapterJob?.unsupportedChannel ?? false,
    blockingReasons: adapterJob?.blockingReasons ?? ["adapter_unavailable"],
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
  };
}

function collectJobBlockingReasons(
  phases: readonly SocialPublicationExecutionCoordinatorPipelinePhase[],
  dependencyFailures: readonly string[],
  authorityFailures: readonly string[],
  adapterJob: SocialPublicationExecutionAdapterJobProjection | undefined,
  runbookJob: SocialPublicationExecutionRunbookJobProjection | undefined,
  plannerStep: SocialPublicationExecutionPlanStep | undefined,
): readonly string[] {
  const reasons = new Set<string>();

  for (const phase of phases) {
    if (phase.blocksCoordination) {
      reasons.add(`phase_blocked:${phase.kind}`);
    }
  }
  for (const failure of dependencyFailures) {
    reasons.add(`dependency_failure:${failure}`);
  }
  for (const failure of authorityFailures) {
    reasons.add(`authority_failure:${failure}`);
  }
  for (const reason of adapterJob?.blockingReasons ?? []) {
    reasons.add(`adapter_blocked:${reason}`);
  }
  for (const reason of runbookJob?.blockedReasons ?? []) {
    reasons.add(`runbook_blocked:${reason}`);
  }
  for (const reason of plannerStep?.blockingReasons ?? []) {
    reasons.add(`planner_blocked:${reason}`);
  }

  return [...reasons];
}

function resolveJobCoordinationStatus(
  phases: readonly SocialPublicationExecutionCoordinatorPipelinePhase[],
  plannerStep: SocialPublicationExecutionPlanStep | undefined,
  preflightJob: SocialPublicationExecutionPreflightJobProjection | undefined,
): SocialPublicationExecutionCoordinatorJob["coordinationStatus"] {
  if (preflightJob?.unsafe || plannerStep?.unsafe) return "blocked";
  if (phases.some((phase) => phase.status === "blocked" && phase.blocksCoordination)) {
    return "blocked";
  }
  if (phases.some((phase) => phase.status === "waiting")) return "waiting";
  if (phases.every((phase) => phase.status === "ready" || phase.status === "passed")) {
    return "coordinated";
  }
  return "waiting";
}

function projectCoordinatorJob(
  job: SocialPublicationExecutionCoordinatorJob,
): SocialPublicationExecutionCoordinatorJobProjection {
  return {
    executionJobId: job.executionJobId,
    executionIntentId: job.executionIntentId,
    executionResultId: job.executionResultId,
    coordinationStatus: job.coordinationStatus,
    coordinationPlan: job,
    pipelinePhases: job.pipelinePhases,
    dependencyGraph: job.dependencyGraph,
    authorityGraph: job.authorityGraph,
    adapterSelection: job.adapterSelection,
    dependencyFailures: job.dependencyFailures,
    authorityFailures: job.authorityFailures,
    adapterReady: job.adapterReady,
    runbookReady: job.runbookReady,
    fullyCoordinated: job.fullyCoordinated,
    blockingReasons: job.blockingReasons,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
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

export { SOCIAL_PUBLICATION_EXECUTION_COORDINATOR_PIPELINE_ORDER };
