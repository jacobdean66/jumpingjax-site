import assert from "node:assert/strict";

import {
  createSocialPlatformMetaAdapterContract,
  detectSocialPlatformMetaAdapterForbiddenStates,
  hydrateSocialPlatformMetaAdapterContract,
  metaAdapterSupportsChannelType,
  metaAdapterSupportsMediaKind,
  metaAdapterSupportsPlatform,
  metaAdapterSupportsPostKind,
  serializeSocialPlatformMetaAdapterContract,
  SOCIAL_PLATFORM_META_ADAPTER_CONTRACTS,
  SOCIAL_PLATFORM_META_ADAPTER_VERSION,
  validateSocialPlatformMetaAdapterContract,
  validateSocialPlatformMetaAdapterPostRequest,
  type SocialPlatformMetaAdapterChannelIdentity,
  type SocialPlatformMetaAdapterPostRequest,
} from "./social-platform-meta-adapter";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function facebookChannel(): SocialPlatformMetaAdapterChannelIdentity {
  return {
    channelId: "channel-facebook-1",
    platform: "facebook",
    channelType: "facebook_page",
    publicationTargetId: "target-facebook-1",
    externalChannelReference: null,
    displayName: "Jumping Jax Facebook Page",
    identityOnly: true,
    containsCredentials: false,
    containsSdkClient: false,
    containsStorageReference: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function validFacebookPostRequest(): SocialPlatformMetaAdapterPostRequest {
  const contract = createSocialPlatformMetaAdapterContract("facebook");
  return {
    requestId: "meta-request-1",
    adapterId: contract.identity.adapterId,
    channel: facebookChannel(),
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

await test("exposes frozen Meta adapter contracts for facebook and instagram", () => {
  assert.equal(SOCIAL_PLATFORM_META_ADAPTER_CONTRACTS.length, 2);
  const facebook = createSocialPlatformMetaAdapterContract("facebook");
  const instagram = createSocialPlatformMetaAdapterContract("instagram");
  assert.equal(facebook.identity.adapterVersion, SOCIAL_PLATFORM_META_ADAPTER_VERSION);
  assert.equal(facebook.identity.provider, "meta");
  assert.equal(facebook.capabilities.supportsStoryPost, false);
  assert.equal(instagram.capabilities.supportsStoryPost, true);
  assert.equal(facebook.grantsExecutionPermission, false);
});

await test("validates Meta adapter contracts and round-trips serialization", () => {
  const contract = createSocialPlatformMetaAdapterContract("instagram");
  const validation = validateSocialPlatformMetaAdapterContract(contract);
  assert.equal(validation.valid, true);

  const serialized = serializeSocialPlatformMetaAdapterContract(contract);
  const hydrated = hydrateSocialPlatformMetaAdapterContract(serialized);
  assert.equal(hydrated.ok, true);
});

await test("supports platform, channel, post, and media capability checks", () => {
  const contract = createSocialPlatformMetaAdapterContract("instagram");
  assert.equal(metaAdapterSupportsPlatform(contract, "instagram"), true);
  assert.equal(metaAdapterSupportsPlatform(contract, "facebook"), false);
  assert.equal(metaAdapterSupportsChannelType(contract, "instagram_business_account"), true);
  assert.equal(metaAdapterSupportsPostKind(contract, "story_post"), true);
  assert.equal(metaAdapterSupportsMediaKind(contract, "carousel_ref"), true);
});

await test("validates post requests and detects forbidden states", () => {
  const contract = createSocialPlatformMetaAdapterContract("facebook");
  const request = validFacebookPostRequest();
  const requestValidation = validateSocialPlatformMetaAdapterPostRequest(request);
  assert.equal(requestValidation.valid, true);

  const forbidden = detectSocialPlatformMetaAdapterForbiddenStates(contract, request);
  assert.equal(forbidden.valid, true);
});

await test("blocks unsupported post kinds and missing media refs", () => {
  const contract = createSocialPlatformMetaAdapterContract("facebook");
  const request: SocialPlatformMetaAdapterPostRequest = {
    ...validFacebookPostRequest(),
    postKind: "story_post",
    mediaRefs: [],
  };

  const forbidden = detectSocialPlatformMetaAdapterForbiddenStates(contract, request);
  assert.equal(forbidden.valid, false);
  assert.ok(forbidden.diagnostics.some((diagnostic) => diagnostic.code === "unsupported_post_kind"));
  assert.ok(forbidden.diagnostics.some((diagnostic) => diagnostic.code === "media_ref_required"));
});

await test("rejects network URLs in media storage references", () => {
  const request: SocialPlatformMetaAdapterPostRequest = {
    ...validFacebookPostRequest(),
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

  const validation = validateSocialPlatformMetaAdapterPostRequest(request);
  assert.equal(validation.valid, false);
  assert.ok(
    validation.diagnostics.some((diagnostic) => diagnostic.code === "storage_reference_forbidden_url"),
  );
});

console.log("social-platform-meta-adapter tests passed");
