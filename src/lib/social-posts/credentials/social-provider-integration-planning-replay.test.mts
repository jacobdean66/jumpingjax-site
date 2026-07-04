import assert from "node:assert/strict";

import { replaySocialProviderIntegrationPlanning } from "./social-provider-integration-planning-replay";
import { SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION } from "./social-provider-integration-planning";
import { replaySocialCredentialRuntimeOrchestrator } from "./social-credential-runtime-orchestrator-replay";
import { evaluateSocialProviderIntegrationOrchestrationCompatibility } from "./social-provider-integration-orchestration-compatibility";
import { SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION } from "./social-credential-runtime-orchestrator";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

await test("replays provider integration planning diagnostics", () => {
  const replay = replaySocialProviderIntegrationPlanning().value;
  assert.equal(replay.replayVersion, SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION);
  assert.equal(replay.summary.totalProviderCount, 3);
  assert.equal(replay.grantsExecutionPermission, false);
  assert.equal(replay.replayIntegrity.deterministic, true);
  assert.equal(replay.replayIntegrity.replayCompatible, true);
  assert.equal(replay.contractSnapshots.length, 3);
});

await test("does not change D15 Wave 1 orchestration outcomes", () => {
  const orchestrator = replaySocialCredentialRuntimeOrchestrator(undefined, {
    now: "2026-07-01T00:00:00.000Z",
  }).value;
  const planning = replaySocialProviderIntegrationPlanning(undefined, {
    now: "2026-07-01T00:00:00.000Z",
  }).value;

  assert.deepEqual(
    orchestrator.plan.providerJobs.map((job) => job.provider),
    planning.orchestrationCompatibility.providerCompatibilities.map((item) => item.provider),
  );
  assert.equal(orchestrator.summary.blockedProviderCount, planning.summary.readinessImpactBlockedCount);
  assert.equal(
    orchestrator.providerIntegrationCompatibility.planId,
    orchestrator.plan.planId,
  );
});

await test("evaluates orchestration compatibility against orchestrator plan", () => {
  const orchestrator = replaySocialCredentialRuntimeOrchestrator().value;
  const compatibility = evaluateSocialProviderIntegrationOrchestrationCompatibility(
    orchestrator.plan,
  );
  assert.equal(compatibility.orchestratorVersion, SOCIAL_CREDENTIAL_RUNTIME_ORCHESTRATOR_VERSION);
  assert.equal(compatibility.providerCompatibilities.length, 3);
  assert.equal(compatibility.contractSummary.totalProviderCount, 3);
  for (const provider of compatibility.providerCompatibilities) {
    assert.equal(provider.orchestrationContractAligned, true);
    assert.equal(provider.contractSnapshot.replayCompatible, true);
  }
});

await test("same input produces deterministic planning replay output", () => {
  const first = replaySocialProviderIntegrationPlanning(undefined, {
    now: "2026-07-01T00:00:00.000Z",
  }).value;
  const second = replaySocialProviderIntegrationPlanning(undefined, {
    now: "2026-07-01T00:00:00.000Z",
  }).value;
  assert.deepEqual(
    first.providerProjections.map((projection) => projection.provider),
    second.providerProjections.map((projection) => projection.provider),
  );
  assert.equal(
    first.contractSummary.forbiddenCapabilityTotal,
    second.contractSummary.forbiddenCapabilityTotal,
  );
});

console.log("social-provider-integration-planning-replay tests passed");
