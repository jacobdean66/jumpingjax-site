import assert from "node:assert/strict";

import { replaySocialPlatformReadinessGate } from "./social-platform-readiness-gate-replay";
import { SOCIAL_PLATFORM_READINESS_GATE_REPLAY_VERSION } from "./social-platform-readiness-gate-replay";
import { SOCIAL_PLATFORM_READINESS_GATE_VERSION } from "./social-platform-readiness-gate";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

await test("replays readiness gate across all supported platforms", () => {
  const replay = replaySocialPlatformReadinessGate().value;

  assert.equal(replay.replayVersion, SOCIAL_PLATFORM_READINESS_GATE_REPLAY_VERSION);
  assert.equal(replay.gateVersion, SOCIAL_PLATFORM_READINESS_GATE_VERSION);
  assert.equal(replay.summary.totalPlatformCount, 4);
  assert.equal(replay.verdict.gateVersion, SOCIAL_PLATFORM_READINESS_GATE_VERSION);
  assert.equal(replay.summary.allExecutionBlocked, true);
  assert.equal(replay.grantsExecutionPermission, false);
});

await test("composes capability, credential, and adapter replays into per-platform diagnostics", () => {
  const replay = replaySocialPlatformReadinessGate().value;

  assert.ok(replay.architecturallyReadyPlatforms.length >= 0);
  assert.equal(
    replay.architecturallyReadyPlatforms.length + replay.architecturallyBlockedPlatforms.length,
    4,
  );
  assert.ok(replay.readinessReasons.length > 0);
  assert.ok(
    replay.readinessReasons.every(
      (reason) => typeof reason.code === "string" && typeof reason.referenceId !== "undefined",
    ),
  );
});

await test("projects capability impact from composed replay layers", () => {
  const replay = replaySocialPlatformReadinessGate().value;

  assert.equal(replay.capabilityImpact.executionCapable, false);
  assert.equal(replay.capabilityImpact.liveOAuthBlocked, true);
  assert.equal(replay.capabilityImpact.liveCredentialsBlocked, true);
  assert.equal(typeof replay.capabilityImpact.platformReadyCount, "number");
  assert.equal(typeof replay.capabilityImpact.metaReadyJobCount, "number");
  assert.equal(typeof replay.capabilityImpact.tiktokReadyJobCount, "number");
  assert.equal(typeof replay.capabilityImpact.linkedinReadyJobCount, "number");
});

await test("evaluates all platforms as architecturally ready with execution blocked", () => {
  const replay = replaySocialPlatformReadinessGate().value;

  assert.equal(replay.summary.allArchitecturallyReady, true);
  assert.equal(replay.summary.architecturallyReadyCount, 4);
  assert.equal(replay.summary.architecturallyBlockedCount, 0);
  assert.equal(replay.summary.dryRunCapableCount, 4);
  assert.equal(replay.summary.credentialBoundaryAwareCount, 4);
  assert.ok(
    replay.architecturallyReadyPlatforms.every((platform) => platform.executionBlocked === true),
  );
});

await test("remains deterministic, read-only, and replay-valid", () => {
  const first = replaySocialPlatformReadinessGate().value;
  const second = replaySocialPlatformReadinessGate().value;

  assert.deepEqual(
    first.architecturallyReadyPlatforms.map((item) => item.platform),
    second.architecturallyReadyPlatforms.map((item) => item.platform),
  );
  assert.equal(first.replayIntegrity.valid, true);
  assert.equal(first.replayIntegrity.source, "social_platform_readiness_gate_replay");
  assert.equal(first.computedOnly, true);
  assert.equal(first.readOnly, true);
  assert.equal(first.executesNothing, true);
  assert.equal(first.publishesNothing, true);
});

console.log("social-platform-readiness-gate-replay tests passed");
