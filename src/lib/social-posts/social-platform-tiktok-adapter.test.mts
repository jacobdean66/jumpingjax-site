import assert from "node:assert/strict";

import {
  createSocialPlatformTiktokAdapterContract,
  detectSocialPlatformTiktokAdapterForbiddenStates,
  hydrateSocialPlatformTiktokAdapterContract,
  tiktokAdapterSupportsChannelType,
  tiktokAdapterSupportsMediaKind,
  tiktokAdapterSupportsPlatform,
  tiktokAdapterSupportsPostKind,
  serializeSocialPlatformTiktokAdapterContract,
  SOCIAL_PLATFORM_TIKTOK_ADAPTER_CONTRACTS,
  SOCIAL_PLATFORM_TIKTOK_ADAPTER_VERSION,
  validateSocialPlatformTiktokAdapterContract,
  validateSocialPlatformTiktokAdapterPostRequest,
  type SocialPlatformTiktokAdapterChannelIdentity,
  type SocialPlatformTiktokAdapterPostRequest,
} from "./social-platform-tiktok-adapter";

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

function validTiktokPostRequest(): SocialPlatformTiktokAdapterPostRequest {
  const contract = createSocialPlatformTiktokAdapterContract();
  return {
    requestId: "tiktok-request-1",
    adapterId: contract.identity.adapterId,
    channel: tiktokChannel(),
    postKind: "feed_post",
    captionText: "Contract-only caption",
    mediaRefs: [
      {
        mediaRefId: "media-1",
        kind: "image_ref",
        storageReference: "storage://social-posts/image-1",
        displayHint: "Hero image",
        referencesOnly: true,
        containsCredentials: false,
        containsNetworkUrl: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
    ],
    scheduledAt: null,
    contractOnly: true,
    modelAuthorityOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    callsNoExternalApis: true,
    usesNoNetwork: true,
    usesNoOAuth: true,
    usesNoCredentials: true,
  };
}

await test("exposes frozen TikTok adapter contract", () => {
  assert.equal(SOCIAL_PLATFORM_TIKTOK_ADAPTER_CONTRACTS.length, 1);
  const tiktok = createSocialPlatformTiktokAdapterContract();
  assert.equal(tiktok.identity.adapterVersion, SOCIAL_PLATFORM_TIKTOK_ADAPTER_VERSION);
  assert.equal(tiktok.identity.provider, "tiktok");
  assert.equal(tiktok.capabilities.supportsStoryPost, false);
  assert.equal(tiktok.grantsExecutionPermission, false);
});

await test("validates TikTok adapter contracts and round-trips serialization", () => {
  const contract = createSocialPlatformTiktokAdapterContract();
  const validation = validateSocialPlatformTiktokAdapterContract(contract);
  assert.equal(validation.valid, true);

  const serialized = serializeSocialPlatformTiktokAdapterContract(contract);
  const hydrated = hydrateSocialPlatformTiktokAdapterContract(serialized);
  assert.equal(hydrated.ok, true);
});

await test("supports platform, channel, post, and media capability checks", () => {
  const contract = createSocialPlatformTiktokAdapterContract();
  assert.equal(tiktokAdapterSupportsPlatform(contract, "tiktok"), true);
  assert.equal(tiktokAdapterSupportsChannelType(contract, "tiktok_business_account"), true);
  assert.equal(tiktokAdapterSupportsPostKind(contract, "video_post"), true);
  assert.equal(tiktokAdapterSupportsMediaKind(contract, "carousel_ref"), true);
});

await test("validates post requests and detects forbidden states", () => {
  const contract = createSocialPlatformTiktokAdapterContract();
  const request = validTiktokPostRequest();
  const requestValidation = validateSocialPlatformTiktokAdapterPostRequest(request);
  assert.equal(requestValidation.valid, true);

  const forbidden = detectSocialPlatformTiktokAdapterForbiddenStates(contract, request);
  assert.equal(forbidden.valid, true);
});

await test("blocks missing media refs for video posts", () => {
  const contract = createSocialPlatformTiktokAdapterContract();
  const request: SocialPlatformTiktokAdapterPostRequest = {
    ...validTiktokPostRequest(),
    postKind: "video_post",
    mediaRefs: [],
  };

  const forbidden = detectSocialPlatformTiktokAdapterForbiddenStates(contract, request);
  assert.equal(forbidden.valid, false);
  assert.ok(forbidden.diagnostics.some((diagnostic) => diagnostic.code === "media_ref_required"));
});

await test("rejects network URLs in media storage references", () => {
  const request: SocialPlatformTiktokAdapterPostRequest = {
    ...validTiktokPostRequest(),
    mediaRefs: [
      {
        mediaRefId: "media-1",
        kind: "image_ref",
        storageReference: "https://example.com/image.jpg",
        displayHint: null,
        referencesOnly: true,
        containsCredentials: false,
        containsNetworkUrl: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
    ],
  };

  const validation = validateSocialPlatformTiktokAdapterPostRequest(request);
  assert.equal(validation.valid, false);
  assert.ok(
    validation.diagnostics.some((diagnostic) => diagnostic.code === "storage_reference_forbidden_url"),
  );
});

console.log("social-platform-tiktok-adapter tests passed");
