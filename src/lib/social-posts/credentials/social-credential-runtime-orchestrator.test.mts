import assert from "node:assert/strict";

import {
  buildSocialCredentialRuntimeOrchestrationPlan,
  detectForbiddenOrchestrationState,
  hydrateSocialCredentialRuntimeOrchestrationPlan,
  serializeSocialCredentialRuntimeOrchestrationPlan,
  validateSocialCredentialRuntimeOrchestrationPlan,
  type SocialCredentialRuntimeAuditIntegration,
  type SocialCredentialRuntimeCapabilityAggregation,
  type SocialCredentialRuntimeOrchestratorDependencyNode,
  type SocialCredentialRuntimeOrchestratorPipelinePhase,
  type SocialCredentialRuntimeOrchestratorProviderJob,
  type SocialCredentialRuntimeReadinessAggregation,
  type SocialCredentialRuntimeResolutionFlow,
} from "./social-credential-runtime-orchestrator";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function pipelinePhase(
  kind: SocialCredentialRuntimeOrchestratorPipelinePhase["kind"],
  order: number,
  status: SocialCredentialRuntimeOrchestratorPipelinePhase["status"],
  blocksOrchestration = false,
): SocialCredentialRuntimeOrchestratorPipelinePhase {
  return {
    phaseId: `phase-${kind}`,
    order,
    kind,
    label: kind,
    description: `${kind} description`,
    status,
    required: true,
    blocksOrchestration,
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
): SocialCredentialRuntimeOrchestratorDependencyNode {
  return {
    nodeId,
    label: nodeId,
    dependencyType: nodeId,
    present,
    blocksOrchestration: !present,
    computedOnly: true,
    readOnly: true,
  };
}

function capabilityAggregation(provider: "meta"): SocialCredentialRuntimeCapabilityAggregation {
  return {
    aggregationId: `capability-aggregation-${provider}`,
    provider,
    credentialReferenceOnly: true,
    liveCredentialsBlocked: true,
    liveOAuthBlocked: true,
    encryptionBlocked: true,
    networkBlocked: true,
    executionBlocked: true,
    satisfiedCapabilityFlags: ["credential_reference_only"],
    missingCapabilityFlags: [],
    blockingReasons: [],
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
  };
}

function readinessAggregation(provider: "meta", ready: boolean): SocialCredentialRuntimeReadinessAggregation {
  return {
    aggregationId: `readiness-aggregation-${provider}`,
    provider,
    credentialReady: ready,
    credentialBlocked: !ready,
    architecturallyReadyPlatformCount: ready ? 2 : 0,
    architecturallyBlockedPlatformCount: ready ? 0 : 2,
    blockingReasons: ready ? [] : ["no_stored_credentials"],
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
  };
}

function auditIntegration(provider: "meta", compatible: boolean): SocialCredentialRuntimeAuditIntegration {
  return {
    integrationId: `audit-integration-${provider}`,
    appendOnlyCompatible: compatible,
    appendAuditEventAvailable: compatible,
    preservesAppendOnlyHistory: compatible,
    auditEventCount: compatible ? 1 : 0,
    blockingReasons: compatible ? [] : ["append_audit_event_unavailable"],
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    mutatesNothing: true,
    grantsExecutionPermission: false,
  };
}

function resolutionFlow(provider: "meta", complete: boolean): SocialCredentialRuntimeResolutionFlow {
  return {
    flowId: `resolution-flow-${provider}`,
    provider,
    providerAgnostic: true,
    steps: [
      {
        stepId: `resolution-${provider}-oauth_token_ref`,
        order: 1,
        label: "Resolve oauth_token_ref",
        provider,
        credentialKind: "oauth_token_ref",
        resolved: complete,
        blocksOrchestration: !complete,
        computedOnly: true,
        readOnly: true,
        authoritative: false,
        grantsExecutionPermission: false,
      },
    ],
    resolvedStepCount: complete ? 1 : 0,
    unresolvedStepCount: complete ? 0 : 1,
    resolutionComplete: complete,
    blockingReasons: complete ? [] : ["unresolved_kind:oauth_token_ref"],
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function orchestratedProviderJob(
  ready: boolean,
  input: Partial<SocialCredentialRuntimeOrchestratorProviderJob> = {},
): SocialCredentialRuntimeOrchestratorProviderJob {
  return {
    providerOrchestrationId: "provider-orchestration-meta",
    provider: "meta",
    orchestrationStatus: ready ? "orchestrated" : "blocked",
    pipelinePhases: [
      pipelinePhase("persistence_validation", 1, "passed"),
      pipelinePhase("domain_mapping_validation", 2, "passed"),
      pipelinePhase("dependency_composition", 3, ready ? "ready" : "blocked", !ready),
      pipelinePhase("readiness_aggregation", 4, ready ? "ready" : "blocked", !ready),
      pipelinePhase("capability_aggregation", 5, "ready"),
      pipelinePhase("audit_append_compatibility", 6, "ready"),
      pipelinePhase("resolution_flow", 7, ready ? "ready" : "blocked", !ready),
    ],
    dependencyGraph: [dependencyNode("provider_account", ready)],
    capabilityAggregation: capabilityAggregation("meta"),
    readinessAggregation: readinessAggregation("meta", ready),
    auditIntegration: auditIntegration("meta", true),
    resolutionFlow: resolutionFlow("meta", ready),
    dependencyFailures: ready ? [] : ["provider_account"],
    blockingReasons: ready ? [] : ["phase_blocked:dependency_composition"],
    fullyOrchestrated: ready,
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
    planId: "orchestration-plan-a",
    createdAt: "2026-07-01T12:00:00.000Z",
    providerJobs: [orchestratedProviderJob(true)],
  };
}

await test("builds an orchestrated plan when pipeline phases align", () => {
  const plan = buildSocialCredentialRuntimeOrchestrationPlan(referencePlanInput());
  assert.equal(plan.status, "orchestrated");
  assert.equal(plan.orchestratorVersion, "d15-w1-v1");
  assert.equal(plan.grantsExecutionPermission, false);
  assert.equal(plan.automationForbidden, true);
  assert.equal(plan.pipelineSummary.orchestratedProviderCount, 1);
  assert.equal(plan.providerJobs[0]?.fullyOrchestrated, true);
  assert.equal(plan.orderedPipeline.length, 7);
});

await test("blocks plans with unsatisfied pipeline phases and dependency failures", () => {
  const plan = buildSocialCredentialRuntimeOrchestrationPlan({
    planId: "orchestration-plan-blocked",
    createdAt: "2026-07-01T12:00:00.000Z",
    providerJobs: [orchestratedProviderJob(false)],
  });
  assert.equal(plan.status, "blocked");
  assert.ok(plan.blockedReasons.includes("phase_blocked:dependency_composition"));
  assert.equal(plan.pipelineSummary.blockedProviderCount, 1);
});

await test("validates and serializes orchestration plans", () => {
  const plan = buildSocialCredentialRuntimeOrchestrationPlan(referencePlanInput());
  const validation = validateSocialCredentialRuntimeOrchestrationPlan(plan);
  assert.equal(validation.valid, true);

  const serialized = serializeSocialCredentialRuntimeOrchestrationPlan(plan);
  const hydrated = hydrateSocialCredentialRuntimeOrchestrationPlan(serialized);
  assert.equal(hydrated.ok, true);
  if (hydrated.ok) {
    assert.equal(hydrated.value.planId, plan.planId);
    assert.equal(hydrated.value.status, plan.status);
  }
});

await test("detects forbidden orchestration states", () => {
  const plan = buildSocialCredentialRuntimeOrchestrationPlan(referencePlanInput());
  const forbidden = detectForbiddenOrchestrationState({
    ...plan,
    grantsExecutionPermission: true as unknown as false,
  });
  assert.equal(forbidden.forbidden, true);
  assert.ok(
    forbidden.diagnostics.some((diagnostic) => diagnostic.code === "forbidden_execution_permission"),
  );
});

console.log("social-credential-runtime-orchestrator tests passed");
