import assert from "node:assert/strict";
import test from "node:test";
import { agreementState, canRequestAgreement, defaultAgreementSelection, type AgreementBatchBooking } from "./workflow.ts";
import type { RentalAgreement } from "./types.ts";
const agreement = (patch: Partial<RentalAgreement> = {}) => ({ status: "awaiting_signature", email_status: "not_sent", reviewed_at: null, signer_legal_name: null, ...patch }) as RentalAgreement;
test("unsigned statuses distinguish missing, unsent, sent, failed and changed agreements", () => {
  assert.equal(agreementState("Jane", undefined), "missing");
  assert.equal(agreementState("Jane", agreement()), "ready");
  assert.equal(agreementState("Jane", agreement({ email_status: "sent" })), "awaiting");
  assert.equal(agreementState("Jane", agreement({ email_status: "failed" })), "failed");
  assert.equal(agreementState("Jane", agreement({ status: "superseded", email_status: "sent" })), "superseded");
});
test("signed name review never makes a rental eligible for an unsigned batch", () => {
  const signed = agreement({ status: "signed", signer_legal_name: "John" });
  assert.equal(agreementState("Jane", signed), "review");
  assert.equal(canRequestAgreement("approved", signed), false);
  assert.equal(agreementState("Jane", { ...signed, reviewed_at: "2026-10-05" }), "signed");
  for (const status of ["cancelled", "canceled", "rejected", "blocked"]) assert.equal(canRequestAgreement(status), false);
});
test("catch-up preselection skips signed, closed, missing-email and already-emailed rentals", () => {
  const row = (id: string, patch = {}) => ({ id, customerEmail: "jane@example.invalid", status: "approved", ...patch }) as AgreementBatchBooking;
  assert.deepEqual(defaultAgreementSelection([
    row("missing"), row("ready", { agreement: agreement() }), row("failed", { agreement: agreement({ email_status: "failed" }) }),
    row("sent", { agreement: agreement({ email_status: "sent" }) }), row("signed", { agreement: agreement({ status: "signed" }) }),
    row("cancelled", { status: "cancelled" }), row("no-email", { customerEmail: null }), row("invalid-email", { customerEmail: "abc" }),
  ]), ["missing", "ready", "failed"]);
});
