import assert from "node:assert/strict";

import { SOCIAL_CREDENTIAL_DOMAIN_VERSION } from "./social-credential-domain";
import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_BOUNDARY,
  SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
  SOCIAL_CREDENTIAL_STORAGE_CONTRACT,
  createSocialCredentialRepository,
  mapAuditEventRecordToDomain,
  mapKeyVersionRecordToDomain,
  mapProviderAccountRecordToReference,
  mapVaultRecordRowToMetadata,
  mapVaultRecordRowToCredentialIdentity,
  mapVaultRecordRowToCredentialReference,
  validateDomainMappingsFromPersistenceModel,
  validateSocialCredentialPersistenceAdapterContract,
  validateSocialCredentialPersistenceModel,
  validateSocialCredentialLifecycleStateRecord,
  validateSocialCredentialProviderAccountRecord,
  validateSocialCredentialVaultRecordRow,
  type SocialCredentialAuditEventRecord,
  type SocialCredentialKeyVersionRecord,
  type SocialCredentialLifecycleStateRecord,
  type SocialCredentialPersistenceAdapterBoundary,
  type SocialCredentialPersistenceAdapterContract,
  type SocialCredentialPersistenceModel,
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

const VALID_ADAPTER_CONTRACT: SocialCredentialPersistenceAdapterContract = {
  adapterId: "test-credential-persistence-adapter",
  repositoryVersion: SOCIAL_CREDENTIAL_REPOSITORY_VERSION,
  domainVersion: SOCIAL_CREDENTIAL_DOMAIN_VERSION,
  capabilities: {
    adapterBoundaryOnly: true,
    referenceOnly: true,
    metadataOnly: true,
    storesNoSecrets: true,
    storesNoTokens: true,
    storesNoPlaintext: true,
    exposesNoSql: true,
    usesNoSupabase: true,
    usesNoNetwork: true,
    performsNoEncryption: true,
    performsNoDecryption: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  },
};

function createTestCredentialPersistenceAdapter(
  seed: SocialCredentialPersistenceModel = EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
): SocialCredentialPersistenceAdapterBoundary {
  let snapshot = seed;

  return {
    contract: VALID_ADAPTER_CONTRACT,
    loadSnapshot() {
      return { ok: true, value: snapshot };
    },
    persistSnapshot(model) {
      snapshot = model;
      return { ok: true, value: snapshot };
    },
  };
}

await test("exposes reference-only storage contract", () => {
  assert.equal(SOCIAL_CREDENTIAL_STORAGE_CONTRACT.contractVersion, SOCIAL_CREDENTIAL_REPOSITORY_VERSION);
  assert.equal(SOCIAL_CREDENTIAL_STORAGE_CONTRACT.adapterBoundaryOnly, true);
  assert.equal(SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsSql, false);
  assert.equal(SOCIAL_CREDENTIAL_STORAGE_CONTRACT.allowsSupabase, false);
  assert.equal(SOCIAL_CREDENTIAL_STORAGE_CONTRACT.grantsExecutionPermission, false);
});

await test("preserves append-only audit boundary without update or delete operations", () => {
  assert.equal(SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_BOUNDARY.version, SOCIAL_CREDENTIAL_REPOSITORY_VERSION);
  assert.deepEqual(SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_BOUNDARY.appendOnlyCollections, ["audit_events"]);
  assert.deepEqual(SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_BOUNDARY.appendOnlyOperations, ["appendAuditEvent"]);
  assert.deepEqual(SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_BOUNDARY.forbiddenAuditMutations, [
    "updateAuditEvent",
    "deleteAuditEvent",
  ]);
  assert.equal(SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_BOUNDARY.auditEventsImmutable, true);
  assert.equal(SOCIAL_CREDENTIAL_REPOSITORY_APPEND_ONLY_BOUNDARY.preservesW2AppendOnlySemantics, true);

  const repository = createSocialCredentialRepository(createTestCredentialPersistenceAdapter());
  assert.equal("appendAuditEvent" in repository, true);
  assert.equal("updateAuditEvent" in repository, false);
  assert.equal("deleteAuditEvent" in repository, false);
});

await test("validates abstract persistence adapter contract boundaries", () => {
  assert.equal(validateSocialCredentialPersistenceAdapterContract(VALID_ADAPTER_CONTRACT).ok, true);

  const invalid = validateSocialCredentialPersistenceAdapterContract({
    ...VALID_ADAPTER_CONTRACT,
    capabilities: {
      ...VALID_ADAPTER_CONTRACT.capabilities,
      usesNoNetwork: false,
    },
  });
  assert.equal(invalid.ok, false);
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

await test("validates lifecycle state records and rejects unsupported authorization_state", () => {
  const valid = validateSocialCredentialLifecycleStateRecord(validLifecycleStateRecord());
  assert.equal(valid.ok, true);

  const invalid = validateSocialCredentialLifecycleStateRecord({
    ...validLifecycleStateRecord(),
    authorization_state: "authorized" as SocialCredentialLifecycleStateRecord["authorization_state"],
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.errors.some((error) => error.code === "authorization_state_invalid"), true);
  }
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

  const identity = mapVaultRecordRowToCredentialIdentity(validVaultRecordRow());
  assert.equal(identity.referencesOnly, true);
  assert.equal(identity.containsTokenValue, false);

  const credentialReference = mapVaultRecordRowToCredentialReference(validVaultRecordRow());
  assert.equal(credentialReference.containsRefreshToken, false);

  const auditEvent = mapAuditEventRecordToDomain(validAuditEventRecord());
  assert.equal(auditEvent.containsTokens, false);

  const keyVersion = mapKeyVersionRecordToDomain(validKeyVersionRecord());
  assert.equal(keyVersion.containsKeyMaterial, false);
});

await test("repository rejects unavailable or unsafe persistence adapters", () => {
  const invalidAdapter = createTestCredentialPersistenceAdapter();
  const unsafeContract = {
    ...VALID_ADAPTER_CONTRACT,
    capabilities: {
      ...VALID_ADAPTER_CONTRACT.capabilities,
      storesNoTokens: false,
    },
  } as unknown as SocialCredentialPersistenceAdapterContract;
  const repository = createSocialCredentialRepository({
    ...invalidAdapter,
    contract: unsafeContract,
  });

  const listed = repository.listProviderAccounts();
  assert.equal(listed.ok, false);
  if (!listed.ok) assert.equal(listed.error.code, "adapter_contract_invalid");
});

await test("adapter-backed repository supports provider account CRUD boundary validation", () => {
  const repository = createSocialCredentialRepository(createTestCredentialPersistenceAdapter());
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

await test("adapter-backed repository validates credential metadata CRUD and append-only audit", () => {
  const repository = createSocialCredentialRepository(createTestCredentialPersistenceAdapter());
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
