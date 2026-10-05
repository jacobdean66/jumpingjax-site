import assert from "node:assert/strict";
import test from "node:test";
import { workflowDisposition } from "./booking-workflow-health.ts";

const rental = { booking_kind: "rental", booking_id: "1" };
const facility = { booking_kind: "facility", booking_id: "party" };
test("current workflow warnings exclude past and cancelled bookings while retaining unknown evidence", () => {
  assert.equal(workflowDisposition(rental, { id: 1, status: "approved", event_date: "2026-10-04" }, "2026-10-05"), "historical");
  assert.equal(workflowDisposition(rental, { id: 1, status: "cancelled", event_date: "2026-11-04" }, "2026-10-05"), "historical");
  assert.equal(workflowDisposition(rental, { id: 1, status: "approved", event_date: "2026-10-05" }, "2026-10-05"), "current");
  assert.equal(workflowDisposition(rental, undefined, "2026-10-05"), "unknown");
  assert.equal(workflowDisposition(rental, { id: 1, status: "approved", event_date: "invalid" }, "2026-10-05"), "unknown");
  assert.equal(workflowDisposition(rental, { id: 1, status: "new-status", event_date: "2026-10-04" }, "2026-10-05"), "unknown");
  assert.equal(workflowDisposition(rental, { id: 1, status: "approved", event_date: "2026-02-30" }, "2026-10-05"), "unknown");
  assert.equal(workflowDisposition(rental, { id: 1, status: "approved", event_date: "2026-10-03", span_days: -1 }, "2026-10-05"), "unknown");
});
test("a multi-day rental remains current through its last booked day", () => {
  const booking = { id: 1, status: "approved", event_date: "2026-10-03", span_days: 3 };
  assert.equal(workflowDisposition(rental, booking, "2026-10-05"), "current");
  assert.equal(workflowDisposition(rental, booking, "2026-10-06"), "historical");
});
test("facility workflows use the actual event end in the business timezone", () => {
  assert.equal(workflowDisposition(facility, { id: "party", status: "confirmed", end_time: "2026-10-05T01:00:00Z" }, "2026-10-05"), "historical");
  assert.equal(workflowDisposition(facility, { id: "party", status: "confirmed", end_time: "2026-10-06T01:00:00Z" }, "2026-10-05"), "current");
  assert.equal(workflowDisposition(facility, { id: "party", status: "confirmed", end_time: null }, "2026-10-05"), "unknown");
});
