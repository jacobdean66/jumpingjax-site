import assert from "node:assert/strict";
import test from "node:test";
import { agreementEmailPayloadMac, assertAgreementEmailConsent } from "./preparation";

const base = {
  kind: "rental" as const,
  bookingId: "12345",
  agreementId: "1ecf032f-f261-44fb-a0e0-fc180e456789",
  version: 2,
  operationId: "2ecf032f-f261-44fb-a0e0-fc180e456789",
  consentEvidenceId: "3ecf032f-f261-44fb-a0e0-fc180e456789",
  recipient: "alex@example.com",
  purpose: "rental_agreement_signature" as const,
  subject: "Sign your Jumping Jax rental agreement",
  text: "Review and sign version 2",
};

test("consent must name the exact booking, agreement version and recipient", () => {
  const consent = {
    granted: true as const,
    bookingId: base.bookingId,
    agreementId: base.agreementId,
    agreementVersion: base.version,
    recipient: base.recipient,
    capturedAt: "2026-11-05T01:00:00.000Z",
    evidenceId: base.consentEvidenceId,
  };
  assert.doesNotThrow(() => assertAgreementEmailConsent({ ...base, consent }));
  assert.throws(() => assertAgreementEmailConsent({ ...base, consent: { ...consent, bookingId: "12346" } }), /does not match/);
  assert.throws(() => assertAgreementEmailConsent({ ...base, consent: { ...consent, agreementVersion: 1 } }), /does not match/);
  assert.throws(() => assertAgreementEmailConsent({ ...base, consent: { ...consent, recipient: "other@example.com" } }), /does not match/);
  assert.throws(() => assertAgreementEmailConsent({ ...base, consent: { ...consent, evidenceId: "bad" } }), /does not match/);
});

test("payload HMAC binds operation, consent evidence, recipient and complete message", () => {
  const prior = process.env.RECEPTIONIST_AGREEMENT_EMAIL_HMAC_SECRET;
  process.env.RECEPTIONIST_AGREEMENT_EMAIL_HMAC_SECRET = "unit-test-secret-with-at-least-32-bytes";
  try {
    const mac = agreementEmailPayloadMac(base);
    assert.match(mac, /^[a-f0-9]{64}$/);
    assert.equal(agreementEmailPayloadMac(base), mac);
    assert.notEqual(agreementEmailPayloadMac({ ...base, recipient: "other@example.com" }), mac);
    assert.notEqual(agreementEmailPayloadMac({ ...base, text: "Different terms" }), mac);
    assert.notEqual(agreementEmailPayloadMac({ ...base, consentEvidenceId: "4ecf032f-f261-44fb-a0e0-fc180e456789" }), mac);
  } finally {
    if (prior === undefined) delete process.env.RECEPTIONIST_AGREEMENT_EMAIL_HMAC_SECRET;
    else process.env.RECEPTIONIST_AGREEMENT_EMAIL_HMAC_SECRET = prior;
  }
});
