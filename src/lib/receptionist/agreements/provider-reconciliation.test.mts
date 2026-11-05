import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
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
