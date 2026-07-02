import assert from "node:assert/strict";

import {
  buildSocialPlatformLinkedinAdapterDryRunRequest,
  simulateSocialPlatformLinkedinAdapterDryRun,
  SOCIAL_PLATFORM_LINKEDIN_ADAPTER_DRY_RUN_VERSION,
} from "./social-platform-linkedin-adapter-dry-run";
import type { SocialPlatformLinkedinAdapterChannelIdentity } from "./social-platform-linkedin-adapter";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function linkedinChannel(): SocialPlatformLinkedinAdapterChannelIdentity {
  return {
    channelId: "channel-linkedin-1",
    platform: "linkedin",
    channelType: "linkedin_company_page",
    publicationTargetId: "target-linkedin-1",
    externalChannelReference: null,
    displayName: "Jumping Jax LinkedIn",
    identityOnly: true,
    containsCredentials: false,
    containsSdkClient: false,
    containsStorageReference: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

await test("builds dry-run requests from LinkedIn contract shapes", () => {
  const request = buildSocialPlatformLinkedinAdapterDryRunRequest({
    requestId: "dry-run-1",
    channel: linkedinChannel(),
    postKind: "article_post",
    mediaRefs: [
      {
        mediaRefId: "media-article-1",
        kind: "image_ref",
        storageReference: "storage://social-posts/article-1",
        displayHint: null,
        referencesOnly: true,
        containsCredentials: false,
        containsNetworkUrl: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
    ],
  });

  assert.equal(request.adapterId, "linkedin-platform-adapter-linkedin-contract");
  assert.equal(request.postKind, "article_post");
  assert.equal(request.mediaRefs.length, 1);
});

await test("simulates LinkedIn dry-run output wired to D11 factory registry", () => {
  const request = buildSocialPlatformLinkedinAdapterDryRunRequest({
    requestId: "dry-run-2",
    channel: linkedinChannel(),
    captionText: "Dry-run caption",
    mediaRefs: [
      {
        mediaRefId: "media-1",
        kind: "image_ref",
        storageReference: "storage://social-posts/image-1",
        displayHint: null,
        referencesOnly: true,
        containsCredentials: false,
        containsNetworkUrl: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
    ],
  });

  const result = simulateSocialPlatformLinkedinAdapterDryRun({ request });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.dryRunVersion, SOCIAL_PLATFORM_LINKEDIN_ADAPTER_DRY_RUN_VERSION);
    assert.equal(result.value.factoryDiscoveryKey, "linkedin:dry_run");
    assert.equal(result.value.wouldSendSummary.provider, "linkedin");
    assert.equal(result.value.wouldSendSummary.simulatedOnly, true);
    assert.equal(result.value.grantsExecutionPermission, false);
    assert.equal(result.value.mediaRefsRequired.length, 1);
  }
});

await test("reports blocked reasons for missing media refs", () => {
  const request = buildSocialPlatformLinkedinAdapterDryRunRequest({
    requestId: "dry-run-3",
    channel: linkedinChannel(),
    mediaRefs: [],
  });

  const result = simulateSocialPlatformLinkedinAdapterDryRun({ request });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.blockedReasons.includes("missing_media_refs"));
  }
});

console.log("social-platform-linkedin-adapter-dry-run tests passed");
