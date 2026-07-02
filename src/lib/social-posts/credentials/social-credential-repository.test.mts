import assert from "node:assert/strict";

import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
  SOCIAL_CREDENTIAL_STORAGE_CONTRACT,
  mapProviderAccountRecordToReference,
  mapVaultRecordRowToMetadata,
  validateDomainMappingsFromPersistenceModel,
  validateSocialCredentialPersistenceModel,
  validateSocialCredentialProviderAccountRecord,
  validateSocialCredentialVaultRecordRow,
  type SocialCredentialProviderAccountRecord,
  type SocialCredentialVaultRecordRow,
} from "./social-credential-repository";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function validProviderAccountRecord(): SocialCredentialProviderAccountRecord {
  return {
    provider_account_id: "pa-meta-1" as SocialCredentialProviderAccountRecord["provider_account_id"],
    provider: "meta",
    publication_target_id: "target-1" as SocialCredentialProviderAccountRecord["publication_target_id"],
    external_account_id_redacted: "page-****-1234",
    display_name_redacted: "Jumping Jax Page",
    status: "registered",
    account_ref_id: "account-ref-meta-1",
    created_at: "2026-01-01T00:00:00.000Z",
    references_only: true,
    contains_credentials: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };
}

function validVaultRecordRow(): SocialCredentialVaultRecordRow {
  return {
    vault_record_id: "vault-1" as SocialCredentialVaultRecordRow["vault_record_id"],
    credential_ref_id: "cred-ref-1" as SocialCredentialVaultRecordRow["credential_ref_id"],
    provider: "meta",
    credential_kind: "oauth_token_ref",
    account_ref_id: "account-ref-meta-1",
    provider_account_id: "pa-meta-1" as SocialCredentialVaultRecordRow["provider_account_id"],
    publication_target_id: "target-1" as SocialCredentialVaultRecordRow["publication_target_id"],
    encrypted_payload_ref: "envelope-ref-****-1",
    key_version: "kv-1",
    lifecycle_phase: "active",
    superseded_at: null,
    revoked_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    metadata_only: true,
    contains_plaintext: false,
    contains_ciphertext: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };
}

await test("exposes reference-only storage contract", () => {
  assert.equal(SOCIAL_CREDENTIAL_STORAGE_CONTRACT.contractVersion, SOCIAL_CREDENTIAL_REPOSITORY_VERSION);
  assert.equal(SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsSql, false);
  assert.equal(SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsSupabase, false);
  assert.equal(SOCIAL_CREDENTIAL_STORAGE_CONTRACT.grantsExecutionPermission, false);
});

await test("validates empty persistence model", () => {
  const validation = validateSocialCredentialPersistenceModel(EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL);
  assert.equal(validation.ok, true);
});

await test("validates provider account records and rejects secrets", () => {
  const valid = validateSocialCredentialProviderAccountRecord(validProviderAccountRecord());
  assert.equal(valid.ok, true);

  const invalid = validateSocialCredentialProviderAccountRecord({
    ...validProviderAccountRecord(),
    access_token: "forbidden",
  });
  assert.equal(invalid.ok, false);
});

await test("validates vault record rows as metadata-only", () => {
  const valid = validateSocialCredentialVaultRecordRow(validVaultRecordRow());
  assert.equal(valid.ok, true);

  const invalid = validateSocialCredentialVaultRecordRow({
    ...validVaultRecordRow(),
    ciphertext: "forbidden",
  });
  assert.equal(invalid.ok, false);
});

await test("maps persistence records to domain references", () => {
  const model = {
    ...EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
    provider_accounts: [validProviderAccountRecord()],
    vault_records: [validVaultRecordRow()],
  };
  const mapping = validateDomainMappingsFromPersistenceModel(model);
  assert.equal(mapping.ok, true);

  const reference = mapProviderAccountRecordToReference(validProviderAccountRecord());
  assert.equal(reference.referencesOnly, true);

  const metadata = mapVaultRecordRowToMetadata(validVaultRecordRow());
  assert.equal(metadata.metadataOnly, true);
  assert.equal(metadata.containsPlaintext, false);
});

console.log("social-credential-repository tests passed");
