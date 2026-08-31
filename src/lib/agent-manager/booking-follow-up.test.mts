import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BOOKING_FOLLOW_UP_JOB_TYPE,
  BookingFollowUpWorker,
  bookingFollowUpIdempotencyKey,
  bookingFollowUpReference,
  planBookingFollowUps,
} from "./booking-follow-up.ts";
import type { AgentJob } from "./types.ts";

const now = new Date("2026-08-31T20:00:00.000Z");

test("Booking follow-ups are deterministic, due-only, and ignore terminal states", () => {
  const followUps = planBookingFollowUps([
    { id: "pending-due", transactionKey: "private-transaction-a", status: "pending_owner_approval", createdAt: "2026-08-31T19:00:00.000Z", updatedAt: "2026-08-31T19:00:00.000Z" },
    { id: "projection-due", transactionKey: "private-transaction-b", status: "projection_staged", createdAt: "2026-08-31T19:00:00.000Z", updatedAt: "2026-08-31T19:40:00.000Z" },
    { id: "too-new", transactionKey: "private-transaction-c", status: "pending_owner_approval", createdAt: "2026-08-31T19:45:00.000Z", updatedAt: "2026-08-31T19:45:00.000Z" },
    { id: "done", transactionKey: "private-transaction-d", status: "rolled_back", createdAt: "2026-08-31T18:00:00.000Z", updatedAt: "2026-08-31T18:00:00.000Z" },
  ], now);

  assert.deepEqual(followUps.map(({ intentId, kind }) => ({ intentId, kind })), [
    { intentId: "pending-due", kind: "owner_approval_overdue" },
    { intentId: "projection-due", kind: "projection_staging_review" },
  ]);
  assert.ok(followUps.every((item) => item.bookingWritesAllowed === false
    && item.calendarWritesAllowed === false
    && item.customerMessagesAllowed === false
    && item.paymentWritesAllowed === false
    && item.aiInvocations === 0));
});

test("Booking follow-ups are bounded and have stable idempotency", () => {
  const intents = Array.from({ length: 14 }, (_, index) => ({
    id: `intent-${index}`,
    transactionKey: `private-key-${index}`,
    status: "pending_owner_approval",
    createdAt: "2026-08-31T18:00:00.000Z",
    updatedAt: "2026-08-31T18:00:00.000Z",
  }));
  const followUps = planBookingFollowUps(intents, now, 50);
  assert.equal(followUps.length, 10);
  assert.equal(bookingFollowUpIdempotencyKey(followUps[0]), bookingFollowUpIdempotencyKey(followUps[0]));
});

test("Booking follow-up worker produces a redacted owner-only review summary", async () => {
  const transactionKey = "composite-booking:must-not-leak";
  const followUp = planBookingFollowUps([{
    id: "intent-1",
    transactionKey,
    status: "pending_owner_approval",
    createdAt: "2026-08-31T18:00:00.000Z",
    updatedAt: "2026-08-31T18:00:00.000Z",
  }], now)[0];
  const job = {
    id: "11111111-1111-4111-8111-111111111111",
    job_type: BOOKING_FOLLOW_UP_JOB_TYPE,
    payload: followUp,
    timeout_seconds: 10,
  } as AgentJob;

  const result = await new BookingFollowUpWorker().execute(job, new AbortController().signal);
  assert.equal(result.ok, true);
  assert.match(result.summary, new RegExp(bookingFollowUpReference(transactionKey)));
  assert.match(result.summary, /No customer message sent; no AI invoked/i);
  assert.doesNotMatch(result.summary, new RegExp(transactionKey));
});

test("Booking follow-up endpoint is owner-only, guarded, bounded, and review-only", async () => {
  const route = await readFile(
    new URL("../../app/api/admin/agents/booking-follow-up/route.ts", import.meta.url),
    "utf8",
  );
  const service = await readFile(new URL("booking-follow-up-service.ts", import.meta.url), "utf8");

  assert.match(route, /verifyAdminOwnerAccess/);
  assert.match(route, /validateOwnerPost/);
  assert.match(service, /composite_booking_intents/);
  assert.match(service, /pending_owner_approval/);
  assert.match(service, /projection_staged/);
  assert.match(service, /BOOKING_FOLLOW_UP_LIMIT/);
  assert.match(service, /customerMessages: 0/);
  assert.match(service, /bookingWrites: 0/);
  assert.match(service, /externalCalendarWrites: 0/);
  assert.match(service, /paymentWrites: 0/);
  assert.match(service, /aiInvocations: 0/);
  assert.doesNotMatch(service, /from\("bookings"\)|from\("facility_bookings"\)|sendEmail|resend|stripe|googleapis|openai|anthropic|model\.generate/i);
});
