import assert from "node:assert/strict";
import test from "node:test";

import { runAnsweringMachineTestCall } from "./test-call.ts";

test("facility test call collects date and time and stops at owner review", () => {
  const result = runAnsweringMachineTestCall("facility");
  assert.equal(result.status, "ready_for_approval");
  assert.equal(result.projections.length, 1);
  assert.equal(result.projections[0]?.service, "facility_party");
  assert.equal(result.productionWrites, 0);
  assert.equal(result.customerMessages, 0);
});

test("rental test call collects rental and day and stops at owner review", () => {
  const result = runAnsweringMachineTestCall("rental");
  assert.equal(result.status, "ready_for_approval");
  assert.equal(result.projections[0]?.service, "rental");
  assert.ok(result.quoteTotalCents > 0);
  assert.equal(result.aiInvocations, 0);
});

test("all-three test call coordinates every service without production writes", () => {
  const result = runAnsweringMachineTestCall("all_three");
  assert.equal(result.status, "ready_for_approval");
  assert.deepEqual(result.projections.map(({ service }) => service), ["rental", "facility_party", "foam_party"]);
  assert.equal(result.productionWrites, 0);
  assert.match(result.transcript.at(-1) ?? "", /Nothing has been booked or charged yet/i);
});
