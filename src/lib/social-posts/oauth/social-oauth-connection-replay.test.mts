import assert from "node:assert/strict";
import test from "node:test";

import { replaySocialOAuthConnections } from "./social-oauth-connection-replay";

test("replaySocialOAuthConnections returns empty snapshot when store unavailable", async () => {
  const replay = await replaySocialOAuthConnections();
  assert.equal(replay.replayVersion, "d16-w1-v1");
  assert.equal(replay.summary.sessionCount, 0);
  assert.equal(Array.isArray(replay.connectionStatuses), true);
});

console.log("social-oauth-connection-replay tests passed");
