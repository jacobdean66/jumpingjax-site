import assert from "node:assert/strict";

import {
  buildSocialPublicationExecutionCoordinationPlan,
  detectForbiddenCoordinationState,
  hydrateSocialPublicationExecutionCoordinationPlan,
  serializeSocialPublicationExecutionCoordinationPlan,
  validateSocialPublicationExecutionCoordinationPlan,
  type SocialPublicationExecutionCoordinatorAdapterSelection,
  type SocialPublicationExecutionCoordinatorAuthorityNode,
  type SocialPublicationExecutionCoordinatorDependencyNode,
  type SocialPublicationExecutionCoordinatorJob,
  type SocialPublicationExecutionCoordinatorPipelinePhase,
} from "./social-publication-execution-coordinator";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function pipelinePhase(
  kind: SocialPublicationExecutionCoordinatorPipelinePhase["kind"],
  order: number,
  status: SocialPublicationExecutionCoordinatorPipelinePhase["status"],
  blocksCoordination = false,
): SocialPublicationExecutionCoordinatorPipelinePhase {
  return {
    phaseId: `phase-${kind}`,
    order,
    kind,
    label: kind,
    description: `${kind} description`,
    status,
    required: true,
    blocksCoordination,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function dependencyNode(
  nodeId: string,
  present: boolean,
): SocialPublicationExecutionCoordinatorDependencyNode {
  return {
    nodeId,
    label: nodeId,
    dependencyType: nodeId,
    present,
    blocksCoordination: !present,
    computedOnly: true,
    readOnly: true,
  };
}

function authorityNode(
  nodeId: "owner_approval" | "publisher_authority",
  present: boolean,
): SocialPublicationExecutionCoordinatorAuthorityNode {
  return {
    nodeId,
    label: nodeId,
    authorityType: nodeId,
    present,
    blocksCoordination: !present,
    computedOnly: true,
    readOnly: true,
  };
}

function adapterSelection(
  executionJobId: string,
  ready: boolean,
): SocialPublicationExecutionCoordinatorAdapterSelection {
  return {
    selectionId: `adapter-selection-${executionJobId}`,
    adapterId: ready ? "dry-run-facebook" : null,
    platform: ready ? "facebook" : null,
    available: ready,
    dryRunCapable: ready,
    adapterReady: ready,
    unsupportedChannel: false,
    blockingReasons: ready ? [] : ["adapter_unavailable"],
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
  };
}

function coordinatedJob(
  id: string,
  input: Partial<SocialPublicationExecutionCoordinatorJob> = {},
): SocialPublicationExecutionCoordinatorJob {
  const ready = input.fullyCoordinated ?? true;
  return {
    executionJobId: `execution-job-${id}`,
    executionIntentId: `execution-intent-${id}`,
    executionResultId: null,
    coordinationStatus: ready ? "coordinated" : "blocked",
    pipelinePhases: [
      pipelinePhase("preflight_gate", 1, "passed"),
      pipelinePhase("dependency_validation", 2, ready ? "ready" : "blocked", !ready),
      pipelinePhase("authority_validation", 3, ready ? "ready" : "blocked", !ready),
      pipelinePhase("planner_planning", 4, ready ? "ready" : "blocked", !ready),
      pipelinePhase("adapter_selection", 5, ready ? "ready" : "blocked", !ready),
      pipelinePhase("runbook_readiness", 6, ready ? "ready" : "blocked", !ready),
    ],
    dependencyGraph: [dependencyNode("owner_approval", ready)],
    authorityGraph: [
      authorityNode("owner_approval", ready),
      authorityNode("publisher_authority", ready),
    ],
    adapterSelection: adapterSelection(`execution-job-${id}`, ready),
    plannerStepStatus: ready ? "ready" : "blocked",
    runbookStatus: ready ? "ready" : "blocked",
    preflightStatus: "pass",
    blockingReasons: ready ? [] : ["phase_blocked:adapter_selection"],
    fullyCoordinated: ready,
    adapterReady: ready,
    runbookReady: ready,
    dependencyFailures: ready ? [] : ["owner_approval"],
    authorityFailures: ready ? [] : ["owner_approval"],
    updatedAt: "2026-07-01T12:00:00.000Z",
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    mutatesNothing: true,
    ...input,
  };
}

function referencePlanInput() {
  return {
    planId: "coordination-plan-a",
    createdAt: "2026-07-01T12:00:00.000Z",
    jobs: [coordinatedJob("a")],
  };
}

await test("builds a coordinated plan when pipeline phases align", () => {
  const plan = buildSocialPublicationExecutionCoordinationPlan(referencePlanInput());
  assert.equal(plan.status, "coordinated");
  assert.equal(plan.grantsExecutionPermission, false);
  assert.equal(plan.automationForbidden, true);
  assert.equal(plan.pipelineSummary.coordinatedJobCount, 1);
  assert.equal(plan.jobs[0]?.fullyCoordinated, true);
  assert.equal(plan.orderedPipeline.length, 6);
});

await test("blocks plans with unsatisfied pipeline phases and dependency failures", () => {
  const plan = buildSocialPublicationExecutionCoordinationPlan({
    planId: "coordination-plan-blocked",
    createdAt: "2026-07-01T12:00:00.000Z",
    jobs: [coordinatedJob("blocked", { fullyCoordinated: false, coordinationStatus: "blocked" })],
  });
  assert.equal(plan.status, "blocked");
  assert.ok(plan.blockedReasons.includes("phase_blocked:adapter_selection"));
  assert.equal(plan.pipelineSummary.blockedJobCount, 1);
});

await test("validates and serializes coordination plans", () => {
  const plan = buildSocialPublicationExecutionCoordinationPlan(referencePlanInput());
  const validation = validateSocialPublicationExecutionCoordinationPlan(plan);
  assert.equal(validation.valid, true);

  const serialized = serializeSocialPublicationExecutionCoordinationPlan(plan);
  const hydrated = hydrateSocialPublicationExecutionCoordinationPlan(serialized);
  assert.equal(hydrated.ok, true);
  if (hydrated.ok) {
    assert.equal(hydrated.value.planId, plan.planId);
    assert.equal(hydrated.value.executesNothing, true);
  }
});

await test("detects forbidden automation and execution permission flags", () => {
  const plan = buildSocialPublicationExecutionCoordinationPlan(referencePlanInput());
  const forbidden = detectForbiddenCoordinationState({
    ...plan,
    grantsExecutionPermission: true as unknown as false,
  });
  assert.equal(forbidden.forbidden, true);
  assert.ok(
    forbidden.diagnostics.some((diagnostic) => diagnostic.code === "forbidden_execution_permission"),
  );
});

await test("rejects invalid coordination plan hydration", () => {
  const hydrated = hydrateSocialPublicationExecutionCoordinationPlan("{not-json");
  assert.equal(hydrated.ok, false);
});
