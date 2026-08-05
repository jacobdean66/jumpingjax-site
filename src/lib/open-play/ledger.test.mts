import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChargeEntry,
  buildMethodCorrectionEntries,
  buildRefundEntry,
  buildVoidEntry,
  cloneEntries,
  LedgerValidationError,
  remainingChargeValueCents,
  sumMethodTotals,
} from "./ledger";
import { buildDailyReport } from "./daily-report";

test("normal cash and card charges reconstruct daily totals", () => {
  const createdAt = "2026-08-03T15:00:00.000Z";
  const cash = buildChargeEntry(
    {
      visitId: "v1",
      attendeeId: "a1",
      method: "cash",
      amountCents: 700,
      createdByStaffId: "owner",
    },
    "p1",
    createdAt,
  );
  const card = buildChargeEntry(
    {
      visitId: "v1",
      attendeeId: "a2",
      method: "card",
      amountCents: 1000,
      createdByStaffId: "owner",
    },
    "p2",
    createdAt,
  );
  const totals = sumMethodTotals([cash, card]);
  assert.equal(totals.cashTotalCents, 700);
  assert.equal(totals.cardTotalCents, 1000);
  assert.equal(totals.combinedTotalCents, 1700);
});

test("cash-to-card correction preserves original charge", () => {
  const createdAt = "2026-08-03T15:00:00.000Z";
  const original = buildChargeEntry(
    {
      visitId: "v1",
      attendeeId: "a1",
      method: "cash",
      amountCents: 700,
      createdByStaffId: "owner",
    },
    "p1",
    createdAt,
  );
  const before = cloneEntries([original]);
  const corrections = buildMethodCorrectionEntries(
    {
      visitId: "v1",
      relatedEntryId: "p1",
      fromMethod: "cash",
      toMethod: "card",
      amountCents: 700,
      reason: "Customer switched to card",
      createdByStaffId: "owner",
    },
    [original],
    { debitId: "c1", creditId: "c2" },
    createdAt,
  );
  assert.deepEqual(original, before[0]);
  const totals = sumMethodTotals([original, ...corrections]);
  assert.equal(totals.cashTotalCents, 0);
  assert.equal(totals.cardTotalCents, 700);
  assert.equal(totals.correctionCount, 1);
});

test("card-to-cash correction preserves original charge", () => {
  const createdAt = "2026-08-03T15:00:00.000Z";
  const original = buildChargeEntry(
    {
      visitId: "v1",
      attendeeId: "a1",
      method: "card",
      amountCents: 1000,
      createdByStaffId: "owner",
    },
    "p1",
    createdAt,
  );
  const corrections = buildMethodCorrectionEntries(
    {
      visitId: "v1",
      relatedEntryId: "p1",
      fromMethod: "card",
      toMethod: "cash",
      amountCents: 1000,
      reason: "Card declined; paid cash",
      createdByStaffId: "owner",
    },
    [original],
    { debitId: "c1", creditId: "c2" },
    createdAt,
  );
  const totals = sumMethodTotals([original, ...corrections]);
  assert.equal(totals.cashTotalCents, 1000);
  assert.equal(totals.cardTotalCents, 0);
});

test("removed attendee void and rare refund keep originals unchanged", () => {
  const createdAt = "2026-08-03T15:00:00.000Z";
  const original = buildChargeEntry(
    {
      visitId: "v1",
      attendeeId: "a1",
      method: "cash",
      amountCents: 700,
      createdByStaffId: "owner",
    },
    "p1",
    createdAt,
  );
  const snapshot = cloneEntries([original]);
  const voidEntry = buildVoidEntry(
    {
      visitId: "v1",
      relatedEntryId: "p1",
      reason: "Attendee left before play",
      createdByStaffId: "owner",
      attendeeId: "a1",
    },
    [original],
    "v1-entry",
    createdAt,
  );
  const refundable = buildChargeEntry(
    {
      visitId: "v1",
      attendeeId: "a2",
      method: "card",
      amountCents: 1000,
      createdByStaffId: "owner",
    },
    "p2",
    createdAt,
  );
  const refund = buildRefundEntry(
    {
      visitId: "v1",
      relatedEntryId: "p2",
      method: "card",
      amountCents: 1000,
      reason: "Rare goodwill refund",
      createdByStaffId: "owner",
    },
    [refundable],
    "r1",
    createdAt,
  );

  assert.deepEqual(original, snapshot[0]);
  const totals = sumMethodTotals([original, voidEntry, refundable, refund]);
  assert.equal(totals.combinedTotalCents, 0);
  assert.equal(totals.voidCount, 1);
  assert.equal(totals.refundCount, 1);
});

