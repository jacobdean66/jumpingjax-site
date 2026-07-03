import assert from "node:assert/strict";

import {
  EMPTY_SOCIAL_CREDENTIAL_STORAGE_SCHEMA_MODEL,
  SOCIAL_CREDENTIAL_STORAGE_METADATA_VERSION,
  SOCIAL_CREDENTIAL_STORAGE_SCHEMA_METADATA,
  SOCIAL_CREDENTIAL_STORAGE_SCHEMA_VERSION,
  isSocialCredentialStorageSchemaTable,
  validateSocialCredentialKeyVersionSchemaModel,
  validateSocialCredentialMetadataSchemaModel,
  validateSocialCredentialProviderAccountSchemaModel,
  validateSocialCredentialRecordSchemaModel,
  validateSocialCredentialStorageSchemaMetadata,
  validateSocialCredentialStorageSchemaModel,
  type SocialCredentialKeyVersionSchemaModel,
  type SocialCredentialMetadataSchemaModel,
  type SocialCredentialProviderAccountSchemaModel,
  type SocialCredentialRecordSchemaModel,
  type SocialCredentialStorageSchemaModel,
} from "./social-credential-storage-schema";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function validProviderAccount(): SocialCredentialProviderAccountSchemaModel {
  return {
    table: "social_credential_provider_accounts",
    schemaVersion: SOCIAL_CREDENTIAL_STORAGE_SCHEMA_VERSION,
    providerAccountId: "pa-meta-1",
    provider: "meta",
    publicationTargetId: "target-1",
    externalAccountIdRedacted: "page-****-1234",
    displayNameRedacted: "Jumping Jax Page",
    accountRefId: "account-ref-meta-1",
    status: "registered",
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z",
    designOnly: true,
    referenceOnly: true,
    containsCredentials: false,
    containsOAuthTokens: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function validCredentialRecord(): SocialCredentialRecordSchemaModel {
  return {
    table: "social_credential_records",
    schemaVersion: SOCIAL_CREDENTIAL_STORAGE_SCHEMA_VERSION,
    credentialRecordId: "credential-record-1",
    credentialRefId: "credential-ref-1",
    providerAccountId: "pa-meta-1",
    accountRefId: "account-ref-meta-1",
    publicationTargetId: "target-1",
    provider: "meta",
    credentialKind: "oauth_token_ref",
    lifecyclePhase: "active",
    encryptedPayloadRef: "vault-envelope-ref-****-1",
    keyVersion: "kv-1",
    redactedHint: "credential-****-1234",
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z",
    expiresAt: null,
    revokedAt: null,
    supersededByCredentialRefId: null,
    designOnly: true,
    metadataOnly: true,
    referenceOnly: true,
    containsSecretValue: false,
    containsTokenValue: false,
    containsRefreshToken: false,
    containsPlaintext: false,
    containsCiphertext: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function validCredentialMetadata(): SocialCredentialMetadataSchemaModel {
  return {
    table: "social_credential_metadata",
    schemaVersion: SOCIAL_CREDENTIAL_STORAGE_SCHEMA_VERSION,
    metadataVersion: SOCIAL_CREDENTIAL_STORAGE_METADATA_VERSION,
    metadataId: "credential-metadata-1",
    credentialRefId: "credential-ref-1",
    providerAccountId: "pa-meta-1",
    provider: "meta",
    lifecyclePhase: "active",
    scopeFingerprintRedacted: "scope-****-1",
    readinessFingerprintRedacted: "ready-****-1",
    lastValidatedAt: null,
    createdAt: "2026-07-03T00:00:00.000Z",
    designOnly: true,
    metadataOnly: true,
    referenceOnly: true,
    containsSecrets: false,
    containsTokens: false,
    containsPlaintext: false,
    containsCiphertext: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function validKeyVersion(): SocialCredentialKeyVersionSchemaModel {
  return {
    table: "social_credential_key_versions",
    schemaVersion: SOCIAL_CREDENTIAL_STORAGE_SCHEMA_VERSION,
    keyVersion: "kv-1",
    status: "active",
    activatedAt: "2026-07-03T00:00:00.000Z",
    retiredAt: null,
    designOnly: true,
    metadataOnly: true,
    containsKeyMaterial: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function validStorageSchema(): SocialCredentialStorageSchemaModel {
  return {
    ...EMPTY_SOCIAL_CREDENTIAL_STORAGE_SCHEMA_MODEL,
    providerAccounts: [validProviderAccount()],
    credentialRecords: [validCredentialRecord()],
    credentialMetadata: [validCredentialMetadata()],
    keyVersions: [validKeyVersion()],
  };
}

await test("exposes D13 Wave 3 storage schema versions and metadata", () => {
  assert.equal(SOCIAL_CREDENTIAL_STORAGE_SCHEMA_VERSION, "d13-w3-v1");
  assert.equal(SOCIAL_CREDENTIAL_STORAGE_METADATA_VERSION, "d13-w3-metadata-v1");
  assert.equal(SOCIAL_CREDENTIAL_STORAGE_SCHEMA_METADATA.designOnly, true);
  assert.equal(SOCIAL_CREDENTIAL_STORAGE_SCHEMA_METADATA.containsSql, false);
  assert.equal(SOCIAL_CREDENTIAL_STORAGE_SCHEMA_METADATA.connectsToSupabase, false);
  assert.equal(validateSocialCredentialStorageSchemaMetadata(SOCIAL_CREDENTIAL_STORAGE_SCHEMA_METADATA).ok, true);
});

await test("recognizes only modeled schema table identifiers", () => {
  assert.equal(isSocialCredentialStorageSchemaTable("social_credential_records"), true);
  assert.equal(isSocialCredentialStorageSchemaTable("oauth_tokens"), false);
});

await test("validates provider account schema models", () => {
  assert.equal(validateSocialCredentialProviderAccountSchemaModel(validProviderAccount()).ok, true);
  assert.equal(validateSocialCredentialProviderAccountSchemaModel({
    ...validProviderAccount(),
    containsCredentials: true,
  }).ok, false);
});

await test("validates credential record schema models as metadata-only references", () => {
  assert.equal(validateSocialCredentialRecordSchemaModel(validCredentialRecord()).ok, true);
  const invalid = validateSocialCredentialRecordSchemaModel({
    ...validCredentialRecord(),
    redactedHint: "Bearer not-allowed",
  });
  assert.equal(invalid.ok, false);
});

await test("validates metadata and key version schema models", () => {
  assert.equal(validateSocialCredentialMetadataSchemaModel(validCredentialMetadata()).ok, true);
  assert.equal(validateSocialCredentialKeyVersionSchemaModel(validKeyVersion()).ok, true);
  assert.equal(validateSocialCredentialKeyVersionSchemaModel({
    ...validKeyVersion(),
    containsKeyMaterial: true,
  }).ok, false);
});

await test("validates complete storage schema model safety boundaries", () => {
  assert.equal(validateSocialCredentialStorageSchemaModel(validStorageSchema()).ok, true);
  const invalid = validateSocialCredentialStorageSchemaModel({
    ...validStorageSchema(),
    usesNetwork: true,
  });
  assert.equal(invalid.ok, false);
});

await test("rejects secret, token, SQL, OAuth, and ciphertext fields", () => {
  const invalid = validateSocialCredentialStorageSchemaModel({
    ...validStorageSchema(),
    token: "forbidden",
    sql: "select * from social_credential_records",
    credentialRecords: [{
      ...validCredentialRecord(),
      ciphertext: "forbidden",
    }],
  });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.diagnostics.some((item) => item.code === "secret_forbidden"));
});

console.log("social-credential-storage-schema tests passed");
