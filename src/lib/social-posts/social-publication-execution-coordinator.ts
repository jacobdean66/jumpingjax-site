import type { SocialPublicationExecutionRunbook } from "./social-publication-execution-runbook";
import type { SocialPublicationExecutionPlanStep } from "./social-publication-execution-planner";

export const SOCIAL_PUBLICATION_EXECUTION_COORDINATOR_PHASE_KINDS = [
  "preflight_gate",
  "dependency_validation",
  "authority_validation",
  "planner_planning",
  "adapter_selection",
  "runbook_readiness",
] as const;

export const SOCIAL_PUBLICATION_EXECUTION_COORDINATOR_STATUSES = [
  "coordinated",
  "waiting",
  "blocked",
] as const;

export const SOCIAL_PUBLICATION_EXECUTION_COORDINATOR_BLOCKED_REASONS = [
  "plan_id_required",
  "timestamp_invalid",
  "job_id_required",
  "intent_id_required",
  "phase_id_required",
  "phase_kind_unknown",
  "phase_order_invalid",
  "phase_order_duplicate",
  "dependency_node_id_required",
  "dependency_label_required",
  "authority_node_id_required",
  "authority_label_required",
  "adapter_selection_id_required",
  "forbidden_automation_flag",
  "forbidden_execution_permission",
  "forbidden_network_flag",
  "serialization_invalid",
  "unsafe_coordination_contract",
] as const;

export type SocialPublicationExecutionCoordinatorPhaseKind =
  (typeof SOCIAL_PUBLICATION_EXECUTION_COORDINATOR_PHASE_KINDS)[number];

export type SocialPublicationExecutionCoordinatorStatus =
  (typeof SOCIAL_PUBLICATION_EXECUTION_COORDINATOR_STATUSES)[number];

export type SocialPublicationExecutionCoordinatorBlockedReason =
  (typeof SOCIAL_PUBLICATION_EXECUTION_COORDINATOR_BLOCKED_REASONS)[number];

export type SocialPublicationExecutionCoordinatorPhaseStatus =
  | "ready"
  | "waiting"
  | "blocked"
  | "passed";

export type SocialPublicationExecutionCoordinatorDiagnostic = Readonly<{
  code: SocialPublicationExecutionCoordinatorBlockedReason;
  path: string;
  message: string;
  severity: "block" | "error";
}>;

