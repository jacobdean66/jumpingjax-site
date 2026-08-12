import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { InMemoryAuditLog } from "./audit";
import {
  SimRentalAvailabilityAdapter,
  SimRentalBookingAdapter,
} from "./adapters/booking";
import { SimEmailAdapter } from "./adapters/email";
import { SimPaymentLinkAdapter } from "./adapters/payment-link";
import { SimSmsAdapter } from "./adapters/sms";
import {
  buildCandidateFromWaiverRow,
  decideBirthdayDelivery,
  nextBirthdayOnOrAfter,
  offerDateSixWeeksBefore,
} from "./birthday/eligibility";
import { runBirthdayOfferDryRun } from "./birthday/scheduler";
import { getAiReceptionistConfig } from "./config";
import { AI_DISCLOSURE_TEXT } from "./disclosure";
import { CallSessionOrchestrator } from "./orchestrator";
import {
  sanitizeEmailLedger,
  sanitizeSessionForOwnerDemo,
  sanitizeSmsLedger,
} from "./sanitize";
import { getForcedSimulationConfig } from "./simulation-mode";
import {
  liveActionsDisabledResponse,
  redactPii,
  verifyWebhookSignatureStub,
} from "./security";
import {
  FixedWindowRateLimiter,
  InMemoryReplayGuard,
  assertWebhookBodySize,
  validateNormalizedCallEvent,
  withProviderTimeout,
} from "./providers/contracts";
import { normalizedFixture } from "./providers/fixtures";

const here = path.dirname(fileURLToPath(import.meta.url));

function makeOrchestrator(configOverrides?: Parameters<typeof getAiReceptionistConfig>[0]) {
  const config = getAiReceptionistConfig({
    liveActions: false,
    ...configOverrides,
  });
  const audit = new InMemoryAuditLog();
  const availability = new SimRentalAvailabilityAdapter();
  const booking = new SimRentalBookingAdapter();
  const paymentLinks = new SimPaymentLinkAdapter(config);
  const orchestrator = new CallSessionOrchestrator({
    config,
    audit,
    availability,
    booking,
    paymentLinks,
  });
  return { config, audit, availability, booking, paymentLinks, orchestrator };
}

test("disclosure always precedes booking and payment tools", async () => {
  const { orchestrator, audit } = makeOrchestrator();
  const session = orchestrator.startSession("+15555550100");
  const turn = await orchestrator.handleTurn({
    sessionId: session.id,
    text: "Please book the mega-slide for me",
    confidence: 0.95,
    intent: "create_booking",
    booking: {
      rentalItems: [{ rentalItem: "mega-slide" }],
      customerName: "Alex Parent",
      customerEmail: "alex@example.com",
      customerPhone: "555-0100",
      eventDateYmd: "2026-09-15",
      eventStartTime: "14:00",
      requestedDeliveryWindow: "12:00-13:00",
      eventAddress: "123 Main St",
      setupSurface: "grass",
      setupAccess: "side yard",
      paymentMethod: "Card",
    },
  });

  assert.equal(turn.spokenDisclosure, true);
  assert.match(turn.reply, new RegExp(AI_DISCLOSURE_TEXT.slice(0, 40)));
  assert.equal(turn.booking?.ok, true);
  const events = audit.list(session.id).map((e) => e.eventType);
  assert.ok(events.indexOf("disclosure_spoken") < events.indexOf("booking_attempt"));
});

