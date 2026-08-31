import assert from "node:assert/strict";
import test from "node:test";

import { parseCompositeBookingRequest } from "./composite-booking-request";

const valid = {
  conversationRef: "voice-session-123",
  revision: 1,
  services: [{
    kind: "rental",
    date: "2026-11-07",
    startMinutes: 720,
    durationMinutes: 240,
    itemRefs: ["18-ft-basic-waterslide"],
    locationRef: "location-token",
    distanceMiles: 12,
  }],
};

test("accepts a bounded provider-neutral booking request", () => {
  const parsed = parseCompositeBookingRequest(valid);
  assert.equal(parsed?.conversationRef, valid.conversationRef);
  assert.equal(parsed?.revision, 1);
  assert.equal(parsed?.services[0]?.kind, "rental");
  assert.deepEqual(parsed?.services[0]?.itemRefs, ["18-ft-basic-waterslide"]);
});

test("rejects duplicate services, excessive arrays, invalid times, and oversized references", () => {
  assert.equal(parseCompositeBookingRequest({ ...valid, services: [...valid.services, valid.services[0]] }), null);
  assert.equal(parseCompositeBookingRequest({ ...valid, services: [{ ...valid.services[0], itemRefs: Array(11).fill("item") }] }), null);
  assert.equal(parseCompositeBookingRequest({ ...valid, services: [{ ...valid.services[0], startMinutes: 1440 }] }), null);
  assert.equal(parseCompositeBookingRequest({ ...valid, conversationRef: "x".repeat(121) }), null);
});
