import assert from "node:assert/strict";

import {
  buildSocialPlatformMetaAdapterDryRunRequest,
  simulateSocialPlatformMetaAdapterDryRun,
  SOCIAL_PLATFORM_META_ADAPTER_DRY_RUN_VERSION,
} from "./social-platform-meta-adapter-dry-run";
import type { SocialPlatformMetaAdapterChannelIdentity } from "./social-platform-meta-adapter";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function instagramChannel(): SocialPlatformMetaAdapterChannelIdentity {
  return {
    channelId: "channel-instagram-1",
    platform: "instagram",
    channelType: "instagram_business_account",
    publicationTargetId: "target-instagram-1",
    externalChannelReference: null,
    displayName: "Jumping Jax Instagram",
    identityOnly: true,
    containsCredentials: false,
    containsSdkClient: false,
    containsStorageReference: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

await test("builds dry-run requests from Meta contract shapes", () => {
  const request = buildSocialPlatformMetaAdapterDryRunRequest({
    requestId: "dry-run-1",
    platform: "instagram",
    channel: instagramChannel(),
    postKind: "story_post",
    mediaRefs: [
      {
        mediaRefId: "media-story-1",
        kind: "video_ref",
        storageReference: "storage://social-posts/story-1",
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

  assert.equal(request.adapterId, "meta-platform-adapter-instagram-contract");
  assert.equal(request.postKind, "story_post");
  assert.equal(request.mediaRefs.length, 1);
});

await test("simulates Meta dry-run output wired to D11 factory registry", () => {
  const request = buildSocialPlatformMetaAdapterDryRunRequest({
    requestId: "dry-run-2",
    platform: "instagram",
    channel: instagramChannel(),
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

  const result = simulateSocialPlatformMetaAdapterDryRun({
    platform: "instagram",
    request,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.dryRunVersion, SOCIAL_PLATFORM_META_ADAPTER_DRY_RUN_VERSION);
    assert.equal(result.value.factoryDiscoveryKey, "instagram:dry_run");
    assert.equal(result.value.wouldSendSummary.provider, "meta");
    assert.equal(result.value.wouldSendSummary.simulatedOnly, true);
    assert.equal(result.value.grantsExecutionPermission, false);
    assert.equal(result.value.mediaRefsRequired.length, 1);
  }
});

await test("reports blocked reasons for missing media refs", () => {
  const request = buildSocialPlatformMetaAdapterDryRunRequest({
    requestId: "dry-run-3",
    platform: "facebook",
    channel: {
      channelId: "channel-facebook-1",
      platform: "facebook",
      channelType: "facebook_page",
      publicationTargetId: "target-facebook-1",
      externalChannelReference: null,
      displayName: null,
      identityOnly: true,
      containsCredentials: false,
      containsSdkClient: false,
      containsStorageReference: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    mediaRefs: [],
  });

  const result = simulateSocialPlatformMetaAdapterDryRun({
    platform: "facebook",
    request,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.blockedReasons.includes("missing_media_refs"));
  }
});

await test("reports unsupported post kinds for facebook story posts", () => {
  const request = buildSocialPlatformMetaAdapterDryRunRequest({
    requestId: "dry-run-4",
    platform: "facebook",
    channel: {
      channelId: "channel-facebook-1",
      platform: "facebook",
      channelType: "facebook_page",
      publicationTargetId: "target-facebook-1",
      externalChannelReference: null,
      displayName: null,
      identityOnly: true,
      containsCredentials: false,
      containsSdkClient: false,
      containsStorageReference: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    postKind: "story_post",
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

  const result = simulateSocialPlatformMetaAdapterDryRun({
    platform: "facebook",
    request,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.blockedReasons.includes("unsupported_post_kind"));
  }
});

console.log("social-platform-meta-adapter-dry-run tests passed");
