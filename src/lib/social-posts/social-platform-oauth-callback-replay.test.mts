import assert from "node:assert/strict";

import { createSocialPlatformOAuthAuthorizationRequestIntent } from "./social-platform-oauth-request";
import { createSocialPlatformOAuthCallbackOutcome } from "./social-platform-oauth-callback";
import {
  replaySocialPlatformOAuthCallbacks,
  SOCIAL_PLATFORM_OAUTH_CALLBACK_REPLAY_VERSION,
} from "./social-platform-oauth-callback-replay";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function metaExpectation() {
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
  }).callbackExpectation;
}

await test("replays an empty callback model deterministically", () => {
  const replay = replaySocialPlatformOAuthCallbacks().value;
  assert.equal(replay.replayVersion, SOCIAL_PLATFORM_OAUTH_CALLBACK_REPLAY_VERSION);
  assert.equal(replay.summary.outcomeCount, 0);
  assert.equal(replay.summary.credentialExchangeBlockedCount, 0);
  assert.equal(replay.replayIntegrity.valid, true);
  assert.equal(replay.readOnly, true);
  assert.equal(replay.authoritative, false);
  assert.equal(replay.grantsExecutionPermission, false);
});

await test("projects success-intent outcomes while blocking credential exchange", () => {
  const expectation = metaExpectation();
  const outcome = createSocialPlatformOAuthCallbackOutcome({
    callbackResultId: "oauth-callback-result-meta-1",
    callbackExpectation: expectation,
    outcomeKind: "success_intent_modeled",
  });
  const replay = replaySocialPlatformOAuthCallbacks({
    callbackExpectations: [expectation],
    callbackOutcomes: [outcome],
  }).value;

  assert.equal(replay.summary.modeledOutcomeCount, 1);
  assert.equal(replay.summary.successIntentCount, 1);
  assert.equal(replay.summary.credentialExchangeBlockedCount, 1);
  assert.equal(replay.successIntentOutcomes[0]?.successIntentModeled, true);
  assert.equal(replay.successIntentOutcomes[0]?.credentialExchangeBlocked, true);
  assert.equal(replay.successIntentOutcomes[0]?.tokenStorageBlocked, true);
  assert.equal(replay.successIntentOutcomes[0]?.grantsExecutionPermission, false);
  assert.equal(
    replay.successIntentOutcomes[0]?.blockingReasons.includes("success_intent_only"),
    true,
  );
});

await test("buckets denied canceled and provider-error outcomes", () => {
  const expectation = metaExpectation();
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
  const error = createSocialPlatformOAuthCallbackOutcome({
    callbackResultId: "oauth-callback-result-error-1",
    callbackExpectation: expectation,
    outcomeKind: "provider_error_reference",
    providerErrorRef: "provider-error-ref-1",
  });
  const replay = replaySocialPlatformOAuthCallbacks({
    callbackExpectations: [expectation],
    callbackOutcomes: [denied, canceled, error],
  }).value;

  assert.equal(replay.summary.deniedCount, 1);
  assert.equal(replay.summary.canceledCount, 1);
  assert.equal(replay.summary.providerErrorCount, 1);
  assert.equal(replay.deniedOutcomes[0]?.userDenied, true);
  assert.equal(replay.canceledOutcomes[0]?.userCanceled, true);
  assert.equal(replay.providerErrorOutcomes[0]?.providerError, true);
});

await test("marks missing expectations invalid and non-authoritative", () => {
  const expectation = metaExpectation();
  const outcome = createSocialPlatformOAuthCallbackOutcome({
    callbackResultId: "oauth-callback-result-missing-expectation-1",
    callbackExpectation: expectation,
    outcomeKind: "success_intent_modeled",
  });
  const replay = replaySocialPlatformOAuthCallbacks({
    callbackOutcomes: [outcome],
  }).value;

  assert.equal(replay.summary.invalidOutcomeCount, 1);
  assert.equal(replay.invalidOutcomes[0]?.modeledOutcomeValid, false);
  assert.equal(replay.invalidOutcomes[0]?.authoritative, false);
  assert.equal(
    replay.diagnostics.some((diagnostic) => diagnostic.code === "callback_expectation_missing"),
    true,
  );
  assert.equal(replay.replayIntegrity.valid, false);
});

await test("summarizes provider readiness as blocked and read-only", () => {
  const expectation = metaExpectation();
  const outcome = createSocialPlatformOAuthCallbackOutcome({
    callbackResultId: "oauth-callback-result-meta-2",
    callbackExpectation: expectation,
    outcomeKind: "denied_by_user",
  });
  const replay = replaySocialPlatformOAuthCallbacks({
    callbackExpectations: [expectation],
    callbackOutcomes: [outcome],
  }).value;
  const meta = replay.providerReadiness.find((provider) => provider.provider === "meta");

  assert.ok(meta);
  assert.equal(meta.callbackOutcomeCount, 1);
  assert.equal(meta.credentialExchangeBlocked, true);
  assert.equal(meta.tokenStorageBlocked, true);
  assert.equal(meta.networkBlocked, true);
  assert.equal(meta.executionCapable, false);
  assert.equal(meta.authoritative, false);
  assert.equal(meta.grantsExecutionPermission, false);
});

console.log("social-platform-oauth-callback-replay tests passed");
