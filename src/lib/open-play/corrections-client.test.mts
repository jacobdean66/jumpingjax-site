import assert from "node:assert/strict";
import test from "node:test";

import type { PaymentEntry } from "./ledger";
import {
  ambiguousNetworkFailure,
  buildCorrectionsUrl,
  buildDailyReportUrl,
  buildMethodCorrectionPayload,
  buildRefundPayload,
  buildRemoveAttendeePayload,
  buildVoidPayload,
  beginCorrectionMutation,
  beginReportRequest,
  canBrowseVisitsAndDates,
  canSelectVisitFromCachedReport,
  canStartPostMutationReload,
  canSubmitCorrection,
  chargeActionBlockedReason,
  createCorrectionsGateState,
  dollarsInputToCents,
  entryTypeLabel,
  fetchVisitsForBusinessDay,
  formatCents,
  formatSignedCents,
  isOriginalEntry,
  isValidDailyReportForCorrections,
  isVisitUuid,
  listOriginalCharges,
  mapCorrectionApiError,
  malformedReportError,
  malformedSuccessError,
  normalizeYmd,
  parsePaymentEntryRow,
  parsePaymentMethodChoice,
  postVisitCorrection,
  resolveReportRequest,
  selectVisitFromCachedReport,
  settleCorrectionMutation,
  shouldShowMutationForVisit,
  sortLedgerEntries,
  toChargeActionView,
} from "./corrections-client";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function charge(overrides: Partial<PaymentEntry> & Pick<PaymentEntry, "id">): PaymentEntry {
  return {
    visitId: "11111111-1111-4111-8111-111111111111",
    attendeeId: "22222222-2222-4222-8222-222222222222",
    entryType: "charge",
    method: "cash",
    amountCents: 1700,
    relatedEntryId: null,
    reason: null,
    createdByStaffId: "owner",
    createdAt: "2026-08-06T14:00:00.000Z",
    ...overrides,
  };
}

test("normalizeYmd and visit UUID helpers", () => {
  assert.equal(normalizeYmd("2026-08-06"), "2026-08-06");
  assert.equal(normalizeYmd("bad"), null);
  assert.equal(isVisitUuid("11111111-1111-4111-8111-111111111111"), true);
  assert.equal(isVisitUuid("not-a-uuid"), false);
});

test("URL builders use GET report and POST corrections paths", () => {
  assert.equal(
    buildDailyReportUrl("2026-08-06"),
    "/api/admin/open-play/daily-report?date=2026-08-06",
  );
  assert.equal(
    buildCorrectionsUrl("11111111-1111-4111-8111-111111111111"),
    "/api/admin/open-play/visits/11111111-1111-4111-8111-111111111111/corrections",
  );
  assert.equal(
    buildCorrectionsUrl(
      "11111111-1111-4111-8111-111111111111",
      "legacy_smartwaiver",
    ),
    "/api/admin/open-play/legacy-visits/11111111-1111-4111-8111-111111111111/corrections",
  );
  assert.throws(() => buildCorrectionsUrl("bad"), /UUID/);
});

test("cash/card validation rejects unsupported methods", () => {
  assert.equal(parsePaymentMethodChoice("cash"), "cash");
  assert.equal(parsePaymentMethodChoice("card"), "card");
  assert.equal(parsePaymentMethodChoice("venmo"), null);
  assert.throws(
    () =>
      buildRefundPayload({
        relatedEntryId: "c1",
        method: "venmo" as "cash",
        amountCents: 100,
        reason: "x",
      }),
    /cash or card/i,
  );
});

test("payload builders map correction, refund, void, and removal", () => {
  const method = buildMethodCorrectionPayload({
    relatedEntryId: "c1",
    fromMethod: "cash",
    toMethod: "card",
    amountCents: 1700,
    reason: "switched",
    attendeeId: null,
  });
  assert.equal(method.type, "method_correction");
  assert.equal(method.fromMethod, "cash");
  assert.equal(method.toMethod, "card");
  assert.equal(method.attendeeId, null);

  const refund = buildRefundPayload({
    relatedEntryId: "c1",
    method: "card",
    amountCents: 500,
    reason: "left early",
    attendeeId: "a1",
  });
  assert.equal(refund.type, "refund");
  assert.equal(refund.amountCents, 500);
  assert.equal(refund.attendeeId, "a1");

  const voidPayload = buildVoidPayload({
    relatedEntryId: "c1",
    reason: "mistake",
    removeAttendeeId: "a1",
  });
  assert.equal(voidPayload.type, "void");
  assert.equal(voidPayload.removeAttendeeId, "a1");

  const remove = buildRemoveAttendeePayload({
    attendeeId: "a1",
    reason: "left",
    relatedEntryId: null,
  });
  assert.equal(remove.type, "remove_attendee");
  assert.equal(remove.relatedEntryId, null);
});

