import assert from "node:assert/strict";
import test from "node:test";

import {
  validateSubmissionDraft,
  WaiverValidationError,
  type SubmissionDraft,
} from "./validation";

function baseDraft(overrides: Partial<SubmissionDraft> = {}): SubmissionDraft {
  return {
    templateVersionId: "11111111-1111-1111-1111-111111111111",
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
    signatureStoragePath: "signatures/demo.png",
    signatureContentType: "image/png",
    idempotencyKey: "idem-1",
    ...overrides,
  };
}

test("one child with guardian is accepted", () => {
  const draft = validateSubmissionDraft(baseDraft());
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
      ),
    WaiverValidationError,
  );
});

test("inactive template rejection is represented by missing templateVersionId validation", () => {
  assert.throws(
    () => validateSubmissionDraft(baseDraft({ templateVersionId: "   " })),
    WaiverValidationError,
  );
});

test("idempotency key is normalized when present", () => {
  const draft = validateSubmissionDraft(baseDraft({ idempotencyKey: "  abc  " }));
  assert.equal(draft.idempotencyKey, "abc");
});
