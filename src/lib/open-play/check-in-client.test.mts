import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVisitCreateBody,
  canSubmitCheckInGroup,
  computeGroupTotalsPreview,
  formatCents,
  isAdultRole,
  mapStaffApiError,
  previewAdmissionPrice,
  resultToDraft,
  type SelectedAttendeeDraft,
  type StaffSearchResult,
} from "./check-in-client";

function childResult(
  overrides: Partial<StaffSearchResult> = {},
): StaffSearchResult {
  return {
    participantId: "p-child",
    submissionId: "s-1",
    firstName: "Ava",
    lastName: "Smith",
    fullName: "Ava Smith",
    birthYear: 2024,
    role: "child",
    expiresOnYmd: "2029-01-01",
    expired: false,
    signerLastInitial: "S",
    source: "native",
    checkInEligible: true,
    selectionKey: "p-child",
    ...overrides,
  };
}

function adultResult(
  overrides: Partial<StaffSearchResult> = {},
): StaffSearchResult {
  return {
    participantId: "p-adult",
    submissionId: "s-2",
    firstName: "Taylor",
    lastName: "Smith",
    fullName: "Taylor Smith",
    birthYear: 1990,
    role: "adult_signer",
    expiresOnYmd: "2029-01-01",
    expired: false,
    signerLastInitial: "S",
    source: "native",
    checkInEligible: true,
    selectionKey: "p-adult",
    ...overrides,
  };
}

test("preview child price is $7 when birth year cannot be 3+", () => {
  const preview = previewAdmissionPrice({
    role: "child",
    birthYear: 2024,
    visitDateYmd: "2026-08-06",
    adultMode: null,
  });
  assert.equal(preview.uncertain, false);
  assert.equal(preview.unitPriceCents, 700);
  assert.equal(preview.classification, "child_2_or_under");
});

test("preview child price is $10 when birth year cannot be 2 or under", () => {
  const preview = previewAdmissionPrice({
    role: "child",
    birthYear: 2020,
    visitDateYmd: "2026-08-06",
    adultMode: null,
  });
  assert.equal(preview.uncertain, false);
  assert.equal(preview.unitPriceCents, 1000);
  assert.equal(preview.classification, "child_3_plus");
});

test("preview child price is uncertain near age-3 boundary year", () => {
  const preview = previewAdmissionPrice({
    role: "child",
    birthYear: 2023,
    visitDateYmd: "2026-08-06",
    adultMode: null,
  });
  assert.equal(preview.uncertain, true);
  assert.equal(preview.unitPriceCents, null);
  assert.deepEqual(preview.possiblePricesCents, [700, 1000]);
});

test("playing adult previews $7 and watching adult is free", () => {
  const playing = previewAdmissionPrice({
    role: "adult_signer",
    birthYear: 1990,
    visitDateYmd: "2026-08-06",
    adultMode: "playing",
  });
  assert.equal(playing.unitPriceCents, 700);
  const watching = previewAdmissionPrice({
    role: "adult_covered",
    birthYear: 1991,
    visitDateYmd: "2026-08-06",
    adultMode: "watching",
  });
  assert.equal(watching.unitPriceCents, 0);
});

test("group totals support mixed cash and card", () => {
  const attendees: SelectedAttendeeDraft[] = [
    {
      ...resultToDraft(childResult({ participantId: "c1", birthYear: 2024 })),
      paymentMethod: "cash",
    },
    {
      ...resultToDraft(
        childResult({
          participantId: "c2",
          birthYear: 2020,
          firstName: "Noah",
          fullName: "Noah Smith",
        }),
      ),
      paymentMethod: "card",
    },
    {
      ...resultToDraft(adultResult({ participantId: "a1" })),
      adultMode: "watching",
      paymentMethod: null,
    },
  ];
  const totals = computeGroupTotalsPreview(attendees, "2026-08-06");
  assert.equal(totals.cashTotalCents, 700);
  assert.equal(totals.cardTotalCents, 1000);
  assert.equal(totals.combinedTotalCents, 1700);
  assert.equal(totals.paidAttendanceCount, 2);
  assert.equal(totals.totalAttendanceCount, 3);
  assert.equal(totals.missingPaymentMethod, false);
  assert.equal(totals.missingAdultMode, false);
});