test("availability + booking orchestration is idempotent on retry", async () => {
  const { orchestrator, availability } = makeOrchestrator();
  availability.setUnavailable("combo-bounce", ["2026-10-01"]);
  const session = orchestrator.startSession(null);

  const avail = await orchestrator.handleTurn({
    sessionId: session.id,
    text: "Is combo-bounce available?",
    confidence: 0.9,
    intent: "check_availability",
    availability: { rentalItem: "combo-bounce" },
  });
  assert.equal(avail.availability?.ok, true);
  if (avail.availability?.ok) {
    assert.deepEqual(avail.availability.unavailableYmds, ["2026-10-01"]);
  }

  const bookingPayload = {
    rentalItems: [{ rentalItem: "combo-bounce" }],
    customerName: "Sam Parent",
    customerEmail: "sam@example.com",
    customerPhone: "555-0101",
    eventDateYmd: "2026-10-02",
    eventStartTime: "15:00",
    requestedDeliveryWindow: "13:00-14:00",
    eventAddress: "456 Oak Ave",
    setupSurface: "concrete",
    setupAccess: "driveway",
    paymentMethod: "Cash",
  };

  const first = await orchestrator.handleTurn({
    sessionId: session.id,
    text: "Book it",
    confidence: 0.9,
    intent: "create_booking",
    booking: bookingPayload,
  });
  assert.equal(first.booking?.ok, true);
  const bookingId = first.booking && first.booking.ok ? first.booking.bookingId : null;

  const second = await orchestrator.handleTurn({
    sessionId: session.id,
    text: "Book it again",
    confidence: 0.9,
    intent: "create_booking",
    booking: bookingPayload,
  });
  assert.equal(second.booking?.ok, true);
  if (second.booking?.ok) {
    assert.equal(second.booking.bookingId, bookingId);
  }
});

test("escalates on low confidence and human request", async () => {
  const { orchestrator } = makeOrchestrator();
  const session = orchestrator.startSession(null);

  const low = await orchestrator.handleTurn({
    sessionId: session.id,
    text: "uhh maybe something",
    confidence: 0.2,
  });
  assert.equal(low.escalated, true);
  assert.equal(low.escalation?.reason, "low_confidence");

  const session2 = orchestrator.startSession(null);
  const human = await orchestrator.handleTurn({
    sessionId: session2.id,
    text: "I want to talk to a real person",
    confidence: 0.99,
  });
  assert.equal(human.escalated, true);
  assert.equal(human.escalation?.reason, "caller_requested_human");
  assert.equal(human.escalation?.simulated, true);
});

test("payment stub never charges and stays simulated", async () => {
  const { orchestrator, paymentLinks } = makeOrchestrator();
  const session = orchestrator.startSession(null);
  const turn = await orchestrator.handleTurn({
    sessionId: session.id,
    text: "Send me a deposit link",
    confidence: 0.95,
    intent: "send_payment_link",
  });
  assert.equal(turn.payment?.ok, true);
  assert.equal(turn.payment?.charged, false);
  assert.equal(turn.payment?.simulated, true);
  assert.match(turn.payment?.warningLabel ?? "", /SIMULATED PAYMENT LINK/);
  assert.match(turn.payment?.simulatedUrl ?? "", /simulated\.jumpingjax\.local/);
  assert.match(turn.reply, /SIMULATED PAYMENT LINK/);
  assert.equal(paymentLinks.listLinks()[0]?.charged, false);
});

