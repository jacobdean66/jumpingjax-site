import { createHash } from "node:crypto";

import type { AgentJob } from "./types";
import type { AgentWorker, WorkerResult } from "./worker";

export const BOOKING_TRIAGE_JOB_TYPE = "booking.workflow.triage";

export type BookingWorkflowStep =
  | "initial_customer_email"
  | "owner_notification"
  | "decision_email"
  | "calendar";

export type BookingTriageIssue = {
  bookingKind: "rental" | "facility";
  bookingId: string;
  workflowStep: BookingWorkflowStep;
  outcome: "failed" | "pending";
  workflowUpdatedAt: string;
};

const STEPS: ReadonlyArray<[BookingWorkflowStep, string]> = [
  ["initial_customer_email", "initial_customer_email_status"],
  ["owner_notification", "owner_notification_status"],
  ["decision_email", "decision_email_status"],
  ["calendar", "calendar_status"],
];

export function bookingReference(bookingKind: string, bookingId: string) {
  const digest = createHash("sha256").update(`${bookingKind}:${bookingId}`).digest("hex").slice(0, 10);
  return `${bookingKind}-${digest}`;
}

export function bookingTriageIdempotencyKey(issue: BookingTriageIssue) {
  return `booking-triage:${createHash("sha256").update([
    issue.bookingKind,
    issue.bookingId,
    issue.workflowStep,
    issue.outcome,
    issue.workflowUpdatedAt,
  ].join(":")).digest("hex")}`;
}

export function identifyBookingTriageIssues(row: Record<string, unknown>): BookingTriageIssue[] {
  const bookingKind = row.booking_kind === "facility" ? "facility" : row.booking_kind === "rental" ? "rental" : null;
  const bookingId = typeof row.booking_id === "string" ? row.booking_id : null;
  const workflowUpdatedAt = typeof row.updated_at === "string" ? row.updated_at : null;
  if (!bookingKind || !bookingId || !workflowUpdatedAt) return [];

  return STEPS.flatMap(([workflowStep, field]) => {
    const outcome = row[field];
    if (outcome !== "failed" && !(row.operator_required === true && outcome === "pending")) return [];
    return [{ bookingKind, bookingId, workflowStep, outcome, workflowUpdatedAt }];
  });
}

function parsePayload(payload: Record<string, unknown>): BookingTriageIssue | null {
  const issues = identifyBookingTriageIssues({
    booking_kind: payload.bookingKind,
    booking_id: payload.bookingId,
    updated_at: payload.workflowUpdatedAt,
    operator_required: true,
    [`${String(payload.workflowStep)}_status`]: payload.outcome,
  });
  return issues.find((issue) => issue.workflowStep === payload.workflowStep) ?? null;
}

export class BookingTriageWorker implements AgentWorker {
  readonly kind = "deterministic" as const;

  supports(jobType: string) {
    return jobType === BOOKING_TRIAGE_JOB_TYPE;
  }

  async execute(job: AgentJob, signal: AbortSignal): Promise<WorkerResult> {
    if (signal.aborted) return { ok: false, summary: "Booking triage cancelled before execution", transient: false };
    const issue = parsePayload(job.payload);
    if (!issue) return { ok: false, summary: "Booking triage payload was invalid", transient: false };
    const reference = bookingReference(issue.bookingKind, issue.bookingId);
    return {
      ok: true,
      summary: `${reference} requires owner review: ${issue.workflowStep} is ${issue.outcome}. Read-only triage; no AI invoked.`,
    };
  }
}