test("canSubmit rejects empty group and missing payment", () => {
  assert.equal(canSubmitCheckInGroup([], "2026-08-06").ok, false);
  const draft = resultToDraft(childResult({ birthYear: 2020 }));
  const missing = canSubmitCheckInGroup([draft], "2026-08-06");
  assert.equal(missing.ok, false);
});

test("canSubmit keeps Native and Legacy Smartwaiver check-ins separate", () => {
  const native = {
    ...resultToDraft(childResult()),
    paymentMethod: "cash" as const,
  };
  const legacy = {
    ...resultToDraft(
      childResult({
        participantId: "",
        submissionId: "",
        source: "legacy_smartwaiver",
        sourceLabel: "Legacy Smartwaiver",
        legacyParticipantId: "legacy-child",
        selectionKey: "legacy:legacy-child",
      }),
    ),
    paymentMethod: "cash" as const,
  };

  const result = canSubmitCheckInGroup([native, legacy], "2026-08-06");
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /separate groups/i);
});

test("buildVisitCreateBody omits clientPriceCents when child price uncertain but still sends payment", () => {
  const body = buildVisitCreateBody({
    visitDateYmd: "2026-08-06",
    attendees: [
      {
        ...resultToDraft(childResult({ birthYear: 2023 })),
        paymentMethod: "cash",
      },
      {
        ...resultToDraft(adultResult()),
        adultMode: "playing",
        paymentMethod: "card",
      },
    ],
  });
  assert.equal(body.visitDate, "2026-08-06");
  assert.equal(body.attendees[0]?.clientPriceCents, null);
  assert.equal(body.attendees[0]?.paymentMethod, "cash");
  assert.equal(body.attendees[1]?.clientPriceCents, 700);
  assert.equal(body.attendees[1]?.adultMode, "playing");
  assert.equal(body.attendees[1]?.paymentMethod, "card");
});

test("uncertain paid child still requires payment method before submit", () => {
  const draft = resultToDraft(childResult({ birthYear: 2023 }));
  const missing = canSubmitCheckInGroup([draft], "2026-08-06");
  assert.equal(missing.ok, false);
  const ready = canSubmitCheckInGroup(
    [{ ...draft, paymentMethod: "card" }],
    "2026-08-06",
  );
  assert.equal(ready.ok, true);
});

test("watching adult request clears payment method", () => {
  const body = buildVisitCreateBody({
    visitDateYmd: "2026-08-06",
    attendees: [
      {
        ...resultToDraft(adultResult()),
        adultMode: "watching",
        paymentMethod: "cash",
      },
    ],
  });
  assert.equal(body.attendees[0]?.paymentMethod, null);
  assert.equal(body.attendees[0]?.clientPriceCents, 0);
});

test("mapStaffApiError covers auth, validation, and duplicate check-in", () => {
  const auth = mapStaffApiError({
    status: 401,
    payload: { ok: false, error: "Staff authentication required", code: "unauthorized" },
  });
  assert.equal(auth.requiresSignIn, true);

  const search = mapStaffApiError({
    status: 400,
    payload: { ok: false, error: "Search query is required", code: "search_validation" },
  });
  assert.equal(search.correctable, true);

  const duplicate = mapStaffApiError({
    status: 400,
    payload: {
      ok: false,
      error: "Participant is already checked in for this business day",
      code: "check_in_validation",
    },
  });
  assert.match(duplicate.message, /already checked in/i);

  const rate = mapStaffApiError({
    status: 429,
    payload: { error: "Too many requests. Try again in a moment." },
  });
  assert.equal(rate.code, "rate_limited");
});

test("formatCents and adult role helpers", () => {
  assert.equal(formatCents(700), "$7.00");
  assert.equal(isAdultRole("child"), false);
  assert.equal(isAdultRole("adult_signer"), true);
});
