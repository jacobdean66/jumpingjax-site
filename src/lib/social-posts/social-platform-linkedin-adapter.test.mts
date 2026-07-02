import assert from "node:assert/strict";

import {
  createSocialPlatformLinkedinAdapterContract,
  detectSocialPlatformLinkedinAdapterForbiddenStates,
  hydrateSocialPlatformLinkedinAdapterContract,
  linkedinAdapterSupportsChannelType,
  linkedinAdapterSupportsMediaKind,
  linkedinAdapterSupportsPlatform,
  linkedinAdapterSupportsPostKind,
  serializeSocialPlatformLinkedinAdapterContract,
  SOCIAL_PLATFORM_LINKEDIN_ADAPTER_CONTRACTS,
  SOCIAL_PLATFORM_LINKEDIN_ADAPTER_VERSION,
  validateSocialPlatformLinkedinAdapterContract,
  validateSocialPlatformLinkedinAdapterPostRequest,
  type SocialPlatformLinkedinAdapterChannelIdentity,
  type SocialPlatformLinkedinAdapterPostRequest,
} from "./social-platform-linkedin-adapter";

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

function validLinkedinPostRequest(): SocialPlatformLinkedinAdapterPostRequest {
  const contract = createSocialPlatformLinkedinAdapterContract();
  return {
    requestId: "linkedin-request-1",
    adapterId: contract.identity.adapterId,
    channel: linkedinChannel(),
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

await test("exposes frozen LinkedIn adapter contract", () => {
  assert.equal(SOCIAL_PLATFORM_LINKEDIN_ADAPTER_CONTRACTS.length, 1);
  const linkedin = createSocialPlatformLinkedinAdapterContract();
  assert.equal(linkedin.identity.adapterVersion, SOCIAL_PLATFORM_LINKEDIN_ADAPTER_VERSION);
  assert.equal(linkedin.identity.provider, "linkedin");
  assert.equal(linkedin.capabilities.supportsStoryPost, false);
  assert.equal(linkedin.grantsExecutionPermission, false);
});

await test("validates LinkedIn adapter contracts and round-trips serialization", () => {
  const contract = createSocialPlatformLinkedinAdapterContract();
  const validation = validateSocialPlatformLinkedinAdapterContract(contract);
  assert.equal(validation.valid, true);

  const serialized = serializeSocialPlatformLinkedinAdapterContract(contract);
  const hydrated = hydrateSocialPlatformLinkedinAdapterContract(serialized);
  assert.equal(hydrated.ok, true);
});

await test("supports platform, channel, post, and media capability checks", () => {
  const contract = createSocialPlatformLinkedinAdapterContract();
  assert.equal(linkedinAdapterSupportsPlatform(contract, "linkedin"), true);
  assert.equal(linkedinAdapterSupportsChannelType(contract, "linkedin_company_page"), true);
  assert.equal(linkedinAdapterSupportsPostKind(contract, "article_post"), true);
  assert.equal(linkedinAdapterSupportsMediaKind(contract, "carousel_ref"), true);
});

await test("validates post requests and detects forbidden states", () => {
  const contract = createSocialPlatformLinkedinAdapterContract();
  const request = validLinkedinPostRequest();
  const requestValidation = validateSocialPlatformLinkedinAdapterPostRequest(request);
  assert.equal(requestValidation.valid, true);

  const forbidden = detectSocialPlatformLinkedinAdapterForbiddenStates(contract, request);
  assert.equal(forbidden.valid, true);
});

await test("blocks missing media refs for article posts", () => {
  const contract = createSocialPlatformLinkedinAdapterContract();
  const request: SocialPlatformLinkedinAdapterPostRequest = {
    ...validLinkedinPostRequest(),
    postKind: "article_post",
    mediaRefs: [],
  };

  const forbidden = detectSocialPlatformLinkedinAdapterForbiddenStates(contract, request);
  assert.equal(forbidden.valid, false);
  assert.ok(forbidden.diagnostics.some((diagnostic) => diagnostic.code === "media_ref_required"));
});

await test("rejects network URLs in media storage references", () => {
  const request: SocialPlatformLinkedinAdapterPostRequest = {
    ...validLinkedinPostRequest(),
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

  const validation = validateSocialPlatformLinkedinAdapterPostRequest(request);
  assert.equal(validation.valid, false);
  assert.ok(
    validation.diagnostics.some((diagnostic) => diagnostic.code === "storage_reference_forbidden_url"),
  );
});

console.log("social-platform-linkedin-adapter tests passed");
