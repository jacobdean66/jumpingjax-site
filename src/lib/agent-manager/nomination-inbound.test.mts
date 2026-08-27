import assert from "node:assert/strict";
import test from "node:test";

import { hasAgentCallbackAuthorization } from "./callback-auth.ts";
import { isRelevantNominationInbound, toNominationEmailEvent } from "./nomination-inbound.ts";

test("inbound nomination filtering requires the exact configured recipient and nomination subject", () => {
  const metadata = {
    emailId: "mail-123",
    to: ["Jumping Jax <nominations@inbound.example>"],
    subject: "Free Party Nomination: Avery J.",
  };
  assert.equal(isRelevantNominationInbound(metadata, "nominations@inbound.example"), true);
  assert.equal(isRelevantNominationInbound(metadata, "other@inbound.example"), false);
  assert.equal(isRelevantNominationInbound({ ...metadata, subject: "General question" }, "nominations@inbound.example"), false);
  assert.equal(isRelevantNominationInbound(metadata, undefined), false);
});

test("Resend email content maps to a stable provider-scoped source event", () => {
  const event = toNominationEmailEvent({
    id: "37e4414c-5e25-4dbc-a071-43552a4bd53b",
    from: "Fixture Sender <fixture@example.test>",
    subject: "Free Party Nomination: Avery J.",
    text: "Structured fixture body",
  });
  assert.equal(event.sourceEventId, "resend:37e4414c-5e25-4dbc-a071-43552a4bd53b");
  assert.equal(event.text, "Structured fixture body");
});

test("machine callback authorization is bearer-based and constant-time comparable", () => {
  const authorized = new Request("https://jumpingjax.example/api/agents/nomination/callback", {
    headers: { Authorization: "Bearer fixture-secret" },
  });
  const rejected = new Request("https://jumpingjax.example/api/agents/nomination/callback", {
    headers: { Authorization: "Bearer wrong" },
  });
  assert.equal(hasAgentCallbackAuthorization(authorized, "fixture-secret"), true);
  assert.equal(hasAgentCallbackAuthorization(rejected, "fixture-secret"), false);
  assert.equal(hasAgentCallbackAuthorization(authorized, undefined), false);
});
