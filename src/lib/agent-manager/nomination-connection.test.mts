import assert from "node:assert/strict";
import test from "node:test";
import { checkNominationCallback } from "./nomination-connection.ts";

test("connection proof authenticates an empty callback without creating a nomination", async () => {
  let calls = 0;
  const result = await checkNominationCallback({ appUrl: "https://jumpingjaxllc.com", callbackSecret: "fixture-only" }, async (url, init) => {
    calls++;
    assert.equal(url, "https://jumpingjaxllc.com/api/agents/nomination/callback");
    assert.equal(init?.body, "{}");
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fixture-only");
    return Response.json({ error: "Invalid Nomination Agent callback." }, { status: 400 });
  });
  assert.equal(result.ok, true);
  assert.equal(result.businessWrites, 0);
  assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify(result), /fixture-only/);
});

test("wrong credentials, redirects, and an unexpected application fail the proof", async () => {
  assert.equal((await checkNominationCallback({ appUrl: "https://jumpingjaxllc.com", callbackSecret: "fixture-only" }, async () => Response.json({ error: "Unauthorized" }, { status: 401 }))).ok, false);
  assert.equal((await checkNominationCallback({ appUrl: "https://jumpingjaxllc.com", callbackSecret: "fixture-only" }, async () => { throw new TypeError("redirect"); })).ok, false);
  assert.equal((await checkNominationCallback({ appUrl: "https://wrong.example", callbackSecret: "fixture-only" }, async () => { assert.fail("must not transmit the credential"); })).ok, false);
});
