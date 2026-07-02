import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createSocialPlatformOAuthAuthorizationRequestIntent } from "./social-platform-oauth-request";
import {
  createSocialPlatformOAuthCallbackOutcome,
  detectSocialPlatformOAuthCallbackForbiddenStates,
  hydrateSocialPlatformOAuthCallbackOutcome,
  serializeSocialPlatformOAuthCallbackOutcome,
  validateSocialPlatformOAuthCallbackOutcome,
  SOCIAL_PLATFORM_OAUTH_CALLBACK_VERSION,
  type SocialPlatformOAuthCallbackOutcome,
} from "./social-platform-oauth-callback";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function validExpectation() {
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
  }).callbackExpectation;
}

function validOutcome(): SocialPlatformOAuthCallbackOutcome {
  return createSocialPlatformOAuthCallbackOutcome({
    callbackResultId: "oauth-callback-result-meta-1",
    callbackExpectation: validExpectation(),
    outcomeKind: "success_intent_modeled",
    receivedAt: "2026-07-02T12:03:00.000Z",
  });
}

await test("creates and validates a secretless OAuth callback success-intent outcome", () => {
  const outcome = validOutcome();
  assert.equal(outcome.callbackVersion, SOCIAL_PLATFORM_OAUTH_CALLBACK_VERSION);
  assert.equal(outcome.secretless, true);
  assert.equal(outcome.successIntentOnly, true);
  assert.equal(outcome.receivedNoCredentials, true);
  assert.equal(outcome.exchangedNoCredentials, true);
  assert.equal(outcome.storedNoCredentials, true);
  assert.equal(outcome.exposesNoCallbackRoute, true);
  assert.equal(outcome.grantsExecutionPermission, false);

  const validation = validateSocialPlatformOAuthCallbackOutcome(outcome, validExpectation());
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.diagnostics, []);
});

await test("models denied canceled provider-error mismatch and expired outcomes", () => {
  const expectation = validExpectation();
  const denied = createSocialPlatformOAuthCallbackOutcome({
    callbackResultId: "oauth-callback-result-denied-1",
    callbackExpectation: expectation,
    outcomeKind: "denied_by_user",
  });
  const canceled = createSocialPlatformOAuthCallbackOutcome({
    callbackResultId: "oauth-callback-result-canceled-1",
    callbackExpectation: expectation,
    outcomeKind: "canceled_by_user",
  });
  const providerError = createSocialPlatformOAuthCallbackOutcome({
    callbackResultId: "oauth-callback-result-error-1",
    callbackExpectation: expectation,
    outcomeKind: "provider_error_reference",
    providerErrorRef: "provider-error-ref-1",
  });
  const mismatch = createSocialPlatformOAuthCallbackOutcome({
    callbackResultId: "oauth-callback-result-mismatch-1",
    callbackExpectation: expectation,
    outcomeKind: "state_mismatch_reference",
  });
  const expired = createSocialPlatformOAuthCallbackOutcome({
    callbackResultId: "oauth-callback-result-expired-1",
    callbackExpectation: expectation,
    outcomeKind: "expired_reference",
  });

  for (const outcome of [denied, canceled, providerError, mismatch, expired]) {
    assert.equal(validateSocialPlatformOAuthCallbackOutcome(outcome, expectation).valid, true);
  }
});

await test("requires provider error references for provider-error outcomes", () => {
  const outcome = createSocialPlatformOAuthCallbackOutcome({
    callbackResultId: "oauth-callback-result-error-2",
    callbackExpectation: validExpectation(),
    outcomeKind: "provider_error_reference",
  });
  const validation = validateSocialPlatformOAuthCallbackOutcome(outcome, validExpectation());
  assert.equal(validation.valid, false);
  assert.equal(
    validation.diagnostics.some((diagnostic) => diagnostic.code === "provider_error_ref_required"),
    true,
  );
});

await test("rejects provider account and state mismatches against expectation", () => {
  const expectation = validExpectation();
  const outcome = {
    ...validOutcome(),
    provider: "linkedin",
    accountRefId: "other-account-ref",
    oauthStateRefId: "other-state-ref",
  };
  const validation = validateSocialPlatformOAuthCallbackOutcome(outcome, expectation);
  assert.equal(validation.valid, false);
  assert.equal(validation.diagnostics.some((diagnostic) => diagnostic.code === "provider_mismatch"), true);
  assert.equal(validation.diagnostics.some((diagnostic) => diagnostic.code === "account_mismatch"), true);
  assert.equal(validation.diagnostics.some((diagnostic) => diagnostic.code === "oauth_state_mismatch"), true);
});

await test("detects authorization code token and secret payloads", () => {
  const outcome = {
    ...validOutcome(),
    code: "not-allowed",
    access_token: "not-allowed",
    client_secret: "not-allowed",
  };
  const validation = validateSocialPlatformOAuthCallbackOutcome(outcome, validExpectation());
  assert.equal(validation.valid, false);
  assert.equal(
    validation.diagnostics.some((diagnostic) => diagnostic.code === "authorization_code_forbidden"),
    true,
  );
  assert.equal(validation.diagnostics.some((diagnostic) => diagnostic.code === "token_forbidden"), true);
  assert.equal(validation.diagnostics.some((diagnostic) => diagnostic.code === "secret_forbidden"), true);

  const forbidden = detectSocialPlatformOAuthCallbackForbiddenStates(outcome);
  assert.equal(forbidden.valid, false);
});

await test("round-trips callback outcome serialization deterministically", () => {
  const outcome = validOutcome();
  const serialized = serializeSocialPlatformOAuthCallbackOutcome(outcome);
  const hydrated = hydrateSocialPlatformOAuthCallbackOutcome(serialized);
  assert.equal(hydrated.ok, true);
  if (hydrated.ok) {
    assert.equal(serializeSocialPlatformOAuthCallbackOutcome(hydrated.value), serialized);
  }
});

await test("contains no live callback or credential exchange primitives", () => {
  const source = readFileSync(
    new URL("./social-platform-oauth-callback.ts", import.meta.url),
    "utf8",
  );
  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes("XMLHttpRequest"), false);
  assert.equal(source.includes("axios"), false);
  assert.equal(source.includes("oauth/token"), false);
  assert.equal(source.includes("client_secret="), false);
  assert.equal(source.includes("NextRequest"), false);
  assert.equal(source.includes("route.ts"), false);
});

console.log("social-platform-oauth-callback tests passed");
