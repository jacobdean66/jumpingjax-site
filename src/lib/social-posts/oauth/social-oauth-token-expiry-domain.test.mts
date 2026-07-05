import assert from "node:assert/strict";
import test from "node:test";

import {
  SOCIAL_OAUTH_TOKEN_LIFECYCLE_VERSION,
  assessTokenExpiry,
  computeExpiresAtFromIssued,
} from "./social-oauth-token-expiry-domain";

test("assessTokenExpiry classifies valid token", () => {
  const now = new Date("2026-07-05T12:00:00.000Z");
  const assessment = assessTokenExpiry({
    expiresAt: "2026-07-10T12:00:00.000Z",
    issuedAt: "2026-07-05T12:00:00.000Z",
    now,
  });

  assert.equal(assessment.lifecycleVersion, SOCIAL_OAUTH_TOKEN_LIFECYCLE_VERSION);
  assert.equal(assessment.expiryState, "valid");
  assert.equal(assessment.blockingReasons.length, 0);
});

test("assessTokenExpiry classifies expiring soon token", () => {
  const now = new Date("2026-07-05T12:00:00.000Z");
  const assessment = assessTokenExpiry({
    expiresAt: "2026-07-05T20:00:00.000Z",
    now,
    warningMs: 24 * 60 * 60 * 1000,
  });

  assert.equal(assessment.expiryState, "expiring_soon");
  assert.deepEqual(assessment.warningReasons, ["token_expiring_soon"]);
});

test("assessTokenExpiry classifies expired token with blocking reason", () => {
  const now = new Date("2026-07-05T12:00:00.000Z");
  const assessment = assessTokenExpiry({
    expiresAt: "2026-07-04T12:00:00.000Z",
    now,
  });

  assert.equal(assessment.expiryState, "expired");
  assert.deepEqual(assessment.blockingReasons, ["token_expired"]);
});

test("computeExpiresAtFromIssued derives expiry timestamp", () => {
  const expiresAt = computeExpiresAtFromIssued({
    issuedAt: "2026-07-05T12:00:00.000Z",
    expiresInSeconds: 3600,
  });
  assert.equal(expiresAt, "2026-07-05T13:00:00.000Z");
});

console.log("social-oauth-token-expiry-domain tests passed");
