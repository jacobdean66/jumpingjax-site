import type { SocialPlatformCredentialKind, SocialPlatformCredentialProvider } from "../social-platform-credential-boundary";

export const SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION = "d15-w1-v1" as const;

export const SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_PHASE_KINDS = [
  "persistence_validation",
  "domain_mapping_validation",
  "dependency_composition",
  "readiness_aggregation",
  "capability_aggregation",
  "audit_append_compatibility",
  "resolution_flow",
] as const;

export const SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_STATUSES = [
  "orchestrated",
  "waiting",
  "blocked",
] as const;

export const SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_BLOCKED_REASONS = [
  "plan_id_required",
  "timestamp_invalid",
  "provider_orchestration_id_required",
  "provider_required",
  "phase_id_required",
  "phase_kind_unknown",
  "phase_order_invalid",
  "phase_order_duplicate",
  "dependency_node_id_required",
  "dependency_label_required",
  "resolution_step_id_required",
  "aggregation_id_required",
  "integration_id_required",
  "forbidden_automation_flag",
  "forbidden_execution_permission",
  "forbidden_network_flag",
  "serialization_invalid",
  "unsafe_orchestration_contract",
] as const;

export type SocialCredentialRuntimeOrchestratorPhaseKind =
  (typeof SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_PHASE_KINDS)[number];

export type SocialCredentialRuntimeOrchestratorStatus =
  (typeof SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_STATUSES)[number];

export type SocialCredentialRuntimeOrchestratorBlockedReason =
  (typeof SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_BLOCKED_REASONS)[number];

export type SocialCredentialRuntimeOrchestratorPhaseStatus =
  | "ready"
  | "waiting"
  | "blocked"
  | "passed";

export type SocialCredentialRuntimeOrchestratorDiagnostic = Readonly<{
  code: SocialCredentialRuntimeOrchestratorBlockedReason;
  path: string;
  message: string;
  severity: "block" | "error";
}>;

