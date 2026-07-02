import assert from "node:assert/strict";

import {
  SOCIAL_CREDENTIAL_DOMAIN_CONTRACT,
  SOCIAL_CREDENTIAL_DOMAIN_VERSION,
  authorizationStateForLifecyclePhase,
  detectSocialCredentialForbiddenStates,
  hydrateSocialCredentialDomainContract,
  isLifecycleTransitionValid,
  serializeSocialCredentialDomainContract,
  validateSocialCredentialDomainContract,
  validateSocialCredentialLifecycleState,
  validateSocialCredentialProviderAccountReference,
  validateSocialCredentialReference,
  type SocialCredentialLifecycleState,
  type SocialCredentialProviderAccountReference,
} from "./social-credential-domain";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function validProviderAccount(): SocialCredentialProviderAccountReference {
  return {
    providerAccountId: "pa-meta-1",
    provider: "meta",
    publicationTargetId: "target-1",
    externalAccountIdRedacted: "page-****-1234",
    displayNameRedacted: "Jumping Jax Page",
    status: "registered",
    accountRefId: "account-ref-meta-1",
    referencesOnly: true,
    containsCredentials: false,
    containsOAuthTokens: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function validLifecycleState(): SocialCredentialLifecycleState {
  return {
    lifecycleStateId: "life-1",
    credentialRefId: "cred-ref-1",
    accountRefId: "account-ref-meta-1",
    provider: "meta",
    authorizationState: "authorized_reference",
    lifecyclePhase: "active",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2027-01-01T00:00:00.000Z",
    lastRotatedAt: null,
    revokedAt: null,
    scopeFingerprintRedacted: "scope-****-fp",
    modeledOnly: true,
    referencesOnly: true,
    containsCredentials: false,
    containsOAuthTokens: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

await test("exposes frozen credential domain contract", () => {
  assert.equal(SOCIAL_CREDENTIAL_DOMAIN_CONTRACT.identity.domainVersion, SOCIAL_CREDENTIAL_DOMAIN_VERSION);
  assert.equal(SOCIAL_CREDENTIAL_DOMAIN_CONTRACT.capabilities.allowsEncryption, false);
  assert.equal(SOCIAL_CREDENTIAL_DOMAIN_CONTRACT.grantsExecutionPermission, false);
});

await test("validates domain contract and round-trips serialization", () => {
  const validation = validateSocialCredentialDomainContract(SOCIAL_CREDENTIAL_DOMAIN_CONTRACT);
  assert.equal(validation.valid, true);

  const serialized = serializeSocialCredentialDomainContract();
  const hydrated = hydrateSocialCredentialDomainContract(serialized);
  assert.equal(hydrated.ok, true);
});

await test("validates provider account references", () => {
  const valid = validateSocialCredentialProviderAccountReference(validProviderAccount());
  assert.equal(valid.valid, true);
});

await test("maps lifecycle phases to authorization states", () => {
  assert.equal(authorizationStateForLifecyclePhase("active"), "authorized_reference");
  assert.equal(authorizationStateForLifecyclePhase("expired"), "expired_reference");
  assert.equal(isLifecycleTransitionValid("pending", "active"), true);
  assert.equal(isLifecycleTransitionValid("revoked", "active"), false);
});

await test("validates lifecycle state phase alignment", () => {
  const valid = validateSocialCredentialLifecycleState(validLifecycleState());
  assert.equal(valid.valid, true);

  const invalid = validateSocialCredentialLifecycleState({
    ...validLifecycleState(),
    lifecyclePhase: "active",
    authorizationState: "not_authorized",
  });
  assert.equal(invalid.valid, false);
});

await test("rejects secret-like credential references", () => {
  const invalid = validateSocialCredentialReference({
    credentialRefId: "cred-ref-1",
    provider: "meta",
    credentialKind: "oauth_token_ref",
    accountRefId: "account-ref-meta-1",
    redactedHint: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature",
    referencesOnly: true,
    containsSecretValue: false,
    containsTokenValue: false,
    containsRefreshToken: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
  assert.equal(invalid.valid, false);
});

await test("detects forbidden credential states for missing kinds", () => {
  const forbidden = detectSocialCredentialForbiddenStates("meta", [], []);
  assert.equal(forbidden.valid, false);
  assert.ok(forbidden.diagnostics.some((diagnostic) => diagnostic.severity === "block"));
});

console.log("social-credential-domain tests passed");
