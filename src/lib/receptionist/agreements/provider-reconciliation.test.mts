import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { agreementEmailPayloadMac } from "./preparation";
import { reconcileResendAgreementEmailWebhook } from "./provider-reconciliation";

function signedRequest(payload: string, secret: string, alterSignature = false) {
  const id = "synthetic-event-1";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
  return new Request("https://example.test/api/webhooks/resend", {
    method: "POST",
    headers: { "webhook-id": id, "webhook-timestamp": timestamp, "webhook-signature": `v1,${alterSignature ? "bad" : signature}` },
    body: payload,
  });
}

test("Resend reconciliation verifies signature and ignores unrelated signed email events", async () => {
  const oldFlag = process.env.RECEPTIONIST_AGREEMENT_EMAIL_RECONCILIATION_ENABLED;
  const oldSecret = process.env.RESEND_AGREEMENT_EMAIL_WEBHOOK_SECRET;
  const secret = `whsec_${Buffer.from("synthetic-resend-secret").toString("base64")}`;
  process.env.RECEPTIONIST_AGREEMENT_EMAIL_RECONCILIATION_ENABLED = "true";
  process.env.RESEND_AGREEMENT_EMAIL_WEBHOOK_SECRET = secret;
  const payload = JSON.stringify({ type: "email.sent", created_at: new Date().toISOString(), data: {
    email_id: "3ecf032f-f261-44fb-a0e0-fc180e456789", message_id: "<synthetic@example.test>",
    created_at: new Date().toISOString(), from: "sender@example.test", to: ["customer@example.test"],
    subject: "Sign your agreement", tags: {},
  } });
  try {
    assert.deepEqual(await reconcileResendAgreementEmailWebhook(signedRequest(payload, secret)), { status: "ignored" });
    await assert.rejects(reconcileResendAgreementEmailWebhook(signedRequest(payload, secret, true)), /signature is invalid/);
  } finally {
    if (oldFlag === undefined) delete process.env.RECEPTIONIST_AGREEMENT_EMAIL_RECONCILIATION_ENABLED;
    else process.env.RECEPTIONIST_AGREEMENT_EMAIL_RECONCILIATION_ENABLED = oldFlag;
    if (oldSecret === undefined) delete process.env.RESEND_AGREEMENT_EMAIL_WEBHOOK_SECRET;
    else process.env.RESEND_AGREEMENT_EMAIL_WEBHOOK_SECRET = oldSecret;
  }
});

test("matching signed email.sent event reconciles once; wrong MAC or recipient is ignored", async context => {
  const old = {
    enabled: process.env.RECEPTIONIST_AGREEMENT_EMAIL_RECONCILIATION_ENABLED,
    webhook: process.env.RESEND_AGREEMENT_EMAIL_WEBHOOK_SECRET,
    hmac: process.env.RECEPTIONIST_AGREEMENT_EMAIL_HMAC_SECRET,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const secret = `whsec_${Buffer.from("synthetic-resend-secret").toString("base64")}`;
  const macSecret = "synthetic-agreement-hmac-secret-at-least-32-bytes";
  process.env.RECEPTIONIST_AGREEMENT_EMAIL_RECONCILIATION_ENABLED = "true";
  process.env.RESEND_AGREEMENT_EMAIL_WEBHOOK_SECRET = secret;
  process.env.RECEPTIONIST_AGREEMENT_EMAIL_HMAC_SECRET = macSecret;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://agreement-reconcile.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-service-role";
  const payload = {
    kind: "rental" as const, bookingId: "123", agreementId: "1ecf032f-f261-44fb-a0e0-fc180e456789",
    version: 2, operationId: "2ecf032f-f261-44fb-a0e0-fc180e456789",
    authorityEvidenceId: "4ecf032f-f261-44fb-a0e0-fc180e456789",
    consentEvidenceId: "5ecf032f-f261-44fb-a0e0-fc180e456789", recipient: "caller@example.test",
    purpose: "rental_agreement_signature" as const, subject: "Sign your agreement", text: "Exact signed link message",
  };
  const mac = agreementEmailPayloadMac(payload);
  let rpcCalls = 0;
  context.mock.method(globalThis, "fetch", async (source: string | Request, init?: RequestInit) => {
    const req = new Request(source, init), url = new URL(req.url);
    if (url.hostname !== "agreement-reconcile.test") throw new Error("Unexpected network host");
    if (url.pathname.endsWith("/receptionist_agreement_email_claims")) return Response.json({
      booking_kind: payload.kind, booking_id: payload.bookingId, agreement_id: payload.agreementId,
      agreement_version: payload.version, payload_mac: mac,
    });
    if (url.pathname.endsWith("/booking_notification_outbox")) return Response.json({
      booking_kind: payload.kind, booking_id: payload.bookingId, purpose: payload.purpose,
      recipient: payload.recipient, subject: payload.subject, body: payload.text, payload_mac: mac,
    });
    if (url.pathname.endsWith("/rpc/accept_receptionist_agreement_email")) {
      rpcCalls++;
      const body = await req.json();
      assert.equal(body.p_payload_mac, mac);
      assert.equal(body.p_provider_email_id, "3ecf032f-f261-44fb-a0e0-fc180e456789");
      return Response.json({ status: "accepted" });
    }
    throw new Error(`Unexpected path ${url.pathname}`);
  });
  const makeEvent = (tagMac = mac, recipient = payload.recipient) => JSON.stringify({
    type: "email.sent", created_at: new Date().toISOString(), data: {
      email_id: "3ecf032f-f261-44fb-a0e0-fc180e456789", message_id: "<sent@example.test>",
      created_at: new Date().toISOString(), from: "sender@example.test", to: [recipient], subject: payload.subject,
      tags: {
        agreement_operation_id: payload.operationId, agreement_payload_mac: tagMac,
        agreement_authority_evidence_id: payload.authorityEvidenceId, agreement_consent_evidence_id: payload.consentEvidenceId,
      },
    },
  });
  try {
    assert.deepEqual(await reconcileResendAgreementEmailWebhook(signedRequest(makeEvent(), secret)), { status: "accepted" });
    assert.deepEqual(await reconcileResendAgreementEmailWebhook(signedRequest(makeEvent("b".repeat(64)), secret)), { status: "ignored" });
    assert.deepEqual(await reconcileResendAgreementEmailWebhook(signedRequest(makeEvent(mac, "other@example.test"), secret)), { status: "ignored" });
    assert.equal(rpcCalls, 1);
  } finally {
    for (const [name, value] of Object.entries({
      RECEPTIONIST_AGREEMENT_EMAIL_RECONCILIATION_ENABLED: old.enabled,
      RESEND_AGREEMENT_EMAIL_WEBHOOK_SECRET: old.webhook,
      RECEPTIONIST_AGREEMENT_EMAIL_HMAC_SECRET: old.hmac,
      NEXT_PUBLIC_SUPABASE_URL: old.url,
      SUPABASE_SERVICE_ROLE_KEY: old.key,
    })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
