import assert from "node:assert/strict";
import test from "node:test";
import { canRetryBookingEmail } from "./email-retry-eligibility.ts";

test("retry eligibility preserves rejection notices and rejects obsolete confirmations", () => {
  const now = new Date("2026-10-13T01:00:00Z");
  const booking = { status: "confirmed", end_time: "2026-11-01T22:00:00Z" };
  assert.equal(canRetryBookingEmail("facility", "decision_confirm", booking, now), true);
  assert.equal(canRetryBookingEmail("facility", "decision_confirm", { ...booking, status: "cancelled" }, now), false);
  assert.equal(canRetryBookingEmail("facility", "decision_confirm", { ...booking, status: "rejected" }, now), false);
  assert.equal(canRetryBookingEmail("facility", "decision_reject", { ...booking, status: "rejected" }, now), true);
  assert.equal(canRetryBookingEmail("facility", "decision_confirm", { ...booking, end_time: "invalid" }, now), false);
  assert.equal(canRetryBookingEmail("facility", "decision_confirm", { ...booking, end_time: "2026-10-10T22:00:00Z" }, now), false);
});

test("rental retries use Eastern dates across midnight, DST, and multi-day rentals", () => {
  const booking = { status: "approved", event_date: "2026-11-01", span_days: 2 };
  assert.equal(canRetryBookingEmail("rental", "decision_confirm", booking, new Date("2026-11-03T04:30:00Z")), true);
  assert.equal(canRetryBookingEmail("rental", "decision_confirm", booking, new Date("2026-11-03T05:00:00Z")), false);
  assert.equal(canRetryBookingEmail("rental", "decision_confirm", { ...booking, event_date: null }, new Date()), false);
});
