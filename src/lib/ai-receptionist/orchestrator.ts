import { randomUUID } from "node:crypto";

import type { AuditLog } from "./audit";
import type { AiReceptionistConfig } from "./config";
import { getAiReceptionistConfig } from "./config";
import { ensureDisclosureSpoken } from "./disclosure";
import { shouldEscalateAfterFailure } from "./failure-recovery";
import type { PaymentLinkAdapter } from "./adapters/payment-link";
import type {
  RentalAvailabilityPort,
  RentalBookingPort,
} from "./adapters/booking";
import { validateRentalBookingRequest } from "./adapters/booking";
import { answerFaq } from "./tools/faq";
import type {
  CallIntent,
  CallSessionState,
  CallTurnInput,
  CallTurnOutput,
  BookingAttemptResult,
  EscalationReason,
  EscalationResult,
} from "./types";

export type OrchestratorDeps = {
  config?: AiReceptionistConfig;
  audit: AuditLog;
  availability: RentalAvailabilityPort;
  booking: RentalBookingPort;
  paymentLinks: PaymentLinkAdapter;
};

function classifyIntent(input: CallTurnInput): CallIntent {
  if (input.intent) return input.intent;
  const text = input.text.toLowerCase();
  if (
    /\b(human|person|manager|agent|transfer|real (person|human)|talk to (someone|jacob|staff))\b/.test(
      text,
    )
  ) {
    return "escalate_human";
  }
  if (/\b(pay|payment|deposit|link)\b/.test(text)) {
    return "send_payment_link";
  }
  if (/\b(book|reserve|schedule|request)\b/.test(text)) {
    return "create_booking";
  }
  if (/\b(available|availability|open|free|date)\b/.test(text)) {
    return "check_availability";
  }
  if (/\b(hour|waiver|rental|bounce|price|cost|where|location|deliver)\b/.test(text)) {
    return "faq";
  }
  return "unknown";
}

function createSession(callerE164: string | null = null): CallSessionState {
  return {
    id: randomUUID(),
    callerE164,
    disclosureSpoken: false,
    disposition: null,
    escalationReason: null,
    bookingIdempotencyKey: null,
    bookingAttemptCount: 0,
    createdAtIso: new Date().toISOString(),
  };
}

export class CallSessionOrchestrator {
  private readonly config: AiReceptionistConfig;
  private readonly sessions = new Map<string, CallSessionState>();

  constructor(private readonly deps: OrchestratorDeps) {
    this.config = deps.config ?? getAiReceptionistConfig();
  }

  startSession(callerE164: string | null = null): CallSessionState {
    const session = createSession(callerE164);
    this.sessions.set(session.id, session);
    this.deps.audit.append(session.id, "session_started", {
      callerPresent: Boolean(callerE164),
    });
    return session;
  }

  getSession(sessionId: string): CallSessionState | null {
    return this.sessions.get(sessionId) ?? null;
  }

