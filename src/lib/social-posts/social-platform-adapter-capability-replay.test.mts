import assert from "node:assert/strict";

import { replaySocialPlatformAdapterCapabilities } from "./social-platform-adapter-capability-replay";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

await test("replays registered adapters, supported platforms, and feature flags", () => {
  const replay = replaySocialPlatformAdapterCapabilities().value;

  assert.equal(replay.registeredAdapters.length, 6);
  assert.deepEqual(replay.supportedPlatforms, ["facebook", "instagram"]);
  assert.deepEqual(replay.unsupportedPlatforms, ["tiktok", "linkedin"]);
  assert.ok(replay.featureFlags.includes("dry_run_enabled"));
  assert.equal(replay.grantsExecutionPermission, false);
});

await test("computes dry-run availability and modeled execution capability only", () => {
  const replay = replaySocialPlatformAdapterCapabilities().value;

  assert.equal(replay.dryRunAvailability.facebook, true);
  assert.equal(replay.dryRunAvailability.instagram, true);
  assert.equal(replay.executionCapability.executionCapable, false);
  assert.equal(replay.executionCapability.realExecutionBlocked, true);
  assert.equal(replay.executionCapability.oauthBlocked, true);
});

await test("projects supported and unsupported channels with platform readiness", () => {
  const replay = replaySocialPlatformAdapterCapabilities().value;

  assert.ok(replay.supportedChannels.every((channel) => channel.supported));
  assert.ok(replay.unsupportedChannels.every((channel) => !channel.supported));
  assert.equal(replay.platformReadiness.length, 4);

  const facebook = replay.platformReadiness.find((item) => item.platform === "facebook");
  assert.ok(facebook);
  assert.equal(facebook?.supported, true);
  assert.equal(facebook?.dryRunAvailable, true);
  assert.equal(facebook?.executionCapable, false);

  const tiktok = replay.platformReadiness.find((item) => item.platform === "tiktok");
  assert.ok(tiktok);
  assert.equal(tiktok?.supported, false);
  assert.equal(tiktok?.dryRunAvailable, false);
});

await test("composes D10 execution adapter replay into execution projection", () => {
  const replay = replaySocialPlatformAdapterCapabilities(undefined, {
    includeExecutionProjection: true,
  }).value;

  assert.ok(replay.executionProjection);
  assert.equal(typeof replay.executionProjection?.availableAdapterCount, "number");
  assert.equal(replay.replayIntegrity.valid, true);
  assert.equal(replay.replayIntegrity.source, "social_platform_adapter_capability_replay");
});

await test("remains read-only and non-executing", () => {
  const replay = replaySocialPlatformAdapterCapabilities().value;
  assert.equal(replay.computedOnly, true);
  assert.equal(replay.readOnly, true);
  assert.equal(replay.executesNothing, true);
  assert.equal(replay.publishesNothing, true);
});

console.log("social-platform-adapter-capability-replay tests passed");
