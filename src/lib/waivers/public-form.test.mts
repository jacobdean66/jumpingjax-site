import assert from "node:assert/strict";
import test from "node:test";

import {
  messageForPublicWaiverError,
  parsePublicWaiverErrorResponse,
} from "./public-errors";
import {
  buildPublicSubmitBody,
  createInitialWaiverFormState,
  createParticipantDraft,
  createWaiverIdempotencyKey,
  SIGNER_PARTICIPANT_TEMP_ID,
  validateConsentStep,
  validateLegalStep,
  validateParticipantsStep,
  validateSignerStep,
  validateSignatureStep,
  waiverDraftFingerprint,
} from "./public-form";

test("signer step requires core fields and valid email/dob", () => {
  const errors = validateSignerStep({
    firstName: "",
    lastName: "",
    email: "not-an-email",
    phone: "",
    dob: "2099-01-01",
  });
  assert.equal(errors.firstName, "First name is required");
  assert.equal(errors.lastName, "Last name is required");
  assert.equal(errors.email, "Enter a valid email address");
  assert.equal(errors.phone, "Phone is required");
  assert.equal(errors.dob, "Date of birth cannot be in the future");
});

test("child without guardian is rejected", () => {
  const errors = validateParticipantsStep(
    {
      firstName: "Taylor",
      lastName: "Smith",
      email: "t@example.com",
      phone: "555",
      dob: "1990-01-01",
    },
    [
      createParticipantDraft({
        tempId: "child-1",
        firstName: "Ava",
        lastName: "Smith",
        dob: "2019-01-01",
        kind: "child",
        guardianTempId: null,
      }),
    ],
  );
  assert.match(errors["participants.0.guardianTempId"] ?? "", /guardian/i);
});

test("child may reference signer as guardian", () => {
  const errors = validateParticipantsStep(
    {
      firstName: "Taylor",
      lastName: "Smith",
      email: "t@example.com",
      phone: "555",
      dob: "1990-01-01",
    },
    [
      createParticipantDraft({
        tempId: "child-1",
        firstName: "Ava",
        lastName: "Smith",
        dob: "2019-01-01",
        kind: "child",
        guardianTempId: SIGNER_PARTICIPANT_TEMP_ID,
      }),
    ],
  );
  assert.deepEqual(errors, {});
});

test("consents are not inferred and start unchecked", () => {
  const state = createInitialWaiverFormState();
  assert.equal(state.consent.acknowledgedRisk, false);
  assert.equal(state.consent.acknowledgedTerms, false);
  assert.equal(state.consent.isLegalGuardian, false);
  const errors = validateConsentStep(state.consent);
  assert.ok(errors.acknowledgedRisk);
  assert.ok(errors.acknowledgedTerms);
  assert.ok(errors.isLegalGuardian);
});

test("legal step reports missing public template contract", () => {
  const state = createInitialWaiverFormState();
  state.consent = {
    acknowledgedRisk: true,
    acknowledgedTerms: true,
    isLegalGuardian: true,
  };
  const errors = validateLegalStep(state);
  assert.match(errors.template ?? "", /not available/i);
});

test("empty signature is rejected", () => {
  const state = createInitialWaiverFormState();
  state.signaturePresent = false;
  state.signatureContentType = "";
  const errors = validateSignatureStep(state);
  assert.ok(errors.signature);
});

test("buildPublicSubmitBody matches reviewed submit contract shape", () => {
  const state = createInitialWaiverFormState();
  state.signer = {
    firstName: "Taylor",
    lastName: "Smith",
    email: "taylor@example.com",
    phone: "555-0100",
    dob: "1990-01-01",
  };
  state.participants = [
    createParticipantDraft({
      tempId: "child-1",
      firstName: "Ava",
      lastName: "Smith",
      dob: "2019-01-01",
      kind: "child",
      guardianTempId: SIGNER_PARTICIPANT_TEMP_ID,
    }),
    createParticipantDraft({
      tempId: "adult-2",
      firstName: "Jordan",
      lastName: "Lee",
      dob: "1988-05-05",
      kind: "adult",
      guardianTempId: null,
    }),
  ];
  state.consent = {
    acknowledgedRisk: true,
    acknowledgedTerms: true,
    isLegalGuardian: true,
  };
  state.templateVersionId = "11111111-1111-4111-8111-111111111111";
  state.signatureContentType = "image/png";
  state.signaturePresent = true;

  const body = buildPublicSubmitBody(state, "idempotency-key-001234");
  assert.equal(body.source, "web");
  assert.equal(body.signatureContentType, "image/png");
  assert.equal(body.idempotencyKey, "idempotency-key-001234");
  assert.equal(body.participants.length, 3);
  assert.equal(body.participants[0].role, "adult_signer");
  assert.equal(body.participants[0].tempId, SIGNER_PARTICIPANT_TEMP_ID);
  assert.equal(body.participants[1].role, "child");
  assert.equal(body.participants[1].guardianTempId, SIGNER_PARTICIPANT_TEMP_ID);
  assert.equal(body.participants[2].role, "adult_covered");
  assert.equal(body.participants[2].guardianTempId, null);
  // No signature binary / storage path fields may be invented.
  assert.equal(
    Object.prototype.hasOwnProperty.call(body, "signatureDataUrl"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(body, "signatureStoragePath"),
    false,
  );
});

test("idempotency key meets backend length bounds", () => {
  const key = createWaiverIdempotencyKey();
  assert.ok(key.length >= 16);
  assert.ok(key.length <= 128);
});

test("draft fingerprint changes when participant data changes", () => {
  const state = createInitialWaiverFormState();
  state.signer = {
    firstName: "Taylor",
    lastName: "Smith",
    email: "taylor@example.com",
    phone: "555-0100",
    dob: "1990-01-01",
  };
  state.templateVersionId = "11111111-1111-4111-8111-111111111111";
  state.signatureContentType = "image/png";
  state.consent = {
    acknowledgedRisk: true,
    acknowledgedTerms: true,
    isLegalGuardian: true,
  };
  const a = buildPublicSubmitBody(state, "k");
  const { idempotencyKey: _a, ...fa } = a;
  void _a;
  state.signer.phone = "555-9999";
  const b = buildPublicSubmitBody(state, "k");
  const { idempotencyKey: _b, ...fb } = b;
  void _b;
  assert.notEqual(waiverDraftFingerprint(fa), waiverDraftFingerprint(fb));
});

test("maps stable backend codes to public messages", () => {
  assert.match(messageForPublicWaiverError("payload_too_large"), /too large/i);
  assert.match(messageForPublicWaiverError("template_inactive"), /not available/i);
  assert.match(messageForPublicWaiverError("token_expired"), /expired/i);
  assert.match(messageForPublicWaiverError("rate_limited"), /Too many/i);
  const parsed = parsePublicWaiverErrorResponse(
    { ok: false, code: "validation", error: "Every child must have a guardian on the submission" },
    400,
  );
  assert.equal(parsed.code, "validation");
  assert.match(parsed.message, /guardian/i);
  const rate = parsePublicWaiverErrorResponse(
    { error: "Too many requests. Try again in a moment." },
    429,
  );
  assert.equal(rate.code, "rate_limited");
});