test("birthday eligibility enforces six-week window, consent, dedupe, exclusion", () => {
  const todayYmd = "2026-08-11";
  const nextBirthday = nextBirthdayOnOrAfter("2018-09-22", todayYmd);
  assert.equal(nextBirthday, "2026-09-22");
  assert.equal(offerDateSixWeeksBefore(nextBirthday), "2026-08-11");

  const candidate = buildCandidateFromWaiverRow({
    participantId: "p1",
    submissionId: "s1",
    childFirstName: "Jamie",
    childLastName: "Kid",
    childDobYmd: "2018-09-22",
    signerEmail: "parent@example.com",
    signerPhone: "555-0100",
    signerFirstName: "Pat",
    signerLastName: "Parent",
    waiverExpiresOn: "2028-01-01",
    todayYmd,
  });
  assert.equal(candidate.offerDateYmd, todayYmd);

  const contact = {
    id: "c1",
    emailNormalized: "parent@example.com",
    phoneE164: "+15555550100",
    smsMarketingOptIn: true,
    emailMarketingOptIn: false,
    smsOptedOutAt: null,
    emailOptedOutAt: null,
  };

  const deliver = decideBirthdayDelivery({
    todayYmd,
    candidate,
    contact,
    exclusions: [],
    priorDeliveries: [],
  });
  assert.equal(deliver.action, "deliver");
  if (deliver.action === "deliver") {
    assert.equal(deliver.status, "simulated");
    assert.equal(deliver.channel, "sms");
  }

  assert.equal(
    decideBirthdayDelivery({
      todayYmd,
      candidate,
      contact: { ...contact, smsMarketingOptIn: false },
      exclusions: [],
      priorDeliveries: [],
    }).action,
    "suppress",
  );

  assert.equal(
    decideBirthdayDelivery({
      todayYmd,
      candidate,
      contact: { ...contact, smsOptedOutAt: "2026-01-01T00:00:00.000Z" },
      exclusions: [],
      priorDeliveries: [],
    }).action,
    "suppress",
  );

  assert.equal(
    decideBirthdayDelivery({
      todayYmd,
      candidate,
      contact,
      exclusions: [{ contactId: "c1", active: true, reason: "staff" }],
      priorDeliveries: [],
    }).action,
    "suppress",
  );

  assert.equal(
    decideBirthdayDelivery({
      todayYmd,
      candidate,
      contact,
      exclusions: [],
      priorDeliveries: [
        {
          contactId: "c1",
          childFingerprint: candidate.childFingerprint,
          offerYear: 2026,
          status: "simulated",
        },
      ],
    }).action,
    "suppress",
  );

  assert.equal(
    decideBirthdayDelivery({
      todayYmd: "2026-08-12",
      candidate,
      contact,
      exclusions: [],
      priorDeliveries: [],
    }).action,
    "suppress",
  );
});

test("birthday dry-run records simulated SMS only", async () => {
  const config = getAiReceptionistConfig({ liveActions: false });
  const audit = new InMemoryAuditLog();
  const sms = new SimSmsAdapter(config);
  const email = new SimEmailAdapter(config);
  const todayYmd = "2026-08-11";
  const candidate = buildCandidateFromWaiverRow({
    participantId: "p1",
    submissionId: "s1",
    childFirstName: "Jamie",
    childLastName: "Kid",
    childDobYmd: "2018-09-22",
    signerEmail: "parent@example.com",
    signerPhone: "555-0100",
    signerFirstName: "Pat",
    signerLastName: "Parent",
    waiverExpiresOn: "2028-01-01",
    todayYmd,
  });

  const result = await runBirthdayOfferDryRun(
    { config, audit, sms, email },
    {
      todayYmd,
      candidates: [candidate],
      contactsById: new Map([
        [
          "c1",
          {
            id: "c1",
            emailNormalized: "parent@example.com",
            phoneE164: "+15555550100",
            smsMarketingOptIn: true,
            emailMarketingOptIn: true,
            smsOptedOutAt: null,
            emailOptedOutAt: null,
          },
        ],
      ]),
      contactIdBySignerKey: new Map([["parent@example.com", "c1"]]),
      exclusions: [],
      priorDeliveries: [],
    },
  );

  assert.equal(result.results[0]?.decision.action, "deliver");
  assert.equal(result.ledger[0]?.status, "simulated");
  assert.equal(sms.listSent().length, 1);
  assert.equal(sms.listSent()[0]?.status, "simulated");
  assert.equal(email.listSent().length, 0);
});

test("orchestrator source does not import live telephony or stripe providers", () => {
  const source = readFileSync(path.join(here, "orchestrator.ts"), "utf8");
  for (const banned of ["twilio", "vapi", "retell", "stripe", "openai/realtime"]) {
    assert.equal(source.toLowerCase().includes(banned), false, `found ${banned}`);
  }
});

test("live webhook gate returns live_actions_disabled", () => {
  const config = getAiReceptionistConfig({ liveActions: false });
  assert.equal(config.liveActions, false);
  const body = liveActionsDisabledResponse("webhook.ingress");
  assert.equal(body.code, "live_actions_disabled");

  const verified = verifyWebhookSignatureStub({
    liveActions: false,
    providedSignature: "sig",
    expectedSecretConfigured: true,
  });
  assert.equal(verified.ok, false);
  if (!verified.ok) assert.equal(verified.code, "live_actions_disabled");
});

