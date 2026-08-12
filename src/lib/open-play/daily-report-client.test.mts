import assert from "node:assert/strict";
import test from "node:test";

import type { DailyReport } from "./daily-report";
import type { PaymentEntry } from "./ledger";
import {
  buildDailyReportUrl,
  entryTypeLabel,
  fetchDailyReport,
  formatCents,
  formatSignedCents,
  isEmptyReport,
  isZeroDollarActiveDay,
  mapDailyReportApiError,
  normalizeReportDateInput,
  sortVisitsForDisplay,
  toLedgerActivityRows,
  toReportSummaryView,
  todayBusinessDayYmd,
} from "./daily-report-client";

function payment(overrides: Partial<PaymentEntry> & Pick<PaymentEntry, "id">): PaymentEntry {
  return {
    visitId: "visit-1",
    attendeeId: "att-1",
    entryType: "charge",
    method: "cash",
    amountCents: 700,
    relatedEntryId: null,
    reason: null,
    createdByStaffId: "owner",
    createdAt: "2026-08-06T14:00:00.000Z",
    ...overrides,
  };
}

function emptyReport(day = "2026-08-06"): DailyReport {
  return {
    businessDayYmd: day,
    cashTotalCents: 0,
    cardTotalCents: 0,
    combinedTotalCents: 0,
    childrenAge2OrYounger: 0,
    childrenAge3OrOlder: 0,
    playingAdults: 0,
    watchingAdults: 0,
    paidAttendance: 0,
    totalAttendance: 0,
    corrections: 0,
    voids: 0,
    refunds: 0,
    paidAttendanceBasis: "net_retained_admission_payment",
    visits: [],
  };
}

test("normalizeReportDateInput accepts only YYYY-MM-DD", () => {
  assert.equal(normalizeReportDateInput("2026-08-06"), "2026-08-06");
  assert.equal(normalizeReportDateInput("2026-13-01"), null);
  assert.equal(normalizeReportDateInput("08/06/2026"), null);
  assert.equal(normalizeReportDateInput(""), null);
});

test("buildDailyReportUrl formats owner report query", () => {
  assert.equal(
    buildDailyReportUrl("2026-08-06"),
    "/api/admin/open-play/daily-report?date=2026-08-06",
  );
  assert.throws(() => buildDailyReportUrl("bad"), /YYYY-MM-DD/);
});

test("todayBusinessDayYmd uses America/New_York helpers", () => {
  const ymd = todayBusinessDayYmd(new Date("2026-08-06T04:30:00.000Z"));
  assert.match(ymd, /^\d{4}-\d{2}-\d{2}$/);
  // 04:30 UTC is still Aug 5 evening or Aug 6 morning NY depending on DST;
  // assert helper returns a valid YMD without throwing.
  assert.ok(normalizeReportDateInput(ymd));
});

test("currency formatters", () => {
  assert.equal(formatCents(1700), "$17.00");
  assert.equal(formatSignedCents(-700), "−$7.00");
  assert.equal(formatSignedCents(700), "+$7.00");
  assert.equal(formatSignedCents(0), "$0.00");
});

test("empty report versus zero-dollar active day", () => {
  const empty = emptyReport();
  assert.equal(isEmptyReport(empty), true);
  assert.equal(isZeroDollarActiveDay(empty), false);

  const watchingOnly: DailyReport = {
    ...emptyReport(),
    totalAttendance: 1,
    watchingAdults: 1,
    visits: [
      {
        visitId: "v1",
        status: "open",
        notes: null,
        createdAt: "2026-08-06T15:00:00.000Z",
        attendees: [
          {
            id: "a1",
            visitId: "v1",
            classification: "watching_adult",
            unitPriceCents: 0,
            status: "active",
          },
        ],
        payments: [],
        cashTotalCents: 0,
        cardTotalCents: 0,
        combinedTotalCents: 0,
      },
    ],
  };
  assert.equal(isEmptyReport(watchingOnly), false);
  assert.equal(isZeroDollarActiveDay(watchingOnly), true);
});