test("currency and ledger labeling", () => {
  assert.equal(formatCents(1700), "$17.00");
  assert.equal(formatSignedCents(-700), "−$7.00");
  assert.equal(entryTypeLabel("charge"), "Original charge");
  assert.equal(entryTypeLabel("correction"), "Payment-method correction");
  const entries = sortLedgerEntries([
    charge({ id: "p2", entryType: "refund", amountCents: -700, createdAt: "2026-08-06T16:00:00.000Z" }),
    charge({ id: "p1", createdAt: "2026-08-06T14:00:00.000Z" }),
  ]);
  assert.equal(entries[0]?.id, "p1");
  assert.equal(isOriginalEntry(entries[0]!), true);
  assert.equal(isOriginalEntry(entries[1]!), false);
  assert.equal(listOriginalCharges(entries).length, 1);
});

test("dollarsInputToCents and charge action hints", () => {
  assert.equal(dollarsInputToCents("7.00"), 700);
  assert.equal(dollarsInputToCents("0"), null);
  assert.equal(dollarsInputToCents("7.001"), null);
  const entries = [charge({ id: "c1", method: "cash", amountCents: 1700 })];
  const view = toChargeActionView(entries, entries[0]!);
  assert.equal(view.remainingCents, 1700);
  assert.equal(view.canCorrectMethod, true);
  assert.equal(view.canRefund, true);
  assert.equal(view.canVoid, true);
});

test("mapCorrectionApiError covers auth, forbidden, financial reversal, and refunds", () => {
  const auth = mapCorrectionApiError({
    status: 401,
    payload: { ok: false, code: "unauthorized" },
  });
  assert.equal(auth.requiresSignIn, true);

  const forbidden = mapCorrectionApiError({
    status: 403,
    payload: { ok: false, code: "forbidden" },
  });
  assert.equal(forbidden.forbidden, true);

  const reversal = mapCorrectionApiError({
    status: 400,
    payload: {
      ok: false,
      code: "ledger_validation",
      error: "Attendee removal requires financial reversal of remaining charges",
    },
  });
  assert.equal(reversal.financialReversalRequired, true);

  const exceed = mapCorrectionApiError({
    status: 400,
    payload: {
      ok: false,
      error: "Refund cannot exceed the remaining charge value",
    },
  });
  assert.equal(exceed.code, "refund_exceeds_remaining");

  assert.equal(ambiguousNetworkFailure().ambiguous, true);
  assert.equal(malformedSuccessError().ambiguous, true);
});