test("webhook ingress route source refuses live traffic by default", () => {
  const route = readFileSync(
    path.join(
      here,
      "..",
      "..",
      "app",
      "api",
      "ai-receptionist",
      "webhooks",
      "ingress",
      "route.ts",
    ),
    "utf8",
  );
  assert.match(route, /liveActionsDisabledResponse/);
  assert.match(route, /getAiReceptionistConfig/);
  assert.match(route, /if \(!config\.liveActions\)/);
});

test("audit migration SQL marks audit events append-only", () => {
  const sql = readFileSync(
    path.join(
      here,
      "..",
      "..",
      "..",
      "supabase",
      "migrations",
      "20260811120000_ai_receptionist_phase1.sql",
    ),
    "utf8",
  );
  assert.match(sql, /ai_receptionist_audit_events_no_update/);
  assert.match(sql, /ai_receptionist_prevent_mutation/);
  assert.match(sql, /charged boolean not null default false check \(charged = false\)/);
});

test("redactPii removes emails and phones from log strings", () => {
  assert.equal(
    redactPii("Contact alex@example.com at 864-933-1420"),
    "Contact [redacted-email] at [redacted-phone]",
  );
});

test("booking conflict escalates after failure policy", async () => {
  const { orchestrator, booking } = makeOrchestrator({
    maxBookingAttempts: 1,
  });
  booking.blockDate("2026-11-01");
  const session = orchestrator.startSession(null);
  const turn = await orchestrator.handleTurn({
    sessionId: session.id,
    text: "book please",
    confidence: 0.95,
    intent: "create_booking",
    booking: {
      rentalItems: [{ rentalItem: "castle" }],
      customerName: "Alex Parent",
      customerEmail: "alex@example.com",
      customerPhone: "555-0100",
      eventDateYmd: "2026-11-01",
      eventStartTime: "14:00",
      requestedDeliveryWindow: "12:00-13:00",
      eventAddress: "123 Main St",
      setupSurface: "grass",
      setupAccess: "side yard",
      paymentMethod: "Card",
    },
  });
  assert.equal(turn.escalated, true);
  assert.equal(turn.escalation?.reason, "booking_conflict");
});

test("stale availability is re-checked before booking write", async () => {
  const { orchestrator, availability } = makeOrchestrator({
    maxBookingAttempts: 1,
  });
  availability.setUnavailable("castle", ["2026-12-01"]);
  const session = orchestrator.startSession(null);
  const turn = await orchestrator.handleTurn({
    sessionId: session.id,
    text: "book please",
    confidence: 0.95,
    intent: "create_booking",
    booking: {
      rentalItems: [{ rentalItem: "castle" }],
      customerName: "Alex Parent",
      customerEmail: "alex@example.com",
      customerPhone: "555-0100",
      eventDateYmd: "2026-12-01",
      eventStartTime: "14:00",
      requestedDeliveryWindow: "12:00-13:00",
      eventAddress: "123 Main St",
      setupSurface: "grass",
      setupAccess: "side yard",
      paymentMethod: "Card",
    },
  });
  assert.equal(turn.booking?.ok, false);
  if (turn.booking && !turn.booking.ok) {
    assert.equal(turn.booking.code, "conflict");
  }
  assert.equal(turn.escalated, true);
  assert.equal(turn.escalation?.reason, "booking_conflict");
});

test("leap-day birthdays clamp and use exactly 42 days", () => {
  // Non-leap year: Feb 29 DOB celebrates on Feb 28.
  assert.equal(nextBirthdayOnOrAfter("2016-02-29", "2025-01-01"), "2025-02-28");
  assert.equal(offerDateSixWeeksBefore("2025-02-28"), "2025-01-17");
  // Leap year keeps Feb 29.
  assert.equal(nextBirthdayOnOrAfter("2016-02-29", "2024-01-01"), "2024-02-29");
  assert.equal(offerDateSixWeeksBefore("2024-02-29"), "2024-01-18");
  // Year boundary: birthday early January, offer date previous year.
  assert.equal(nextBirthdayOnOrAfter("2018-01-10", "2026-12-01"), "2027-01-10");
  assert.equal(offerDateSixWeeksBefore("2027-01-10"), "2026-11-29");
});

