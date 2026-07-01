import type { SocialPublicationExecutionPreflightJobProjection } from "./social-publication-execution-preflight-replay";

export const SOCIAL_PUBLICATION_EXECUTION_PLANNER_DIAGNOSTIC_CODES = [
  "plan_id_required",
  "timestamp_invalid",
  "step_identity_required",
  "step_order_invalid",
  "step_order_duplicate",
  "step_priority_invalid",
  "step_status_invalid",
  "dependency_self_reference",
  "serialization_invalid",
] as const;

export type SocialPublicationExecutionPlannerDiagnosticCode =
  (typeof SOCIAL_PUBLICATION_EXECUTION_PLANNER_DIAGNOSTIC_CODES)[number];

export type SocialPublicationExecutionPlannerDiagnostic = Readonly<{
  code: SocialPublicationExecutionPlannerDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPublicationExecutionPlanStepStatus =
  | "ready"
  | "waiting"
  | "blocked"
  | "completed";

export type SocialPublicationExecutionPlanDependency = Readonly<{
  dependencyId: string;
  dependencyType:
    | "owner_approval"
    | "publication_target"
    | "ledger_evidence"
    | "publisher_request"
    | "scheduler_intent"
    | "publication_manifest"
    | "publisher_authority"
    | "preflight"
    | "result";
  present: boolean;
  blocksStep: boolean;
}>;

export type SocialPublicationExecutionPlanStep = Readonly<{
  stepId: string;
  executionJobId: string;
  executionIntentId: string;
  executionResultId: string | null;
  order: number;
  priority: number;
  status: SocialPublicationExecutionPlanStepStatus;
  replayState: SocialPublicationExecutionPreflightJobProjection["replayState"];
  whyWouldRun: string;
  dependencyGraph: readonly SocialPublicationExecutionPlanDependency[];
  dependsOn: readonly string[];
  requiredAuthority: readonly string[];
  presentAuthority: readonly string[];
  missingAuthority: readonly string[];
  requiredReferences: readonly string[];
  presentReferences: readonly string[];
  missingReferences: readonly string[];
  blockingReasons: readonly string[];
  couldRunLater: boolean;
  unsafe: boolean;
  updatedAt: string;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  mutatesNothing: true;
}>;

export type SocialPublicationExecutionPlan = Readonly<{
  planId: string;
  createdAt: string;
  steps: readonly SocialPublicationExecutionPlanStep[];
  diagnostics: readonly SocialPublicationExecutionPlannerDiagnostic[];
  valid: boolean;
  dependencyGraph: readonly SocialPublicationExecutionPlanDependency[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  mutatesNothing: true;
}>;

export type SocialPublicationExecutionPlanInput = Readonly<{
  planId: string;
  createdAt: string;
  jobs: readonly SocialPublicationExecutionPreflightJobProjection[];
}>;

type UnknownRecord = Readonly<Record<string, unknown>>;

const REQUIRED_REFERENCES = [
  "owner_approval",
  "publication_target",
  "ledger_evidence",
  "publisher_request",
  "scheduler_intent",
  "publication_manifest",
] as const;

const REQUIRED_AUTHORITY = ["owner_approval", "publisher_authority"] as const;

export function planSocialPublicationExecution(
  input: SocialPublicationExecutionPlanInput,
): SocialPublicationExecutionPlan {
  const diagnostics: SocialPublicationExecutionPlannerDiagnostic[] = [];
  if (!hasText(input.planId)) {
    diagnostics.push(errorDiagnostic(
      "plan_id_required",
      "plan.planId",
      "Execution planner requires a plan id.",
    ));
  }
  if (!isValidTimestamp(input.createdAt)) {
    diagnostics.push(errorDiagnostic(
      "timestamp_invalid",
      "plan.createdAt",
      "Execution planner requires a valid createdAt timestamp.",
    ));
  }

  const steps = orderJobs(input.jobs).map((job, index) =>
    buildPlanStep(job, index + 1),
  );
  const plan = {
    planId: input.planId,
    createdAt: input.createdAt,
    steps,
    diagnostics,
    valid: diagnostics.length === 0,
    dependencyGraph: flattenDependencies(steps),
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    mutatesNothing: true,
  } satisfies SocialPublicationExecutionPlan;

  const validation = validateSocialPublicationExecutionPlan(plan);
  const allDiagnostics = [...diagnostics, ...validation.diagnostics];
  return deepFreeze({
    ...plan,
    diagnostics: allDiagnostics,
    valid: allDiagnostics.every((diagnostic) => diagnostic.severity !== "error"),
  });
}

export function validateSocialPublicationExecutionPlan(
  plan: unknown,
): Readonly<{
  valid: boolean;
  diagnostics: readonly SocialPublicationExecutionPlannerDiagnostic[];
}> {
  const diagnostics: SocialPublicationExecutionPlannerDiagnostic[] = [];
  if (!isRecord(plan)) {
    return {
      valid: false,
      diagnostics: [
        errorDiagnostic(
          "serialization_invalid",
          "plan",
          "Execution plan must be an object.",
        ),
      ],
    };
  }

  if (!hasText(plan.planId)) {
    diagnostics.push(errorDiagnostic("plan_id_required", "plan.planId", "Execution plan id is required."));
  }
  if (!isValidTimestamp(plan.createdAt)) {
    diagnostics.push(errorDiagnostic("timestamp_invalid", "plan.createdAt", "Execution plan timestamp is invalid."));
  }
  if (!Array.isArray(plan.steps)) {
    diagnostics.push(errorDiagnostic("serialization_invalid", "plan.steps", "Execution plan steps must be an array."));
  } else {
    validateSteps(plan.steps, diagnostics);
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function serializeSocialPublicationExecutionPlan(
  plan: SocialPublicationExecutionPlan,
): string {
  return JSON.stringify(toStableValue(plan));
}

export function hydrateSocialPublicationExecutionPlan(
  serialized: string,
): Readonly<{
  ok: true;
  value: SocialPublicationExecutionPlan;
}> | Readonly<{
  ok: false;
  diagnostics: readonly SocialPublicationExecutionPlannerDiagnostic[];
}> {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const validation = validateSocialPublicationExecutionPlan(parsed);
    if (!validation.valid || !isRecord(parsed)) {
      return { ok: false, diagnostics: validation.diagnostics };
    }
    return { ok: true, value: deepFreeze(parsed as SocialPublicationExecutionPlan) };
  } catch {
    return {
      ok: false,
      diagnostics: [
        errorDiagnostic(
          "serialization_invalid",
          "serialized",
          "Execution plan serialization must be valid JSON.",
        ),
      ],
    };
  }
}

function buildPlanStep(
  job: SocialPublicationExecutionPreflightJobProjection,
  order: number,
): SocialPublicationExecutionPlanStep {
  const dependencies = dependenciesForJob(job);
  const blockingReasons = blockingReasonsForJob(job, dependencies);
  const status = statusForJob(job, blockingReasons);
  const presentReferences = REQUIRED_REFERENCES.filter(
    (reference) => !job.missingReferences.includes(reference),
  );
  const presentAuthority = REQUIRED_AUTHORITY.filter(
    (authority) => !job.missingAuthority.includes(authority),
  );

  return {
    stepId: `execution-plan-step-${job.executionJobId}`,
    executionJobId: job.executionJobId,
    executionIntentId: job.executionIntentId,
    executionResultId: job.executionResultId,
    order,
    priority: priorityForJob(job, status),
    status,
    replayState: job.replayState,
    whyWouldRun: whyForJob(job, status, blockingReasons),
    dependencyGraph: dependencies,
    dependsOn: dependencies.map((dependency) => dependency.dependencyId),
    requiredAuthority: REQUIRED_AUTHORITY,
    presentAuthority,
    missingAuthority: job.missingAuthority,
    requiredReferences: REQUIRED_REFERENCES,
    presentReferences,
    missingReferences: job.missingReferences,
    blockingReasons,
    couldRunLater: job.couldRunLater && status !== "completed",
    unsafe: job.unsafe,
    updatedAt: job.updatedAt,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    mutatesNothing: true,
  };
}

function dependenciesForJob(
  job: SocialPublicationExecutionPreflightJobProjection,
): readonly SocialPublicationExecutionPlanDependency[] {
  const referenceDependencies: SocialPublicationExecutionPlanDependency[] =
    REQUIRED_REFERENCES.map((reference) => ({
      dependencyId: reference,
      dependencyType: reference,
      present: !job.missingReferences.includes(reference),
      blocksStep: job.missingReferences.includes(reference),
    }));

  return [
    ...referenceDependencies,
    {
      dependencyId: "publisher_authority",
      dependencyType: "publisher_authority",
      present: !job.missingAuthority.includes("publisher_authority"),
      blocksStep: job.missingAuthority.includes("publisher_authority"),
    },
    {
      dependencyId: "owner_approval_authority",
      dependencyType: "owner_approval",
      present: !job.missingAuthority.includes("owner_approval"),
      blocksStep: job.missingAuthority.includes("owner_approval"),
    },
    {
      dependencyId: "preflight_gate",
      dependencyType: "preflight",
      present: job.preflightStatus === "pass" && job.staleReferences.length === 0,
      blocksStep: job.preflightStatus !== "pass" || job.staleReferences.length > 0,
    },
    {
      dependencyId: "execution_result_state",
      dependencyType: "result",
      present: job.replayState !== "failed",
      blocksStep: job.replayState === "failed" || job.replayState === "completed",
    },
  ];
}

function blockingReasonsForJob(
  job: SocialPublicationExecutionPreflightJobProjection,
  dependencies: readonly SocialPublicationExecutionPlanDependency[],
): readonly string[] {
  const reasons = [
    ...job.diagnostics.map((diagnostic) => diagnostic.code),
    ...job.staleReferences,
    ...dependencies
      .filter((dependency) => dependency.blocksStep)
      .map((dependency) => `dependency_blocked:${dependency.dependencyId}`),
  ];
  if (job.replayState === "completed") reasons.push("already_completed");
  if (job.unsafe) reasons.push("unsafe_execution_contract");
  return unique(reasons);
}

function statusForJob(
  job: SocialPublicationExecutionPreflightJobProjection,
  blockingReasons: readonly string[],
): SocialPublicationExecutionPlanStepStatus {
  if (job.replayState === "completed") return "completed";
  if (job.unsafe || job.blockedStates.length > 0 || job.replayState === "failed") {
    return "blocked";
  }
  if (blockingReasons.length > 0) return "waiting";
  return "ready";
}

function whyForJob(
  job: SocialPublicationExecutionPreflightJobProjection,
  status: SocialPublicationExecutionPlanStepStatus,
  blockingReasons: readonly string[],
): string {
  if (status === "ready") {
    return "Preflight passed, required references are present, and authority evidence is sufficient.";
  }
  if (status === "completed") return "Execution result is already recorded as completed.";
  if (status === "blocked") return `Planner blocks this job: ${blockingReasons.join(", ")}.`;
  return `Planner is waiting on: ${blockingReasons.join(", ")}.`;
}

function priorityForJob(
  job: SocialPublicationExecutionPreflightJobProjection,
  status: SocialPublicationExecutionPlanStepStatus,
): number {
  if (status === "ready") return 100;
  if (status === "waiting" && job.couldRunLater) return 60;
  if (status === "blocked") return 20;
  return 0;
}

function orderJobs(
  jobs: readonly SocialPublicationExecutionPreflightJobProjection[],
): readonly SocialPublicationExecutionPreflightJobProjection[] {
  return [...jobs].sort((left, right) => {
    const leftStatus = statusForJob(left, blockingReasonsForJob(left, dependenciesForJob(left)));
    const rightStatus = statusForJob(right, blockingReasonsForJob(right, dependenciesForJob(right)));
    return (
      priorityForJob(right, rightStatus) - priorityForJob(left, leftStatus) ||
      left.updatedAt.localeCompare(right.updatedAt) ||
      left.executionJobId.localeCompare(right.executionJobId)
    );
  });
}

function flattenDependencies(
  steps: readonly SocialPublicationExecutionPlanStep[],
): readonly SocialPublicationExecutionPlanDependency[] {
  return steps.flatMap((step) =>
    step.dependencyGraph.map((dependency) => ({
      ...dependency,
      dependencyId: `${step.stepId}:${dependency.dependencyId}`,
    })),
  );
}

function validateSteps(
  steps: readonly unknown[],
  diagnostics: SocialPublicationExecutionPlannerDiagnostic[],
): void {
  const orders = new Set<number>();
  steps.forEach((step, index) => {
    if (!isRecord(step)) {
      diagnostics.push(errorDiagnostic("serialization_invalid", `plan.steps.${index}`, "Execution plan step must be an object."));
      return;
    }
    const path = `plan.steps.${index}`;
    if (!hasText(step.stepId) || !hasText(step.executionJobId) || !hasText(step.executionIntentId)) {
      diagnostics.push(errorDiagnostic("step_identity_required", path, "Execution plan step identity is required."));
    }
    const order = step.order;
    if (typeof order !== "number" || !Number.isInteger(order) || order < 1) {
      diagnostics.push(errorDiagnostic("step_order_invalid", `${path}.order`, "Execution plan step order must be a positive integer."));
    } else if (orders.has(order)) {
      diagnostics.push(errorDiagnostic("step_order_duplicate", `${path}.order`, "Execution plan step order must be unique."));
    } else {
      orders.add(order);
    }
    if (typeof step.priority !== "number" || step.priority < 0) {
      diagnostics.push(errorDiagnostic("step_priority_invalid", `${path}.priority`, "Execution plan step priority must be a non-negative number."));
    }
    if (!["ready", "waiting", "blocked", "completed"].includes(String(step.status))) {
      diagnostics.push(errorDiagnostic("step_status_invalid", `${path}.status`, "Execution plan step status is not supported."));
    }
    if (Array.isArray(step.dependsOn) && hasText(step.stepId) && step.dependsOn.includes(step.stepId)) {
      diagnostics.push(errorDiagnostic("dependency_self_reference", `${path}.dependsOn`, "Execution plan step must not depend on itself."));
    }
  });
}

function errorDiagnostic(
  code: SocialPublicationExecutionPlannerDiagnosticCode,
  path: string,
  message: string,
): SocialPublicationExecutionPlannerDiagnostic {
  return { code, path, message, severity: "error" };
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function toStableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toStableValue);
  if (!isRecord(value)) return value;
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((output, key) => {
      output[key] = toStableValue(value[key]);
      return output;
    }, {});
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidTimestamp(value: unknown): value is string {
  return hasText(value) && Number.isFinite(Date.parse(value));
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
