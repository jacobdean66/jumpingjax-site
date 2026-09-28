import assert from "node:assert/strict";
import test from "node:test";
import OpenAI from "openai";
import { safeProviderFailure } from "./provider-failure.ts";

test("SDK HTTP failures retain only bounded status and allowlisted type", () => {
  for (const status of [400, 401, 403, 408, 409, 422, 429, 500, 502, 503, 504, 599]) {
    const err = OpenAI.APIError.generate(status, { error: { type: "rate_limit_error", message: "SECRET CUSTOMER BODY", code: "SECRET KEY", param: "customer details" } }, "SECRET MESSAGE", new Headers({ "x-request-id": "SECRET HEADER" }));
    assert.deepEqual(safeProviderFailure(err), { status, providerType: "http", providerErrorType: "rate_limit_error" });
    assert.doesNotMatch(JSON.stringify(safeProviderFailure(err)), /SECRET|customer/);
  }
});

test("SDK timeout, connection, user abort and DOM abort are distinct", () => {
  assert.deepEqual(safeProviderFailure(new OpenAI.APIConnectionTimeoutError({ message: "SECRET" })), { providerType: "timeout" });
  assert.deepEqual(safeProviderFailure(new OpenAI.APIConnectionError({ message: "SECRET", cause: new Error("SECRET") })), { providerType: "connection" });
  assert.deepEqual(safeProviderFailure(new OpenAI.APIUserAbortError({ message: "SECRET" })), { providerType: "aborted" });
  assert.deepEqual(safeProviderFailure(new DOMException("SECRET", "AbortError")), { providerType: "aborted" });
  assert.deepEqual(safeProviderFailure(new DOMException("SECRET", "TimeoutError")), { providerType: "timeout" });
});

test("invalid statuses, unrecognized types, arbitrary strings and nested causes are discarded", () => {
  for (const status of [undefined, null, "429", 200, 399, 600, -1, NaN, Infinity, 429.5]) {
    assert.deepEqual(safeProviderFailure({ status, type: "SECRET CUSTOMER BODY", message: "SECRET", cause: { status: 429, type: "rate_limit_error" } }), { providerType: "unknown" });
  }
  for (const value of [null, undefined, "SECRET", new Error("SECRET")]) assert.deepEqual(safeProviderFailure(value), { providerType: "unknown" });
  assert.deepEqual(safeProviderFailure({ status: 502, type: "sensitive-custom-error", response: "SECRET" }), { status: 502, providerType: "http" });
});

test("hostile accessor errors cannot replace the original retry response", () => {
  const value = Object.defineProperties({}, { status: { get() { throw new Error("SECRET"); } }, type: { get() { throw new Error("SECRET"); } }, name: { get() { throw new Error("SECRET"); } } });
  assert.deepEqual(safeProviderFailure(value), { providerType: "unknown" });
});