test("multiple children and missing contact suppress with ledger reasons", async () => {
  const config = getAiReceptionistConfig({ liveActions: false });
  const audit = new InMemoryAuditLog();
  const sms = new SimSmsAdapter(config);
  const email = new SimEmailAdapter(config);
  const todayYmd = "2026-08-11";

  const childA = buildCandidateFromWaiverRow({
    participantId: "p1",
    submissionId: "s1",
    childFirstName: "Jamie",
    childLastName: "Kid",
    childDobYmd: "2018-09-22",
    signerEmail: "parent@example.com",
    signerPhone: "555-0100",
    signerFirstName: "Pat",
    signerLastName: "Parent",
    waiverExpiresOn: "2028-01-01",
    todayYmd,
  });
  const childB = buildCandidateFromWaiverRow({
    participantId: "p2",
    submissionId: "s1",
    childFirstName: "Riley",
    childLastName: "Kid",
    childDobYmd: "2016-09-22",
    signerEmail: "parent@example.com",
    signerPhone: "555-0100",
    signerFirstName: "Pat",
    signerLastName: "Parent",
    waiverExpiresOn: "2028-01-01",
    todayYmd,
  });
  const orphan = buildCandidateFromWaiverRow({
    participantId: "p3",
    submissionId: "s2",
    childFirstName: "Sam",
    childLastName: "Solo",
    childDobYmd: "2019-09-22",
    signerEmail: "missing@example.com",
    signerPhone: "555-9999",
    signerFirstName: "No",
    signerLastName: "Contact",
    waiverExpiresOn: "2028-01-01",
    todayYmd,
  });

  const result = await runBirthdayOfferDryRun(
    { config, audit, sms, email },
    {
      todayYmd,
      candidates: [childA, childB, orphan],
      contactsById: new Map([
        [
          "c1",
          {
            id: "c1",
            emailNormalized: "parent@example.com",
            phoneE164: "+15555550100",
            smsMarketingOptIn: true,
            emailMarketingOptIn: false,
            smsOptedOutAt: null,
            emailOptedOutAt: null,
          },
        ],
      ]),
      contactIdBySignerKey: new Map([["parent@example.com", "c1"]]),
      exclusions: [],
      priorDeliveries: [],
    },
  );

  assert.equal(result.ledger.length, 3);
  assert.equal(result.ledger.filter((row) => row.status === "simulated").length, 2);
  assert.equal(
    result.ledger.find((row) => row.participantId === "p3")?.reason,
    "no_contact",
  );
  assert.equal(sms.listSent().length, 2);
});

test("duplicate birthday run is suppressed via annual dedupe ledger reason", async () => {
  const todayYmd = "2026-08-11";
  const candidate = buildCandidateFromWaiverRow({
    participantId: "p1",
    submissionId: "s1",
    childFirstName: "Jamie",
    childLastName: "Kid",
    childDobYmd: "2018-09-22",
    signerEmail: "parent@example.com",
    signerPhone: "555-0100",
    signerFirstName: "Pat",
    signerLastName: "Parent",
    waiverExpiresOn: "2028-01-01",
    todayYmd,
  });
  const contact = {
    id: "c1",
    emailNormalized: "parent@example.com",
    phoneE164: "+15555550100",
    smsMarketingOptIn: true,
    emailMarketingOptIn: true,
    smsOptedOutAt: null,
    emailOptedOutAt: null,
  };
  const decision = decideBirthdayDelivery({
    todayYmd,
    candidate,
    contact,
    exclusions: [],
    priorDeliveries: [
      {
        contactId: "c1",
        childFingerprint: candidate.childFingerprint,
        offerYear: 2026,
        status: "simulated",
      },
    ],
  });
  assert.equal(decision.action, "suppress");
  if (decision.action === "suppress") {
    assert.equal(decision.reason, "annual_dedupe");
  }
});

