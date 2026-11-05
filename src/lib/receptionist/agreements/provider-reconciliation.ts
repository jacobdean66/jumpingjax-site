import "server-only";

import { Resend } from "resend";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { agreementEmailPayloadMac } from "./preparation";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const macPattern = /^[a-f0-9]{64}$/;

/** Verify a signed Resend email.sent webhook and reconcile only its exact claimed operation. */
export async function reconcileResendAgreementEmailWebhook(request: Request) {
  const secret = process.env.RESEND_AGREEMENT_EMAIL_WEBHOOK_SECRET?.trim();
  if (process.env.RECEPTIONIST_AGREEMENT_EMAIL_RECONCILIATION_ENABLED !== "true" || !secret) {
    throw new Error("Agreement email reconciliation is disabled.");
  }
  const raw = await request.text();
  if (raw.length > 256_000) throw new Error("Webhook payload is invalid.");
  let event;
  try {
    const verifier = new Resend(process.env.RESEND_API_KEY?.trim() || "re_webhook_verifier");
    const headers = {
      id: request.headers.get("webhook-id") ?? request.headers.get("svix-id") ?? "",
      timestamp: request.headers.get("webhook-timestamp") ?? request.headers.get("svix-timestamp") ?? "",
      signature: request.headers.get("webhook-signature") ?? request.headers.get("svix-signature") ?? "",
    };
    if (!headers.id || !headers.timestamp || !headers.signature) throw new Error("Webhook signature headers are missing.");
    event = verifier.webhooks.verify({ payload: raw, headers, webhookSecret: secret });
  } catch {
    throw new Error("Provider webhook signature is invalid.");
  }
  if (event.type !== "email.sent") return { status: "ignored" as const };

  const data = event.data;
  const tags = data.tags ?? {};
  const operationId = tags.agreement_operation_id;
  const payloadMac = tags.agreement_payload_mac;
  const authorityEvidenceId = tags.agreement_authority_evidence_id;
  const consentEvidenceId = tags.agreement_consent_evidence_id;
  if (!uuid.test(operationId ?? "") || !macPattern.test(payloadMac ?? "") ||
      !uuid.test(authorityEvidenceId ?? "") || !uuid.test(consentEvidenceId ?? "") ||
      !uuid.test(data.email_id ?? "") || data.to.length !== 1) {
    return { status: "ignored" as const };
  }

  const db = createServiceRoleClient();
  const [{ data: claim, error: claimError }, { data: stored, error: outboxError }] = await Promise.all([
    db.from("receptionist_agreement_email_claims").select("booking_kind,booking_id,agreement_id,agreement_version,payload_mac")
      .eq("operation_id", operationId).maybeSingle(),
    db.from("booking_notification_outbox").select("booking_kind,booking_id,purpose,recipient,subject,body,payload_mac")
      .eq("message_key", `receptionist-agreement-${operationId}`).maybeSingle(),
  ]);
  if (claimError || outboxError || !claim || !stored || claim.payload_mac !== payloadMac ||
      claim.booking_kind !== stored.booking_kind || claim.booking_id !== stored.booking_id ||
      typeof claim.agreement_id !== "string" || typeof claim.agreement_version !== "number" ||
      stored.payload_mac !== payloadMac || typeof stored.recipient !== "string" ||
      data.to[0].trim().toLowerCase() !== stored.recipient.trim().toLowerCase() || data.subject !== stored.subject) {
    return { status: "ignored" as const };
  }
  const purpose = claim.booking_kind === "rental" ? "rental_agreement_signature" : "party_agreement_signature";
  if (stored.purpose !== purpose || typeof stored.subject !== "string" || typeof stored.body !== "string") {
    return { status: "ignored" as const };
  }
  const computedMac = agreementEmailPayloadMac({
    kind: claim.booking_kind,
    bookingId: claim.booking_id,
    agreementId: claim.agreement_id,
    version: claim.agreement_version,
    operationId,
    authorityEvidenceId,
    consentEvidenceId,
    recipient: stored.recipient.trim().toLowerCase(),
    purpose,
    subject: stored.subject,
    text: stored.body,
  });
  if (computedMac !== payloadMac) return { status: "ignored" as const };

  const { data: accepted, error } = await db.rpc("accept_receptionist_agreement_email", {
    p_operation_id: operationId,
    p_payload_mac: payloadMac,
    p_provider_email_id: data.email_id,
    p_kind: claim.booking_kind,
    p_booking_id: claim.booking_id,
    p_agreement_id: claim.agreement_id,
    p_version: claim.agreement_version,
    p_purpose: purpose,
    p_recipient: stored.recipient,
    p_subject: stored.subject,
    p_body: stored.body,
  });
  if (error || accepted?.status !== "accepted") return { status: "unresolved" as const };
  return { status: "accepted" as const };
}
