import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createSocialPlatformOAuthAuthorizationRequestIntent,
  detectSocialPlatformOAuthRequestForbiddenStates,
  hydrateSocialPlatformOAuthAuthorizationRequestIntent,
  serializeSocialPlatformOAuthAuthorizationRequestIntent,
  validateSocialPlatformOAuthAuthorizationRequestIntent,
  validateSocialPlatformOAuthCallbackExpectation,
  SOCIAL_PLATFORM_OAUTH_REQUEST_VERSION,
  type SocialPlatformOAuthAuthorizationRequestIntent,
} from "./social-platform-oauth-request";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function validRequest(): SocialPlatformOAuthAuthorizationRequestIntent {
  return createSocialPlatformOAuthAuthorizationRequestIntent({
    requestIntentId: "oauth-request-meta-1",
    provider: "meta",
    accountRefId: "account-ref-meta-1",
    intentKind: "authorize_account",
    requestedScopes: [
      "pages_manage_posts_modeled",
      "pages_read_engagement_modeled",
      "instagram_basic_modeled",
      "instagram_content_publish_modeled",
      "business_management_modeled",
    ],
    oauthStateRefId: "oauth-state-ref-meta-1",
    redirectUriReference: "internal://oauth/redirect/meta",
    callbackExpectationId: "oauth-callback-meta-1",
    callbackReference: "internal://oauth/callback/meta",
    requestedAt: "2026-07-02T12:00:00.000Z",
    requestedByActorRef: "owner-ref-1",
    expiresAt: "2026-07-02T12:10:00.000Z",
  });
}

await test("creates and validates a secretless OAuth authorization request intent", () => {
  const request = validRequest();
  assert.equal(request.requestVersion, SOCIAL_PLATFORM_OAUTH_REQUEST_VERSION);
  assert.equal(request.secretless, true);
  assert.equal(request.liveOAuthBlocked, true);
  assert.equal(request.callsNoExternalApis, true);
  assert.equal(request.usesNoNetwork, true);
  assert.equal(request.grantsExecutionPermission, false);

  const validation = validateSocialPlatformOAuthAuthorizationRequestIntent(request);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.diagnostics, []);
});

await test("validates callback expectations as reference-only records", () => {
  const request = validRequest();
  const validation = validateSocialPlatformOAuthCallbackExpectation(request.callbackExpectation);
  assert.equal(validation.valid, true);

  const invalid = validateSocialPlatformOAuthCallbackExpectation({
    ...request.callbackExpectation,
    callbackReference: "https://example.com/oauth/callback",
  });
  assert.equal(invalid.valid, false);
  assert.equal(
    invalid.diagnostics.some((diagnostic) => diagnostic.code === "callback_reference_forbidden_url"),
    true,
  );
});

await test("rejects network-shaped redirect references", () => {
  const request = {
    ...validRequest(),
    redirectUriReference: "https://example.com/oauth/redirect",
  };
  const validation = validateSocialPlatformOAuthAuthorizationRequestIntent(request);
  assert.equal(validation.valid, false);
  assert.equal(
    validation.diagnostics.some((diagnostic) => diagnostic.code === "redirect_uri_forbidden_url"),
    true,
  );
});

await test("rejects scopes that do not belong to the selected provider", () => {
  const request = {
    ...validRequest(),
    provider: "linkedin",
    requestedScopes: ["instagram_content_publish_modeled"],
  };
  const validation = validateSocialPlatformOAuthAuthorizationRequestIntent(request);
  assert.equal(validation.valid, false);
  assert.equal(
    validation.diagnostics.some((diagnostic) => diagnostic.code === "oauth_scope_provider_mismatch"),
    true,
  );
});

await test("detects forbidden secret token and authorization code payloads", () => {
  const request = {
    ...validRequest(),
    client_secret: "not-allowed",
    access_token: "not-allowed",
    authorization_code: "not-allowed",
  };
  const validation = validateSocialPlatformOAuthAuthorizationRequestIntent(request);
  assert.equal(validation.valid, false);
  assert.equal(validation.diagnostics.some((diagnostic) => diagnostic.code === "secret_forbidden"), true);
  assert.equal(validation.diagnostics.some((diagnostic) => diagnostic.code === "token_forbidden"), true);
  assert.equal(
    validation.diagnostics.some((diagnostic) => diagnostic.code === "authorization_code_forbidden"),
    true,
  );

  const forbidden = detectSocialPlatformOAuthRequestForbiddenStates(request);
  assert.equal(forbidden.valid, false);
});

await test("round-trips authorization request serialization deterministically", () => {
  const request = validRequest();
  const serialized = serializeSocialPlatformOAuthAuthorizationRequestIntent(request);
  const hydrated = hydrateSocialPlatformOAuthAuthorizationRequestIntent(serialized);
  assert.equal(hydrated.ok, true);
  if (hydrated.ok) {
    assert.equal(
      serializeSocialPlatformOAuthAuthorizationRequestIntent(hydrated.value),
      serialized,
    );
  }
});

await test("contains no live OAuth implementation primitives", () => {
  const source = readFileSync(
    new URL("./social-platform-oauth-request.ts", import.meta.url),
    "utf8",
  );
  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes("XMLHttpRequest"), false);
  assert.equal(source.includes("axios"), false);
  assert.equal(source.includes("oauth/token"), false);
  assert.equal(source.includes("client_secret="), false);
});

console.log("social-platform-oauth-request tests passed");