test("consent revocation and email fallback work", () => {
  const todayYmd = "2026-08-11";
  const candidate = buildCandidateFromWaiverRow({
    participantId: "p1",
    submissionId: "s1",
    childFirstName: "Jamie",
    childLastName: "Kid",
    childDobYmd: "2018-09-22",
    signerEmail: "parent@example.com",
    signerPhone: "555-0100",
    signerFirstName: "Pat",
    signerLastName: "Parent",
    waiverExpiresOn: "2028-01-01",
    todayYmd,
  });

  const emailOnly = decideBirthdayDelivery({
    todayYmd,
    candidate,
    contact: {
      id: "c1",
      emailNormalized: "parent@example.com",
      phoneE164: "+15555550100",
      smsMarketingOptIn: false,
      emailMarketingOptIn: true,
      smsOptedOutAt: "2026-01-01T00:00:00.000Z",
      emailOptedOutAt: null,
    },
    exclusions: [],
    priorDeliveries: [],
  });
  assert.equal(emailOnly.action, "deliver");
  if (emailOnly.action === "deliver") {
    assert.equal(emailOnly.channel, "email");
  }

  const revoked = decideBirthdayDelivery({
    todayYmd,
    candidate,
    contact: {
      id: "c1",
      emailNormalized: "parent@example.com",
      phoneE164: "+15555550100",
      smsMarketingOptIn: true,
      emailMarketingOptIn: true,
      smsOptedOutAt: "2026-01-01T00:00:00.000Z",
      emailOptedOutAt: "2026-01-01T00:00:00.000Z",
    },
    exclusions: [],
    priorDeliveries: [],
  });
  assert.equal(revoked.action, "suppress");
});

test("same child fingerprint across repeated waiver submissions dedupes", () => {
  const todayYmd = "2026-08-11";
  const a = buildCandidateFromWaiverRow({
    participantId: "p-old",
    submissionId: "s-old",
    childFirstName: "Jamie",
    childLastName: "Kid",
    childDobYmd: "2018-09-22",
    signerEmail: "parent@example.com",
    signerPhone: "555-0100",
    signerFirstName: "Pat",
    signerLastName: "Parent",
    waiverExpiresOn: "2028-01-01",
    todayYmd,
  });
  const b = buildCandidateFromWaiverRow({
    participantId: "p-new",
    submissionId: "s-new",
    childFirstName: "Jamie",
    childLastName: "Kid",
    childDobYmd: "2018-09-22",
    signerEmail: "parent@example.com",
    signerPhone: "555-0100",
    signerFirstName: "Pat",
    signerLastName: "Parent",
    waiverExpiresOn: "2029-01-01",
    todayYmd,
  });
  assert.equal(a.childFingerprint, b.childFingerprint);
});

test("owner simulate routes require owner auth and force simulation", () => {
  for (const rel of [
    ["simulate", "call", "route.ts"],
    ["simulate", "birthday-run", "route.ts"],
  ] as const) {
    const route = readFileSync(
      path.join(here, "..", "..", "app", "api", "ai-receptionist", ...rel),
      "utf8",
    );
    assert.match(route, /requireOwnerAuth/);
    assert.match(route, /getForcedSimulationConfig|liveActions: false/);
    assert.match(route, /SIMULATION_BANNER|SIMULATION — NO LIVE ACTIONS/);
  }
  const page = readFileSync(
    path.join(here, "..", "..", "app", "admin", "ai-receptionist", "page.tsx"),
    "utf8",
  );
  assert.match(page, /verifyAdminOwnerAccess/);
  const client = readFileSync(
    path.join(
      here,
      "..",
      "..",
      "app",
      "admin",
      "ai-receptionist",
      "AiReceptionistDemoClient.tsx",
    ),
    "utf8",
  );
  assert.match(client, /SIMULATION — NO LIVE ACTIONS/);
});

