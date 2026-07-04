import assert from "node:assert/strict";

import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  type SocialCredentialAuditEventRecord,
  type SocialCredentialKeyVersionRecord,
  type SocialCredentialLifecycleStateRecord,
  type SocialCredentialPersistenceModel,
  type SocialCredentialProviderAccountRecord,
  type SocialCredentialVaultRecordRow,
} from "./social-credential-repository";
import {
  appendSocialCredentialAuditEvent,
  configureSocialCredentialStoreTestDependencies,
  createSocialCredentialProviderAccount,
  loadSocialCredentialSnapshot,
  type SocialCredentialStoreStorage,
} from "./social-credential-store";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function providerAccount(
  overrides: Partial<SocialCredentialProviderAccountRecord> = {},
): SocialCredentialProviderAccountRecord {
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
    ...overrides,
  };
}

function vaultRecord(
  overrides: Partial<SocialCredentialVaultRecordRow> = {},
): SocialCredentialVaultRecordRow {
  return {
    vault_record_id: "vault-1" as SocialCredentialVaultRecordRow["vault_record_id"],
    credential_ref_id: "cred-ref-1" as SocialCredentialVaultRecordRow["credential_ref_id"],
    provider: "meta",
    credential_kind: "oauth_token_ref",
    account_ref_id: "account-ref-meta-1",
    provider_account_id: "pa-meta-1" as SocialCredentialVaultRecordRow["provider_account_id"],
    publication_target_id: "target-1" as SocialCredentialVaultRecordRow["publication_target_id"],
    encrypted_payload_ref: "payload-****-1",
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
    ...overrides,
  };
}

function lifecycleState(
  overrides: Partial<SocialCredentialLifecycleStateRecord> = {},
): SocialCredentialLifecycleStateRecord {
  return {
    lifecycle_state_id: "state-1" as SocialCredentialLifecycleStateRecord["lifecycle_state_id"],
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
    ...overrides,
  };
}

function auditEvent(
  overrides: Partial<SocialCredentialAuditEventRecord> = {},
): SocialCredentialAuditEventRecord {
  return {
    audit_event_id: "audit-1" as SocialCredentialAuditEventRecord["audit_event_id"],
    credential_ref_id: "cred-ref-1" as SocialCredentialAuditEventRecord["credential_ref_id"],
    actor_admin_id: "admin-1",
    action: "create",
    outcome: "success",
    sanitized_detail: "Stored credential reference metadata.",
    created_at: "2026-01-01T00:00:00.000Z",
    append_only: true,
    contains_secrets: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
    ...overrides,
  };
}

function keyVersion(
  overrides: Partial<SocialCredentialKeyVersionRecord> = {},
): SocialCredentialKeyVersionRecord {
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
    ...overrides,
  };
}

function createInMemoryStorage(
  seed: SocialCredentialPersistenceModel = EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
): SocialCredentialStoreStorage {
  let providerAccounts = [...seed.provider_accounts].map((record) => clone(record));
  let vaultRecords = [...seed.vault_records].map((record) => clone(record));
  let lifecycleStates = [...seed.lifecycle_states].map((record) => clone(record));
  let auditEvents = [...seed.audit_events].map((record) => clone(record));
  let keyVersions = [...seed.key_versions].map((record) => clone(record));

  function removeById<T extends Record<string, unknown>>(
    collection: readonly T[],
    key: keyof T,
    value: string,
  ): { next: T[]; removed: T } {
    const index = collection.findIndex((item) => String(item[key]) === value);
    if (index < 0) {
      throw new Error(`Record not found: ${value}`);
    }
    const removed = collection[index] as T;
    const next = [...collection.slice(0, index), ...collection.slice(index + 1)];
    return { next, removed };
  }

  return {
    async loadSnapshot() {
      return clone({
        provider_accounts: providerAccounts,
        vault_records: vaultRecords,
        lifecycle_states: lifecycleStates,
        audit_events: auditEvents,
        key_versions: keyVersions,
      });
    },
    async insertProviderAccount(record) {
      providerAccounts = [...providerAccounts, clone(record)];
      return clone(record);
    },
    async updateProviderAccount(record) {
      providerAccounts = providerAccounts.map((current) =>
        current.provider_account_id === record.provider_account_id ? clone(record) : current,
      );
      return clone(record);
    },
    async deleteProviderAccount(providerAccountId) {
      const { next, removed } = removeById(
        providerAccounts,
        "provider_account_id",
        providerAccountId,
      );
      providerAccounts = next;
      return clone(removed);
    },
    async insertVaultRecord(record) {
      vaultRecords = [...vaultRecords, clone(record)];
      return clone(record);
    },
    async updateVaultRecord(record) {
      vaultRecords = vaultRecords.map((current) =>
        current.vault_record_id === record.vault_record_id ? clone(record) : current,
      );
      return clone(record);
    },
    async deleteVaultRecord(vaultRecordId) {
      const { next, removed } = removeById(
        vaultRecords,
        "vault_record_id",
        vaultRecordId,
      );
      vaultRecords = next;
      return clone(removed);
    },
    async insertLifecycleState(record) {
      lifecycleStates = [...lifecycleStates, clone(record)];
      return clone(record);
    },
    async updateLifecycleState(record) {
      lifecycleStates = lifecycleStates.map((current) =>
        current.lifecycle_state_id === record.lifecycle_state_id ? clone(record) : current,
      );
      return clone(record);
    },
    async deleteLifecycleState(lifecycleStateId) {
      const { next, removed } = removeById(
        lifecycleStates,
        "lifecycle_state_id",
        lifecycleStateId,
      );
      lifecycleStates = next;
      return clone(removed);
    },
    async insertAuditEvent(record) {
      auditEvents = [...auditEvents, clone(record)];
      return clone(record);
    },
    async insertKeyVersion(record) {
      keyVersions = [...keyVersions, clone(record)];
      return clone(record);
    },
    async updateKeyVersion(record) {
      keyVersions = keyVersions.map((current) =>
        current.key_version === record.key_version ? clone(record) : current,
      );
      return clone(record);
    },
    async deleteKeyVersion(keyVersionValue) {
      const { next, removed } = removeById(
        keyVersions,
        "key_version",
        keyVersionValue,
      );
      keyVersions = next;
      return clone(removed);
    },
  };
}

