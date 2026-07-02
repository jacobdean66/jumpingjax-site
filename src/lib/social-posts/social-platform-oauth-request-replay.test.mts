import assert from "node:assert/strict";

import { createSocialPlatformOAuthAuthorizationRequestIntent } from "./social-platform-oauth-request";
import {
  replaySocialPlatformOAuthRequests,
  SOCIAL_PLATFORM_OAUTH_REQUEST_REPLAY_VERSION,
} from "./social-platform-oauth-request-replay";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function metaRequest() {
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

await test("replays an empty OAuth request model deterministically", () => {
  const replay = replaySocialPlatformOAuthRequests().value;
  assert.equal(replay.replayVersion, SOCIAL_PLATFORM_OAUTH_REQUEST_REPLAY_VERSION);
  assert.equal(replay.summary.requestCount, 0);
  assert.equal(replay.summary.liveOAuthBlockedRequestCount, 0);
  assert.equal(replay.replayIntegrity.valid, true);
  assert.equal(replay.readOnly, true);
  assert.equal(replay.authoritative, false);
  assert.equal(replay.grantsExecutionPermission, false);
});

await test("projects valid modeled requests while keeping live OAuth blocked", () => {
  const request = metaRequest();
  const replay = replaySocialPlatformOAuthRequests({
    authorizationRequests: [request],
    callbackExpectations: [request.callbackExpectation],
  }).value;

  assert.equal(replay.summary.requestCount, 1);
  assert.equal(replay.summary.modeledRequestCount, 1);
  assert.equal(replay.summary.liveOAuthBlockedRequestCount, 1);
  assert.equal(replay.modeledRequests[0]?.liveOAuthBlocked, true);
  assert.equal(replay.modeledRequests[0]?.realRedirectBlocked, true);
  assert.equal(replay.modeledRequests[0]?.realCallbackBlocked, true);
  assert.equal(
    replay.modeledRequests[0]?.blockingReasons.includes("live_oauth_blocked"),
    true,
  );
  assert.equal(replay.summary.blockCount, 1);
});

await test("surfaces invalid request diagnostics without execution authority", () => {
  const request = {
    ...metaRequest(),
    redirectUriReference: "https://example.com/oauth/redirect",
  };
  const replay = replaySocialPlatformOAuthRequests({
    authorizationRequests: [request],
  }).value;

  assert.equal(replay.summary.invalidRequestCount, 1);
  assert.equal(replay.invalidRequests[0]?.modeledRequestValid, false);
  assert.equal(replay.invalidRequests[0]?.grantsExecutionPermission, false);
  assert.equal(
    replay.diagnostics.some((diagnostic) => diagnostic.code === "request_validation_error"),
    true,
  );
  assert.equal(replay.replayIntegrity.valid, false);
});

await test("reports missing modeled scopes as warnings only", () => {
  const request = createSocialPlatformOAuthAuthorizationRequestIntent({
    requestIntentId: "oauth-request-linkedin-1",
    provider: "linkedin",
    accountRefId: "account-ref-linkedin-1",
    intentKind: "verify_scopes",
    requestedScopes: ["linkedin_organization_social_modeled"],
    oauthStateRefId: "oauth-state-ref-linkedin-1",
    redirectUriReference: "internal://oauth/redirect/linkedin",
    callbackExpectationId: "oauth-callback-linkedin-1",
  });
  const replay = replaySocialPlatformOAuthRequests({
    authorizationRequests: [request],
  }).value;

  assert.equal(replay.summary.errorCount, 0);
  assert.equal(replay.summary.modeledRequestCount, 1);
  assert.deepEqual(replay.modeledRequests[0]?.missingScopes, []);
});

await test("summarizes provider readiness as read-only and non-executing", () => {
  const replay = replaySocialPlatformOAuthRequests({
    authorizationRequests: [metaRequest()],
  }).value;
  const meta = replay.providerReadiness.find((provider) => provider.provider === "meta");

  assert.ok(meta);
  assert.equal(meta.liveOAuthBlocked, true);
  assert.equal(meta.credentialStorageBlocked, true);
  assert.equal(meta.networkBlocked, true);
  assert.equal(meta.executionCapable, false);
  assert.equal(meta.authoritative, false);
  assert.equal(meta.grantsExecutionPermission, false);
});

console.log("social-platform-oauth-request-replay tests passed");