  async handleTurn(input: CallTurnInput): Promise<CallTurnOutput> {
    let session = this.sessions.get(input.sessionId);
    if (!session) {
      session = createSession(null);
      session.id = input.sessionId;
      this.sessions.set(session.id, session);
      this.deps.audit.append(session.id, "session_started", { recovered: true });
    }

    const auditEventIds: string[] = [];
    auditEventIds.push(
      this.deps.audit.append(session.id, "turn_received", {
        textLength: input.text.length,
        confidence: input.confidence,
      }).id,
    );

    let spokenDisclosure = false;
    const disclosure = ensureDisclosureSpoken(session.disclosureSpoken);
    let replyPrefix = "";
    if (disclosure.required) {
      session.disclosureSpoken = true;
      spokenDisclosure = true;
      replyPrefix = `${disclosure.text} `;
      auditEventIds.push(
        this.deps.audit.append(session.id, "disclosure_spoken", {
          version: disclosure.version,
        }).id,
      );
    }

    if (input.confidence < this.config.confidenceThreshold) {
      return this.escalate(session, replyPrefix, "low_confidence", auditEventIds, spokenDisclosure);
    }

    const intent = classifyIntent(input);
    auditEventIds.push(
      this.deps.audit.append(session.id, "intent_classified", { intent }).id,
    );

    if (intent === "escalate_human") {
      return this.escalate(
        session,
        replyPrefix,
        input.escalateReason ?? "caller_requested_human",
        auditEventIds,
        spokenDisclosure,
        intent,
      );
    }

    if (intent === "faq" || intent === "unknown") {
      const faq = answerFaq(input.text);
      auditEventIds.push(
        this.deps.audit.append(session.id, "tool_called", { tool: "faq", id: faq.id }).id,
      );
      return {
        sessionId: session.id,
        reply: `${replyPrefix}${faq.answer}`,
        spokenDisclosure,
        intent,
        escalated: false,
        auditEventIds,
      };
    }

    if (intent === "check_availability") {
      const rentalItem =
        input.availability?.rentalItem?.trim() ||
        extractSlugHint(input.text) ||
        "";
      auditEventIds.push(
        this.deps.audit.append(session.id, "tool_called", {
          tool: "availability",
          rentalItem,
        }).id,
      );
      const availability = await this.deps.availability.checkAvailability({
        rentalItem,
        monthsAhead: input.availability?.monthsAhead,
      });
      auditEventIds.push(
        this.deps.audit.append(session.id, "tool_result", {
          tool: "availability",
          ok: availability.ok,
        }).id,
      );
      if (!availability.ok) {
        return {
          sessionId: session.id,
          reply: `${replyPrefix}${availability.message} I can transfer you to a person if that helps.`,
          spokenDisclosure,
          intent,
          escalated: false,
          availability,
          auditEventIds,
        };
      }
      const sample = availability.unavailableYmds.slice(0, 5).join(", ");
      const reply = sample
        ? `${replyPrefix}I checked availability for ${availability.rentalItem}. Some unavailable dates include: ${sample}. Tell me your preferred date and I can check it specifically or start a pending booking request.`
        : `${replyPrefix}I checked availability for ${availability.rentalItem}. I do not see blocked dates in the current window. Share your preferred date to continue.`;
      return {
        sessionId: session.id,
        reply,
        spokenDisclosure,
        intent,
        escalated: false,
        availability,
        auditEventIds,
      };
    }

    if (intent === "create_booking") {
      if (!session.bookingIdempotencyKey) {
        session.bookingIdempotencyKey = randomUUID();
      }
      const draft = {
        ...input.booking,
        idempotencyKey:
          input.booking?.idempotencyKey?.trim() || session.bookingIdempotencyKey,
      };
      const validated = validateRentalBookingRequest(draft);
      if (!validated.ok) {
        auditEventIds.push(
          this.deps.audit.append(session.id, "booking_attempt", {
            status: "missing_fields",
          }).id,
        );
        return {
          sessionId: session.id,
          reply: `${replyPrefix}${validated.message}`,
          spokenDisclosure,
          intent,
          escalated: false,
          booking: { ok: false, code: "missing_fields", message: validated.message },
          auditEventIds,
        };
      }

      session.bookingAttemptCount += 1;
      auditEventIds.push(
        this.deps.audit.append(session.id, "tool_called", {
          tool: "booking",
          attempt: session.bookingAttemptCount,
        }).id,
      );

      // Fresh availability check before write — mitigates stale UI/cache windows.
      const primarySlug = validated.value.rentalItems[0]?.rentalItem ?? "";
      const availability = await this.deps.availability.checkAvailability({
        rentalItem: primarySlug,
      });
      if (!availability.ok) {
        const booking: BookingAttemptResult = {
          ok: false,
          code: "write_failed",
          message: availability.message,
        };
        auditEventIds.push(
          this.deps.audit.append(session.id, "booking_attempt", {
            ok: false,
            code: "availability_unavailable",
          }).id,
        );
        if (
          shouldEscalateAfterFailure({
            attemptCount: session.bookingAttemptCount,
            maxAttempts: this.config.maxBookingAttempts,
            lastCode: booking.code,
          })
        ) {
          return this.escalate(
            session,
            `${replyPrefix}${booking.message} `,
            "tool_failure",
            auditEventIds,
            spokenDisclosure,
            intent,
            { booking, availability },
          );
        }
        return {
          sessionId: session.id,
          reply: `${replyPrefix}${booking.message}`,
          spokenDisclosure,
          intent,
          escalated: false,
          booking,
          availability,
          auditEventIds,
        };
      }
      if (availability.unavailableYmds.includes(validated.value.eventDateYmd)) {
        const booking: BookingAttemptResult = {
          ok: false,
          code: "conflict",
          message:
            "That date is unavailable for the selected rental. Please choose another date or ask for a person.",
        };
        auditEventIds.push(
          this.deps.audit.append(session.id, "booking_attempt", {
            ok: false,
            code: "conflict",
            staleOrConflict: true,
          }).id,
        );
        if (
          shouldEscalateAfterFailure({
            attemptCount: session.bookingAttemptCount,
            maxAttempts: this.config.maxBookingAttempts,
            lastCode: "conflict",
          })
        ) {
          return this.escalate(
            session,
            `${replyPrefix}${booking.message} `,
            "booking_conflict",
            auditEventIds,
            spokenDisclosure,
            intent,
            { booking, availability },
          );
        }
        return {
          sessionId: session.id,
          reply: `${replyPrefix}${booking.message}`,
          spokenDisclosure,
          intent,
          escalated: false,
          booking,
          availability,
          auditEventIds,
        };
      }

      const booking = await this.deps.booking.createPendingBooking(validated.value);
      auditEventIds.push(
        this.deps.audit.append(session.id, "booking_attempt", {
          ok: booking.ok,
          code: booking.ok ? "pending" : booking.code,
          bookingId: booking.ok ? booking.bookingId : null,
          idempotencyKey: validated.value.idempotencyKey,
        }).id,
      );

      if (!booking.ok) {
        if (
          shouldEscalateAfterFailure({
            attemptCount: session.bookingAttemptCount,
            maxAttempts: this.config.maxBookingAttempts,
            lastCode: booking.code,
          })
        ) {
          return this.escalate(
            session,
            `${replyPrefix}${booking.message} `,
            booking.code === "conflict" ? "booking_conflict" : "tool_failure",
            auditEventIds,
            spokenDisclosure,
            intent,
            { booking },
          );
        }
        return {
          sessionId: session.id,
          reply: `${replyPrefix}${booking.message}`,
          spokenDisclosure,
          intent,
          escalated: false,
          booking,
          auditEventIds,
        };
      }

      session.disposition = "completed";
      return {
        sessionId: session.id,
        reply: `${replyPrefix}${booking.message}`,
        spokenDisclosure,
        intent,
        escalated: false,
        booking,
        auditEventIds,
      };
    }

    if (intent === "send_payment_link") {
      auditEventIds.push(
        this.deps.audit.append(session.id, "tool_called", {
          tool: "payment_link",
        }).id,
      );
      const payment = await this.deps.paymentLinks.createDepositLink({
        sessionId: session.id,
        bookingId: input.payment?.bookingId ?? null,
        amountCents: input.payment?.amountCents ?? null,
      });
      auditEventIds.push(
        this.deps.audit.append(session.id, "payment_link_stub", {
          token: payment.token,
          charged: payment.charged,
          simulatedUrl: payment.simulatedUrl,
        }).id,
      );
      return {
        sessionId: session.id,
        reply: `${replyPrefix}${payment.warningLabel}. Link: ${payment.simulatedUrl}. Expires ${payment.expiresAtIso}. No card details are collected on this call.`,
        spokenDisclosure,
        intent,
        escalated: false,
        payment,
        auditEventIds,
      };
    }

    return this.escalate(
      session,
      replyPrefix,
      "low_confidence",
      auditEventIds,
      spokenDisclosure,
      intent,
    );
  }

  private escalate(
    session: CallSessionState,
    replyPrefix: string,
    reason: EscalationReason,
    auditEventIds: string[],
    spokenDisclosure: boolean,
    intent: CallIntent = "escalate_human",
    extra: Partial<CallTurnOutput> = {},
  ): CallTurnOutput {
    const escalation: EscalationResult = {
      ok: true,
      transferTarget: this.config.transferTargetSim,
      reason,
      simulated: true,
    };
    session.disposition = "escalated";
    session.escalationReason = reason;
    auditEventIds.push(
      this.deps.audit.append(session.id, "human_handoff", {
        reason,
        transferTarget: escalation.transferTarget,
        simulated: true,
      }).id,
    );
    return {
      sessionId: session.id,
      reply: `${replyPrefix}I am connecting you with a Jumping Jax team member now (${escalation.transferTarget}).`,
      spokenDisclosure,
      intent,
      escalated: true,
      escalation,
      auditEventIds,
      ...extra,
    };
  }
}

function extractSlugHint(text: string): string | null {
  const match = text.match(/\b([a-z0-9]+(?:-[a-z0-9]+)+)\b/i);
  return match?.[1]?.toLowerCase() ?? null;
}
