import assert from "node:assert/strict";

import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
  SOCIAL_CREDENTIAL_STORAGE_CONTRACT,
  createReferenceSocialCredentialPersistencePort,
  createReferenceSocialCredentialRepository,
  mapProviderAccountRecordToReference,
  mapVaultRecordRowToMetadata,
  validateDomainMappingsFromPersistenceModel,
  validateSocialCredentialPersistenceModel,
  validateSocialCredentialProviderAccountRecord,
  validateSocialCredentialVaultRecordRow,
  type SocialCredentialAuditEventRecord,
  type SocialCredentialKeyVersionRecord,
  type SocialCredentialLifecycleStateRecord,
  type SocialCredentialProviderAccountRecord,
  type SocialCredentialRepositoryResult,
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

function validLifecycleStateRecord(): SocialCredentialLifecycleStateRecord {
  return {
    lifecycle_state_id: "life-1" as SocialCredentialLifecycleStateRecord["lifecycle_state_id"],
    credential_ref_id: "cred-ref-1" as SocialCredentialLifecycleStateRecord["credential_ref_id"],
    account_ref_id: "account-ref-meta-1",
    provider: "meta",
    authorization_state: "authorized_reference",
    lifecycle_phase: "active",
    issued_at: "2026-01-01T00:00:00.000Z",
    expires_at: null,
    last_rotated_at: null,
    revoked_at: null,
    scope_fingerprint_redacted: "scope-****-1",
    created_at: "2026-01-01T00:00:00.000Z",
    modeled_only: true,
    references_only: true,
    contains_credentials: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };
}

function validAuditEventRecord(): SocialCredentialAuditEventRecord {
  return {
    audit_event_id: "audit-1" as SocialCredentialAuditEventRecord["audit_event_id"],
    credential_ref_id: "cred-ref-1" as SocialCredentialAuditEventRecord["credential_ref_id"],
    actor_admin_id: "admin-1",
    action: "create",
    outcome: "success",
    sanitized_detail: "Registered credential reference metadata.",
    created_at: "2026-01-01T00:00:00.000Z",
    append_only: true,
    contains_secrets: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };
}

function validKeyVersionRecord(): SocialCredentialKeyVersionRecord {
  return {
    key_version: "kv-1" as SocialCredentialKeyVersionRecord["key_version"],
    status: "active",
    activated_at: "2026-01-01T00:00:00.000Z",
    retired_at: null,
    metadata_only: true,
    contains_key_material: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };
}

function assertOk<T>(result: SocialCredentialRepositoryResult<T>): T {
  if (result.ok) return result.value;
  assert.fail(result.error.message);
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

await test("reference persistence port snapshots validated metadata only state", () => {
  const port = createReferenceSocialCredentialPersistencePort();
  const saved = assertOk(port.save({
    ...EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
    provider_accounts: [validProviderAccountRecord()],
  }));
  assert.equal(saved.provider_accounts.length, 1);

  const rejected = port.save({
    ...EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
    provider_accounts: [{ ...validProviderAccountRecord(), accessToken: "forbidden" } as SocialCredentialProviderAccountRecord],
  });
  assert.equal(rejected.ok, false);
});

await test("reference repository supports provider account CRUD contracts", () => {
  const repository = createReferenceSocialCredentialRepository();
  const created = assertOk(repository.createProviderAccount({ providerAccount: validProviderAccountRecord() }));
  assert.equal(created.provider_account_id, "pa-meta-1");

  const updated = assertOk(repository.updateProviderAccount({
    providerAccount: {
      ...validProviderAccountRecord(),
      display_name_redacted: "Jumping Jax Meta",
    },
  }));
  assert.equal(updated.display_name_redacted, "Jumping Jax Meta");

  const listed = assertOk(repository.listProviderAccounts({ provider: "meta" }));
  assert.equal(listed.length, 1);

  const deleted = assertOk(repository.deleteProviderAccount({ provider_account_id: "pa-meta-1" }));
  assert.equal(deleted.provider_account_id, "pa-meta-1");
  assert.equal(assertOk(repository.listProviderAccounts()).length, 0);
});

await test("reference repository validates credential metadata CRUD and append-only audit", () => {
  const repository = createReferenceSocialCredentialRepository();
  assertOk(repository.createVaultRecordMetadata({ vaultRecord: validVaultRecordRow() }));
  assertOk(repository.createLifecycleState({ lifecycleState: validLifecycleStateRecord() }));
  assertOk(repository.appendAuditEvent({ auditEvent: validAuditEventRecord() }));
  assertOk(repository.createKeyVersion({ keyVersion: validKeyVersionRecord() }));

  const records = assertOk(repository.getCredentialRecordsByIdentity({ credential_ref_id: "cred-ref-1" }));
  assert.equal(records.vault_records.length, 1);
  assert.equal(records.lifecycle_states.length, 1);
  assert.equal(records.audit_events.length, 1);

  const duplicateAudit = repository.appendAuditEvent({ auditEvent: validAuditEventRecord() });
  assert.equal(duplicateAudit.ok, false);

  const updatedLifecycle = assertOk(repository.updateLifecycleState({
    lifecycleState: {
      ...validLifecycleStateRecord(),
      authorization_state: "revoked_reference",
      lifecycle_phase: "superseded",
    },
  }));
  assert.equal(updatedLifecycle.lifecycle_phase, "superseded");

  assert.equal(assertOk(repository.deleteVaultRecordMetadata({ vault_record_id: "vault-1" })).vault_record_id, "vault-1");
  assert.equal(assertOk(repository.deleteLifecycleState({ lifecycle_state_id: "life-1" })).lifecycle_state_id, "life-1");
  assert.equal(assertOk(repository.deleteKeyVersion({ key_version: "kv-1" })).key_version, "kv-1");
});

console.log("social-credential-repository tests passed");
