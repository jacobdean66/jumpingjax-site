import { redactPii, redactPayload } from "./security";
import type { AuditEvent, CallSessionState, CallTurnOutput } from "./types";

export function sanitizeSessionForOwnerDemo(
  session: CallSessionState,
): Record<string, unknown> {
  return {
    id: session.id,
    callerProvided: Boolean(session.callerE164),
    disclosureSpoken: session.disclosureSpoken,
    disposition: session.disposition,
    escalationReason: session.escalationReason,
    bookingAttemptCount: session.bookingAttemptCount,
    hasBookingIdempotencyKey: Boolean(session.bookingIdempotencyKey),
    createdAtIso: session.createdAtIso,
  };
}

export function sanitizeTurnForOwnerDemo(
  turn: CallTurnOutput,
): Record<string, unknown> {
  return {
    sessionId: turn.sessionId,
    reply: redactPii(turn.reply),
    spokenDisclosure: turn.spokenDisclosure,
    intent: turn.intent,
    escalated: turn.escalated,
    escalation: turn.escalation
      ? {
          ok: turn.escalation.ok,
          reason: turn.escalation.reason,
          simulated: turn.escalation.simulated,
          transferTarget: turn.escalation.transferTarget,
        }
      : undefined,
    availability: turn.availability,
    booking: turn.booking
      ? turn.booking.ok
        ? {
            ok: true,
            bookingId: turn.booking.bookingId,
            status: turn.booking.status,
            message: turn.booking.message,
          }
        : {
            ok: false,
            code: turn.booking.code,
            message: turn.booking.message,
          }
      : undefined,
    payment: turn.payment
      ? {
          ok: turn.payment.ok,
          token: turn.payment.token,
          simulatedUrl: turn.payment.simulatedUrl,
          expiresAtIso: turn.payment.expiresAtIso,
          charged: turn.payment.charged,
          simulated: turn.payment.simulated,
          warningLabel: turn.payment.warningLabel,
        }
      : undefined,
    auditEventIds: turn.auditEventIds,
  };
}

export function sanitizeAuditForOwnerDemo(events: AuditEvent[]): AuditEvent[] {
  return events.map((event) => ({
    ...event,
    payload: redactPayload(event.payload),
  }));
}

export function sanitizeSmsLedger(
  rows: Array<{
    toE164: string;
    body: string;
    purpose: string;
    messageId: string;
    status: string;
    simulated: boolean;
  }>,
): Array<Record<string, unknown>> {
  return rows.map((row) => ({
    messageId: row.messageId,
    purpose: row.purpose,
    status: row.status,
    simulated: row.simulated,
    toE164: "[redacted]",
    bodyPreview: redactPii(row.body).slice(0, 160),
  }));
}

export function sanitizeEmailLedger(
  rows: Array<{
    toEmail: string;
    subject: string;
    body: string;
    purpose: string;
    messageId: string;
    status: string;
    simulated: boolean;
  }>,
): Array<Record<string, unknown>> {
  return rows.map((row) => ({
    messageId: row.messageId,
    purpose: row.purpose,
    status: row.status,
    simulated: row.simulated,
    toEmail: "[redacted]",
    subject: row.subject,
    bodyPreview: redactPii(row.body).slice(0, 160),
  }));
}
