import assert from "node:assert/strict";

import { replaySocialCredentialRuntimeOrchestrator } from "./social-credential-runtime-orchestrator-replay";
import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  type SocialCredentialPersistenceModel,
} from "./social-credential-repository";
import { SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION } from "./social-credential-runtime-orchestrator";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function model(overrides: Partial<SocialCredentialPersistenceModel> = {}): SocialCredentialPersistenceModel {
  return {
    ...EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
    ...overrides,
  };
}

await test("replays credential runtime orchestrator from empty persistence model", () => {
  const replay = replaySocialCredentialRuntimeOrchestrator().value;
  assert.equal(replay.replayVersion, SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION);
  assert.equal(replay.summary.totalProviderCount, 3);
  assert.equal(replay.summary.fullyOrchestratedProviderCount, 0);
  assert.equal(replay.summary.blockedProviderCount, 3);
  assert.equal(replay.grantsExecutionPermission, false);
  assert.equal(replay.computedOnly, true);
  assert.equal(replay.plan.orchestratorVersion, SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION);
});

await test("aggregates readiness and capability projections per provider", () => {
  const replay = replaySocialCredentialRuntimeOrchestrator(model()).value;
  const meta = replay.blockedProviders.find((provider) => provider.provider === "meta");
  assert.ok(meta);
  assert.equal(meta.capabilityAggregation.liveCredentialsBlocked, true);
  assert.equal(meta.capabilityAggregation.liveOAuthBlocked, true);
  assert.equal(meta.readinessAggregation.credentialBlocked, true);
  assert.equal(meta.resolutionFlow.providerAgnostic, true);
  assert.ok(meta.resolutionFlow.steps.length > 0);
});

await test("verifies append-only audit integration compatibility", () => {
  const replay = replaySocialCredentialRuntimeOrchestrator(model()).value;
  for (const provider of replay.blockedProviders) {
    assert.equal(provider.auditIntegration.mutatesNothing, true);
    assert.equal(provider.auditIntegration.grantsExecutionPermission, false);
    assert.equal(provider.auditIntegration.appendAuditEventAvailable, true);
    assert.equal(provider.auditIntegration.appendOnlyCompatible, true);
  }
});

await test("same input produces deterministic orchestration output", () => {
  const first = replaySocialCredentialRuntimeOrchestrator(model(), {
    now: "2026-07-01T00:00:00.000Z",
  }).value;
  const second = replaySocialCredentialRuntimeOrchestrator(model(), {
    now: "2026-07-01T00:00:00.000Z",
  }).value;
  assert.deepEqual(
    first.plan.providerJobs.map((job) => job.provider),
    second.plan.providerJobs.map((job) => job.provider),
  );
  assert.equal(first.summary.blockedProviderCount, second.summary.blockedProviderCount);
  assert.equal(first.replayIntegrity.deterministic, true);
});

await test("plan pipeline order matches orchestrator contract", () => {
  const replay = replaySocialCredentialRuntimeOrchestrator().value;
  assert.deepEqual(replay.plan.orderedPipeline, [
    "persistence_validation",
    "domain_mapping_validation",
    "dependency_composition",
    "readiness_aggregation",
    "capability_aggregation",
    "audit_append_compatibility",
    "resolution_flow",
  ]);
});

console.log("social-credential-runtime-orchestrator-replay tests passed");
