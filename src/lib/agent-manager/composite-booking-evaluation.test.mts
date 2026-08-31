import assert from "node:assert/strict";
import test from "node:test";

import { evaluateCompositeBooking } from "./composite-booking-evaluation.ts";
import type { CompositeBookingRequest } from "./composite-booking.ts";

const request: CompositeBookingRequest = {
  conversationRef: "private-call-ref",
  revision: 7,
  services: [
    {
      kind: "rental",
      date: "2026-09-19",
      startMinutes: 720,
      durationMinutes: 240,
      itemRefs: ["18-ft-basic-waterslide"],
      locationRef: "same-location-token",
      distanceMiles: 12,
    },
    {
      kind: "facility_party",
      date: "2026-09-19",
      startMinutes: 780,
      durationMinutes: 120,
      packageRef: "whole-facility",
    },
    {
      kind: "foam_party",
      date: "2026-09-19",
      startMinutes: 840,
      durationMinutes: 60,
      locationRef: "same-location-token",
      distanceMiles: 12,
    },
  ],
};

test("uses the existing catalogs and charges delivery once for a combined location", () => {
  const result = evaluateCompositeBooking(request);
  assert.equal(result.status, "ready_for_approval");
  assert.equal(result.quote.totalCents, 92285);
  assert.deepEqual(result.quote.lines.map(({ code }) => code), [
    "catalog_items",
    "whole-facility",
    "foam_60",
    "delivery_19",
  ]);
  assert.equal(result.approvalIntent?.requiresOwnerApproval, true);
  assert.equal(result.approvalIntent?.writesAllowed, false);
  assert.doesNotMatch(JSON.stringify(result), /private-call-ref|same-location-token/);
});

test("unknown catalog selections cannot produce an approval intent", () => {
  const result = evaluateCompositeBooking({
    ...request,
    revision: 8,
    services: request.services.map((service) => service.kind === "rental"
      ? { ...service, itemRefs: ["not-a-real-rental"] }
      : service),
  });
  assert.equal(result.status, "needs_pricing");
  assert.equal(result.approvalIntent, null);
  assert.match(result.quote.issues.join(" "), /catalog price/i);
});

test("availability conflict blocks the entire priced request", () => {
  const result = evaluateCompositeBooking(request, [{
    resourceRef: "crew:foam",
    date: "2026-09-19",
    startMinutes: 800,
    endMinutes: 920,
  }]);
  assert.equal(result.status, "conflict");
  assert.equal(result.approvalIntent, null);
  assert.deepEqual(result.plan.projections, []);
});

test("separate delivery locations receive separate deterministic fees", () => {
  const result = evaluateCompositeBooking({
    ...request,
    revision: 9,
    services: request.services.map((service) => service.kind === "foam_party"
      ? { ...service, locationRef: "second-location", distanceMiles: 30 }
      : service),
  });
  assert.equal(result.status, "ready_for_approval");
  assert.equal(result.quote.lines.filter(({ code }) => code.startsWith("delivery_")).length, 2);
  assert.equal(result.quote.totalCents, 95785);
});
