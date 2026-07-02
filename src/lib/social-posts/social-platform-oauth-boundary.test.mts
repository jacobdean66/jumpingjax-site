import assert from "node:assert/strict";

import {
  createSocialPlatformOAuthBoundaryContract,
  hydrateSocialPlatformOAuthBoundaryContract,
  oauthScopesForProvider,
  serializeSocialPlatformOAuthBoundaryContract,
  SOCIAL_PLATFORM_OAUTH_BOUNDARY_CONTRACTS,
  SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION,
  validateSocialPlatformOAuthBoundaryContract,
  validateSocialPlatformOAuthFlowBoundary,
  validateSocialPlatformOAuthStateReference,
  type SocialPlatformOAuthFlowBoundary,
  type SocialPlatformOAuthStateReference,
} from "./social-platform-oauth-boundary";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function validOAuthStateRef(): SocialPlatformOAuthStateReference {
  return {
    oauthStateRefId: "oauth-state-ref-1",
    provider: "meta",
    stateKind: "oauth_state_ref",
    redactedHint: "state-****-ref",
    referencesOnly: true,
    containsSecretValue: false,
    containsAuthorizationCode: false,
    containsAccessToken: false,
    containsRefreshToken: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function validOAuthFlow(): SocialPlatformOAuthFlowBoundary {
  return {
    flowId: "oauth-flow-meta-1",
    provider: "meta",
    phase: "authorize_modeled",
    requiredScopes: [...oauthScopesForProvider("meta")],
    oauthStateRefs: [validOAuthStateRef()],
    redirectUriReference: "internal://oauth/callback/meta",
    modeledOnly: true,
    contractOnly: true,
    liveOAuthBlocked: true,
    callsNoExternalApis: true,
    usesNoNetwork: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

await test("exposes frozen OAuth boundary contracts for all providers", () => {
  assert.equal(SOCIAL_PLATFORM_OAUTH_BOUNDARY_CONTRACTS.length, 3);
  const meta = createSocialPlatformOAuthBoundaryContract("meta");
  assert.equal(meta.identity.boundaryVersion, SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION);
  assert.equal(meta.capabilities.allowsLiveOAuth, false);
  assert.equal(meta.grantsExecutionPermission, false);
});

await test("lists modeled OAuth scopes per provider", () => {
  const metaScopes = oauthScopesForProvider("meta");
  assert.ok(metaScopes.includes("instagram_content_publish_modeled"));
  const tiktokScopes = oauthScopesForProvider("tiktok");
  assert.ok(tiktokScopes.includes("tiktok_content_post_modeled"));
});

await test("validates OAuth boundary contracts and round-trips serialization", () => {
  const contract = createSocialPlatformOAuthBoundaryContract("linkedin");
  const validation = validateSocialPlatformOAuthBoundaryContract(contract);
  assert.equal(validation.valid, true);

  const serialized = serializeSocialPlatformOAuthBoundaryContract(contract);
  const hydrated = hydrateSocialPlatformOAuthBoundaryContract(serialized);
  assert.equal(hydrated.ok, true);
});

await test("validates OAuth state references and flow boundaries", () => {
  const stateValidation = validateSocialPlatformOAuthStateReference(validOAuthStateRef());
  assert.equal(stateValidation.valid, true);

  const flowValidation = validateSocialPlatformOAuthFlowBoundary(validOAuthFlow());
  assert.equal(flowValidation.valid, true);

  const invalidFlow = validateSocialPlatformOAuthFlowBoundary({
    ...validOAuthFlow(),
    redirectUriReference: "https://example.com/oauth/callback",
  });
  assert.equal(invalidFlow.valid, false);
});

console.log("social-platform-oauth-boundary tests passed");
