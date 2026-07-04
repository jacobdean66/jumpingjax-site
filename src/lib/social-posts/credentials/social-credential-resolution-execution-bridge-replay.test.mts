import assert from "node:assert/strict";

import {
  composeCredentialResolutionExecutionBridgeReadModel,
  replaySocialCredentialResolutionExecutionBridge,
  SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BRIDGE_REPLAY_VERSION,
} from "./social-credential-resolution-execution-bridge-replay";
import { SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BRIDGE_VERSION } from "./social-credential-resolution-execution-bridge";
import { replaySocialCredentialRuntimeOrchestrator } from "./social-credential-runtime-orchestrator-replay";
import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  type SocialCredentialPersistenceModel,
} from "./social-credential-repository";

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

await test("replays credential resolution execution bridge diagnostics", () => {
  const replay = replaySocialCredentialResolutionExecutionBridge().value;
  assert.equal(replay.replayVersion, SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BRIDGE_REPLAY_VERSION);
  assert.equal(replay.plan.bridgeVersion, SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BRIDGE_VERSION);
  assert.equal(replay.summary.totalProviderCount, 3);
  assert.equal(replay.grantsExecutionPermission, false);
  assert.equal(replay.replayIntegrity.deterministic, true);
  assert.equal(replay.replayIntegrity.replayCompatible, true);
});

await test("wires resolution bridge into orchestrator without changing orchestration outcomes", () => {
  const orchestrator = replaySocialCredentialRuntimeOrchestrator(model(), {
    now: "2026-07-01T00:00:00.000Z",
  }).value;
  const resolution = replaySocialCredentialResolutionExecutionBridge(model(), {
    now: "2026-07-01T00:00:00.000Z",
  }).value;

  assert.deepEqual(
    orchestrator.plan.providerJobs.map((job) => job.provider),
    resolution.providerProjections.map((provider) => provider.provider),
  );
  assert.equal(
    orchestrator.credentialResolutionExecution.summary.totalProviderCount,
    resolution.summary.totalProviderCount,
  );
  assert.equal(orchestrator.credentialResolutionExecution.plan.planId, resolution.plan.planId);
});

await test("compose helper accepts orchestration plan without re-running orchestrator replay", () => {
  const orchestrator = replaySocialCredentialRuntimeOrchestrator(model(), {
    now: "2026-07-01T00:00:00.000Z",
  }).value;
  const composed = composeCredentialResolutionExecutionBridgeReadModel(
    model(),
    orchestrator.plan,
    "2026-07-01T00:00:00.000Z",
  );
  assert.equal(composed.summary.totalProviderCount, 3);
  assert.equal(composed.plan.orchestratorVersion, orchestrator.plan.orchestratorVersion);
});

await test("same input produces deterministic resolution bridge output", () => {
  const first = replaySocialCredentialResolutionExecutionBridge(model(), {
    now: "2026-07-01T00:00:00.000Z",
  }).value;
  const second = replaySocialCredentialResolutionExecutionBridge(model(), {
    now: "2026-07-01T00:00:00.000Z",
  }).value;
  assert.deepEqual(
    first.providerProjections.map((provider) => provider.provider),
    second.providerProjections.map((provider) => provider.provider),
  );
  assert.equal(first.summary.blockedProviderCount, second.summary.blockedProviderCount);
});
