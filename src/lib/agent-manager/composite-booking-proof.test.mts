import assert from "node:assert/strict";
import test from "node:test";

import { runCompositeBookingProof } from "./composite-booking-proof.ts";

test("deterministic proof covers single, combined, conflict, correction, and cancellation paths", () => {
  const proof = runCompositeBookingProof();
  assert.deepEqual(proof.scenarios.map(({ name }) => name), [
    "rental",
    "facility",
    "foam",
    "combined",
    "conflict",
    "correction",
    "cancellation",
  ]);
  assert.equal(proof.ready, 5);
  assert.equal(proof.safelyBlocked, 2);
  assert.equal(proof.aiInvocations, 0);
  assert.equal(proof.productionWrites, 0);
  assert.equal(proof.scenarios.find(({ name }) => name === "conflict")?.status, "conflict");
  assert.equal(proof.scenarios.find(({ name }) => name === "cancellation")?.status, "cancelled");
  assert.ok(proof.scenarios.every(({ writesAllowed }) => writesAllowed === false));
  assert.doesNotMatch(JSON.stringify(proof), /deterministic-proof|proof-location/);
});
