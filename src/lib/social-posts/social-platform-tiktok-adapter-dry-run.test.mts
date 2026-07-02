import assert from "node:assert/strict";

import {
  buildSocialPlatformTiktokAdapterDryRunRequest,
  simulateSocialPlatformTiktokAdapterDryRun,
  SOCIAL_PLATFORM_TIKTOK_ADAPTER_DRY_RUN_VERSION,
} from "./social-platform-tiktok-adapter-dry-run";
import type { SocialPlatformTiktokAdapterChannelIdentity } from "./social-platform-tiktok-adapter";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function tiktokChannel(): SocialPlatformTiktokAdapterChannelIdentity {
  return {
    channelId: "channel-tiktok-1",
    platform: "tiktok",
    channelType: "tiktok_business_account",
    publicationTargetId: "target-tiktok-1",
    externalChannelReference: null,
    displayName: "Jumping Jax TikTok",
    identityOnly: true,
    containsCredentials: false,
    containsSdkClient: false,
    containsStorageReference: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

await test("builds dry-run requests from TikTok contract shapes", () => {
  const request = buildSocialPlatformTiktokAdapterDryRunRequest({
    requestId: "dry-run-1",
    channel: tiktokChannel(),
    postKind: "video_post",
    mediaRefs: [
      {
        mediaRefId: "media-video-1",
        kind: "video_ref",
        storageReference: "storage://social-posts/video-1",
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

  assert.equal(request.adapterId, "tiktok-platform-adapter-tiktok-contract");
  assert.equal(request.postKind, "video_post");
  assert.equal(request.mediaRefs.length, 1);
});

await test("simulates TikTok dry-run output wired to D11 factory registry", () => {
  const request = buildSocialPlatformTiktokAdapterDryRunRequest({
    requestId: "dry-run-2",
    channel: tiktokChannel(),
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

  const result = simulateSocialPlatformTiktokAdapterDryRun({ request });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.dryRunVersion, SOCIAL_PLATFORM_TIKTOK_ADAPTER_DRY_RUN_VERSION);
    assert.equal(result.value.factoryDiscoveryKey, "tiktok:dry_run");
    assert.equal(result.value.wouldSendSummary.provider, "tiktok");
    assert.equal(result.value.wouldSendSummary.simulatedOnly, true);
    assert.equal(result.value.grantsExecutionPermission, false);
    assert.equal(result.value.mediaRefsRequired.length, 1);
  }
});

await test("reports blocked reasons for missing media refs", () => {
  const request = buildSocialPlatformTiktokAdapterDryRunRequest({
    requestId: "dry-run-3",
    channel: tiktokChannel(),
    mediaRefs: [],
  });

  const result = simulateSocialPlatformTiktokAdapterDryRun({ request });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.blockedReasons.includes("missing_media_refs"));
  }
});

console.log("social-platform-tiktok-adapter-dry-run tests passed");
