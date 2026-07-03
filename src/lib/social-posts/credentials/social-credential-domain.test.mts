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
  validateSocialCredentialKeyVersion,
  validateSocialCredentialLifecycleState,
  validateSocialCredentialMetadataModel,
  validateSocialCredentialProviderAccountReference,
  validateSocialCredentialReference,
  validateSocialCredentialVaultRecordMetadata,
  type SocialCredentialLifecycleState,
  type SocialCredentialMetadataModel,
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

function validMetadataModel(): SocialCredentialMetadataModel {
  const providerAccount = validProviderAccount();
  const lifecycleState = validLifecycleState();
  return {
    providerAccounts: [providerAccount],
    credentialIdentities: [
      {
        credentialRefId: "cred-ref-1",
        provider: "meta",
        credentialKind: "oauth_token_ref",
        accountRefId: providerAccount.accountRefId,
        providerAccountId: providerAccount.providerAccountId,
        publicationTargetId: providerAccount.publicationTargetId,
        domainVersion: SOCIAL_CREDENTIAL_DOMAIN_VERSION,
        credentialBoundaryVersion: "d11-m7-v1",
        referencesOnly: true,
        containsSecretValue: false,
        containsTokenValue: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
    ],
    credentialReferences: [
      {
        credentialRefId: "cred-ref-1",
        provider: "meta",
        credentialKind: "oauth_token_ref",
        accountRefId: providerAccount.accountRefId,
        redactedHint: "oauth-ref-****-1234",
        referencesOnly: true,
        containsSecretValue: false,
        containsTokenValue: false,
        containsRefreshToken: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
    ],
    vaultRecordMetadata: [
      {
        vaultRecordId: "vault-meta-1",
        credentialRefId: "cred-ref-1",
        provider: "meta",
        credentialKind: "oauth_token_ref",
        accountRefId: providerAccount.accountRefId,
        providerAccountId: providerAccount.providerAccountId,
        publicationTargetId: providerAccount.publicationTargetId,
        encryptedPayloadRef: "metadata-ref-****-1234",
        keyVersion: "key-version-1",
        lifecyclePhase: "active",
        supersededAt: null,
        revokedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        metadataOnly: true,
        containsPlaintext: false,
        containsCiphertext: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
    ],
    lifecycleStates: [lifecycleState],
    auditEvents: [
      {
        auditEventId: "audit-1",
        credentialRefId: "cred-ref-1",
        actorAdminId: null,
        action: "read_metadata",
        outcome: "success",
        sanitizedDetail: "metadata read for credential reference",
        createdAt: "2026-01-01T00:00:00.000Z",
        appendOnly: true,
        containsSecrets: false,
        containsTokens: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
    ],
    keyVersions: [
      {
        keyVersion: "key-version-1",
        status: "active",
        activatedAt: "2026-01-01T00:00:00.000Z",
        retiredAt: null,
        metadataOnly: true,
        containsKeyMaterial: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
    ],
    metadataOnly: true,
    referencesOnly: true,
    containsSecrets: false,
    containsTokens: false,
    containsRefreshTokens: false,
    containsPlaintext: false,
    containsCiphertext: false,
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

await test("validates metadata-only vault records and key versions", () => {
  const vaultValidation = validateSocialCredentialVaultRecordMetadata(validMetadataModel().vaultRecordMetadata[0]);
  assert.equal(vaultValidation.valid, true);

  const invalidVaultTimestamp = validateSocialCredentialVaultRecordMetadata({
    ...validMetadataModel().vaultRecordMetadata[0],
    createdAt: "not-a-date",
  });
  assert.equal(invalidVaultTimestamp.valid, false);

  const keyVersionValidation = validateSocialCredentialKeyVersion(validMetadataModel().keyVersions[0]);
  assert.equal(keyVersionValidation.valid, true);
});

await test("validates complete credential metadata model", () => {
  const valid = validateSocialCredentialMetadataModel(validMetadataModel());
  assert.equal(valid.valid, true);

  const invalid = validateSocialCredentialMetadataModel({
    ...validMetadataModel(),
    containsTokens: true,
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

await test("rejects token-bearing lifecycle and reference fields", () => {
  const tokenState = validateSocialCredentialLifecycleState({
    ...validLifecycleState(),
    containsOAuthTokens: true,
  });
  assert.equal(tokenState.valid, false);

  const rawSecretReference = validateSocialCredentialReference({
    credentialRefId: "cred-ref-1",
    provider: "meta",
    credentialKind: "oauth_token_ref",
    accountRefId: "account-ref-meta-1",
    redactedHint: "oauth-ref-****-1234",
    accessToken: "Bearer definitely-not-allowed",
    referencesOnly: true,
    containsSecretValue: false,
    containsTokenValue: false,
    containsRefreshToken: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
  assert.equal(rawSecretReference.valid, false);
});

await test("detects forbidden credential states for missing kinds", () => {
  const forbidden = detectSocialCredentialForbiddenStates("meta", [], []);
  assert.equal(forbidden.valid, false);
  assert.ok(forbidden.diagnostics.some((diagnostic) => diagnostic.severity === "block"));
});

console.log("social-credential-domain tests passed");