test("daily report counts classifications and ledger adjustments", () => {
  const report = buildDailyReport("2026-08-03", [
    {
      id: "v1",
      visitDate: "2026-08-03",
      businessDayYmd: "2026-08-03",
      status: "open",
      notes: null,
      createdAt: "2026-08-03T15:00:00.000Z",
      attendees: [
        {
          id: "a1",
          visitId: "v1",
          classification: "child_2_or_under",
          unitPriceCents: 700,
          status: "active",
        },
        {
          id: "a2",
          visitId: "v1",
          classification: "child_3_plus",
          unitPriceCents: 1000,
          status: "active",
        },
        {
          id: "a3",
          visitId: "v1",
          classification: "playing_adult",
          unitPriceCents: 700,
          status: "active",
        },
        {
          id: "a4",
          visitId: "v1",
          classification: "watching_adult",
          unitPriceCents: 0,
          status: "active",
        },
      ],
      payments: [
        {
          id: "p1",
          visitId: "v1",
          attendeeId: "a1",
          entryType: "charge",
          method: "cash",
          amountCents: 700,
          relatedEntryId: null,
          reason: null,
          createdByStaffId: "owner",
          createdAt: "2026-08-03T15:00:00.000Z",
        },
        {
          id: "p2",
          visitId: "v1",
          attendeeId: "a2",
          entryType: "charge",
          method: "card",
          amountCents: 1000,
          relatedEntryId: null,
          reason: null,
          createdByStaffId: "owner",
          createdAt: "2026-08-03T15:00:00.000Z",
        },
        {
          id: "p3",
          visitId: "v1",
          attendeeId: "a3",
          entryType: "charge",
          method: "cash",
          amountCents: 700,
          relatedEntryId: null,
          reason: null,
          createdByStaffId: "owner",
          createdAt: "2026-08-03T15:00:00.000Z",
        },
      ],
    },
  ]);

  assert.equal(report.cashTotalCents, 1400);
  assert.equal(report.cardTotalCents, 1000);
  assert.equal(report.combinedTotalCents, 2400);
  assert.equal(report.childrenAge2OrYounger, 1);
  assert.equal(report.childrenAge3OrOlder, 1);
  assert.equal(report.playingAdults, 1);
  assert.equal(report.watchingAdults, 1);
  assert.equal(report.paidAttendance, 3);
  assert.equal(report.totalAttendance, 4);
});

test("repeated void is rejected", () => {
  const createdAt = "2026-08-03T15:00:00.000Z";
  const original = buildChargeEntry(
    {
      visitId: "v1",
      attendeeId: "a1",
      method: "cash",
      amountCents: 700,
      createdByStaffId: "owner",
    },
    "p1",
    createdAt,
  );
  const voidEntry = buildVoidEntry(
    {
      visitId: "v1",
      relatedEntryId: "p1",
      reason: "first void",
      createdByStaffId: "owner",
    },
    [original],
    "v1",
    createdAt,
  );
  assert.throws(
    () =>
      buildVoidEntry(
        {
          visitId: "v1",
          relatedEntryId: "p1",
          reason: "second void",
          createdByStaffId: "owner",
        },
        [original, voidEntry],
        "v2",
        createdAt,
      ),
    LedgerValidationError,
  );
});

test("repeated method correction is rejected", () => {
  const createdAt = "2026-08-03T15:00:00.000Z";
  const original = buildChargeEntry(
    {
      visitId: "v1",
      attendeeId: "a1",
      method: "cash",
      amountCents: 700,
      createdByStaffId: "owner",
    },
    "p1",
    createdAt,
  );
  const first = buildMethodCorrectionEntries(
    {
      visitId: "v1",
      relatedEntryId: "p1",
      fromMethod: "cash",
      toMethod: "card",
      amountCents: 700,
      reason: "switch",
      createdByStaffId: "owner",
    },
    [original],
    { debitId: "c1", creditId: "c2" },
    createdAt,
  );
  assert.throws(
    () =>
      buildMethodCorrectionEntries(
        {
          visitId: "v1",
          relatedEntryId: "p1",
          fromMethod: "cash",
          toMethod: "card",
          amountCents: 700,
          reason: "again",
          createdByStaffId: "owner",
        },
        [original, ...first],
        { debitId: "c3", creditId: "c4" },
        createdAt,
      ),
    LedgerValidationError,
  );
});

