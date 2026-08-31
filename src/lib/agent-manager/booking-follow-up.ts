import { createHash } from "node:crypto";

import type { AgentJob } from "./types";
import type { AgentWorker, WorkerResult } from "./worker";

export const BOOKING_FOLLOW_UP_JOB_TYPE = "booking.follow_up.review";
export const BOOKING_FOLLOW_UP_LIMIT = 10;

const OWNER_APPROVAL_AFTER_MS = 30 * 60 * 1000;
const PROJECTION_REVIEW_AFTER_MS = 15 * 60 * 1000;

export type BookingFollowUpIntent = {
  id: string;
  transactionKey: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type BookingFollowUp = {
  intentId: string;
  reference: string;
  kind: "owner_approval_overdue" | "projection_staging_review";
  status: "pending_owner_approval" | "projection_staged";
  dueAt: string;
  intentUpdatedAt: string;
  bookingWritesAllowed: false;
  calendarWritesAllowed: false;
  customerMessagesAllowed: false;
  paymentWritesAllowed: false;
  aiInvocations: 0;
};

export function bookingFollowUpReference(transactionKey: string) {
  return `booking-${createHash("sha256").update(transactionKey).digest("hex").slice(0, 10)}`;
}

export function bookingFollowUpIdempotencyKey(followUp: BookingFollowUp) {
  return `booking-follow-up:${createHash("sha256").update([
    followUp.intentId,
    followUp.kind,
    followUp.status,
    followUp.intentUpdatedAt,
  ].join(":")).digest("hex")}`;
}

function validDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function planBookingFollowUps(
  intents: BookingFollowUpIntent[],
  now: Date,
  limit = BOOKING_FOLLOW_UP_LIMIT,
): BookingFollowUp[] {
  const nowMs = now.getTime();
  const boundedLimit = Math.max(0, Math.min(BOOKING_FOLLOW_UP_LIMIT, Math.trunc(limit)));

  return intents.flatMap((intent): BookingFollowUp[] => {
    const createdAt = validDate(intent.createdAt);
    const updatedAt = validDate(intent.updatedAt);
    if (!intent.id || !intent.transactionKey || createdAt === null || updatedAt === null) return [];

    const status = intent.status === "pending_owner_approval"
      ? "pending_owner_approval" as const
      : intent.status === "projection_staged"
        ? "projection_staged" as const
        : null;
    if (!status) return [];
    const policy = status === "pending_owner_approval"
      ? { kind: "owner_approval_overdue" as const, delay: OWNER_APPROVAL_AFTER_MS, base: createdAt }
      : { kind: "projection_staging_review" as const, delay: PROJECTION_REVIEW_AFTER_MS, base: updatedAt };

    const dueAt = policy.base + policy.delay;
    if (dueAt > nowMs) return [];
    return [{
      intentId: intent.id,
      reference: bookingFollowUpReference(intent.transactionKey),
      kind: policy.kind,
      status,
      dueAt: new Date(dueAt).toISOString(),
      intentUpdatedAt: intent.updatedAt,
      bookingWritesAllowed: false,
      calendarWritesAllowed: false,
      customerMessagesAllowed: false,
      paymentWritesAllowed: false,
      aiInvocations: 0,
    }];
  }).sort((left, right) => left.dueAt.localeCompare(right.dueAt) || left.reference.localeCompare(right.reference))
    .slice(0, boundedLimit);
}

function parsePayload(payload: Record<string, unknown>): BookingFollowUp | null {
  if (typeof payload.intentId !== "string" || typeof payload.reference !== "string") return null;
  if (payload.kind !== "owner_approval_overdue" && payload.kind !== "projection_staging_review") return null;
  if (payload.status !== "pending_owner_approval" && payload.status !== "projection_staged") return null;
  if (typeof payload.dueAt !== "string" || typeof payload.intentUpdatedAt !== "string") return null;
  if (payload.bookingWritesAllowed !== false || payload.calendarWritesAllowed !== false
    || payload.customerMessagesAllowed !== false || payload.paymentWritesAllowed !== false
    || payload.aiInvocations !== 0) return null;
  return payload as unknown as BookingFollowUp;
}

export class BookingFollowUpWorker implements AgentWorker {
  readonly kind = "deterministic" as const;

  supports(jobType: string) {
    return jobType === BOOKING_FOLLOW_UP_JOB_TYPE;
  }

  async execute(job: AgentJob, signal: AbortSignal): Promise<WorkerResult> {
    if (signal.aborted) return { ok: false, summary: "Booking follow-up review cancelled before execution", transient: false };
    const followUp = parsePayload(job.payload);
    if (!followUp) return { ok: false, summary: "Booking follow-up payload was invalid", transient: false };
    const action = followUp.kind === "owner_approval_overdue"
      ? "owner approval is still pending"
      : "calendar projection staging needs owner review";
    return {
      ok: true,
      summary: `${followUp.reference} requires owner review: ${action}. No customer message sent; no AI invoked.`,
    };
  }
}
