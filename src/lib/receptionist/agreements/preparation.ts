import "server-only";

import { createHmac } from "node:crypto";
import { agreementEmailText, agreementUrl, type FacilityAgreementSnapshot } from "@/lib/facility-parties/agreement";
import { loadAgreementById as loadFacilityAgreementById } from "@/lib/facility-parties/agreement-store";
import { isValidEmailAddress } from "@/lib/email/address";
import { resolveRentalEmailSiteUrl } from "@/lib/rentals/rental-site-url";
import { customerAgreementPath, loadAgreementById as loadRentalAgreementById } from "@/lib/rental-agreements/store";
import { normalizeAgreementEmail, validAgreementEmail } from "@/lib/rental-agreements/workflow";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadCurrentAgreementStatus, type AgreementKind } from "./status";

export type AgreementConsentEvidence = {
  granted: true;
  bookingId: string;
  agreementId: string;
  agreementVersion: number;
  recipient: string;
  capturedAt: string;
  evidenceId: string;
};

export type AgreementEmailPreparation = {
  kind: AgreementKind;
  bookingId: string;
  agreementId: string;
  version: number;
  operationId: string;
  authorityEvidenceId: string;
  consentEvidenceId: string;
  recipient: string;
  purpose: "rental_agreement_signature" | "party_agreement_signature";
  subject: string;
  text: string;
  payloadMac: string;
};

export function assertAgreementEmailConsent(input: {
  bookingId: string;
  agreementId: string;
  version: number;
  recipient: string;
  consent: AgreementConsentEvidence;
}) {
  const consent = input.consent;
  if (!consent || consent.granted !== true || consent.bookingId !== input.bookingId ||
      consent.agreementId !== input.agreementId || consent.agreementVersion !== input.version ||
      !Number.isFinite(Date.parse(consent.capturedAt)) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(consent.evidenceId) ||
      normalizeAgreementEmail(consent.recipient) !== normalizeAgreementEmail(input.recipient)) {
    throw new Error("Agreement consent does not match the current booking, version, and recipient.");
  }
}

export function agreementEmailPayloadMac(payload: Omit<AgreementEmailPreparation, "payloadMac">) {
  const secret = process.env.RECEPTIONIST_AGREEMENT_EMAIL_HMAC_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("Agreement email preparation is not configured.");
  }
  return createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

/** Server-only status entry point for trusted callers; caller authority remains external. */
export async function readCurrentAgreementStatus(kind: AgreementKind, bookingId: string) {
  return loadCurrentAgreementStatus(createServiceRoleClient(), kind, bookingId);
}

/**
 * Prepares a message for a trusted server caller. This function does not
 * authenticate that caller, send mail, or prove that terms remain current at
 * dispatch time. `consent` is a typed assertion, not proof: the caller must
 * independently verify authority and read persisted consent evidence for this
 * exact booking/version/recipient. `capturedAt` is syntax-checked but has no
 * freshness or expiry enforcement here. A later sender must validate the
 * persisted evidence, claim atomically and recheck current state immediately
 * before provider dispatch.
 */
export async function prepareCurrentAgreementEmail(input: {
  kind: AgreementKind;
  bookingId: string;
  agreementId: string;
  version: number;
  operationId: string;
  consent: AgreementConsentEvidence;
  authorityEvidenceId: string;
}): Promise<AgreementEmailPreparation> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.operationId) ||
      !Number.isSafeInteger(input.version) || input.version < 1) {
    throw new Error("Agreement email request is invalid.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.authorityEvidenceId)) {
    throw new Error("Agreement caller authority evidence is invalid.");
  }

  const db = createServiceRoleClient();
  const status = await loadCurrentAgreementStatus(db, input.kind, input.bookingId);
  if (status.state !== "awaiting_signature" || status.agreementId !== input.agreementId || status.version !== input.version) {
    throw new Error("The requested agreement is not the current unsigned version.");
  }

  let recipient: string;
  let subject: string;
  let text: string;
  if (input.kind === "rental") {
    const [agreement, bookingResult] = await Promise.all([
      loadRentalAgreementById(input.bookingId, input.agreementId),
      db.from("bookings").select("customer_email,customer_name,status").eq("id", input.bookingId).single(),
    ]);
    const booking = bookingResult.data;
    if (!agreement || bookingResult.error || !booking || agreement.version !== input.version ||
        agreement.status !== "awaiting_signature" || agreement.signed_at || !["pending", "approved"].includes(booking.status)) {
      throw new Error("The rental agreement changed. Reload before preparing email.");
    }
    recipient = typeof booking.customer_email === "string" ? booking.customer_email.trim() : "";
    if (!validAgreementEmail(recipient)) throw new Error("The saved rental email is invalid.");
    subject = "Sign your Jumping Jax rental agreement";
    const url = new URL(customerAgreementPath(agreement.id), resolveRentalEmailSiteUrl()).toString();
    text = [
      `Hi ${booking.customer_name},`, "",
      "Please review your rental details and safety rules, check the acknowledgment, and type your full legal name to sign.",
      `Booking reference: ${input.bookingId}`,
      `Event date: ${agreement.snapshot.eventDate}`,
      `Equipment: ${agreement.snapshot.items.map(item => item.rental_name).join(", ")}`,
      `Agreement version: ${agreement.version}`, "", url, "",
      "You can view, print, or save a PDF using this link.", "Jumping Jax · 864-933-1420",
    ].join("\n");
  } else {
    const [agreement, bookingResult] = await Promise.all([
      loadFacilityAgreementById({ bookingId: input.bookingId, agreementId: input.agreementId }),
      db.from("facility_bookings").select("email,status").eq("id", input.bookingId).single(),
    ]);
    const booking = bookingResult.data;
    if (!agreement || bookingResult.error || !booking || agreement.version !== input.version ||
        agreement.status !== "sent" || agreement.signed_at || !["pending", "confirmed"].includes(booking.status)) {
      throw new Error("The facility agreement changed. Reload before preparing email.");
    }
    recipient = typeof booking.email === "string" ? booking.email.trim() : "";
    if (!isValidEmailAddress(recipient)) throw new Error("The saved facility email is invalid.");
    subject = "Sign your Jumping Jax birthday party agreement";
    const baseUrl = resolveRentalEmailSiteUrl();
    const url = agreementUrl(baseUrl, agreement.id);
    text = agreementEmailText({ snapshot: agreement.snapshot as FacilityAgreementSnapshot, url, version: agreement.version });
  }

  assertAgreementEmailConsent({ ...input, recipient });
  const payload = {
    kind: input.kind,
    bookingId: input.bookingId,
    agreementId: input.agreementId,
    version: input.version,
    operationId: input.operationId,
    authorityEvidenceId: input.authorityEvidenceId,
    consentEvidenceId: input.consent.evidenceId,
    recipient: recipient.toLowerCase(),
    purpose: input.kind === "rental" ? "rental_agreement_signature" as const : "party_agreement_signature" as const,
    subject,
    text,
  };
  return { ...payload, payloadMac: agreementEmailPayloadMac(payload) };
}
