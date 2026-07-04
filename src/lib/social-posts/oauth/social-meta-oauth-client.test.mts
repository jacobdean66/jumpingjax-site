import assert from "node:assert/strict";
import test from "node:test";

import { exchangeMetaAuthorizationCode } from "./social-meta-oauth-client";

test("exchangeMetaAuthorizationCode returns token on success", async () => {
  const result = await exchangeMetaAuthorizationCode({
    appId: "app",
    appSecret: "secret",
    redirectUri: "https://example.com/callback",
    authorizationCode: "code",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({ access_token: "token-123", expires_in: 3600, token_type: "bearer" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.accessToken, "token-123");
    assert.equal(result.expiresInSeconds, 3600);
  }
});

test("exchangeMetaAuthorizationCode surfaces provider errors", async () => {
  const result = await exchangeMetaAuthorizationCode({
    appId: "app",
    appSecret: "secret",
    redirectUri: "https://example.com/callback",
    authorizationCode: "code",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({ error: { message: "Invalid code", type: "OAuthException" } }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, "OAuthException");
  }
});

console.log("social-meta-oauth-client tests passed");
