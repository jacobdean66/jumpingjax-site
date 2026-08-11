import assert from "node:assert/strict";
import test from "node:test";

import {
  constantTimeEqual,
  generateOAuthPkceMaterial,
  generateOAuthStateMaterial,
} from "./social-oauth-state";
import {
  decryptOAuthSecret,
  encryptOAuthSecret,
  hydrateOAuthEnvelope,
  serializeOAuthEnvelope,
} from "./social-oauth-credential-envelope";
import { buildMetaAuthorizeUrl } from "./social-meta-oauth-client";

test("generateOAuthStateMaterial produces deterministic-shape values", () => {
  const first = generateOAuthStateMaterial();
  const second = generateOAuthStateMaterial();
  assert.notEqual(first.oauthState, second.oauthState);
  assert.match(first.intentId, /^oauth-intent:/);
  assert.match(first.stateRefId, /^oauth-state-ref:/);
  assert.equal(first.pkce.codeChallengeMethod, "S256");
});

test("generateOAuthPkceMaterial challenge verifies with verifier", () => {
  const pkce = generateOAuthPkceMaterial();
  assert.ok(pkce.codeVerifier.length >= 43);
  assert.ok(pkce.codeChallenge.length >= 43);
});

test("constantTimeEqual compares safely", () => {
  assert.equal(constantTimeEqual("abc", "abc"), true);
  assert.equal(constantTimeEqual("abc", "abd"), false);
  assert.equal(constantTimeEqual("abc", "ab"), false);
});

test("oauth envelope round trip encrypts and decrypts", () => {
  const key = Buffer.alloc(32, 7);
  const envelope = encryptOAuthSecret("secret-token", key);
  const serialized = serializeOAuthEnvelope(envelope);
  const hydrated = hydrateOAuthEnvelope(serialized);
  assert.equal(decryptOAuthSecret(hydrated, key), "secret-token");
});

test("buildMetaAuthorizeUrl includes state and scopes", () => {
  const url = new URL(
    buildMetaAuthorizeUrl({
      appId: "app-id",
      redirectUri: "https://example.com/api/admin/social-oauth/callback",
      oauthState: "state-123",
    }),
  );
  assert.equal(url.searchParams.get("client_id"), "app-id");
  assert.equal(url.searchParams.get("state"), "state-123");
  assert.equal(url.searchParams.get("code_challenge"), null);
  assert.ok(url.searchParams.get("scope")?.includes("pages_show_list"));
  assert.ok(url.searchParams.get("scope")?.includes("ads_read"));
});

console.log("social-oauth-state tests passed");