test("postVisitCorrection is POST-only and maps success identities", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(
      JSON.stringify({
        ok: true,
        entries: [
          {
            id: "adj-1",
            visitId: "11111111-1111-4111-8111-111111111111",
            attendeeId: null,
            entryType: "refund",
            method: "cash",
            amountCents: -700,
            relatedEntryId: "c1",
            reason: "partial",
            createdByStaffId: "owner",
            createdAt: "2026-08-06T16:00:00.000Z",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const result = await postVisitCorrection(
      "11111111-1111-4111-8111-111111111111",
      buildRefundPayload({
        relatedEntryId: "c1",
        method: "cash",
        amountCents: 700,
        reason: "partial",
      }),
    );
    assert.equal(result.ok, true);
    assert.equal(result.entries[0]?.attendeeId, null);
    assert.equal(result.entries[0]?.relatedEntryId, "c1");
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.init?.method, "POST");
    assert.match(String(calls[0]?.url), /\/corrections$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const VISIT_ID = "11111111-1111-4111-8111-111111111111";

function validSuccessRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "adj-1",
    visitId: VISIT_ID,
    attendeeId: null,
    entryType: "refund",
    method: "cash",
    amountCents: -700,
    relatedEntryId: "c1",
    reason: "partial",
    createdByStaffId: "owner",
    createdAt: "2026-08-06T16:00:00.000Z",
    ...overrides,
  };
}

function mockFetchJson(payload: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
}

test("parsePaymentEntryRow enforces the PaymentEntry contract strictly", () => {
  assert.notEqual(parsePaymentEntryRow(validSuccessRow()), null);

  const malformedRows: Array<[string, Record<string, unknown>]> = [
    ["empty id", validSuccessRow({ id: "" })],
    ["missing id", validSuccessRow({ id: undefined })],
    ["empty visitId", validSuccessRow({ visitId: "" })],
    ["unsupported entryType", validSuccessRow({ entryType: "tip" })],
    ["unsupported method", validSuccessRow({ method: "venmo" })],
    ["string amountCents", validSuccessRow({ amountCents: "-700" })],
    ["fractional amountCents", validSuccessRow({ amountCents: -700.5 })],
    ["empty-string attendeeId", validSuccessRow({ attendeeId: "" })],
    ["numeric attendeeId", validSuccessRow({ attendeeId: 42 })],
    ["empty-string relatedEntryId", validSuccessRow({ relatedEntryId: "" })],
    ["numeric reason", validSuccessRow({ reason: 7 })],
    ["missing createdByStaffId", validSuccessRow({ createdByStaffId: undefined })],
    ["empty createdAt", validSuccessRow({ createdAt: "" })],
  ];
  for (const [label, row] of malformedRows) {
    assert.equal(parsePaymentEntryRow(row), null, `expected malformed: ${label}`);
  }

  assert.equal(parsePaymentEntryRow(null), null);
  assert.equal(parsePaymentEntryRow([validSuccessRow()]), null);
  assert.equal(
    parsePaymentEntryRow(validSuccessRow(), { expectedVisitId: "99999999-9999-4999-8999-999999999999" }),
    null,
    "expected malformed: visitId mismatch",
  );
});

test("postVisitCorrection rejects each malformed success row and forces the reload gate", async () => {
  const originalFetch = globalThis.fetch;
  const malformedPayloads: unknown[] = [
    { ok: true, entries: [validSuccessRow({ entryType: "tip" })] },
    { ok: true, entries: [validSuccessRow({ method: "venmo" })] },
    { ok: true, entries: [validSuccessRow({ amountCents: "700" })] },
    { ok: true, entries: [validSuccessRow({ id: "" })] },
    { ok: true, entries: [validSuccessRow({ createdAt: null })] },
    { ok: true, entries: [validSuccessRow({ visitId: "99999999-9999-4999-8999-999999999999" })] },
    { ok: true, entries: [validSuccessRow(), validSuccessRow({ attendeeId: "" })] },
  ];
  try {
    for (const payload of malformedPayloads) {
      globalThis.fetch = mockFetchJson(payload);
      await assert.rejects(
        () =>
          postVisitCorrection(
            VISIT_ID,
            buildRefundPayload({
              relatedEntryId: "c1",
              method: "cash",
              amountCents: 700,
              reason: "partial",
            }),
          ),
        (error: unknown) => {
          const mapped = error as { code?: string; ambiguous?: boolean };
          return mapped.code === "malformed_success" && mapped.ambiguous === true;
        },
        `expected malformed_success for ${JSON.stringify(payload)}`,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("postVisitCorrection preserves legitimate null identity fields", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetchJson({
    ok: true,
    entries: [
      validSuccessRow({ attendeeId: null, relatedEntryId: null, reason: null }),
    ],
  });
  try {
    const result = await postVisitCorrection(
      VISIT_ID,
      buildVoidPayload({ relatedEntryId: "c1", reason: "mistake" }),
    );
    assert.equal(result.ok, true);
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0]?.attendeeId, null);
    assert.equal(result.entries[0]?.relatedEntryId, null);
    assert.equal(result.entries[0]?.reason, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function validReportVisit(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    visitId: VISIT_ID,
    status: "open",
    notes: null,
    createdAt: "2026-08-06T14:00:00.000Z",
    attendees: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        visitId: VISIT_ID,
        classification: "child_3_plus",
        unitPriceCents: 1700,
        status: "active",
      },
    ],
    payments: [validSuccessRow({ id: "c1", entryType: "charge", amountCents: 1700, relatedEntryId: null, reason: null, attendeeId: "22222222-2222-4222-8222-222222222222" })],
    cashTotalCents: 1700,
    cardTotalCents: 0,
    combinedTotalCents: 1700,
    ...overrides,
  };
}

test("daily-report validation accepts valid reports and rejects malformed shapes", () => {
  assert.equal(
    isValidDailyReportForCorrections({ visits: [validReportVisit()] }),
    true,
  );
  assert.equal(isValidDailyReportForCorrections({ visits: [] }), true);

  const malformedReports: Array<[string, unknown]> = [
    ["report not object", "nope"],
    ["visits not array", { visits: "nope" }],
    ["visit missing visitId", { visits: [validReportVisit({ visitId: "" })] }],
    ["visit invalid status", { visits: [validReportVisit({ status: "paused" })] }],
    ["visit NaN totals", { visits: [validReportVisit({ combinedTotalCents: "1700" })] }],
    ["attendee invalid status", {
      visits: [validReportVisit({
        attendees: [{ id: "a1", classification: "child_3_plus", unitPriceCents: 1700, status: "gone" }],
      })],
    }],
    ["attendee non-integer price", {
      visits: [validReportVisit({
        attendees: [{ id: "a1", classification: "child_3_plus", unitPriceCents: "1700", status: "active" }],
      })],
    }],
    ["payment row malformed", {
      visits: [validReportVisit({ payments: [validSuccessRow({ method: "venmo" })] })],
    }],
    ["payments not array", { visits: [validReportVisit({ payments: null })] }],
  ];
  for (const [label, report] of malformedReports) {
    assert.equal(
      isValidDailyReportForCorrections(report),
      false,
      `expected malformed report: ${label}`,
    );
  }
});

test("fetchVisitsForBusinessDay maps valid reports and fails safely on malformed ok:true data", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = mockFetchJson({ ok: true, report: { visits: [validReportVisit()] } });
  try {
    const report = await fetchVisitsForBusinessDay("2026-08-06");
    assert.equal(report.visits.length, 1);
    assert.equal(report.visits[0]?.visitId, VISIT_ID);
    assert.equal(report.visits[0]?.payments[0]?.amountCents, 1700);
  } finally {
    globalThis.fetch = originalFetch;
  }

  globalThis.fetch = mockFetchJson({
    ok: true,
    report: { visits: [validReportVisit({ payments: [validSuccessRow({ amountCents: "oops" })] })] },
  });
  try {
    await assert.rejects(
      () => fetchVisitsForBusinessDay("2026-08-06"),
      (error: unknown) => {
        const mapped = error as { code?: string; message?: string };
        return (
          mapped.code === "malformed_report" &&
          mapped.message === malformedReportError().message
        );
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("chargeActionBlockedReason enforces eligibility after correction, refund, and void", () => {
  const base = charge({ id: "c1", method: "cash", amountCents: 1700 });

  const fresh = toChargeActionView([base], base);
  assert.equal(chargeActionBlockedReason(fresh, "method"), null);
  assert.equal(chargeActionBlockedReason(fresh, "refund"), null);
  assert.equal(chargeActionBlockedReason(fresh, "void"), null);

  const corrected = [
    base,
    charge({ id: "d1", entryType: "correction", method: "cash", amountCents: -1700, relatedEntryId: "c1", createdAt: "2026-08-06T15:00:00.000Z" }),
    charge({ id: "d2", entryType: "correction", method: "card", amountCents: 1700, relatedEntryId: "c1", createdAt: "2026-08-06T15:00:00.000Z" }),
  ];
  const correctedView = toChargeActionView(corrected, base);
  assert.equal(correctedView.canCorrectMethod, false);
  assert.match(chargeActionBlockedReason(correctedView, "method") ?? "", /already been corrected/i);
  assert.equal(chargeActionBlockedReason(correctedView, "refund"), null);
  assert.equal(chargeActionBlockedReason(correctedView, "void"), null);

  const partiallyRefunded = [
    base,
    charge({ id: "r1", entryType: "refund", amountCents: -700, relatedEntryId: "c1", createdAt: "2026-08-06T15:00:00.000Z" }),
  ];
  const refundedView = toChargeActionView(partiallyRefunded, base);
  assert.match(chargeActionBlockedReason(refundedView, "method") ?? "", /after refunds/i);
  assert.equal(chargeActionBlockedReason(refundedView, "refund"), null);
  assert.match(chargeActionBlockedReason(refundedView, "void") ?? "", /after refunds/i);

  const fullyRefunded = [
    base,
    charge({ id: "r1", entryType: "refund", amountCents: -1700, relatedEntryId: "c1", createdAt: "2026-08-06T15:00:00.000Z" }),
  ];
  const fullyRefundedView = toChargeActionView(fullyRefunded, base);
  assert.match(chargeActionBlockedReason(fullyRefundedView, "refund") ?? "", /no remaining/i);

  const voided = [
    base,
    charge({ id: "v1", entryType: "void", amountCents: -1700, relatedEntryId: "c1", createdAt: "2026-08-06T15:00:00.000Z" }),
  ];
  const voidedView = toChargeActionView(voided, base);
  assert.match(chargeActionBlockedReason(voidedView, "method") ?? "", /voided/i);
  assert.match(chargeActionBlockedReason(voidedView, "refund") ?? "", /voided/i);
  assert.match(chargeActionBlockedReason(voidedView, "void") ?? "", /already voided/i);
});

test("canSubmitCorrection blocks duplicate submits and pre-reload retries", () => {
  assert.equal(canSubmitCorrection({ submitting: false, needsReload: false }), true);
  assert.equal(canSubmitCorrection({ submitting: true, needsReload: false }), false);
  assert.equal(canSubmitCorrection({ submitting: false, needsReload: true }), false);
  assert.equal(canSubmitCorrection({ submitting: true, needsReload: true }), false);
});

const VISIT_A = "11111111-1111-4111-8111-111111111111";
const VISIT_B = "22222222-2222-4222-8222-222222222222";

test("corrections gate: successful correction arms reload; selections cannot clear it", () => {
  let gate = createCorrectionsGateState({ selectedVisitId: VISIT_A });
  gate = beginCorrectionMutation(gate, VISIT_A);
  assert.equal(gate.submitting, true);
  assert.equal(gate.mutationVisitId, VISIT_A);
  assert.equal(canSubmitCorrection(gate), false);
  assert.equal(canBrowseVisitsAndDates(gate), false);

  gate = settleCorrectionMutation(gate, "success");
  assert.equal(gate.submitting, false);
  assert.equal(gate.needsReload, true);
  assert.equal(gate.mutationEpoch, 1);
  assert.equal(canSubmitCorrection(gate), false);

  const sameVisit = selectVisitFromCachedReport(gate, VISIT_A);
  assert.equal(sameVisit.needsReload, true);
  assert.equal(sameVisit.selectedVisitId, VISIT_A);
  assert.equal(sameVisit, gate, "same-visit reselection is a no-op while gated");

  const otherVisit = selectVisitFromCachedReport(gate, VISIT_B);
  assert.equal(otherVisit, gate, "other-visit cached selection cannot bypass reload");
  assert.equal(otherVisit.needsReload, true);

  const manualUuid = selectVisitFromCachedReport(gate, VISIT_B);
  assert.equal(manualUuid.needsReload, true);
  assert.equal(canSelectVisitFromCachedReport(gate), false);
});

test("corrections gate: stale browse GET cannot clear a newer mutation reload requirement", () => {
  let gate = createCorrectionsGateState({ selectedVisitId: VISIT_A });

  const browse = beginReportRequest(gate, { kind: "browse", nextRequestId: 1 });
  assert.ok(browse);
  assert.equal(browse.request.startedAtEpoch, 0);

  gate = beginCorrectionMutation(gate, VISIT_A);
  gate = settleCorrectionMutation(gate, "success");
  assert.equal(gate.needsReload, true);
  assert.equal(gate.mutationEpoch, 1);

  // Older browse (started at epoch 0) resolves after mutation epoch advanced.
  const stale = resolveReportRequest(gate, browse.request, 1);
  assert.equal(stale.action, "discard_stale_browse");
  if (stale.action === "discard_stale_browse") {
    assert.equal(stale.state.needsReload, true);
    assert.equal(stale.state.mutationEpoch, 1);
  }

  // Browse started during/after gate is refused entirely.
  assert.equal(
    beginReportRequest(gate, { kind: "browse", nextRequestId: 2 }),
    null,
  );
});

test("corrections gate: only a fresh post-mutation reload started after settle clears the gate", () => {
  let gate = createCorrectionsGateState({ selectedVisitId: VISIT_A });
  gate = beginCorrectionMutation(gate, VISIT_A);
  gate = settleCorrectionMutation(gate, "success");
  assert.equal(gate.needsReload, true);
  assert.equal(gate.mutationEpoch, 1);

  const reload = beginReportRequest(gate, {
    kind: "post_mutation_reload",
    nextRequestId: 9,
  });
  assert.ok(reload);
  assert.equal(reload.request.startedAtEpoch, 1);

  const applied = resolveReportRequest(gate, reload.request, 9);
  assert.equal(applied.action, "apply");
  if (applied.action === "apply") {
    assert.equal(applied.state.needsReload, false);
    assert.equal(canSubmitCorrection(applied.state), true);
  }

  // A reload handle from an older epoch must not clear a newer gate.
  const gated = createCorrectionsGateState({
    selectedVisitId: VISIT_A,
    needsReload: true,
    mutationEpoch: 2,
  });
  const staleReload = resolveReportRequest(
    gated,
    { requestId: 3, kind: "post_mutation_reload", startedAtEpoch: 1 },
    3,
  );
  assert.equal(staleReload.action, "ignore");
});

test("corrections gate: ambiguous outcome stays gated until fresh reload", () => {
  let gate = createCorrectionsGateState({ selectedVisitId: VISIT_A });
  gate = beginCorrectionMutation(gate, VISIT_A);
  gate = settleCorrectionMutation(gate, "ambiguous");
  assert.equal(gate.needsReload, true);
  assert.equal(gate.mutationEpoch, 1);
  assert.equal(canSubmitCorrection(gate), false);
  assert.equal(canBrowseVisitsAndDates(gate), false);
  assert.equal(canStartPostMutationReload(gate), true);

  const reload = beginReportRequest(gate, {
    kind: "post_mutation_reload",
    nextRequestId: 4,
  });
  assert.ok(reload);
  const cleared = resolveReportRequest(gate, reload.request, 4);
  assert.equal(cleared.action, "apply");
  if (cleared.action === "apply") {
    assert.equal(cleared.state.needsReload, false);
  }
});

test("corrections gate: mutation result stays tied to posted visit during selection attempts", () => {
  let gate = createCorrectionsGateState({ selectedVisitId: VISIT_A });
  gate = beginCorrectionMutation(gate, VISIT_A);
  assert.equal(gate.mutationVisitId, VISIT_A);
  assert.equal(
    shouldShowMutationForVisit({
      mutationVisitId: gate.mutationVisitId,
      selectedVisitId: VISIT_A,
    }),
    true,
  );

  // Selection during POST is rejected; mutationVisitId remains A.
  const attempted = selectVisitFromCachedReport(gate, VISIT_B);
  assert.equal(attempted, gate);
  assert.equal(attempted.selectedVisitId, VISIT_A);
  assert.equal(attempted.mutationVisitId, VISIT_A);
  assert.equal(
    shouldShowMutationForVisit({
      mutationVisitId: attempted.mutationVisitId,
      selectedVisitId: attempted.selectedVisitId,
    }),
    true,
  );
  assert.equal(
    shouldShowMutationForVisit({
      mutationVisitId: VISIT_A,
      selectedVisitId: VISIT_B,
    }),
    false,
  );

  gate = settleCorrectionMutation(gate, "success");
  assert.equal(gate.mutationVisitId, VISIT_A);
  assert.equal(gate.needsReload, true);
});

test("CorrectionsClient wires the shared gate transitions (no cached pick clears reload)", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const clientPath = join(
    here,
    "..",
    "..",
    "app",
    "admin",
    "open-play-corrections",
    "CorrectionsClient.tsx",
  );
  const source = readFileSync(clientPath, "utf8");
  assert.match(source, /selectVisitFromCachedReport/);
  assert.match(source, /beginCorrectionMutation/);
  assert.match(source, /settleCorrectionMutation/);
  assert.match(source, /beginReportRequest/);
  assert.match(source, /resolveReportRequest/);
  assert.match(source, /shouldShowMutationForVisit/);
  assert.match(source, /cancelInFlightReportLoad/);
  assert.match(source, /loadKind:\s*"post_mutation_reload"/);
  assert.doesNotMatch(source, /setNeedsReload\(false\)/);
  assert.doesNotMatch(
    source,
    /selectVisitFromCachedReport[\s\S]{0,200}needsReload:\s*false/,
  );
});

test("postVisitCorrection rejects malformed success and maps network ambiguity", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
  try {
    await assert.rejects(
      () =>
        postVisitCorrection(
          "11111111-1111-4111-8111-111111111111",
          buildVoidPayload({ relatedEntryId: "c1", reason: "void" }),
        ),
      (error: unknown) => (error as { code?: string }).code === "malformed_success",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  globalThis.fetch = (async () => {
    throw new TypeError("Failed to fetch");
  }) as typeof fetch;
  try {
    await assert.rejects(
      () =>
        postVisitCorrection(
          "11111111-1111-4111-8111-111111111111",
          buildRemoveAttendeePayload({ attendeeId: "a1", reason: "gone" }),
        ),
      (error: unknown) => (error as { ambiguous?: boolean }).ambiguous === true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
