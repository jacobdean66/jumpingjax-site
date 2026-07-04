import assert from "node:assert/strict";
import test from "node:test";

import { replaySocialMetaAssetBindings } from "./social-meta-asset-replay";

test("replaySocialMetaAssetBindings returns empty snapshot when store unavailable", async () => {
  const replay = await replaySocialMetaAssetBindings();
  assert.equal(replay.summary.discoveredAssetCount, 0);
  assert.equal(replay.bindingStatuses.length, 0);
});

console.log("social-meta-asset-replay tests passed");
