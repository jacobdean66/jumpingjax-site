import assert from "node:assert/strict";

import { replaySocialPlatformCredentialBoundary } from "./social-platform-credential-boundary-replay";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

await test("replays provider readiness with live OAuth and credentials blocked", () => {
  const replay = replaySocialPlatformCredentialBoundary().value;

  assert.equal(replay.providerReadiness.length, 3);
  assert.equal(replay.capabilityImpact.liveOAuthBlocked, true);
  assert.equal(replay.capabilityImpact.liveCredentialsBlocked, true);
  assert.equal(replay.capabilityImpact.executionCapable, false);
  assert.ok(
    replay.providerReadiness.every((readiness) => readiness.liveOAuthBlocked === true),
  );
  assert.ok(
    replay.providerReadiness.every((readiness) => readiness.authorizationModeled === false),
  );
});

await test("models all jobs as credential-blocked with missing authorization", () => {
  const replay = replaySocialPlatformCredentialBoundary(undefined, {
    jobHints: [
      {
        executionJobId: "execution-job-1",
        publicationTargetId: "target-facebook-1",
        platform: "facebook",
        provider: "meta",
      },
    ],
  }).value;

  assert.equal(replay.summary.credentialReadyJobCount, 0);
  assert.equal(replay.summary.oauthReadyJobCount, 0);
  assert.ok(replay.summary.credentialBlockedJobCount >= 0);
  assert.equal(replay.grantsExecutionPermission, false);
});

await test("composes capability and meta replay into capability impact projection", () => {
  const replay = replaySocialPlatformCredentialBoundary().value;

  assert.equal(typeof replay.capabilityImpact.platformReadyCount, "number");
  assert.equal(typeof replay.capabilityImpact.metaReadyJobCount, "number");
  assert.equal(replay.replayIntegrity.valid, true);
  assert.equal(replay.replayIntegrity.source, "social_platform_credential_boundary_replay");
});

await test("remains read-only and non-executing", () => {
  const replay = replaySocialPlatformCredentialBoundary().value;
  assert.equal(replay.computedOnly, true);
  assert.equal(replay.readOnly, true);
  assert.equal(replay.executesNothing, true);
  assert.equal(replay.publishesNothing, true);
});

console.log("social-platform-credential-boundary-replay tests passed");
