import assert from "node:assert/strict";
import test from "node:test";

import {
  validateSubmissionDraft,
  WaiverValidationError,
  type SubmissionDraft,
} from "./validation";

function baseDraft(overrides: Partial<SubmissionDraft> = {}): SubmissionDraft {
  return {
    templateVersionId: "11111111-1111-4111-8111-111111111111",
    signer: {
      firstName: "Taylor",
      lastName: "Smith",
      email: "taylor@example.com",
      phone: "555-0100",
    },
    participants: [
      {
        tempId: "adult-1",
        firstName: "Taylor",
        lastName: "Smith",
        dob: "1990-01-01",
        role: "adult_signer",
      },
      {
        tempId: "child-1",
        firstName: "Ava",
        lastName: "Smith",
        dob: "2019-01-01",
        role: "child",
        guardianTempId: "adult-1",
      },
    ],
    consent: {
      acknowledgedRisk: true,
      acknowledgedTerms: true,
      isLegalGuardian: true,
    },
    source: "web",
    signatureContentType: "image/png",
    idempotencyKey: "idempotency-key-001",
    ...overrides,
  };
}

test("one child with guardian is accepted", () => {
  const draft = validateSubmissionDraft(baseDraft(), { todayYmd: "2026-08-04" });
  assert.equal(draft.participants.length, 2);
});

test("multiple children with guardian are accepted", () => {
  const draft = validateSubmissionDraft(
    baseDraft({
      participants: [
        {
          tempId: "adult-1",
          firstName: "Taylor",
          lastName: "Smith",
          dob: "1990-01-01",
          role: "adult_signer",
        },
        {
          tempId: "child-1",
          firstName: "Ava",
          lastName: "Smith",
          dob: "2019-01-01",
          role: "child",
          guardianTempId: "adult-1",
        },
        {
          tempId: "child-2",
          firstName: "Noah",
          lastName: "Smith",
          dob: "2021-01-01",
          role: "child",
          guardianTempId: "adult-1",
        },
      ],
    }),
    { todayYmd: "2026-08-04" },
  );
  assert.equal(draft.participants.filter((p) => p.role === "child").length, 2);
});

test("adult-only submission is accepted", () => {
  const draft = validateSubmissionDraft(
    baseDraft({
      participants: [
        {
          tempId: "adult-1",
          firstName: "Taylor",
          lastName: "Smith",
          dob: "1990-01-01",
          role: "adult_signer",
        },
      ],
    }),
    { todayYmd: "2026-08-04" },
  );
  assert.equal(draft.participants.length, 1);
});

test("child without guardian is rejected", () => {
  assert.throws(
    () =>
      validateSubmissionDraft(
        baseDraft({
          participants: [
            {
              tempId: "adult-1",
              firstName: "Taylor",
              lastName: "Smith",
              dob: "1990-01-01",
              role: "adult_signer",
            },
            {
              tempId: "child-1",
              firstName: "Ava",
              lastName: "Smith",
              dob: "2019-01-01",
              role: "child",
              guardianTempId: null,
            },
          ],
        }),
        { todayYmd: "2026-08-04" },
      ),
    WaiverValidationError,
  );
});

test("invalid templateVersionId is rejected", () => {
  assert.throws(
    () =>
      validateSubmissionDraft(baseDraft({ templateVersionId: "not-a-uuid" }), {
        todayYmd: "2026-08-04",
      }),
    WaiverValidationError,
  );
});

test("idempotency key is mandatory and normalized", () => {
  const draft = validateSubmissionDraft(
    baseDraft({ idempotencyKey: "  idempotency-key-abc  " }),
    { todayYmd: "2026-08-04" },
  );
  assert.equal(draft.idempotencyKey, "idempotency-key-abc");
  assert.throws(
    () =>
      validateSubmissionDraft(baseDraft({ idempotencyKey: "short" }), {
        todayYmd: "2026-08-04",
      }),
    WaiverValidationError,
  );
});

test("future DOB is rejected", () => {
  assert.throws(
    () =>
      validateSubmissionDraft(
        baseDraft({
          participants: [
            {
              tempId: "adult-1",
              firstName: "Taylor",
              lastName: "Smith",
              dob: "2099-01-01",
              role: "adult_signer",
            },
          ],
        }),
        { todayYmd: "2026-08-04" },
      ),
    WaiverValidationError,
  );
});

test("invalid calendar DOB is rejected", () => {
  assert.throws(
    () =>
      validateSubmissionDraft(
        baseDraft({
          participants: [
            {
              tempId: "adult-1",
              firstName: "Taylor",
              lastName: "Smith",
              dob: "2020-02-30",
              role: "adult_signer",
            },
          ],
        }),
        { todayYmd: "2026-08-04" },
      ),
    WaiverValidationError,
  );
});

test("signer mismatch with adult_signer is rejected", () => {
  assert.throws(
    () =>
      validateSubmissionDraft(
        baseDraft({
          participants: [
            {
              tempId: "adult-1",
              firstName: "Other",
              lastName: "Person",
              dob: "1990-01-01",
              role: "adult_signer",
            },
          ],
        }),
        { todayYmd: "2026-08-04" },
      ),
    WaiverValidationError,
  );
});

test("participant limits are enforced", () => {
  const adults = Array.from({ length: 9 }, (_, i) => ({
    tempId: `adult-${i}`,
    firstName: i === 0 ? "Taylor" : `Adult${i}`,
    lastName: "Smith",
    dob: "1990-01-01",
    role: (i === 0 ? "adult_signer" : "adult_covered") as
      | "adult_signer"
      | "adult_covered",
  }));
  assert.throws(
    () => validateSubmissionDraft(baseDraft({ participants: adults }), { todayYmd: "2026-08-04" }),
    WaiverValidationError,
  );
});

test("guardian mismatch / self-guardian is rejected", () => {
  assert.throws(
    () =>
      validateSubmissionDraft(
        baseDraft({
          participants: [
            {
              tempId: "adult-1",
              firstName: "Taylor",
              lastName: "Smith",
              dob: "1990-01-01",
              role: "adult_signer",
            },
            {
              tempId: "child-1",
              firstName: "Ava",
              lastName: "Smith",
              dob: "2019-01-01",
              role: "child",
              guardianTempId: "missing",
            },
          ],
        }),
        { todayYmd: "2026-08-04" },
      ),
    WaiverValidationError,
  );
});
