import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createSocialPlatformOAuthAuthorizationRequestIntent } from "./social-platform-oauth-request";
import { createSocialPlatformOAuthCallbackOutcome } from "./social-platform-oauth-callback";
import {
  replaySocialPlatformOAuthSessions,
  SOCIAL_PLATFORM_OAUTH_SESSION_REPLAY_VERSION,
} from "./social-platform-oauth-session-replay";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function metaRequest(idSuffix = "1") {
  return createSocialPlatformOAuthAuthorizationRequestIntent({
    requestIntentId: `oauth-request-meta-${idSuffix}`,
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
    oauthStateRefId: `oauth-state-ref-meta-${idSuffix}`,
    redirectUriReference: "internal://oauth/redirect/meta",
    callbackExpectationId: `oauth-callback-meta-${idSuffix}`,
    callbackReference: "internal://oauth/callback/meta",
  });
}

await test("replays an empty OAuth session model deterministically", () => {
  const replay = replaySocialPlatformOAuthSessions().value;
  assert.equal(replay.replayVersion, SOCIAL_PLATFORM_OAUTH_SESSION_REPLAY_VERSION);
  assert.equal(replay.summary.sessionCount, 0);
  assert.equal(replay.replayIntegrity.valid, true);
  assert.equal(replay.computedOnly, true);
  assert.equal(replay.readOnly, true);
  assert.equal(replay.authoritative, false);
  assert.equal(replay.grantsExecutionPermission, false);
});

await test("projects awaiting-callback sessions without execution authority", () => {
  const request = metaRequest();
  const replay = replaySocialPlatformOAuthSessions({
    authorizationRequests: [request],
    callbackExpectations: [request.callbackExpectation],
  }).value;

  assert.equal(replay.summary.sessionCount, 1);
  assert.equal(replay.summary.awaitingCallbackCount, 1);
  assert.equal(replay.awaitingCallbackSessions[0]?.lifecycleState, "awaiting_callback_reference");
  assert.equal(replay.awaitingCallbackSessions[0]?.hasCallbackOutcome, false);
  assert.equal(replay.awaitingCallbackSessions[0]?.liveOAuthBlocked, true);
  assert.equal(replay.awaitingCallbackSessions[0]?.credentialExchangeBlocked, true);
  assert.equal(replay.awaitingCallbackSessions[0]?.authoritative, false);
});

await test("correlates success-intent callback outcomes while blocking exchange", () => {
  const request = metaRequest();
  const outcome = createSocialPlatformOAuthCallbackOutcome({
    callbackResultId: "oauth-callback-result-meta-1",
    callbackExpectation: request.callbackExpectation,
    outcomeKind: "success_intent_modeled",
  });
  const replay = replaySocialPlatformOAuthSessions({
    authorizationRequests: [request],
    callbackExpectations: [request.callbackExpectation],
    callbackOutcomes: [outcome],
  }).value;

  assert.equal(replay.summary.successIntentCount, 1);
  assert.equal(replay.successIntentSessions[0]?.lifecycleState, "success_intent_modeled");
  assert.equal(replay.successIntentSessions[0]?.successIntentModeled, true);
  assert.equal(replay.successIntentSessions[0]?.credentialExchangeBlocked, true);
  assert.equal(replay.successIntentSessions[0]?.tokenStorageBlocked, true);
  assert.equal(replay.successIntentSessions[0]?.grantsExecutionPermission, false);
});