test("cumulative refunds and refund/void ordering rules", () => {
  const createdAt = "2026-08-03T15:00:00.000Z";
  const original = buildChargeEntry(
    {
      visitId: "v1",
      attendeeId: "a1",
      method: "card",
      amountCents: 1000,
      createdByStaffId: "owner",
    },
    "p1",
    createdAt,
  );
  const firstRefund = buildRefundEntry(
    {
      visitId: "v1",
      relatedEntryId: "p1",
      method: "card",
      amountCents: 400,
      reason: "partial",
      createdByStaffId: "owner",
    },
    [original],
    "r1",
    createdAt,
  );
  assert.equal(remainingChargeValueCents([original, firstRefund], "p1"), 600);
  const secondRefund = buildRefundEntry(
    {
      visitId: "v1",
      relatedEntryId: "p1",
      method: "card",
      amountCents: 600,
      reason: "remainder",
      createdByStaffId: "owner",
    },
    [original, firstRefund],
    "r2",
    createdAt,
  );
  assert.equal(remainingChargeValueCents([original, firstRefund, secondRefund], "p1"), 0);
  assert.throws(
    () =>
      buildRefundEntry(
        {
          visitId: "v1",
          relatedEntryId: "p1",
          method: "card",
          amountCents: 1,
          reason: "too much",
          createdByStaffId: "owner",
        },
        [original, firstRefund, secondRefund],
        "r3",
        createdAt,
      ),
    LedgerValidationError,
  );
  assert.throws(
    () =>
      buildVoidEntry(
        {
          visitId: "v1",
          relatedEntryId: "p1",
          reason: "after refund",
          createdByStaffId: "owner",
        },
        [original, firstRefund],
        "v1",
        createdAt,
      ),
    LedgerValidationError,
  );

  const voidable = buildChargeEntry(
    {
      visitId: "v1",
      attendeeId: "a2",
      method: "cash",
      amountCents: 700,
      createdByStaffId: "owner",
    },
    "p2",
    createdAt,
  );
  const voided = buildVoidEntry(
    {
      visitId: "v1",
      relatedEntryId: "p2",
      reason: "void first",
      createdByStaffId: "owner",
    },
    [voidable],
    "vv",
    createdAt,
  );
  assert.throws(
    () =>
      buildRefundEntry(
        {
          visitId: "v1",
          relatedEntryId: "p2",
          method: "cash",
          amountCents: 100,
          reason: "after void",
          createdByStaffId: "owner",
        },
        [voidable, voided],
        "rr",
        createdAt,
      ),
    LedgerValidationError,
  );
});

test("incorrect refund payment method is rejected", () => {
  const createdAt = "2026-08-03T15:00:00.000Z";
  const original = buildChargeEntry(
    {
      visitId: "v1",
      attendeeId: "a1",
      method: "cash",
      amountCents: 700,
      createdByStaffId: "owner",
    },
    "p1",
    createdAt,
  );
  assert.throws(
    () =>
      buildRefundEntry(
        {
          visitId: "v1",
          relatedEntryId: "p1",
          method: "card",
          amountCents: 700,
          reason: "wrong method",
          createdByStaffId: "owner",
        },
        [original],
        "r1",
        createdAt,
      ),
    LedgerValidationError,
  );
});

