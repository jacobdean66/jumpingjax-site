export type CallIntent =
  | "faq"
  | "check_availability"
  | "create_booking"
  | "send_payment_link"
  | "escalate_human"
  | "unknown";

export type EscalationReason =
  | "caller_requested_human"
  | "low_confidence"
  | "booking_conflict"
  | "tool_failure"
  | "payment_ambiguity"
  | "consent_ambiguity";

export type CallDisposition =
  | "completed"
  | "escalated"
  | "abandoned"
  | "failed";

export type AuditEventType =
  | "session_started"
  | "disclosure_spoken"
  | "turn_received"
  | "intent_classified"
  | "tool_called"
  | "tool_result"
  | "booking_attempt"
  | "payment_link_stub"
  | "sms_simulated"
  | "email_simulated"
  | "human_handoff"
  | "session_ended"
  | "failure_recovered"
  | "live_action_blocked";

export type RentalBookingRequest = {
  idempotencyKey: string;
  rentalItems: { rentalItem: string; rentalName?: string }[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  eventDateYmd: string;
  eventStartTime: string;
  requestedDeliveryWindow: string;
  eventAddress: string;
  setupSurface: string;
  setupAccess: string;
  paymentMethod: string;
  durationLabel?: string;
  setupNotes?: string;
  distanceMiles?: number | null;
};

export type AvailabilityQuery = {
  rentalItem: string;
  monthsAhead?: number;
};

export type AvailabilityResult =
  | { ok: true; rentalItem: string; unavailableYmds: string[] }
  | { ok: false; code: "invalid_rental" | "unavailable"; message: string };

export type BookingAttemptResult =
  | {
      ok: true;
      bookingId: string;
      status: "pending";
      message: string;
    }
  | {
      ok: false;
      code: "conflict" | "invalid_input" | "write_failed" | "missing_fields";
      message: string;
    };

export type PaymentLinkResult = {
  ok: true;
  token: string;
  simulatedUrl: string;
  expiresAtIso: string;
  charged: false;
  /** Always true in Phase 1 — never a live processor URL. */
  simulated: true;
  warningLabel: string;
};

export type EscalationResult = {
  ok: true;
  transferTarget: string;
  reason: EscalationReason;
  simulated: true;
};

export type CallTurnInput = {
  sessionId: string;
  text: string;
  confidence: number;
  intent?: CallIntent;
  availability?: AvailabilityQuery;
  booking?: Partial<RentalBookingRequest>;
  payment?: { bookingId?: string; amountCents?: number | null };
  escalateReason?: EscalationReason;
};

export type CallTurnOutput = {
  sessionId: string;
  reply: string;
  spokenDisclosure: boolean;
  intent: CallIntent;
  escalated: boolean;
  escalation?: EscalationResult;
  availability?: AvailabilityResult;
  booking?: BookingAttemptResult;
  payment?: PaymentLinkResult;
  auditEventIds: string[];
};

export type CallSessionState = {
  id: string;
  callerE164: string | null;
  disclosureSpoken: boolean;
  disposition: CallDisposition | null;
  escalationReason: EscalationReason | null;
  bookingIdempotencyKey: string | null;
  bookingAttemptCount: number;
  createdAtIso: string;
};

export type AuditEvent = {
  id: string;
  sessionId: string | null;
  eventType: AuditEventType;
  payload: Record<string, unknown>;
  createdAtIso: string;
};

export type MarketingChannel = "sms" | "email";

export type BirthdayCandidate = {
  participantId: string;
  submissionId: string;
  childFirstName: string;
  childLastName: string;
  childDobYmd: string;
  nextBirthdayYmd: string;
  offerDateYmd: string;
  signerEmail: string;
  signerPhone: string;
  signerFirstName: string;
  signerLastName: string;
  waiverExpiresOn: string;
  childFingerprint: string;
};

export type MarketingContactSnapshot = {
  id: string;
  emailNormalized: string | null;
  phoneE164: string | null;
  smsMarketingOptIn: boolean;
  emailMarketingOptIn: boolean;
  smsOptedOutAt: string | null;
  emailOptedOutAt: string | null;
};

export type BirthdayExclusion = {
  contactId?: string | null;
  childFingerprint?: string | null;
  active: boolean;
  reason: string;
};

export type PriorBirthdayDelivery = {
  contactId: string;
  childFingerprint: string;
  offerYear: number;
  status: "pending" | "simulated" | "sent" | "failed" | "suppressed";
};

export type BirthdayDeliveryDecision =
  | {
      action: "deliver";
      channel: MarketingChannel;
      offerCode: string;
      expiresOnYmd: string;
      offerYear: number;
      status: "simulated" | "sent";
    }
  | {
      action: "suppress";
      reason:
        | "no_opt_in"
        | "opted_out"
        | "excluded"
        | "waiver_expired"
        | "wrong_offer_day"
        | "annual_dedupe"
        | "offer_expired"
        | "live_actions_disabled_no_channel"
        | "no_contact";
    };