await test("creates provider accounts and rejects duplicate identities", async () => {
  configureSocialCredentialStoreTestDependencies(createInMemoryStorage());

  const created = await createSocialCredentialProviderAccount(providerAccount());
  assert.equal(created.ok, true);

  const duplicate = await createSocialCredentialProviderAccount(providerAccount());
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) {
    assert.equal(duplicate.error.code, "duplicate_identity");
  }

  const snapshot = await loadSocialCredentialSnapshot();
  assert.equal(snapshot.ok, true);
  if (snapshot.ok) {
    assert.equal(snapshot.value.provider_accounts.length, 1);
    assert.equal(snapshot.value.provider_accounts[0].provider, "meta");
  }
});

await test("validates records before writing and appends audit events", async () => {
  configureSocialCredentialStoreTestDependencies(createInMemoryStorage());

  const invalid = await createSocialCredentialProviderAccount({
    ...providerAccount(),
    grants_execution_permission: true,
  } as unknown as SocialCredentialProviderAccountRecord);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.error.code, "validation_failed");
  }

  const appended = await appendSocialCredentialAuditEvent(auditEvent());
  assert.equal(appended.ok, true);

  const snapshot = await loadSocialCredentialSnapshot();
  assert.equal(snapshot.ok, true);
  if (snapshot.ok) {
    assert.equal(snapshot.value.provider_accounts.length, 0);
    assert.equal(snapshot.value.audit_events.length, 1);
    assert.equal(snapshot.value.audit_events[0].append_only, true);
  }
});

await test("sorts snapshot rows deterministically on read", async () => {
  configureSocialCredentialStoreTestDependencies(
    createInMemoryStorage({
      provider_accounts: [
        providerAccount({
          provider_account_id: "pa-meta-2" as SocialCredentialProviderAccountRecord["provider_account_id"],
          created_at: "2026-01-02T00:00:00.000Z",
        }),
        providerAccount(),
      ],
      vault_records: [
        vaultRecord({
          vault_record_id: "vault-2" as SocialCredentialVaultRecordRow["vault_record_id"],
          created_at: "2026-01-02T00:00:00.000Z",
        }),
        vaultRecord(),
      ],
      lifecycle_states: [
        lifecycleState({
          lifecycle_state_id: "state-2" as SocialCredentialLifecycleStateRecord["lifecycle_state_id"],
          created_at: "2026-01-02T00:00:00.000Z",
        }),
        lifecycleState(),
      ],
      audit_events: [
        auditEvent({
          audit_event_id: "audit-2" as SocialCredentialAuditEventRecord["audit_event_id"],
          created_at: "2026-01-02T00:00:00.000Z",
        }),
        auditEvent(),
      ],
      key_versions: [
        keyVersion({
          key_version: "kv-2" as SocialCredentialKeyVersionRecord["key_version"],
          activated_at: "2026-01-02T00:00:00.000Z",
        }),
        keyVersion(),
      ],
    }),
  );

  const snapshot = await loadSocialCredentialSnapshot();
  assert.equal(snapshot.ok, true);
  if (snapshot.ok) {
    assert.deepEqual(
      snapshot.value.provider_accounts.map((record) => record.provider_account_id),
      ["pa-meta-1", "pa-meta-2"],
    );
    assert.deepEqual(
      snapshot.value.vault_records.map((record) => record.vault_record_id),
      ["vault-1", "vault-2"],
    );
    assert.deepEqual(
      snapshot.value.lifecycle_states.map((record) => record.lifecycle_state_id),
      ["state-1", "state-2"],
    );
    assert.deepEqual(
      snapshot.value.audit_events.map((record) => record.audit_event_id),
      ["audit-1", "audit-2"],
    );
    assert.deepEqual(
      snapshot.value.key_versions.map((record) => record.key_version),
      ["kv-1", "kv-2"],
    );
  }
});

configureSocialCredentialStoreTestDependencies(null);
console.log("social-credential-store tests passed");
