import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  LedgerValidationError,
  mapCorrectionRpcEntries,
  parseCorrectionRequest,
  parsePaymentMethod,
} from "./corrections-service";

test("parsePaymentMethod accepts cash and card only", () => {
  assert.equal(parsePaymentMethod("cash"), "cash");
  assert.equal(parsePaymentMethod("card"), "card");
  assert.equal(parsePaymentMethod(undefined), null);
  assert.equal(parsePaymentMethod(null), null);
  assert.equal(parsePaymentMethod(""), null);
  assert.equal(parsePaymentMethod("Cash"), null);
  assert.equal(parsePaymentMethod("venmo"), null);
  assert.equal(parsePaymentMethod(1), null);
});

test("method_correction accepts valid cash and card pairs", () => {
  const cashToCard = parseCorrectionRequest({
    type: "method_correction",
    relatedEntryId: "11111111-1111-4111-8111-111111111111",
    fromMethod: "cash",
    toMethod: "card",
    amountCents: 700,
    reason: "Switched to card",
  });
  assert.ok(cashToCard);
  assert.equal(cashToCard.type, "method_correction");
  if (cashToCard.type !== "method_correction") {
    assert.fail("expected method_correction");
  }
  assert.equal(cashToCard.fromMethod, "cash");
  assert.equal(cashToCard.toMethod, "card");

  const cardToCash = parseCorrectionRequest({
    type: "method_correction",
    relatedEntryId: "11111111-1111-4111-8111-111111111111",
    fromMethod: "card",
    toMethod: "cash",
    amountCents: 1000,
    reason: "Card declined",
  });
  assert.ok(cardToCash);
  assert.equal(cardToCash.type, "method_correction");
  if (cardToCash.type !== "method_correction") {
    assert.fail("expected method_correction");
  }
  assert.equal(cardToCash.fromMethod, "card");
  assert.equal(cardToCash.toMethod, "cash");
});

test("refund accepts valid cash and card methods", () => {
  const cash = parseCorrectionRequest({
    type: "refund",
    relatedEntryId: "11111111-1111-4111-8111-111111111111",
    method: "cash",
    amountCents: 700,
    reason: "Partial refund",
  });
  assert.ok(cash);
  assert.equal(cash.type, "refund");
  if (cash.type !== "refund") assert.fail("expected refund");
  assert.equal(cash.method, "cash");

  const card = parseCorrectionRequest({
    type: "refund",
    relatedEntryId: "11111111-1111-4111-8111-111111111111",
    method: "card",
    amountCents: 700,
    reason: "Partial refund",
  });
  assert.ok(card);
  assert.equal(card.type, "refund");
  if (card.type !== "refund") assert.fail("expected refund");
  assert.equal(card.method, "card");
});

test("missing payment method is rejected for method_correction and refund", () => {
  assert.throws(
    () =>
      parseCorrectionRequest({
        type: "method_correction",
        relatedEntryId: "11111111-1111-4111-8111-111111111111",
        toMethod: "card",
        amountCents: 700,
        reason: "missing from",
      }),
    (error: unknown) =>
      error instanceof LedgerValidationError &&
      /cash or card/i.test(error.message),
  );

  assert.throws(
    () =>
      parseCorrectionRequest({
        type: "refund",
        relatedEntryId: "11111111-1111-4111-8111-111111111111",
        amountCents: 700,
        reason: "missing method",
      }),
    (error: unknown) =>
      error instanceof LedgerValidationError &&
      /cash or card/i.test(error.message),
  );
});

test("unknown payment method is rejected and not coerced to cash", () => {
  assert.throws(
    () =>
      parseCorrectionRequest({
        type: "refund",
        relatedEntryId: "11111111-1111-4111-8111-111111111111",
        method: "venmo",
        amountCents: 700,
        reason: "bad method",
      }),
    LedgerValidationError,
  );

  assert.throws(
    () =>
      parseCorrectionRequest({
        type: "method_correction",
        relatedEntryId: "11111111-1111-4111-8111-111111111111",
        fromMethod: "check",
        toMethod: "card",
        amountCents: 700,
        reason: "bad from",
      }),
    LedgerValidationError,
  );

  // Empty string previously coerced to cash — must reject.
  assert.throws(
    () =>
      parseCorrectionRequest({
        type: "refund",
        relatedEntryId: "11111111-1111-4111-8111-111111111111",
        method: "",
        amountCents: 700,
        reason: "empty method",
      }),
    LedgerValidationError,
  );
});

