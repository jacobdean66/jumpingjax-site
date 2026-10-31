import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { publicBackyardEntryId, signBackyardVisit, verifyBackyardVisit } from "./backyard-tracking-security";
import { verifyAdminSessionValue } from "./delivery-auth";

test("visit cookies expire, reject tampering and cannot be used as admin sessions", () => {
  const previous = process.env.CAMPAIGN_TRACKING_SECRET;
  process.env.CAMPAIGN_TRACKING_SECRET = "unit-test-tracking-signing-key";
  try {
    const id = randomUUID(), now = Date.parse("2026-11-01T12:00:00Z"), value = signBackyardVisit(id, now);
    assert.equal(verifyBackyardVisit(value, now), id);
    assert.equal(verifyBackyardVisit(value + "x", now), null);
    assert.equal(verifyBackyardVisit(value.replace(id, randomUUID()), now), null);
    assert.equal(verifyBackyardVisit(value, now + 30 * 60_000), null);
    assert.equal(verifyAdminSessionValue(value).ok, false);
    assert.equal(verifyBackyardVisit(undefined, now), null);
  } finally { if (previous === undefined) delete process.env.CAMPAIGN_TRACKING_SECRET; else process.env.CAMPAIGN_TRACKING_SECRET = previous; }
});

test("public entry identity is deterministic per normalized email without disclosing the email", () => {
  const previous = process.env.CAMPAIGN_TRACKING_SECRET;
  process.env.CAMPAIGN_TRACKING_SECRET = "unit-test-tracking-signing-key";
  try {
    const id = publicBackyardEntryId("Person@example.invalid");
    assert.equal(id, publicBackyardEntryId(" person@EXAMPLE.invalid "));
    assert.notEqual(id, publicBackyardEntryId("another@example.invalid"));
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally { if (previous === undefined) delete process.env.CAMPAIGN_TRACKING_SECRET; else process.env.CAMPAIGN_TRACKING_SECRET = previous; }
});
