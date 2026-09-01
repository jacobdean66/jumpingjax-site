import assert from "node:assert/strict";
import test from "node:test";
import fc from "fast-check";

import { buildCompositeBookingDryRun, type CompositeBookingRequest } from "./composite-booking.ts";

const combinedRequest: CompositeBookingRequest = {
  conversationRef: "call-session-private-reference",
  revision: 1,
  services: [
    {
      kind: "rental",
      date: "2026-09-12",
      startMinutes: 780,
      durationMinutes: 180,
      itemRefs: ["18-ft-basic-waterslide"],
      locationRef: "address-token-1",
      distanceMiles: 12,
    },
    {
      kind: "facility_party",
      date: "2026-09-12",
      startMinutes: 780,
      durationMinutes: 120,
      packageRef: "whole-facility-2h",
    },
    {
      kind: "foam_party",
      date: "2026-09-12",
      startMinutes: 840,
      durationMinutes: 60,
      locationRef: "address-token-1",
      distanceMiles: 12,
    },
  ],
};

test("plans rental, facility, and foam as one approval-gated transaction", () => {
  const plan = buildCompositeBookingDryRun(combinedRequest);
  assert.equal(plan.status, "ready_for_approval");
  assert.equal(plan.writesAllowed, false);
  assert.deepEqual(plan.projections.map(({ calendar }) => calendar), [
    "rentals",
    "facility",
    "foam-operations",
  ]);
  assert.equal(new Set(plan.projections.map(({ transactionKey }) => transactionKey)).size, 1);
  assert.doesNotMatch(JSON.stringify(plan), /call-session-private-reference|address-token-1/);
});

test("returns every missing answer before proposing calendar work", () => {
  const plan = buildCompositeBookingDryRun({
    conversationRef: "call-2",
    revision: 1,
    services: [{ kind: "foam_party" }],
  });
  assert.equal(plan.status, "needs_information");
  assert.deepEqual(plan.projections, []);
  assert.deepEqual(plan.missing, [
    "services.0.foam_party.date",
    "services.0.foam_party.startMinutes",
    "services.0.foam_party.durationMinutes",
    "services.0.foam_party.locationRef",
    "services.0.foam_party.distanceMiles",
  ]);
});

test("fails the whole combined request closed when one resource conflicts", () => {
  const plan = buildCompositeBookingDryRun(combinedRequest, [{
    resourceRef: "facility:main",
    date: "2026-09-12",
    startMinutes: 800,
    endMinutes: 900,
  }]);
  assert.equal(plan.status, "conflict");
  assert.deepEqual(plan.conflicts, ["facility:main"]);
  assert.deepEqual(plan.projections, []);
});

test("corrections create a new idempotency identity and cancellation creates no work", () => {
  const first = buildCompositeBookingDryRun(combinedRequest);
  const corrected = buildCompositeBookingDryRun({ ...combinedRequest, revision: 2 });
  const cancelled = buildCompositeBookingDryRun({ ...combinedRequest, revision: 3, cancelled: true });
  assert.notEqual(first.transactionKey, corrected.transactionKey);
  assert.equal(cancelled.status, "cancelled");
  assert.deepEqual(cancelled.projections, []);
  assert.equal(cancelled.writesAllowed, false);
});

test("property: replay, correction, cancellation, and conflicts remain deterministic", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 1_320 }),
      fc.integer({ min: 15, max: 480 }),
      fc.integer({ min: 0, max: 80 }),
      fc.array(fc.stringMatching(/^[a-z0-9-]{1,24}$/), { minLength: 1, maxLength: 4 }),
      (startMinutes, durationMinutes, distanceMiles, rawItemRefs) => {
        const itemRefs = [...new Set(rawItemRefs)];
        const request: CompositeBookingRequest = {
          conversationRef: "property-safe-fixture",
          revision: 1,
          services: [{
            kind: "rental",
            date: "2027-06-12",
            startMinutes,
            durationMinutes,
            itemRefs,
            locationRef: "redacted-location-token",
            distanceMiles,
          }],
        };
        const first = buildCompositeBookingDryRun(request);
        const replay = buildCompositeBookingDryRun(request);
        const correction = buildCompositeBookingDryRun({ ...request, revision: 2 });
        const cancellation = buildCompositeBookingDryRun({ ...request, cancelled: true });
        const conflict = buildCompositeBookingDryRun(request, [{
          resourceRef: `rental:${itemRefs[0]}`,
          date: "2027-06-12",
          startMinutes,
          endMinutes: startMinutes + durationMinutes,
        }]);

        assert.deepEqual(replay, first);
        assert.notEqual(correction.transactionKey, first.transactionKey);
        assert.equal(cancellation.status, "cancelled");
        assert.deepEqual(cancellation.projections, []);
        assert.equal(conflict.status, "conflict");
        assert.deepEqual(conflict.projections, []);
        assert.equal(first.writesAllowed, false);
      },
    ),
    { seed: 20_260_901, numRuns: 250 },
  );
});