test("sanitize helpers redact contact fields for owner demo responses", () => {
  const session = sanitizeSessionForOwnerDemo({
    id: "sess-1",
    callerE164: "+15555550100",
    disclosureSpoken: true,
    disposition: null,
    escalationReason: null,
    bookingIdempotencyKey: "key",
    bookingAttemptCount: 1,
    createdAtIso: "2026-08-11T00:00:00.000Z",
  });
  assert.equal(session.callerProvided, true);
  assert.equal("callerE164" in session, false);

  const sms = sanitizeSmsLedger([
    {
      toE164: "+15555550100",
      body: "Offer for Jamie at parent@example.com",
      purpose: "birthday_offer",
      messageId: "m1",
      status: "simulated",
      simulated: true,
    },
  ]);
  assert.equal(sms[0]?.toE164, "[redacted]");
  assert.match(String(sms[0]?.bodyPreview), /\[redacted-email\]/);

  const email = sanitizeEmailLedger([
    {
      toEmail: "parent@example.com",
      subject: "Offer",
      body: "Call 864-933-1420",
      purpose: "birthday_offer",
      messageId: "m2",
      status: "simulated",
      simulated: true,
    },
  ]);
  assert.equal(email[0]?.toEmail, "[redacted]");
  assert.match(String(email[0]?.bodyPreview), /\[redacted-phone\]/);
});

test("migration is additive and does not alter waiver participant tables", () => {
  const sql = readFileSync(
    path.join(
      here,
      "..",
      "..",
      "..",
      "supabase",
      "migrations",
      "20260811120000_ai_receptionist_phase1.sql",
    ),
    "utf8",
  );
  assert.doesNotMatch(sql, /alter table public\.waiver_participants/i);
  assert.doesNotMatch(sql, /update public\.waiver_participants/i);
  assert.doesNotMatch(sql, /alter table public\.waiver_submissions/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /No public .+ access/);
  assert.match(sql, /grant execute on function public\.ai_receptionist_list_birthday_candidates/);
  assert.match(sql, /to service_role/);
});

test("forced simulation config ignores live env", () => {
  const previous = process.env.AI_RECEPTIONIST_LIVE_ACTIONS;
  process.env.AI_RECEPTIONIST_LIVE_ACTIONS = "true";
  try {
    assert.equal(getForcedSimulationConfig().liveActions, false);
  } finally {
    if (previous === undefined) delete process.env.AI_RECEPTIONIST_LIVE_ACTIONS;
    else process.env.AI_RECEPTIONIST_LIVE_ACTIONS = previous;
  }
});

test("all provider fixtures satisfy the normalized event contract", () => {
  for (const provider of ["vapi", "retell", "twilio_openai_realtime"] as const) {
    assert.equal(validateNormalizedCallEvent(normalizedFixture(provider)).provider, provider);
  }
  assert.throws(() => validateNormalizedCallEvent({ provider: "vapi" }), /invalid_event/);
});

test("webhook boundary rejects oversized bodies, replays, and bursts", () => {
  assert.throws(() => assertWebhookBodySize("12345", 4), /webhook_body_too_large/);
  const replay = new InMemoryReplayGuard();
  assert.equal(replay.accept("evt-1", 1_000, 500), true);
  assert.equal(replay.accept("evt-1", 1_100, 500), false);
  assert.equal(replay.accept("evt-1", 1_501, 500), true);
  const rate = new FixedWindowRateLimiter();
  assert.equal(rate.accept("provider:ip", 0, 2), true);
  assert.equal(rate.accept("provider:ip", 1, 2), true);
  assert.equal(rate.accept("provider:ip", 2, 2), false);
  assert.equal(rate.accept("provider:ip", 60_000, 2), true);
});

test("provider calls time out fail-closed", async () => {
  await assert.rejects(
    withProviderTimeout(new Promise(() => undefined), 5),
    /provider_timeout/,
  );
});
