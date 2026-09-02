import assert from "node:assert/strict";
import test from "node:test";

import {
  BOOKING_TRIAGE_JOB_TYPE,
  BookingTriageWorker,
  bookingReference,
  bookingTriageIdempotencyKey,
  identifyBookingTriageIssues,
  planBookingTriageBatch,
} from "./booking-triage.ts";
import type { AgentJob } from "./types.ts";

const row = {
  booking_kind: "rental",
  booking_id: "customer-facing-booking-id",
  initial_customer_email_status: "sent",
  owner_notification_status: "failed",
  decision_email_status: "not_required",
  calendar_status: "pending",
  operator_required: true,
  updated_at: "2026-08-27T19:30:00.000Z",
};

test("Booking Agent deterministically identifies failed and incomplete steps", () => {
  const issues = identifyBookingTriageIssues(row);
  assert.deepEqual(issues.map(({ workflowStep, outcome }) => ({ workflowStep, outcome })), [
    { workflowStep: "owner_notification", outcome: "failed" },
    { workflowStep: "calendar", outcome: "pending" },
  ]);
  assert.equal(bookingTriageIdempotencyKey(issues[0]), bookingTriageIdempotencyKey(issues[0]));
});

test("Booking Agent summary is redacted and uses zero AI", async () => {
  const issue = identifyBookingTriageIssues(row)[0];
  const job = {
    id: "11111111-1111-1111-1111-111111111111",
    job_type: BOOKING_TRIAGE_JOB_TYPE,
    payload: {
      bookingKind: issue.bookingKind,
      bookingId: issue.bookingId,
      workflowStep: issue.workflowStep,
      outcome: issue.outcome,
      workflowUpdatedAt: issue.workflowUpdatedAt,
    },
    timeout_seconds: 10,
  } as AgentJob;
  const result = await new BookingTriageWorker().execute(job, new AbortController().signal);
  assert.equal(result.ok, true);
  assert.match(result.summary, new RegExp(bookingReference("rental", row.booking_id)));
  assert.match(result.summary, /read-only triage; no AI invoked/i);
  assert.doesNotMatch(result.summary, new RegExp(row.booking_id));
});

test("Booking Agent ignores rows that do not require operator review", () => {
  assert.deepEqual(identifyBookingTriageIssues({ ...row, operator_required: false, owner_notification_status: "sent", calendar_status: "pending" }), []);
});

test("Booking Agent advances past already-triaged newest issues", () => {
  const issues = Array.from({ length: 20 }, (_, index) => identifyBookingTriageIssues({
    ...row,
    booking_id: `booking-${index}`,
    calendar_status: "not_required",
  })[0]);
  const existingKeys = new Set(issues.slice(0, 10).map(bookingTriageIdempotencyKey));
  const batch = planBookingTriageBatch(issues, existingKeys, 5);
  assert.deepEqual(batch.selected.map((issue) => issue.bookingId), [
    "booking-10",
    "booking-11",
    "booking-12",
    "booking-13",
    "booking-14",
  ]);
  assert.equal(batch.issuesScanned, 20);
  assert.equal(batch.alreadyTriaged, 10);
  assert.equal(batch.remainingUntriaged, 5);
});
