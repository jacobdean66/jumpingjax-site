import assert from "node:assert/strict";
import test from "node:test";

import { buildStagedCompositeBookingIntent } from "./composite-booking-intent";
import type { CompositeBookingRequest } from "./composite-booking";

const combined: CompositeBookingRequest = {
  conversationRef: "customer-call-never-persist-this-value",
  revision: 1,
  services: [
    {
      kind: "rental",
      date: "2026-10-03",
      startMinutes: 720,
      durationMinutes: 240,
      itemRefs: ["18-ft-basic-waterslide"],
      locationRef: "private-location-reference",
      distanceMiles: 12,
    },
    {
      kind: "facility_party",
      date: "2026-10-03",
      startMinutes: 780,
      durationMinutes: 120,
      packageRef: "whole-facility",
    },
    {
      kind: "foam_party",
      date: "2026-10-03",
      startMinutes: 840,
      durationMinutes: 60,
      locationRef: "private-location-reference",
      distanceMiles: 12,
    },
  ],
};

test("stages one redacted pending intent for a coordinated composite request", () => {
  const result = buildStagedCompositeBookingIntent(combined);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.intent.status, "pending_owner_approval");
  assert.deepEqual(result.intent.services, ["facility_party", "foam_party", "rental"]);
  assert.equal(result.intent.requiresOwnerApproval, true);
  assert.equal(result.intent.bookingWritesAllowed, false);
  assert.equal(result.intent.calendarWritesAllowed, false);
  assert.equal(result.intent.customerMessagesAllowed, false);
  assert.equal(result.intent.paymentWritesAllowed, false);
  assert.equal(result.intent.projections.every((projection) => projection.transactionKey === result.intent.transactionKey), true);
  assert.equal(JSON.stringify(result.intent).includes(combined.conversationRef), false);
  assert.equal(JSON.stringify(result.intent).includes("private-location-reference"), false);
});

test("replay is fingerprint-stable and a correction gets a different identity", () => {
  const first = buildStagedCompositeBookingIntent(combined);
  const replay = buildStagedCompositeBookingIntent(structuredClone(combined));
  const correction = buildStagedCompositeBookingIntent({ ...combined, revision: 2 });
  assert.equal(first.ok && replay.ok && first.intent.requestFingerprint, replay.ok && replay.intent.requestFingerprint);
  assert.notEqual(first.ok && first.intent.transactionKey, correction.ok && correction.intent.transactionKey);
  assert.notEqual(first.ok && first.intent.requestFingerprint, correction.ok && correction.intent.requestFingerprint);
});

test("conflict and cancellation fail closed without a pending intent", () => {
  const conflict = buildStagedCompositeBookingIntent(combined, [{
    resourceRef: "facility:main",
    date: "2026-10-03",
    startMinutes: 800,
    endMinutes: 900,
  }]);
  const cancellation = buildStagedCompositeBookingIntent({ ...combined, cancelled: true });
  assert.deepEqual(conflict, { ok: false, status: "conflict", reasons: ["facility:main"] });
  assert.deepEqual(cancellation, { ok: false, status: "cancelled", reasons: [] });
});