test("void and remove_attendee do not require a payment method", () => {
  const voidReq = parseCorrectionRequest({
    type: "void",
    relatedEntryId: "11111111-1111-4111-8111-111111111111",
    reason: "Left early",
  });
  assert.ok(voidReq);
  assert.equal(voidReq.type, "void");

  const remove = parseCorrectionRequest({
    type: "remove_attendee",
    attendeeId: "22222222-2222-4222-8222-222222222222",
    reason: "Duplicate check-in",
  });
  assert.ok(remove);
  assert.equal(remove.type, "remove_attendee");
});

test("unsupported correction type is rejected", () => {
  assert.equal(parseCorrectionRequest({ type: "mystery" }), null);
  assert.equal(parseCorrectionRequest({}), null);
});

test("mapCorrectionRpcEntries preserves attendeeId and relatedEntryId from RPC rows", () => {
  const mapped = mapCorrectionRpcEntries({
    visitId: "visit-1",
    staffId: "staff-1",
    reason: "Partial refund",
    createdAt: "2026-08-06T12:00:00.000Z",
    entries: [
      {
        id: "refund-1",
        entry_type: "refund",
        method: "card",
        amount_cents: -500,
        attendee_id: "attendee-9",
        related_entry_id: "charge-3",
      },
    ],
  });

  assert.equal(mapped.length, 1);
  assert.equal(mapped[0]?.attendeeId, "attendee-9");
  assert.equal(mapped[0]?.relatedEntryId, "charge-3");
  assert.equal(mapped[0]?.id, "refund-1");
  assert.equal(mapped[0]?.visitId, "visit-1");
  assert.equal(mapped[0]?.entryType, "refund");
  assert.equal(mapped[0]?.method, "card");
  assert.equal(mapped[0]?.amountCents, -500);
  assert.equal(mapped[0]?.reason, "Partial refund");
  assert.equal(mapped[0]?.createdByStaffId, "staff-1");
  assert.equal(mapped[0]?.createdAt, "2026-08-06T12:00:00.000Z");
});

test("mapCorrectionRpcEntries keeps legitimate null identity fields null", () => {
  const mapped = mapCorrectionRpcEntries({
    visitId: "visit-1",
    staffId: "staff-1",
    reason: "Adjustment",
    createdAt: "2026-08-06T12:00:00.000Z",
    entries: [
      {
        id: "entry-1",
        entry_type: "correction",
        method: "cash",
        amount_cents: -700,
        attendee_id: null,
        related_entry_id: null,
      },
    ],
  });
  assert.equal(mapped[0]?.attendeeId, null);
  assert.equal(mapped[0]?.relatedEntryId, null);
});

test("mapCorrectionRpcEntries omits identity as null when RPC rows lack those keys", () => {
  // Matches current SQL jsonb_build_object shape (id/entry_type/method/amount_cents only).
  const mapped = mapCorrectionRpcEntries({
    visitId: "visit-1",
    staffId: "staff-1",
    reason: "Void",
    createdAt: "2026-08-06T12:00:00.000Z",
    entries: [
      {
        id: "void-1",
        entry_type: "void",
        method: "cash",
        amount_cents: -700,
      },
    ],
  });
  assert.equal(mapped[0]?.attendeeId, null);
  assert.equal(mapped[0]?.relatedEntryId, null);
  assert.equal(mapped[0]?.entryType, "void");
  assert.equal(mapped[0]?.method, "cash");
});

test("corrections route uses parseCorrectionRequest and still requires owner auth", () => {
  const routePath = join(
    process.cwd(),
    "src/app/api/admin/open-play/visits/[id]/corrections/route.ts",
  );
  const source = readFileSync(routePath, "utf8");
  assert.match(source, /requireOwnerAuth/);
  assert.match(source, /parseCorrectionRequest/);
  assert.doesNotMatch(source, /=== "card" \? "card" : "cash"/);
  assert.doesNotMatch(source, /body\.method === "card"/);
});
