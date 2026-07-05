import assert from "node:assert/strict";
import test from "node:test";

import { validateManualTokenRefreshRequest } from "./social-oauth-token-refresh-request";

test("validateManualTokenRefreshRequest accepts valid publication target id", () => {
  const result = validateManualTokenRefreshRequest({
    publicationTargetId: "target-1",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.publicationTargetId, "target-1");
  }
});

test("validateManualTokenRefreshRequest rejects missing publication target id", () => {
  const result = validateManualTokenRefreshRequest({
    publicationTargetId: "   ",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "publication_target_id_required");
  }
});

test("validateManualTokenRefreshRequest rejects invalid publication target id", () => {
  const result = validateManualTokenRefreshRequest({
    publicationTargetId: "bad id with spaces",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "publication_target_id_invalid");
  }
});

console.log("social-oauth-token-refresh-request tests passed");
