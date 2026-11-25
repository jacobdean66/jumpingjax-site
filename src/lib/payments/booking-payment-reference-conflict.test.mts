import test from "node:test";
import assert from "node:assert/strict";
import { bookingPaymentReferenceConflictMessage } from "./booking-payment-reference-conflict.ts";

const current = { kind: "facility", id: "synthetic-selected" } as const;
test("linked to a different booking or kind reports scope, not customer or booking details", () => {
  for (const entry of [
    { booking_kind: "facility", booking_id: "synthetic-other", status: "posted" },
    { booking_kind: "rental", booking_id: current.id, status: "needs_review" },
  ]) {
    const message = bookingPaymentReferenceConflictMessage(current, entry);
    assert.match(message, /different booking/);
    assert.match(message, /No payment was added/);
    assert.doesNotMatch(message, /synthetic-/);
  }
});
test("own booking distinguishes a not-yet-posted receipt from history", () => {
  const own = { booking_kind: current.kind, booking_id: current.id };
  assert.match(bookingPaymentReferenceConflictMessage(current, { ...own, status: "needs_review" }), /needs review/);
  assert.match(bookingPaymentReferenceConflictMessage(current, { ...own, status: "posted" }), /Reload and check/);
});
test("missing, inconsistent, or since-voided rows never suggest a new payment", () => {
  for (const entry of [null, { booking_kind: current.kind, booking_id: current.id, status: "voided" }]) {
    const message = bookingPaymentReferenceConflictMessage(current, entry);
    assert.match(message, /No payment was added/);
    assert.match(message, /manager to review/);
  }
});
