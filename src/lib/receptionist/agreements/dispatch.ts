import "server-only";

import { sendDurableBookingEmail } from "@/lib/bookings/durable-email";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { prepareCurrentAgreementEmail, type AgreementConsentEvidence, type AgreementEmailPreparation } from "./preparation";
import type { AgreementKind } from "./status";

export type AgreementGateRequest = {
  kind: AgreementKind;
  bookingId: string;
  agreementId: string;
  version: number;
  operationId: string;
  authorityEvidenceId: string;
  consentEvidenceId: string;
};

/** The caller must wire this to its independent identity/booking/consent store. */
export type TrustedAgreementGate = {
  verify(input: AgreementGateRequest): Promise<{
    actorId: string;
    authorityEvidenceId: string;
    consent: AgreementConsentEvidence;
  }>;
};

function operationMessageKey(operationId: string) { return `receptionist-agreement-${operationId}`; }

async function verifyGate(gate: TrustedAgreementGate, input: AgreementGateRequest) {
  const proof = await gate.verify(input);
  if (!proof || typeof proof.actorId !== "string" || !proof.actorId.trim() ||
      proof.authorityEvidenceId !== input.authorityEvidenceId ||
      proof.consent?.evidenceId !== input.consentEvidenceId || proof.consent.bookingId !== input.bookingId ||
      proof.consent.agreementId !== input.agreementId || proof.consent.agreementVersion !== input.version) {
    throw new Error("Trusted caller authorization or persisted consent is unavailable.");
  }
  return proof;
}

async function releaseClaim(db: ReturnType<typeof createServiceRoleClient>, payload: AgreementEmailPreparation, reason: "pre_dispatch_changed" | "dispatch_not_started") {
  const { data, error } = await db.rpc("release_receptionist_agreement_email_claim", {
    p_operation_id: payload.operationId, p_payload_mac: payload.payloadMac, p_reason: reason,
  });
  if (error || data?.status !== "not_sent") throw new Error("Agreement email claim could not be safely released.");
}

/**
 * Dormant send coordinator. It is not called by any route. Enabling it requires
 * a separately implemented gate that verifies caller authority and persisted
 * consent for this exact booking/version, plus deployment of the draft SQL.
 * Provider/network errors consume the claim and stay outcome_unknown; they are
 * never automatically retried.
 */
export async function dispatchCurrentAgreementEmail(input: {
  gate: TrustedAgreementGate;
  request: AgreementGateRequest;
}): Promise<{ state: "accepted" | "outcome_unknown" | "not_sent"; providerAccepted: boolean }> {
  if (process.env.RECEPTIONIST_AGREEMENT_EMAIL_SEND_ENABLED !== "true") {
    throw new Error("Receptionist agreement email sending is disabled.");
  }
  const firstProof = await verifyGate(input.gate, input.request);
  const payload = await prepareCurrentAgreementEmail({
    ...input.request,
    consent: firstProof.consent,
    authorityEvidenceId: firstProof.authorityEvidenceId,
  });

  const db = createServiceRoleClient();
  const { data: claim, error: claimError } = await db.rpc("claim_receptionist_agreement_email", {
    p_operation_id: payload.operationId,
    p_kind: payload.kind,
    p_booking_id: payload.bookingId,
    p_agreement_id: payload.agreementId,
    p_version: payload.version,
    p_expected_email: payload.recipient,
    p_payload_mac: payload.payloadMac,
  });
  if (claimError || !claim || typeof claim !== "object") throw new Error("Agreement email claim is unavailable.");
  if (claim.dispatch !== true) {
    if (claim.status === "accepted") return { state: "accepted", providerAccepted: true };
    if (claim.status === "not_sent" || claim.status === "unavailable") return { state: "not_sent", providerAccepted: false };
    return { state: "outcome_unknown", providerAccepted: false };
  }

  try {
    const latestProof = await verifyGate(input.gate, input.request);
    const latest = await prepareCurrentAgreementEmail({
      ...input.request,
      consent: latestProof.consent,
      authorityEvidenceId: latestProof.authorityEvidenceId,
    });
    if (latest.payloadMac !== payload.payloadMac || latestProof.actorId !== firstProof.actorId) {
      await releaseClaim(db, payload, "pre_dispatch_changed");
      return { state: "not_sent", providerAccepted: false };
    }
  } catch {
    await releaseClaim(db, payload, "pre_dispatch_changed");
    return { state: "not_sent", providerAccepted: false };
  }

  const sent = await sendDurableBookingEmail({
    supabase: db,
    messageKey: operationMessageKey(payload.operationId),
    kind: payload.kind,
    bookingId: payload.bookingId,
    purpose: payload.purpose,
    to: payload.recipient,
    subject: payload.subject,
    text: payload.text,
    requireExactPayload: true,
    singleAttempt: true,
    payloadMac: payload.payloadMac,
    tags: [
      { name: "agreement_operation_id", value: payload.operationId },
      { name: "agreement_payload_mac", value: payload.payloadMac },
      { name: "agreement_authority_evidence_id", value: payload.authorityEvidenceId },
      { name: "agreement_consent_evidence_id", value: payload.consentEvidenceId },
    ],
  });
  if (sent.outcomeUnknown) return { state: "outcome_unknown", providerAccepted: false };
  if (sent.definitelyNotSent) {
    await releaseClaim(db, payload, "dispatch_not_started");
    return { state: "not_sent", providerAccepted: false };
  }
  if (!sent.accepted || !sent.providerEmailId) return { state: "outcome_unknown", providerAccepted: false };

  const { data: accepted, error: acceptError } = await db.rpc("accept_receptionist_agreement_email", {
    p_operation_id: payload.operationId,
    p_payload_mac: payload.payloadMac,
    p_provider_email_id: sent.providerEmailId,
    p_kind: payload.kind,
    p_booking_id: payload.bookingId,
    p_agreement_id: payload.agreementId,
    p_version: payload.version,
    p_purpose: payload.purpose,
    p_recipient: payload.recipient,
    p_subject: payload.subject,
    p_body: payload.text,
  });
  if (acceptError || accepted?.status !== "accepted") return { state: "outcome_unknown", providerAccepted: true };
  return { state: "accepted", providerAccepted: true };
}