await test("summarizes denied canceled provider-error mismatch and expired sessions", () => {
  const deniedRequest = metaRequest("denied");
  const canceledRequest = metaRequest("canceled");
  const errorRequest = metaRequest("error");
  const mismatchRequest = metaRequest("mismatch");
  const expiredRequest = metaRequest("expired");
  const outcomes = [
    createSocialPlatformOAuthCallbackOutcome({
      callbackResultId: "oauth-callback-result-denied-1",
      callbackExpectation: deniedRequest.callbackExpectation,
      outcomeKind: "denied_by_user",
    }),
    createSocialPlatformOAuthCallbackOutcome({
      callbackResultId: "oauth-callback-result-canceled-1",
      callbackExpectation: canceledRequest.callbackExpectation,
      outcomeKind: "canceled_by_user",
    }),
    createSocialPlatformOAuthCallbackOutcome({
      callbackResultId: "oauth-callback-result-error-1",
      callbackExpectation: errorRequest.callbackExpectation,
      outcomeKind: "provider_error_reference",
      providerErrorRef: "provider-error-ref-1",
    }),
    createSocialPlatformOAuthCallbackOutcome({
      callbackResultId: "oauth-callback-result-mismatch-1",
      callbackExpectation: mismatchRequest.callbackExpectation,
      outcomeKind: "state_mismatch_reference",
    }),
    createSocialPlatformOAuthCallbackOutcome({
      callbackResultId: "oauth-callback-result-expired-1",
      callbackExpectation: expiredRequest.callbackExpectation,
      outcomeKind: "expired_reference",
    }),
  ];
  const requests = [deniedRequest, canceledRequest, errorRequest, mismatchRequest, expiredRequest];
  const replay = replaySocialPlatformOAuthSessions({
    authorizationRequests: requests,
    callbackExpectations: requests.map((request) => request.callbackExpectation),
    callbackOutcomes: outcomes,
  }).value;

  assert.equal(replay.summary.deniedCount, 1);
  assert.equal(replay.summary.canceledCount, 1);
  assert.equal(replay.summary.providerErrorCount, 1);
  assert.equal(replay.summary.stateMismatchCount, 1);
  assert.equal(replay.summary.expiredCount, 1);
  assert.equal(replay.deniedSessions[0]?.denied, true);
  assert.equal(replay.canceledSessions[0]?.canceled, true);
  assert.equal(replay.providerErrorSessions[0]?.providerError, true);
  assert.equal(replay.stateMismatchSessions[0]?.stateMismatch, true);
  assert.equal(replay.expiredSessions[0]?.expired, true);
});

await test("marks duplicate callback outcomes invalid at session level", () => {
  const request = metaRequest("duplicate");
  const first = createSocialPlatformOAuthCallbackOutcome({
    callbackResultId: "oauth-callback-result-duplicate-1",
    callbackExpectation: request.callbackExpectation,
    outcomeKind: "success_intent_modeled",
  });
  const second = createSocialPlatformOAuthCallbackOutcome({
    callbackResultId: "oauth-callback-result-duplicate-2",
    callbackExpectation: request.callbackExpectation,
    outcomeKind: "denied_by_user",
  });
  const replay = replaySocialPlatformOAuthSessions({
    authorizationRequests: [request],
    callbackExpectations: [request.callbackExpectation],
    callbackOutcomes: [first, second],
  }).value;

  assert.equal(replay.summary.duplicateCallbackSessionCount, 1);
  assert.equal(replay.sessions[0]?.hasDuplicateCallbackOutcomes, true);
  assert.equal(
    replay.diagnostics.some((diagnostic) => diagnostic.code === "session_callback_duplicate"),
    true,
  );
  assert.equal(replay.replayIntegrity.valid, false);
});

await test("summarizes provider sessions as blocked and non-authoritative", () => {
  const request = metaRequest("provider-summary");
  const outcome = createSocialPlatformOAuthCallbackOutcome({
    callbackResultId: "oauth-callback-result-provider-summary-1",
    callbackExpectation: request.callbackExpectation,
    outcomeKind: "success_intent_modeled",
  });
  const replay = replaySocialPlatformOAuthSessions({
    authorizationRequests: [request],
    callbackExpectations: [request.callbackExpectation],
    callbackOutcomes: [outcome],
  }).value;
  const meta = replay.providerSummaries.find((provider) => provider.provider === "meta");

  assert.ok(meta);
  assert.equal(meta.sessionCount, 1);
  assert.equal(meta.successIntentCount, 1);
  assert.equal(meta.liveOAuthBlocked, true);
  assert.equal(meta.credentialExchangeBlocked, true);
  assert.equal(meta.executionCapable, false);
  assert.equal(meta.authoritative, false);
  assert.equal(meta.grantsExecutionPermission, false);
});

await test("contains no live OAuth implementation primitives", () => {
  const source = readFileSync(
    new URL("./social-platform-oauth-session-replay.ts", import.meta.url),
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

console.log("social-platform-oauth-session-replay tests passed");