test("daily report marks paidAttendance basis and counts logical corrections", () => {
  const createdAt = "2026-08-03T15:00:00.000Z";
  const charge = buildChargeEntry(
    {
      visitId: "v1",
      attendeeId: "a1",
      method: "cash",
      amountCents: 700,
      createdByStaffId: "owner",
    },
    "p1",
    createdAt,
  );
  const corrections = buildMethodCorrectionEntries(
    {
      visitId: "v1",
      relatedEntryId: "p1",
      fromMethod: "cash",
      toMethod: "card",
      amountCents: 700,
      reason: "switch",
      createdByStaffId: "owner",
    },
    [charge],
    { debitId: "c1", creditId: "c2" },
    createdAt,
  );
  const report = buildDailyReport("2026-08-03", [
    {
      id: "v1",
      visitDate: "2026-08-03",
      businessDayYmd: "2026-08-03",
      status: "open",
      notes: null,
      createdAt,
      attendees: [
        {
          id: "a1",
          visitId: "v1",
          classification: "child_2_or_under",
          unitPriceCents: 700,
          status: "active",
        },
      ],
      payments: [charge, ...corrections],
    },
  ]);
  assert.equal(report.corrections, 1);
  assert.equal(report.paidAttendanceBasis, "net_retained_admission_payment");
  assert.equal(report.paidAttendance, 1);
});


test("fully refunded attendee is not paid attendance; removed and voided excluded", () => {
  const createdAt = "2026-08-03T15:00:00.000Z";
  const charge = buildChargeEntry(
    {
      visitId: "v1",
      attendeeId: "a1",
      method: "cash",
      amountCents: 700,
      createdByStaffId: "owner",
    },
    "p1",
    createdAt,
  );
  const refund = buildRefundEntry(
    {
      visitId: "v1",
      relatedEntryId: "p1",
      method: "cash",
      amountCents: 700,
      reason: "full refund",
      createdByStaffId: "owner",
    },
    [charge],
    "r1",
    createdAt,
  );
  const report = buildDailyReport("2026-08-03", [
    {
      id: "v1",
      visitDate: "2026-08-03",
      businessDayYmd: "2026-08-03",
      status: "open",
      notes: null,
      createdAt,
      attendees: [
        {
          id: "a1",
          visitId: "v1",
          classification: "child_2_or_under",
          unitPriceCents: 700,
          status: "active",
        },
        {
          id: "a2",
          visitId: "v1",
          classification: "watching_adult",
          unitPriceCents: 0,
          status: "active",
        },
        {
          id: "a3",
          visitId: "v1",
          classification: "playing_adult",
          unitPriceCents: 700,
          status: "removed",
        },
      ],
      payments: [charge, refund],
    },
    {
      id: "v2",
      visitDate: "2026-08-03",
      businessDayYmd: "2026-08-03",
      status: "voided",
      notes: null,
      createdAt,
      attendees: [
        {
          id: "a9",
          visitId: "v2",
          classification: "child_3_plus",
          unitPriceCents: 1000,
          status: "active",
        },
      ],
      payments: [],
    },
  ]);
  assert.equal(report.totalAttendance, 2);
  assert.equal(report.paidAttendance, 0);
  assert.equal(report.watchingAdults, 1);
  assert.equal(report.paidAttendanceBasis, "net_retained_admission_payment");
});

test("multiple partial refunds count as separate refund operations", () => {
  const createdAt = "2026-08-03T15:00:00.000Z";
  const charge = buildChargeEntry(
    {
      visitId: "v1",
      attendeeId: "a1",
      method: "card",
      amountCents: 1000,
      createdByStaffId: "owner",
    },
    "p1",
    createdAt,
  );
  const r1 = buildRefundEntry(
    {
      visitId: "v1",
      relatedEntryId: "p1",
      method: "card",
      amountCents: 400,
      reason: "partial 1",
      createdByStaffId: "owner",
    },
    [charge],
    "r1",
    createdAt,
  );
  const r2 = buildRefundEntry(
    {
      visitId: "v1",
      relatedEntryId: "p1",
      method: "card",
      amountCents: 300,
      reason: "partial 2",
      createdByStaffId: "owner",
    },
    [charge, r1],
    "r2",
    createdAt,
  );
  const totals = sumMethodTotals([charge, r1, r2]);
  assert.equal(totals.refundCount, 2);
  assert.equal(totals.cardTotalCents, 300);
  const report = buildDailyReport("2026-08-03", [
    {
      id: "v1",
      visitDate: "2026-08-03",
      businessDayYmd: "2026-08-03",
      status: "open",
      notes: null,
      createdAt,
      attendees: [
        {
          id: "a1",
          visitId: "v1",
          classification: "child_3_plus",
          unitPriceCents: 1000,
          status: "active",
        },
      ],
      payments: [charge, r1, r2],
    },
  ]);
  assert.equal(report.paidAttendance, 1);
  assert.equal(report.refunds, 2);
});