export type SocialPublicationExecutionCoordinatorPipelinePhase = Readonly<{
  phaseId: string;
  order: number;
  kind: SocialPublicationExecutionCoordinatorPhaseKind;
  label: string;
  description: string;
  status: SocialPublicationExecutionCoordinatorPhaseStatus;
  required: boolean;
  blocksCoordination: boolean;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPublicationExecutionCoordinatorDependencyNode = Readonly<{
  nodeId: string;
  label: string;
  dependencyType: string;
  present: boolean;
  blocksCoordination: boolean;
  computedOnly: true;
  readOnly: true;
}>;

export type SocialPublicationExecutionCoordinatorAuthorityNode = Readonly<{
  nodeId: string;
  label: string;
  authorityType: "owner_approval" | "publisher_authority";
  present: boolean;
  blocksCoordination: boolean;
  computedOnly: true;
  readOnly: true;
}>;

export type SocialPublicationExecutionCoordinatorAdapterSelection = Readonly<{
  selectionId: string;
  adapterId: string | null;
  platform: string | null;
  available: boolean;
  dryRunCapable: boolean;
  adapterReady: boolean;
  unsupportedChannel: boolean;
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
}>;

export type SocialPublicationExecutionCoordinatorJob = Readonly<{
  executionJobId: string;
  executionIntentId: string;
  executionResultId: string | null;
  coordinationStatus: SocialPublicationExecutionCoordinatorStatus;
  pipelinePhases: readonly SocialPublicationExecutionCoordinatorPipelinePhase[];
  dependencyGraph: readonly SocialPublicationExecutionCoordinatorDependencyNode[];
  authorityGraph: readonly SocialPublicationExecutionCoordinatorAuthorityNode[];
  adapterSelection: SocialPublicationExecutionCoordinatorAdapterSelection;
  plannerStepStatus: SocialPublicationExecutionPlanStep["status"] | null;
  runbookStatus: SocialPublicationExecutionRunbook["status"] | null;
  preflightStatus: "pass" | "block" | null;
  blockingReasons: readonly string[];
  fullyCoordinated: boolean;
  adapterReady: boolean;
  runbookReady: boolean;
  dependencyFailures: readonly string[];
  authorityFailures: readonly string[];
  updatedAt: string;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  mutatesNothing: true;
}>;

export type SocialPublicationExecutionCoordinationPlan = Readonly<{
  planId: string;
  createdAt: string;
  jobs: readonly SocialPublicationExecutionCoordinatorJob[];
  pipelineSummary: Readonly<{
    totalJobCount: number;
    coordinatedJobCount: number;
    waitingJobCount: number;
    blockedJobCount: number;
    dependencyFailureCount: number;
    authorityFailureCount: number;
    adapterReadyCount: number;
    runbookReadyCount: number;
    computedOnly: true;
    readOnly: true;
  }>;
  orderedPipeline: readonly SocialPublicationExecutionCoordinatorPhaseKind[];
  dependencyGraph: readonly SocialPublicationExecutionCoordinatorDependencyNode[];
  authorityGraph: readonly SocialPublicationExecutionCoordinatorAuthorityNode[];
  diagnostics: readonly SocialPublicationExecutionCoordinatorDiagnostic[];
  blockedReasons: readonly string[];
  status: SocialPublicationExecutionCoordinatorStatus;
  valid: boolean;
  contractOnly: true;
  modelAuthorityOnly: true;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  mutatesNothing: true;
  callsNoExternalApis: true;
  usesNoNetwork: true;
  usesNoOAuth: true;
  usesNoCredentials: true;
  startsNoWorkers: true;
  createsNoQueues: true;
  automationForbidden: true;
}>;

export type SocialPublicationExecutionCoordinationPlanInput = Readonly<{
  planId: string;
  createdAt: string;
  jobs: readonly SocialPublicationExecutionCoordinatorJob[];
}>;

const PHASE_KIND_SET = new Set<string>(SOCIAL_PUBLICATION_EXECUTION_COORDINATOR_PHASE_KINDS);

export const SOCIAL_PUBLICATION_EXECUTION_COORDINATOR_PIPELINE_ORDER: readonly SocialPublicationExecutionCoordinatorPhaseKind[] =
  [
    "preflight_gate",
    "dependency_validation",
    "authority_validation",
    "planner_planning",
    "adapter_selection",
    "runbook_readiness",
  ];

export function isSocialPublicationExecutionCoordinatorPhaseKind(
  value: unknown,
): value is SocialPublicationExecutionCoordinatorPhaseKind {
  return typeof value === "string" && PHASE_KIND_SET.has(value);
}

export function buildSocialPublicationExecutionCoordinationPlan(
  input: SocialPublicationExecutionCoordinationPlanInput,
): SocialPublicationExecutionCoordinationPlan {
  const validation = validateSocialPublicationExecutionCoordinationPlanInput(input);
  const forbidden = detectForbiddenCoordinationState(input);
  const diagnostics = [...validation.diagnostics, ...forbidden.diagnostics];
  const blockedReasons = collectCoordinationBlockedReasons(input, validation, forbidden);
  const pipelineSummary = summarizePipeline(input.jobs);
  const dependencyGraph = flattenDependencyGraph(input.jobs);
  const authorityGraph = flattenAuthorityGraph(input.jobs);
  const status = resolvePlanStatus(input.jobs, diagnostics);

  return deepFreeze({
    planId: input.planId,
    createdAt: input.createdAt,
    jobs: input.jobs,
    pipelineSummary,
    orderedPipeline: SOCIAL_PUBLICATION_EXECUTION_COORDINATOR_PIPELINE_ORDER,
    dependencyGraph,
    authorityGraph,
    diagnostics,
    blockedReasons,
    status,
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    contractOnly: true,
    modelAuthorityOnly: true,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    mutatesNothing: true,
    callsNoExternalApis: true,
    usesNoNetwork: true,
    usesNoOAuth: true,
    usesNoCredentials: true,
    startsNoWorkers: true,
    createsNoQueues: true,
    automationForbidden: true,
  });
}

export function validateSocialPublicationExecutionCoordinationPlan(
  plan: unknown,
): Readonly<{
  valid: boolean;
  diagnostics: readonly SocialPublicationExecutionCoordinatorDiagnostic[];
}> {
  if (!isRecord(plan)) {
    return {
      valid: false,
      diagnostics: [
        blockDiagnostic(
          "serialization_invalid",
          "plan",
          "Coordination plan must be an object.",
          "error",
        ),
      ],
    };
  }

  const diagnostics: SocialPublicationExecutionCoordinatorDiagnostic[] = [];
  requireText(plan.planId, "plan.planId", "plan_id_required", diagnostics);
  if (!isValidTimestamp(plan.createdAt)) {
    diagnostics.push(blockDiagnostic(
      "timestamp_invalid",
      "plan.createdAt",
      "Coordination plan requires a valid createdAt timestamp.",
      "error",
    ));
  }

  validateJobs(plan.jobs, "plan.jobs", diagnostics);

  if (plan.grantsExecutionPermission !== false) {
    diagnostics.push(blockDiagnostic(
      "forbidden_execution_permission",
      "plan.grantsExecutionPermission",
      "Coordination plan must not grant execution permission.",
      "block",
    ));
  }
  if (plan.automationForbidden !== true) {
    diagnostics.push(blockDiagnostic(
      "forbidden_automation_flag",
      "plan.automationForbidden",
      "Coordination plan must forbid automation.",
      "block",
    ));
  }
  if (
    plan.executesNothing !== true ||
    plan.publishesNothing !== true ||
    plan.usesNoNetwork !== true ||
    plan.usesNoOAuth !== true ||
    plan.usesNoCredentials !== true
  ) {
    diagnostics.push(blockDiagnostic(
      "unsafe_coordination_contract",
      "plan",
      "Coordination plan contract invariants failed.",
      "block",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function detectForbiddenCoordinationState(
  input: SocialPublicationExecutionCoordinationPlanInput | SocialPublicationExecutionCoordinationPlan,
): Readonly<{
  forbidden: boolean;
  diagnostics: readonly SocialPublicationExecutionCoordinatorDiagnostic[];
}> {
  const diagnostics: SocialPublicationExecutionCoordinatorDiagnostic[] = [];
  const candidate = input as Readonly<Record<string, unknown>>;

  if (candidate.grantsExecutionPermission === true) {
    diagnostics.push(blockDiagnostic(
      "forbidden_execution_permission",
      "plan.grantsExecutionPermission",
      "Coordination plan must not grant execution permission.",
      "block",
    ));
  }
  if (candidate.automationForbidden === false) {
    diagnostics.push(blockDiagnostic(
      "forbidden_automation_flag",
      "plan.automationForbidden",
      "Coordination plan must forbid automation.",
      "block",
    ));
  }
  if (candidate.usesNoNetwork === false || candidate.callsNoExternalApis === false) {
    diagnostics.push(blockDiagnostic(
      "forbidden_network_flag",
      "plan",
      "Coordination plan must forbid network and external API usage.",
      "block",
    ));
  }

  return {
    forbidden: diagnostics.length > 0,
    diagnostics,
  };
}

export function serializeSocialPublicationExecutionCoordinationPlan(
  plan: SocialPublicationExecutionCoordinationPlan,
): string {
  return JSON.stringify(toStableValue(plan));
}

export function hydrateSocialPublicationExecutionCoordinationPlan(
  serialized: string,
): Readonly<{
  ok: true;
  value: SocialPublicationExecutionCoordinationPlan;
}> | Readonly<{
  ok: false;
  diagnostics: readonly SocialPublicationExecutionCoordinatorDiagnostic[];
}> {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const validation = validateSocialPublicationExecutionCoordinationPlan(parsed);
    if (!validation.valid || !isRecord(parsed)) {
      return { ok: false, diagnostics: validation.diagnostics };
    }
    return { ok: true, value: deepFreeze(parsed as SocialPublicationExecutionCoordinationPlan) };
  } catch {
    return {
      ok: false,
      diagnostics: [
        blockDiagnostic(
          "serialization_invalid",
          "serialized",
          "Coordination plan serialization must be valid JSON.",
          "error",
        ),
      ],
    };
  }
}

function validateSocialPublicationExecutionCoordinationPlanInput(
  input: SocialPublicationExecutionCoordinationPlanInput,
): Readonly<{
  diagnostics: readonly SocialPublicationExecutionCoordinatorDiagnostic[];
}> {
  const diagnostics: SocialPublicationExecutionCoordinatorDiagnostic[] = [];
  requireText(input.planId, "input.planId", "plan_id_required", diagnostics);
  if (!isValidTimestamp(input.createdAt)) {
    diagnostics.push(blockDiagnostic(
      "timestamp_invalid",
      "input.createdAt",
      "Coordination plan requires a valid createdAt timestamp.",
      "error",
    ));
  }
  validateJobs(input.jobs, "input.jobs", diagnostics);
  return { diagnostics };
}

function collectCoordinationBlockedReasons(
  input: SocialPublicationExecutionCoordinationPlanInput,
  validation: Readonly<{ diagnostics: readonly SocialPublicationExecutionCoordinatorDiagnostic[] }>,
  forbidden: Readonly<{ diagnostics: readonly SocialPublicationExecutionCoordinatorDiagnostic[] }>,
): readonly string[] {
  const reasons = new Set<string>();
  for (const diagnostic of [...validation.diagnostics, ...forbidden.diagnostics]) {
    reasons.add(diagnostic.code);
  }

  for (const job of input.jobs) {
    for (const reason of job.blockingReasons) {
      reasons.add(reason);
    }
    for (const phase of job.pipelinePhases) {
      if (phase.required && phase.blocksCoordination && phase.status === "blocked") {
        reasons.add(`phase_blocked:${phase.kind}`);
      }
    }
  }

  return [...reasons];
}

function validateJobs(
  jobs: unknown,
  path: string,
  diagnostics: SocialPublicationExecutionCoordinatorDiagnostic[],
): void {
  if (!Array.isArray(jobs)) {
    diagnostics.push(blockDiagnostic("serialization_invalid", path, "Coordination jobs must be an array.", "error"));
    return;
  }

  jobs.forEach((job, index) => {
    const jobPath = `${path}.${index}`;
    if (!isRecord(job)) {
      diagnostics.push(blockDiagnostic("serialization_invalid", jobPath, "Coordination job must be an object.", "error"));
      return;
    }
    requireText(job.executionJobId, `${jobPath}.executionJobId`, "job_id_required", diagnostics);
    requireText(job.executionIntentId, `${jobPath}.executionIntentId`, "intent_id_required", diagnostics);
    validatePhases(job.pipelinePhases, `${jobPath}.pipelinePhases`, diagnostics);
    validateDependencyGraph(job.dependencyGraph, `${jobPath}.dependencyGraph`, diagnostics);
    validateAuthorityGraph(job.authorityGraph, `${jobPath}.authorityGraph`, diagnostics);
    validateAdapterSelection(job.adapterSelection, `${jobPath}.adapterSelection`, diagnostics);
  });
}

function validatePhases(
  phases: unknown,
  path: string,
  diagnostics: SocialPublicationExecutionCoordinatorDiagnostic[],
): void {
  if (!Array.isArray(phases)) {
    diagnostics.push(blockDiagnostic("serialization_invalid", path, "Pipeline phases must be an array.", "error"));
    return;
  }

  const orders = new Set<number>();
  phases.forEach((phase, index) => {
    const phasePath = `${path}.${index}`;
    if (!isRecord(phase)) {
      diagnostics.push(blockDiagnostic("serialization_invalid", phasePath, "Pipeline phase must be an object.", "error"));
      return;
    }
    requireText(phase.phaseId, `${phasePath}.phaseId`, "phase_id_required", diagnostics);
    if (typeof phase.order !== "number" || !Number.isInteger(phase.order) || phase.order < 1) {
      diagnostics.push(blockDiagnostic("phase_order_invalid", `${phasePath}.order`, "Pipeline phase order must be a positive integer.", "error"));
    } else if (orders.has(phase.order)) {
      diagnostics.push(blockDiagnostic("phase_order_duplicate", `${phasePath}.order`, "Pipeline phase order must be unique.", "error"));
    } else {
      orders.add(phase.order);
    }
    if (!isSocialPublicationExecutionCoordinatorPhaseKind(phase.kind)) {
      diagnostics.push(blockDiagnostic("phase_kind_unknown", `${phasePath}.kind`, "Pipeline phase kind is not supported.", "error"));
    }
    if (phase.grantsExecutionPermission !== false) {
      diagnostics.push(blockDiagnostic("forbidden_execution_permission", phasePath, "Pipeline phase must not grant execution permission.", "block"));
    }
  });
}

function validateDependencyGraph(
  nodes: unknown,
  path: string,
  diagnostics: SocialPublicationExecutionCoordinatorDiagnostic[],
): void {
  if (!Array.isArray(nodes)) {
    diagnostics.push(blockDiagnostic("serialization_invalid", path, "Dependency graph must be an array.", "error"));
    return;
  }
  nodes.forEach((node, index) => {
    const nodePath = `${path}.${index}`;
    if (!isRecord(node)) {
      diagnostics.push(blockDiagnostic("serialization_invalid", nodePath, "Dependency node must be an object.", "error"));
      return;
    }
    requireText(node.nodeId, `${nodePath}.nodeId`, "dependency_node_id_required", diagnostics);
    requireText(node.label, `${nodePath}.label`, "dependency_label_required", diagnostics);
  });
}

function validateAuthorityGraph(
  nodes: unknown,
  path: string,
  diagnostics: SocialPublicationExecutionCoordinatorDiagnostic[],
): void {
  if (!Array.isArray(nodes)) {
    diagnostics.push(blockDiagnostic("serialization_invalid", path, "Authority graph must be an array.", "error"));
    return;
  }
  nodes.forEach((node, index) => {
    const nodePath = `${path}.${index}`;
    if (!isRecord(node)) {
      diagnostics.push(blockDiagnostic("serialization_invalid", nodePath, "Authority node must be an object.", "error"));
      return;
    }
    requireText(node.nodeId, `${nodePath}.nodeId`, "authority_node_id_required", diagnostics);
    requireText(node.label, `${nodePath}.label`, "authority_label_required", diagnostics);
  });
}

function validateAdapterSelection(
  selection: unknown,
  path: string,
  diagnostics: SocialPublicationExecutionCoordinatorDiagnostic[],
): void {
  if (!isRecord(selection)) {
    diagnostics.push(blockDiagnostic("serialization_invalid", path, "Adapter selection must be an object.", "error"));
    return;
  }
  requireText(selection.selectionId, `${path}.selectionId`, "adapter_selection_id_required", diagnostics);
  if (selection.grantsExecutionPermission !== false) {
    diagnostics.push(blockDiagnostic("forbidden_execution_permission", path, "Adapter selection must not grant execution permission.", "block"));
  }
}

function summarizePipeline(
  jobs: readonly SocialPublicationExecutionCoordinatorJob[],
): SocialPublicationExecutionCoordinationPlan["pipelineSummary"] {
  return {
    totalJobCount: jobs.length,
    coordinatedJobCount: jobs.filter((job) => job.coordinationStatus === "coordinated").length,
    waitingJobCount: jobs.filter((job) => job.coordinationStatus === "waiting").length,
    blockedJobCount: jobs.filter((job) => job.coordinationStatus === "blocked").length,
    dependencyFailureCount: jobs.filter((job) => job.dependencyFailures.length > 0).length,
    authorityFailureCount: jobs.filter((job) => job.authorityFailures.length > 0).length,
    adapterReadyCount: jobs.filter((job) => job.adapterReady).length,
    runbookReadyCount: jobs.filter((job) => job.runbookReady).length,
    computedOnly: true,
    readOnly: true,
  };
}

function flattenDependencyGraph(
  jobs: readonly SocialPublicationExecutionCoordinatorJob[],
): readonly SocialPublicationExecutionCoordinatorDependencyNode[] {
  return jobs.flatMap((job) =>
    job.dependencyGraph.map((node) => ({
      ...node,
      nodeId: `${job.executionJobId}:${node.nodeId}`,
    })),
  );
}

function flattenAuthorityGraph(
  jobs: readonly SocialPublicationExecutionCoordinatorJob[],
): readonly SocialPublicationExecutionCoordinatorAuthorityNode[] {
  return jobs.flatMap((job) =>
    job.authorityGraph.map((node) => ({
      ...node,
      nodeId: `${job.executionJobId}:${node.nodeId}`,
    })),
  );
}

function resolvePlanStatus(
  jobs: readonly SocialPublicationExecutionCoordinatorJob[],
  diagnostics: readonly SocialPublicationExecutionCoordinatorDiagnostic[],
): SocialPublicationExecutionCoordinatorStatus {
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error" || diagnostic.severity === "block")) {
    return "blocked";
  }
  if (jobs.some((job) => job.coordinationStatus === "blocked")) return "blocked";
  if (jobs.some((job) => job.coordinationStatus === "waiting")) return "waiting";
  return jobs.length > 0 ? "coordinated" : "waiting";
}

function requireText(
  value: unknown,
  path: string,
  code: SocialPublicationExecutionCoordinatorBlockedReason,
  diagnostics: SocialPublicationExecutionCoordinatorDiagnostic[],
): void {
  if (hasText(value)) return;
  diagnostics.push(blockDiagnostic(code, path, "Required coordination text field is missing.", "error"));
}

function blockDiagnostic(
  code: SocialPublicationExecutionCoordinatorBlockedReason,
  path: string,
  message: string,
  severity: "block" | "error",
): SocialPublicationExecutionCoordinatorDiagnostic {
  return { code, path, message, severity };
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidTimestamp(value: unknown): value is string {
  return hasText(value) && Number.isFinite(Date.parse(value));
}

type UnknownRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
