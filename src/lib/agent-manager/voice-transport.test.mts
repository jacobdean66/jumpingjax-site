import assert from "node:assert/strict";
import test from "node:test";

import {
  BROWSER_SIMULATION_PROFILE,
  evaluateVoiceTransport,
  TEXTNOW_IPHONE_PROFILE,
} from "./voice-transport.ts";

test("TextNow on an iPhone is always represented as unsupported, never connected", () => {
  assert.deepEqual(evaluateVoiceTransport(TEXTNOW_IPHONE_PROFILE), {
    status: "blocked",
    reasons: ["TextNow on iPhone exposes no supported inbound webhook or live-audio stream"],
    mayHandleCustomerCalls: false,
  });
});

test("browser simulation can prove the booking brain but cannot take calls", () => {
  const readiness = evaluateVoiceTransport(BROWSER_SIMULATION_PROFILE);
  assert.equal(readiness.status, "proof_only");
  assert.equal(readiness.mayHandleCustomerCalls, false);
});

test("programmable voice remains blocked until every connection and cost gate is explicit", () => {
  const blocked = evaluateVoiceTransport({
    id: "programmable_voice",
    inboundWebhook: true,
    liveAudioStream: true,
    structuredTurns: true,
    credentialsConfigured: false,
    paidTelephonyApproved: false,
  });
  assert.equal(blocked.status, "blocked");
  assert.deepEqual(blocked.reasons, [
    "Provider credentials are not configured",
    "Telephony charges are not approved",
  ]);

  const ready = evaluateVoiceTransport({
    id: "programmable_voice",
    inboundWebhook: true,
    liveAudioStream: true,
    structuredTurns: true,
    credentialsConfigured: true,
    paidTelephonyApproved: true,
  });
  assert.equal(ready.status, "ready_to_connect");
  assert.equal(ready.mayHandleCustomerCalls, true);
});
