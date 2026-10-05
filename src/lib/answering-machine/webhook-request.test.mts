import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { answeringMachineCoverage } from "./coverage.ts";
import { getAnsweringMachineReadiness } from "./readiness.ts";
import { readWhatsAppWebhook } from "./webhook-request.ts";
import { extractWhatsAppCallSignals, extractWhatsAppVoicemails } from "./whatsapp.ts";

const env = {
  WHATSAPP_CALLING_ENABLED: "1", WHATSAPP_ANSWERING_MODE: "native_voicemail",
  WHATSAPP_VERIFY_TOKEN: "fixture", WHATSAPP_APP_SECRET: "fixture-secret",
  WHATSAPP_PHONE_NUMBER_ID: "111", WHATSAPP_WABA_ID: "222",
  WHATSAPP_ACCESS_TOKEN: "fixture-token", WHATSAPP_GRAPH_API_VERSION: "v25.0",
};

function entry(wabaId = "222", phoneId = "111") {
  return { id: wabaId, changes: [{ field: "calls", value: {
    messaging_product: "whatsapp", metadata: { phone_number_id: phoneId },
    calls: [{ id: "wacid.fixture", from: "15555550123", event: "connect", timestamp: "123" }],
  } }] };
}

function request(payload: unknown, secret = env.WHATSAPP_APP_SECRET) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return new Request("https://fixture.test/webhook", { method: "POST", body,
    headers: { "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}` },
  });
}

test("signed mixed-account delivery only selects the bound WhatsApp account and phone", async () => {
  const result = await readWhatsAppWebhook(request({ object: "whatsapp_business_account", entry: [entry("333"), entry("222", "444"), entry()] }), env);
  assert.ok("payload" in result);
  assert.equal(result.payload?.entry.length, 1);
  assert.equal(extractWhatsAppCallSignals(result.payload).length, 1);
  for (const foreign of [entry("333"), entry("222", "444")]) {
    const skipped = await readWhatsAppWebhook(request({ object: "whatsapp_business_account", entry: [foreign] }), env);
    assert.ok("payload" in skipped);
    assert.equal(skipped.payload, null);
  }
});

test("ingress is disabled by missing credentials, unknown modes, bad signatures, and oversized payloads", async () => {
  const payload = { object: "whatsapp_business_account", entry: [entry()] };
  for (const override of [{ WHATSAPP_CALLING_ENABLED: "0" }, { WHATSAPP_ACCESS_TOKEN: "" }, { WHATSAPP_ANSWERING_MODE: "typo" }, { WHATSAPP_GRAPH_API_VERSION: "latest" }]) {
    const result = await readWhatsAppWebhook(request(payload), { ...env, ...override });
    assert.ok("error" in result);
    assert.equal(result.status, 503);
  }
  const invalidSignature = await readWhatsAppWebhook(request(payload, "wrong-secret"), env);
  assert.ok("error" in invalidSignature);
  assert.equal(invalidSignature.status, 401);
  const oversized = await readWhatsAppWebhook(request("x".repeat(256 * 1024 + 1)), env);
  assert.ok("error" in oversized);
  assert.equal(oversized.status, 413);
  const malformed = await readWhatsAppWebhook(request("{"), env);
  assert.ok("error" in malformed);
  assert.equal(malformed.status, 400);
});

test("signed deliveries with the wrong object, product, or webhook field are ignored", async () => {
  const payloads = [
    { object: "page", entry: [entry()] },
    { object: "whatsapp_business_account", entry: [{ id: "222", changes: [{ field: "unknown", value: entry().changes[0].value }] }] },
    { object: "whatsapp_business_account", entry: [{ id: "222", changes: [{ field: "calls", value: { ...entry().changes[0].value, messaging_product: "other" } }] }] },
  ];
  for (const payload of payloads) {
    const result = await readWhatsAppWebhook(request(payload), env);
    assert.ok("payload" in result);
    assert.equal(result.payload, null);
  }
});

test("configured intake still requires physical acceptance and is never counted as connected", () => {
  const readiness = getAnsweringMachineReadiness(env);
  assert.equal(readiness.live, true);
  assert.equal(readiness.status, "ACCEPTANCE REQUIRED");
  assert.equal(answeringMachineCoverage(readiness).state, "degraded");
  assert.match(answeringMachineCoverage(readiness).summary, /unverified/);
  const disabled = answeringMachineCoverage(getAnsweringMachineReadiness({ ...env, WHATSAPP_CALLING_ENABLED: "0" }));
  assert.equal(disabled.state, "setup_required");
  assert.doesNotMatch(disabled.blocker!, /Configure  /);
  const unsafeBridge = getAnsweringMachineReadiness({ ...env, WHATSAPP_ANSWERING_MODE: "interactive_bridge", ANSWERING_MACHINE_CALLBACK_SECRET: "fixture", ANSWERING_MACHINE_MEDIA_BRIDGE_URL: "http://bridge.test" });
  assert.equal(unsafeBridge.live, false);
  assert.deepEqual(unsafeBridge.invalid, ["ANSWERING_MACHINE_MEDIA_BRIDGE_URL"]);
});

test("call parsing excludes invalid identifiers and bounds work; ordinary audio never counts as voicemail", () => {
  const value = entry().changes[0].value;
  const valid = value.calls[0];
  const payload = { entry: [{ changes: [{ value: { ...value, calls: [
    { ...valid, id: "wamid.not-a-call" }, { ...valid, id: `wacid.${"x".repeat(240)}` },
    { ...valid, event: "unexpected" }, ...Array.from({ length: 20 }, (_, i) => ({ ...valid, id: `wacid.${i}` })),
  ] } }] }] };
  assert.equal(extractWhatsAppCallSignals(payload).length, 10);
  assert.equal(extractWhatsAppCallSignals(payload)[0].providerCallId, "wacid.0");
  assert.deepEqual(extractWhatsAppVoicemails({ entry: [{ changes: [{ value: {
    messages: [{ id: "wamid.voice-message", from: "15555550123", type: "audio", audio: { id: "media", mime_type: "audio/ogg" } }],
  } }] }] }), []);
});
