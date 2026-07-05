import assert from "node:assert/strict";
import test from "node:test";

import { replaySocialOAuthManualRefresh } from "./social-oauth-manual-refresh-replay";

test("replaySocialOAuthManualRefresh returns GET-only manual refresh diagnostics", async () => {
  const replay = await replaySocialOAuthManualRefresh();
  assert.equal(replay.replayVersion, "d16-w4-v1");
  assert.equal(replay.computedOnly, true);
  assert.equal(replay.readOnly, true);
  assert.equal(Array.isArray(replay.manualRefreshTargetStatuses), true);
  assert.equal(Array.isArray(replay.recentRefreshAuditEvents), true);
});

console.log("social-oauth-manual-refresh-replay tests passed");
