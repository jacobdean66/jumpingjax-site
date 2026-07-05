import assert from "node:assert/strict";
import test from "node:test";

import {
  exchangeMetaAuthorizationCode,
  exchangeMetaLongLivedAccessToken,
  refreshMetaOAuthAccessToken,
} from "./social-meta-oauth-client";

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

test("exchangeMetaAuthorizationCode uses POST body for client credentials", async () => {
  let observedMethod = "";
  let observedBody = "";

  await exchangeMetaAuthorizationCode({
    appId: "app",
    appSecret: "secret",
    redirectUri: "https://example.com/callback",
    authorizationCode: "code",
    fetchImpl: async (_url, init) => {
      observedMethod = init?.method ?? "";
      observedBody = String(init?.body ?? "");
      return new Response(
        JSON.stringify({ access_token: "token-123", expires_in: 3600, token_type: "bearer" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  assert.equal(observedMethod, "POST");
  assert.match(observedBody, /client_secret=secret/);
  assert.match(observedBody, /code=code/);
});

test("exchangeMetaLongLivedAccessToken uses POST body for fb_exchange_token", async () => {
  let observedMethod = "";
  let observedBody = "";

  await exchangeMetaLongLivedAccessToken({
    appId: "app",
    appSecret: "secret",
    currentAccessToken: "short-token",
    fetchImpl: async (_url, init) => {
      observedMethod = init?.method ?? "";
      observedBody = String(init?.body ?? "");
      return new Response(
        JSON.stringify({ access_token: "long-token", expires_in: 5184000 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  assert.equal(observedMethod, "POST");
  assert.match(observedBody, /grant_type=fb_exchange_token/);
  assert.match(observedBody, /fb_exchange_token=short-token/);
});

test("refreshMetaOAuthAccessToken uses POST body for refresh_token grant", async () => {
  let observedMethod = "";
  let observedBody = "";

  await refreshMetaOAuthAccessToken({
    appId: "app",
    appSecret: "secret",
    refreshToken: "refresh-abc",
    fetchImpl: async (_url, init) => {
      observedMethod = init?.method ?? "";
      observedBody = String(init?.body ?? "");
      return new Response(
        JSON.stringify({ access_token: "new-token", expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  assert.equal(observedMethod, "POST");
  assert.match(observedBody, /grant_type=refresh_token/);
  assert.match(observedBody, /refresh_token=refresh-abc/);
});

console.log("social-meta-oauth-client tests passed");
