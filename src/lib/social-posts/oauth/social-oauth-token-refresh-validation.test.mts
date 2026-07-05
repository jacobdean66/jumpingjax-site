import assert from "node:assert/strict";
import test from "node:test";

import {
  validateMetaTokenRefreshResult,
  validateRefreshEligibilityBeforeExchange,
} from "./social-oauth-token-refresh-validation";

test("validateRefreshEligibilityBeforeExchange fails closed when blocked", () => {
  const result = validateRefreshEligibilityBeforeExchange({
    lifecycleVersion: "d16-w3-v1",
    eligible: false,
    refreshMode: "none",
    blockingReasons: ["token_expired_requires_reconnect"],
    advisoryReasons: [],
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    containsTokens: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "token_expired_requires_reconnect");
  }
});

test("validateMetaTokenRefreshResult rejects empty access token", () => {
  const result = validateMetaTokenRefreshResult({
    ok: true,
    accessToken: "   ",
    expiresInSeconds: 3600,
    tokenType: "bearer",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "refresh_empty_access_token");
  }
});

console.log("social-oauth-token-refresh-validation tests passed");