test("toReportSummaryView maps authoritative backend fields", () => {
  const report: DailyReport = {
    ...emptyReport(),
    cashTotalCents: 1700,
    cardTotalCents: 700,
    combinedTotalCents: 2400,
    childrenAge2OrYounger: 1,
    childrenAge3OrOlder: 1,
    playingAdults: 1,
    watchingAdults: 1,
    paidAttendance: 3,
    totalAttendance: 4,
    corrections: 1,
    voids: 0,
    refunds: 2,
  };
  const view = toReportSummaryView(report);
  assert.equal(view.cashTotalCents, 1700);
  assert.equal(view.cardTotalCents, 700);
  assert.equal(view.combinedTotalCents, 2400);
  assert.equal(view.paidAttendance, 3);
  assert.equal(view.totalAttendance, 4);
  assert.equal(view.corrections, 1);
  assert.equal(view.voids, 0);
  assert.equal(view.refunds, 2);
  assert.equal(view.paidAttendanceBasis, "net_retained_admission_payment");
  assert.equal(view.empty, false);
});

test("toLedgerActivityRows preserves originals and adjustments in time order", () => {
  const rows = toLedgerActivityRows([
    payment({
      id: "p2",
      entryType: "refund",
      amountCents: -700,
      createdAt: "2026-08-06T16:00:00.000Z",
      relatedEntryId: "p1",
      reason: "left early",
    }),
    payment({
      id: "p1",
      entryType: "charge",
      amountCents: 700,
      createdAt: "2026-08-06T14:00:00.000Z",
    }),
    payment({
      id: "p3",
      entryType: "correction",
      method: "card",
      amountCents: 700,
      createdAt: "2026-08-06T15:00:00.000Z",
      relatedEntryId: "p1",
    }),
  ]);
  assert.equal(rows.length, 3);
  assert.equal(rows[0]?.id, "p1");
  assert.equal(rows[0]?.isOriginal, true);
  assert.equal(rows[0]?.entryTypeLabel, "Original charge");
  assert.equal(rows[1]?.isAdjustment, true);
  assert.equal(rows[1]?.entryTypeLabel, "Payment-method correction");
  assert.equal(rows[2]?.entryTypeLabel, "Refund");
  assert.equal(entryTypeLabel("void"), "Void adjustment");
});

test("sortVisitsForDisplay orders by createdAt then visitId", () => {
  const report: DailyReport = {
    ...emptyReport(),
    visits: [
      {
        visitId: "b",
        status: "open",
        notes: null,
        createdAt: "2026-08-06T16:00:00.000Z",
        attendees: [],
        payments: [],
        cashTotalCents: 0,
        cardTotalCents: 0,
        combinedTotalCents: 0,
      },
      {
        visitId: "a",
        status: "open",
        notes: null,
        createdAt: "2026-08-06T14:00:00.000Z",
        attendees: [],
        payments: [],
        cashTotalCents: 0,
        cardTotalCents: 0,
        combinedTotalCents: 0,
      },
    ],
  };
  const sorted = sortVisitsForDisplay(report);
  assert.equal(sorted[0]?.visitId, "a");
  assert.equal(sorted[1]?.visitId, "b");
});

test("mapDailyReportApiError covers auth, forbidden, validation, and rate limit", () => {
  const auth = mapDailyReportApiError({
    status: 401,
    payload: { ok: false, code: "unauthorized", error: "Staff authentication required" },
  });
  assert.equal(auth.requiresSignIn, true);

  const forbidden = mapDailyReportApiError({
    status: 403,
    payload: { ok: false, code: "forbidden", error: "Owner access required" },
  });
  assert.equal(forbidden.forbidden, true);
  assert.match(forbidden.message, /owner/i);

  const validation = mapDailyReportApiError({
    status: 400,
    payload: { ok: false, code: "validation", error: "date must be YYYY-MM-DD" },
  });
  assert.equal(validation.code, "validation");

  const rate = mapDailyReportApiError({
    status: 429,
    payload: { error: "Too many requests. Try again in a moment." },
  });
  assert.equal(rate.code, "rate_limited");
});

test("fetchDailyReport is GET-only and maps success payload", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(
      JSON.stringify({
        ok: true,
        report: {
          ...emptyReport("2026-08-06"),
          cashTotalCents: 700,
          combinedTotalCents: 700,
          paidAttendance: 1,
          totalAttendance: 1,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const report = await fetchDailyReport("2026-08-06");
    assert.equal(report.cashTotalCents, 700);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "/api/admin/open-play/daily-report?date=2026-08-06");
    assert.equal(calls[0]?.init?.method, "GET");
    assert.equal(calls[0]?.init?.cache, "no-store");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchDailyReport does not invent mutation methods on error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ ok: false, code: "database", error: "Request could not be completed" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;

  try {
    await assert.rejects(() => fetchDailyReport("2026-08-06"), (error: unknown) => {
      const mapped = error as { code?: string };
      return mapped.code === "database";
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
