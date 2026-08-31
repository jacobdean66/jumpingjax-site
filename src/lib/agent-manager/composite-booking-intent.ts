import { createHash } from "node:crypto";

import {
  evaluateCompositeBooking,
  type CompositeApprovalIntent,
  type CompositeQuote,
} from "./composite-booking-evaluation";
import type {
  CalendarBlock,
  CalendarProjection,
  CompositeBookingRequest,
  CompositeServiceKind,
} from "./composite-booking";

export type StagedCompositeBookingIntent = {
  transactionKey: string;
  requestFingerprint: string;
  conversationRefHash: string;
  revision: number;
  status: "pending_owner_approval";
  services: CompositeServiceKind[];
  projections: CalendarProjection[];
  quote: CompositeQuote;
  requiresOwnerApproval: true;
  bookingWritesAllowed: false;
  calendarWritesAllowed: false;
  customerMessagesAllowed: false;
  paymentWritesAllowed: false;
};

export type CompositeBookingIntentStageResult =
  | { ok: true; intent: StagedCompositeBookingIntent }
  | {
      ok: false;
      status: "cancelled" | "needs_information" | "conflict" | "needs_pricing";
      reasons: string[];
    };

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableApprovalSnapshot(intent: CompositeApprovalIntent, revision: number) {
  return {
    transactionKey: intent.transactionKey,
    revision,
    services: [...intent.services].sort(),
    projections: [...intent.projections]
      .map(({ calendar, date, endMinutes, resourceRef, service, startMinutes, transactionKey }) => ({
        calendar,
        date,
        endMinutes,
        resourceRef,
        service,
        startMinutes,
        transactionKey,
      }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    quote: intent.quote,
  };
}

export function buildStagedCompositeBookingIntent(
  request: CompositeBookingRequest,
  existingBlocks: CalendarBlock[] = [],
): CompositeBookingIntentStageResult {
  const evaluation = evaluateCompositeBooking(request, existingBlocks);
  if (!evaluation.approvalIntent) {
    const status = evaluation.status === "ready_for_approval"
      ? "needs_pricing"
      : evaluation.status;
    return {
      ok: false,
      status,
      reasons: [
        ...evaluation.plan.missing,
        ...evaluation.plan.conflicts,
        ...evaluation.quote.issues,
      ],
    };
  }

  const snapshot = stableApprovalSnapshot(evaluation.approvalIntent, request.revision);
  return {
    ok: true,
    intent: {
      transactionKey: evaluation.approvalIntent.transactionKey,
      requestFingerprint: hash(JSON.stringify(snapshot)),
      conversationRefHash: hash(request.conversationRef),
      revision: request.revision,
      status: "pending_owner_approval",
      services: snapshot.services,
      projections: evaluation.approvalIntent.projections,
      quote: evaluation.approvalIntent.quote,
      requiresOwnerApproval: true,
      bookingWritesAllowed: false,
      calendarWritesAllowed: false,
      customerMessagesAllowed: false,
      paymentWritesAllowed: false,
    },
  };
}
