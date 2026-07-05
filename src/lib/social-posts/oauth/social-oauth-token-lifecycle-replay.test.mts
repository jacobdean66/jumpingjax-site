import assert from "node:assert/strict";
import test from "node:test";

import { replaySocialOAuthTokenLifecycle } from "./social-oauth-token-lifecycle-replay";
import { replaySocialOAuthBindingHealth } from "./social-oauth-binding-health-replay";

test("replaySocialOAuthTokenLifecycle returns empty snapshot when store unavailable", async () => {
  const replay = await replaySocialOAuthTokenLifecycle();
  assert.equal(replay.replayVersion, "d16-w3-v1");
  assert.equal(replay.summary.connectedSessionCount, 0);
  assert.equal(replay.computedOnly, true);
  assert.equal(replay.readOnly, true);
});

test("replaySocialOAuthBindingHealth returns empty snapshot when store unavailable", async () => {
  const replay = await replaySocialOAuthBindingHealth();
  assert.equal(replay.replayVersion, "d16-w3-v1");
  assert.equal(replay.summary.healthyCount, 0);
  assert.equal(replay.computedOnly, true);
});

console.log("social-oauth-token-lifecycle-replay tests passed");
