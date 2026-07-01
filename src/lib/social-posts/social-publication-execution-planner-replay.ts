import {
  planSocialPublicationExecution,
  type SocialPublicationExecutionPlan,
  type SocialPublicationExecutionPlanStep,
} from "./social-publication-execution-planner";
import { replaySocialPublicationExecutionPreflight } from "./social-publication-execution-preflight-replay";
import type { SocialPublicationExecutionPersistenceModel } from "./social-publication-execution-repository";

export const SOCIAL_PUBLICATION_EXECUTION_PLANNER_REPLAY_DIAGNOSTIC_CODES = [
  "preflight_replay_error",
  "planner_validation_error",
] as const;

export type SocialPublicationExecutionPlannerReplayDiagnosticCode =
  (typeof SOCIAL_PUBLICATION_EXECUTION_PLANNER_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPublicationExecutionPlannerReplayDiagnostic = Readonly<{
  code: SocialPublicationExecutionPlannerReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPublicationExecutionPlannerReadModel = Readonly<{
  plan: SocialPublicationExecutionPlan;
  plannedJobs: readonly SocialPublicationExecutionPlanStep[];
  executionOrder: readonly SocialPublicationExecutionPlanStep[];
  readyPlans: readonly SocialPublicationExecutionPlanStep[];
  waitingPlans: readonly SocialPublicationExecutionPlanStep[];
  blockedPlans: readonly SocialPublicationExecutionPlanStep[];
  dependencyFailures: readonly SocialPublicationExecutionPlanStep[];
  authorityFailures: readonly SocialPublicationExecutionPlanStep[];
  referenceFailures: readonly SocialPublicationExecutionPlanStep[];
  diagnostics: readonly SocialPublicationExecutionPlannerReplayDiagnostic[];
  summary: Readonly<{
    totalStepCount: number;
    plannedJobCount: number;
    readyPlanCount: number;
    waitingPlanCount: number;
    blockedPlanCount: number;
    dependencyFailureCount: number;
    authorityFailureCount: number;
    referenceFailureCount: number;
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
    source: "publication_execution_planner_replay";
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

export type SocialPublicationExecutionPlannerReplayResult = Readonly<{
  ok: true;
  value: SocialPublicationExecutionPlannerReadModel;
}>;

export function replaySocialPublicationExecutionPlanner(
  model: SocialPublicationExecutionPersistenceModel,
  now = "2026-07-01T00:00:00.000Z",
): SocialPublicationExecutionPlannerReplayResult {
  const diagnostics: SocialPublicationExecutionPlannerReplayDiagnostic[] = [];
  const preflightReplay = replaySocialPublicationExecutionPreflight(model).value;

  for (const diagnostic of preflightReplay.diagnostics) {
    diagnostics.push({
      code: "preflight_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: diagnostic.severity,
    });
  }

  const plan = planSocialPublicationExecution({
    planId: "publication-execution-plan",
    createdAt: now,
    jobs: [
      ...preflightReplay.preflightPassJobs,
      ...preflightReplay.preflightBlockedJobs,
      ...preflightReplay.staleReferenceJobs,
    ],
  });

  for (const diagnostic of plan.diagnostics) {
    diagnostics.push({
      code: "planner_validation_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: diagnostic.severity,
    });
  }

  const executionOrder = [...plan.steps].sort(
    (left, right) =>
      left.order - right.order ||
      right.priority - left.priority ||
      left.executionJobId.localeCompare(right.executionJobId),
  );
  const plannedJobs = executionOrder.filter((step) => step.status !== "completed");
  const readyPlans = executionOrder.filter((step) => step.status === "ready");
  const waitingPlans = executionOrder.filter((step) => step.status === "waiting");
  const blockedPlans = executionOrder.filter((step) => step.status === "blocked");
  const dependencyFailures = executionOrder.filter((step) =>
    step.dependencyGraph.some((dependency) => dependency.blocksStep),
  );
  const authorityFailures = executionOrder.filter(
    (step) => step.missingAuthority.length > 0,
  );
  const referenceFailures = executionOrder.filter(
    (step) => step.missingReferences.length > 0,
  );
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;

  return {
    ok: true,
    value: deepFreeze({
      plan,
      plannedJobs,
      executionOrder,
      readyPlans,
      waitingPlans,
      blockedPlans,
      dependencyFailures,
      authorityFailures,
      referenceFailures,
      diagnostics,
      summary: {
        totalStepCount: executionOrder.length,
        plannedJobCount: plannedJobs.length,
        readyPlanCount: readyPlans.length,
        waitingPlanCount: waitingPlans.length,
        blockedPlanCount: blockedPlans.length,
        dependencyFailureCount: dependencyFailures.length,
        authorityFailureCount: authorityFailures.length,
        referenceFailureCount: referenceFailures.length,
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
        source: "publication_execution_planner_replay",
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

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
