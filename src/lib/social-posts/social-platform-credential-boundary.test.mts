import assert from "node:assert/strict";

import {
  computeMissingCredentialKinds,
  createSocialPlatformCredentialBoundaryContract,
  detectSocialPlatformCredentialForbiddenStates,
  hydrateSocialPlatformCredentialBoundaryContract,
  isAuthorizationStateSufficient,
  providerForPlatform,
  requiredCredentialKindsForProvider,
  serializeSocialPlatformCredentialBoundaryContract,
  SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_CONTRACTS,
  SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
  validateSocialPlatformAccountAuthorizationState,
  validateSocialPlatformCredentialBoundaryContract,
  validateSocialPlatformRedactedCredentialReference,
  type SocialPlatformAccountAuthorizationState,
  type SocialPlatformRedactedCredentialReference,
} from "./social-platform-credential-boundary";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function modeledNotAuthorizedState(): SocialPlatformAccountAuthorizationState {
  const provider = "meta";
  const required = requiredCredentialKindsForProvider(provider);
  return {
    accountRefId: "account-ref-meta-1",
    provider,
    platform: "facebook",
    authorizationState: "not_authorized",
    requiredCredentialKinds: required,
    satisfiedCredentialRefIds: [],
    missingCredentialKinds: [...required],
    modeledOnly: true,
    referencesOnly: true,
    containsCredentials: false,
    containsOAuthTokens: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function validRedactedCredentialRef(): SocialPlatformRedactedCredentialReference {
  return {
    credentialRefId: "cred-ref-1",
    provider: "meta",
    credentialKind: "oauth_token_ref",
    accountRefId: "account-ref-meta-1",
    redactedHint: "oauth-token-****-ref",
    platform: "facebook",
    referencesOnly: true,
    containsSecretValue: false,
    containsTokenValue: false,
    containsRefreshToken: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

await test("exposes frozen credential boundary contracts for all providers", () => {
  assert.equal(SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_CONTRACTS.length, 3);
  const meta = createSocialPlatformCredentialBoundaryContract("meta");
  assert.equal(meta.identity.boundaryVersion, SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION);
  assert.equal(meta.capabilities.allowsLiveOAuth, false);
  assert.equal(meta.capabilities.allowsLiveCredentials, false);
  assert.equal(meta.grantsExecutionPermission, false);
});

await test("maps platforms to credential providers", () => {
  assert.equal(providerForPlatform("facebook"), "meta");
  assert.equal(providerForPlatform("instagram"), "meta");
  assert.equal(providerForPlatform("tiktok"), "tiktok");
  assert.equal(providerForPlatform("linkedin"), "linkedin");
});

await test("validates credential boundary contracts and round-trips serialization", () => {
  const contract = createSocialPlatformCredentialBoundaryContract("tiktok");
  const validation = validateSocialPlatformCredentialBoundaryContract(contract);
  assert.equal(validation.valid, true);

  const serialized = serializeSocialPlatformCredentialBoundaryContract(contract);
  const hydrated = hydrateSocialPlatformCredentialBoundaryContract(serialized);
  assert.equal(hydrated.ok, true);
});

await test("validates redacted credential references and rejects secret-like hints", () => {
  const valid = validateSocialPlatformRedactedCredentialReference(validRedactedCredentialRef());
  assert.equal(valid.valid, true);

  const invalid = validateSocialPlatformRedactedCredentialReference({
    ...validRedactedCredentialRef(),
    redactedHint: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature",
  });
  assert.equal(invalid.valid, false);
});

await test("computes missing credential kinds and authorization sufficiency", () => {
  const missing = computeMissingCredentialKinds("meta", ["oauth_token_ref"]);
  assert.ok(missing.includes("page_access_ref"));
  assert.equal(isAuthorizationStateSufficient("not_authorized"), false);
  assert.equal(isAuthorizationStateSufficient("authorized_reference"), true);
});

await test("detects forbidden credential states for insufficient authorization", () => {
  const contract = createSocialPlatformCredentialBoundaryContract("meta");
  const state = modeledNotAuthorizedState();
  const validation = validateSocialPlatformAccountAuthorizationState(state);
  assert.equal(validation.valid, true);

  const forbidden = detectSocialPlatformCredentialForbiddenStates(contract, state);
  assert.equal(forbidden.valid, false);
  assert.ok(forbidden.diagnostics.some((diagnostic) => diagnostic.severity === "block"));
});

console.log("social-platform-credential-boundary tests passed");