export type SocialCredentialRuntimeOrchestratorPipelinePhase = Readonly<{
  phaseId: string;
  order: number;
  kind: SocialCredentialRuntimeOrchestratorPhaseKind;
  label: string;
  description: string;
  status: SocialCredentialRuntimeOrchestratorPhaseStatus;
  required: boolean;
  blocksOrchestration: boolean;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialRuntimeOrchestratorDependencyNode = Readonly<{
  nodeId: string;
  label: string;
  dependencyType: string;
  present: boolean;
  blocksOrchestration: boolean;
  computedOnly: true;
  readOnly: true;
}>;

export type SocialCredentialRuntimeResolutionStep = Readonly<{
  stepId: string;
  order: number;
  label: string;
  provider: SocialPlatformCredentialProvider;
  credentialKind: SocialPlatformCredentialKind | null;
  resolved: boolean;
  blocksOrchestration: boolean;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
}>;

export type SocialCredentialRuntimeResolutionFlow = Readonly<{
  flowId: string;
  provider: SocialPlatformCredentialProvider;
  providerAgnostic: true;
  steps: readonly SocialCredentialRuntimeResolutionStep[];
  resolvedStepCount: number;
  unresolvedStepCount: number;
  resolutionComplete: boolean;
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialCredentialRuntimeCapabilityAggregation = Readonly<{
  aggregationId: string;
  provider: SocialPlatformCredentialProvider;
  credentialReferenceOnly: true;
  liveCredentialsBlocked: true;
  liveOAuthBlocked: true;
  encryptionBlocked: true;
  networkBlocked: true;
  executionBlocked: true;
  satisfiedCapabilityFlags: readonly string[];
  missingCapabilityFlags: readonly string[];
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
}>;

export type SocialCredentialRuntimeReadinessAggregation = Readonly<{
  aggregationId: string;
  provider: SocialPlatformCredentialProvider;
  credentialReady: boolean;
  credentialBlocked: boolean;
  architecturallyReadyPlatformCount: number;
  architecturallyBlockedPlatformCount: number;
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
}>;

export type SocialCredentialRuntimeAuditIntegration = Readonly<{
  integrationId: string;
  appendOnlyCompatible: boolean;
  appendAuditEventAvailable: boolean;
  preservesAppendOnlyHistory: boolean;
  auditEventCount: number;
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  mutatesNothing: true;
  grantsExecutionPermission: false;
}>;

export type SocialCredentialRuntimeOrchestratorProviderJob = Readonly<{
  providerOrchestrationId: string;
  provider: SocialPlatformCredentialProvider;
  orchestrationStatus: SocialCredentialRuntimeOrchestratorStatus;
  pipelinePhases: readonly SocialCredentialRuntimeOrchestratorPipelinePhase[];
  dependencyGraph: readonly SocialCredentialRuntimeOrchestratorDependencyNode[];
  capabilityAggregation: SocialCredentialRuntimeCapabilityAggregation;
  readinessAggregation: SocialCredentialRuntimeReadinessAggregation;
  auditIntegration: SocialCredentialRuntimeAuditIntegration;
  resolutionFlow: SocialCredentialRuntimeResolutionFlow;
  dependencyFailures: readonly string[];
  blockingReasons: readonly string[];
  fullyOrchestrated: boolean;
  updatedAt: string;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  mutatesNothing: true;
}>;

export type SocialCredentialRuntimeOrchestrationPlan = Readonly<{
  orchestratorVersion: typeof SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION;
  planId: string;
  createdAt: string;
  providerJobs: readonly SocialCredentialRuntimeOrchestratorProviderJob[];
  pipelineSummary: Readonly<{
    totalProviderCount: number;
    orchestratedProviderCount: number;
    waitingProviderCount: number;
    blockedProviderCount: number;
    dependencyFailureCount: number;
    resolutionCompleteCount: number;
    readinessReadyCount: number;
    auditCompatibleCount: number;
    computedOnly: true;
    readOnly: true;
  }>;
  orderedPipeline: readonly SocialCredentialRuntimeOrchestratorPhaseKind[];
  dependencyGraph: readonly SocialCredentialRuntimeOrchestratorDependencyNode[];
  diagnostics: readonly SocialCredentialRuntimeOrchestratorDiagnostic[];
  blockedReasons: readonly string[];
  status: SocialCredentialRuntimeOrchestratorStatus;
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
  storesNoSecrets: true;
  startsNoWorkers: true;
  createsNoQueues: true;
  automationForbidden: true;
}>;

export type SocialCredentialRuntimeOrchestrationPlanInput = Readonly<{
  planId: string;
  createdAt: string;
  providerJobs: readonly SocialCredentialRuntimeOrchestratorProviderJob[];
}>;

const PHASE_KIND_SET = new Set<string>(SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_PHASE_KINDS);

export const SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_PIPELINE_ORDER: readonly SocialCredentialRuntimeOrchestratorPhaseKind[] =
  [
    "persistence_validation",
    "domain_mapping_validation",
    "dependency_composition",
    "readiness_aggregation",
    "capability_aggregation",
    "audit_append_compatibility",
    "resolution_flow",
  ];

export function isSocialCredentialRuntimeOrchestratorPhaseKind(
  value: unknown,
): value is SocialCredentialRuntimeOrchestratorPhaseKind {
  return typeof value === "string" && PHASE_KIND_SET.has(value);
}

export function buildSocialCredentialRuntimeOrchestrationPlan(
  input: SocialCredentialRuntimeOrchestrationPlanInput,
): SocialCredentialRuntimeOrchestrationPlan {
  const validation = validateSocialCredentialRuntimeOrchestrationPlanInput(input);
  const forbidden = detectForbiddenOrchestrationState(input);
  const diagnostics = [...validation.diagnostics, ...forbidden.diagnostics];
  const blockedReasons = collectOrchestrationBlockedReasons(input, validation, forbidden);
  const pipelineSummary = summarizeOrchestrationPipeline(input.providerJobs);
  const dependencyGraph = flattenOrchestrationDependencyGraph(input.providerJobs);
  const status = resolveOrchestrationPlanStatus(input.providerJobs, diagnostics);

  return deepFreeze({
    orchestratorVersion: SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION,
    planId: input.planId,
    createdAt: input.createdAt,
    providerJobs: input.providerJobs,
    pipelineSummary,
    orderedPipeline: SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_PIPELINE_ORDER,
    dependencyGraph,
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
    storesNoSecrets: true,
    startsNoWorkers: true,
    createsNoQueues: true,
    automationForbidden: true,
  });
}

export function validateSocialCredentialRuntimeOrchestrationPlan(
  plan: unknown,
): Readonly<{
  valid: boolean;
  diagnostics: readonly SocialCredentialRuntimeOrchestratorDiagnostic[];
}> {
  if (!isRecord(plan)) {
    return {
      valid: false,
      diagnostics: [
        blockDiagnostic(
          "serialization_invalid",
          "plan",
          "Orchestration plan must be an object.",
          "error",
        ),
      ],
    };
  }

  const diagnostics: SocialCredentialRuntimeOrchestratorDiagnostic[] = [];
  requireText(plan.planId, "plan.planId", "plan_id_required", diagnostics);
  if (!isValidTimestamp(plan.createdAt)) {
    diagnostics.push(blockDiagnostic(
      "timestamp_invalid",
      "plan.createdAt",
      "Orchestration plan requires a valid createdAt timestamp.",
      "error",
    ));
  }

  validateProviderJobs(plan.providerJobs, "plan.providerJobs", diagnostics);

  if (plan.grantsExecutionPermission !== false) {
    diagnostics.push(blockDiagnostic(
      "forbidden_execution_permission",
      "plan.grantsExecutionPermission",
      "Orchestration plan must not grant execution permission.",
      "block",
    ));
  }
  if (plan.automationForbidden !== true) {
    diagnostics.push(blockDiagnostic(
      "forbidden_automation_flag",
      "plan.automationForbidden",
      "Orchestration plan must forbid automation.",
      "block",
    ));
  }
  if (
    plan.executesNothing !== true ||
    plan.publishesNothing !== true ||
    plan.usesNoNetwork !== true ||
    plan.usesNoOAuth !== true ||
    plan.storesNoSecrets !== true
  ) {
    diagnostics.push(blockDiagnostic(
      "unsafe_orchestration_contract",
      "plan",
      "Orchestration plan contract invariants failed.",
      "block",
    ));
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

export function detectForbiddenOrchestrationState(
  input: SocialCredentialRuntimeOrchestrationPlanInput | SocialCredentialRuntimeOrchestrationPlan,
): Readonly<{
  forbidden: boolean;
  diagnostics: readonly SocialCredentialRuntimeOrchestratorDiagnostic[];
}> {
  const diagnostics: SocialCredentialRuntimeOrchestratorDiagnostic[] = [];
  const candidate = input as Readonly<Record<string, unknown>>;

  if (candidate.grantsExecutionPermission === true) {
    diagnostics.push(blockDiagnostic(
      "forbidden_execution_permission",
      "plan.grantsExecutionPermission",
      "Orchestration plan must not grant execution permission.",
      "block",
    ));
  }
  if (candidate.automationForbidden === false) {
    diagnostics.push(blockDiagnostic(
      "forbidden_automation_flag",
      "plan.automationForbidden",
      "Orchestration plan must forbid automation.",
      "block",
    ));
  }
  if (candidate.usesNoNetwork === false || candidate.callsNoExternalApis === false) {
    diagnostics.push(blockDiagnostic(
      "forbidden_network_flag",
      "plan",
      "Orchestration plan must forbid network and external API usage.",
      "block",
    ));
  }

  return {
    forbidden: diagnostics.length > 0,
    diagnostics,
  };
}

export function serializeSocialCredentialRuntimeOrchestrationPlan(
  plan: SocialCredentialRuntimeOrchestrationPlan,
): string {
  return JSON.stringify(toStableValue(plan));
}

export function hydrateSocialCredentialRuntimeOrchestrationPlan(
  serialized: string,
): Readonly<{
  ok: true;
  value: SocialCredentialRuntimeOrchestrationPlan;
}> | Readonly<{
  ok: false;
  diagnostics: readonly SocialCredentialRuntimeOrchestratorDiagnostic[];
}> {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const validation = validateSocialCredentialRuntimeOrchestrationPlan(parsed);
    if (!validation.valid || !isRecord(parsed)) {
      return { ok: false, diagnostics: validation.diagnostics };
    }
    return { ok: true, value: deepFreeze(parsed as SocialCredentialRuntimeOrchestrationPlan) };
  } catch {
    return {
      ok: false,
      diagnostics: [
        blockDiagnostic(
          "serialization_invalid",
          "serialized",
          "Orchestration plan serialization must be valid JSON.",
          "error",
        ),
      ],
    };
  }
}

function validateSocialCredentialRuntimeOrchestrationPlanInput(
  input: SocialCredentialRuntimeOrchestrationPlanInput,
): Readonly<{
  diagnostics: readonly SocialCredentialRuntimeOrchestratorDiagnostic[];
}> {
  const diagnostics: SocialCredentialRuntimeOrchestratorDiagnostic[] = [];
  requireText(input.planId, "input.planId", "plan_id_required", diagnostics);
  if (!isValidTimestamp(input.createdAt)) {
    diagnostics.push(blockDiagnostic(
      "timestamp_invalid",
      "input.createdAt",
      "Orchestration plan requires a valid createdAt timestamp.",
      "error",
    ));
  }
  validateProviderJobs(input.providerJobs, "input.providerJobs", diagnostics);
  return { diagnostics };
}

function collectOrchestrationBlockedReasons(
  input: SocialCredentialRuntimeOrchestrationPlanInput,
  validation: Readonly<{ diagnostics: readonly SocialCredentialRuntimeOrchestratorDiagnostic[] }>,
  forbidden: Readonly<{ diagnostics: readonly SocialCredentialRuntimeOrchestratorDiagnostic[] }>,
): readonly string[] {
  const reasons = new Set<string>();
  for (const diagnostic of [...validation.diagnostics, ...forbidden.diagnostics]) {
    reasons.add(diagnostic.code);
  }

  for (const job of input.providerJobs) {
    for (const reason of job.blockingReasons) {
      reasons.add(reason);
    }
    for (const phase of job.pipelinePhases) {
      if (phase.required && phase.blocksOrchestration && phase.status === "blocked") {
        reasons.add(`phase_blocked:${phase.kind}`);
      }
    }
  }

  return [...reasons];
}

function validateProviderJobs(
  jobs: unknown,
  path: string,
  diagnostics: SocialCredentialRuntimeOrchestratorDiagnostic[],
): void {
  if (!Array.isArray(jobs)) {
    diagnostics.push(blockDiagnostic("serialization_invalid", path, "Orchestration provider jobs must be an array.", "error"));
    return;
  }

  jobs.forEach((job, index) => {
    const jobPath = `${path}.${index}`;
    if (!isRecord(job)) {
      diagnostics.push(blockDiagnostic("serialization_invalid", jobPath, "Orchestration provider job must be an object.", "error"));
      return;
    }
    requireText(job.providerOrchestrationId, `${jobPath}.providerOrchestrationId`, "provider_orchestration_id_required", diagnostics);
    requireText(job.provider, `${jobPath}.provider`, "provider_required", diagnostics);
    validatePhases(job.pipelinePhases, `${jobPath}.pipelinePhases`, diagnostics);
    validateDependencyGraph(job.dependencyGraph, `${jobPath}.dependencyGraph`, diagnostics);
    validateResolutionFlow(job.resolutionFlow, `${jobPath}.resolutionFlow`, diagnostics);
    validateCapabilityAggregation(job.capabilityAggregation, `${jobPath}.capabilityAggregation`, diagnostics);
    validateReadinessAggregation(job.readinessAggregation, `${jobPath}.readinessAggregation`, diagnostics);
    validateAuditIntegration(job.auditIntegration, `${jobPath}.auditIntegration`, diagnostics);
  });
}

function validatePhases(
  phases: unknown,
  path: string,
  diagnostics: SocialCredentialRuntimeOrchestratorDiagnostic[],
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
    if (!isSocialCredentialRuntimeOrchestratorPhaseKind(phase.kind)) {
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
  diagnostics: SocialCredentialRuntimeOrchestratorDiagnostic[],
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

function validateResolutionFlow(
  flow: unknown,
  path: string,
  diagnostics: SocialCredentialRuntimeOrchestratorDiagnostic[],
): void {
  if (!isRecord(flow)) {
    diagnostics.push(blockDiagnostic("serialization_invalid", path, "Resolution flow must be an object.", "error"));
    return;
  }
  if (!Array.isArray(flow.steps)) {
    diagnostics.push(blockDiagnostic("serialization_invalid", `${path}.steps`, "Resolution flow steps must be an array.", "error"));
    return;
  }
  flow.steps.forEach((step, index) => {
    const stepPath = `${path}.steps.${index}`;
    if (!isRecord(step)) {
      diagnostics.push(blockDiagnostic("serialization_invalid", stepPath, "Resolution step must be an object.", "error"));
      return;
    }
    requireText(step.stepId, `${stepPath}.stepId`, "resolution_step_id_required", diagnostics);
  });
}

function validateCapabilityAggregation(
  aggregation: unknown,
  path: string,
  diagnostics: SocialCredentialRuntimeOrchestratorDiagnostic[],
): void {
  if (!isRecord(aggregation)) {
    diagnostics.push(blockDiagnostic("serialization_invalid", path, "Capability aggregation must be an object.", "error"));
    return;
  }
  requireText(aggregation.aggregationId, `${path}.aggregationId`, "aggregation_id_required", diagnostics);
}

function validateReadinessAggregation(
  aggregation: unknown,
  path: string,
  diagnostics: SocialCredentialRuntimeOrchestratorDiagnostic[],
): void {
  if (!isRecord(aggregation)) {
    diagnostics.push(blockDiagnostic("serialization_invalid", path, "Readiness aggregation must be an object.", "error"));
    return;
  }
  requireText(aggregation.aggregationId, `${path}.aggregationId`, "aggregation_id_required", diagnostics);
}

function validateAuditIntegration(
  integration: unknown,
  path: string,
  diagnostics: SocialCredentialRuntimeOrchestratorDiagnostic[],
): void {
  if (!isRecord(integration)) {
    diagnostics.push(blockDiagnostic("serialization_invalid", path, "Audit integration must be an object.", "error"));
    return;
  }
  requireText(integration.integrationId, `${path}.integrationId`, "integration_id_required", diagnostics);
}

function summarizeOrchestrationPipeline(
  jobs: readonly SocialCredentialRuntimeOrchestratorProviderJob[],
): SocialCredentialRuntimeOrchestrationPlan["pipelineSummary"] {
  return {
    totalProviderCount: jobs.length,
    orchestratedProviderCount: jobs.filter((job) => job.orchestrationStatus === "orchestrated").length,
    waitingProviderCount: jobs.filter((job) => job.orchestrationStatus === "waiting").length,
    blockedProviderCount: jobs.filter((job) => job.orchestrationStatus === "blocked").length,
    dependencyFailureCount: jobs.filter((job) => job.dependencyFailures.length > 0).length,
    resolutionCompleteCount: jobs.filter((job) => job.resolutionFlow.resolutionComplete).length,
    readinessReadyCount: jobs.filter((job) => job.readinessAggregation.credentialReady).length,
    auditCompatibleCount: jobs.filter((job) => job.auditIntegration.appendOnlyCompatible).length,
    computedOnly: true,
    readOnly: true,
  };
}

function flattenOrchestrationDependencyGraph(
  jobs: readonly SocialCredentialRuntimeOrchestratorProviderJob[],
): readonly SocialCredentialRuntimeOrchestratorDependencyNode[] {
  return jobs.flatMap((job) =>
    job.dependencyGraph.map((node) => ({
      ...node,
      nodeId: `${job.provider}:${node.nodeId}`,
    })),
  );
}

function resolveOrchestrationPlanStatus(
  jobs: readonly SocialCredentialRuntimeOrchestratorProviderJob[],
  diagnostics: readonly SocialCredentialRuntimeOrchestratorDiagnostic[],
): SocialCredentialRuntimeOrchestratorStatus {
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error" || diagnostic.severity === "block")) {
    return "blocked";
  }
  if (jobs.some((job) => job.orchestrationStatus === "blocked")) return "blocked";
  if (jobs.some((job) => job.orchestrationStatus === "waiting")) return "waiting";
  return jobs.length > 0 ? "orchestrated" : "waiting";
}

function requireText(
  value: unknown,
  path: string,
  code: SocialCredentialRuntimeOrchestratorBlockedReason,
  diagnostics: SocialCredentialRuntimeOrchestratorDiagnostic[],
): void {
  if (hasText(value)) return;
  diagnostics.push(blockDiagnostic(code, path, "Required orchestration text field is missing.", "error"));
}

function blockDiagnostic(
  code: SocialCredentialRuntimeOrchestratorBlockedReason,
  path: string,
  message: string,
  severity: "block" | "error",
): SocialCredentialRuntimeOrchestratorDiagnostic {
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
