import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  type SocialCredentialPersistenceModel,
  type SocialCredentialVaultRecordRow,
} from "../credentials/social-credential-repository";
import {
  configureSocialCredentialStoreTestDependencies,
  type SocialCredentialStoreStorage,
} from "../credentials/social-credential-store";
import {
  buildMetaPageVaultAccountRefId,
  buildMetaPageVaultProviderAccountId,
  redactMetaAccountId,
} from "./social-meta-oauth-client";
import type { SocialOAuthRuntimeConfig } from "./social-oauth-config";
import {
  encryptOAuthSecret,
  serializeOAuthEnvelope,
} from "./social-oauth-credential-envelope";
import { loadMetaPageAccessTokenForPublicationTarget } from "./social-oauth-token-loader";
import { isActiveMetaPageAccessVaultRecordForIdentity } from "./social-oauth-vault-integration";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createInMemoryStorage(
  seed: SocialCredentialPersistenceModel = EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
): SocialCredentialStoreStorage & {
  updateVaultRecordDirect: (
    record: SocialCredentialVaultRecordRow,
  ) => Promise<void>;
  listVaultRecords: () => SocialCredentialVaultRecordRow[];
} {
  let providerAccounts = [...seed.provider_accounts].map((record) => clone(record));
  let vaultRecords = [...seed.vault_records].map((record) => clone(record));
  let lifecycleStates = [...seed.lifecycle_states].map((record) => clone(record));
  let auditEvents = [...seed.audit_events].map((record) => clone(record));
  let keyVersions = [...seed.key_versions].map((record) => clone(record));

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
        current.provider_account_id === record.provider_account_id
          ? clone(record)
          : current,
      );
      return clone(record);
    },
    async deleteProviderAccount() {
      throw new Error("unused");
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
    async deleteVaultRecord() {
      throw new Error("unused");
    },
    async insertLifecycleState(record) {
      lifecycleStates = [...lifecycleStates, clone(record)];
      return clone(record);
    },
    async updateLifecycleState(record) {
      lifecycleStates = lifecycleStates.map((current) =>
        current.lifecycle_state_id === record.lifecycle_state_id
          ? clone(record)
          : current,
      );
      return clone(record);
    },
    async deleteLifecycleState() {
      throw new Error("unused");
    },
    async insertAuditEvent(record) {
      auditEvents = [...auditEvents, clone(record)];
      return clone(record);
    },
    async insertKeyVersion(record) {
      keyVersions = [...keyVersions, clone(record)];
      return clone(record);
    },
    async updateKeyVersion() {
      throw new Error("unused");
    },
    async deleteKeyVersion() {
      throw new Error("unused");
    },
    async updateVaultRecordDirect(record) {
      vaultRecords = vaultRecords.map((current) =>
        current.vault_record_id === record.vault_record_id ? clone(record) : current,
      );
    },
    listVaultRecords() {
      return clone(vaultRecords);
    },
  };
}

const PAGE_A = "1111111111111111";
const PAGE_B = "2222222222221111"; // same last 4 as PAGE_A
const TARGET = "target-vault-1";
const MASTER_KEY = Buffer.alloc(32, 7);

const TEST_CONFIG: SocialOAuthRuntimeConfig = {
  oauthEnabled: true,
  metaOAuthEnabled: true,
  metaAppId: "app",
  metaAppSecret: "secret",
  vaultMasterKey: MASTER_KEY,
  callbackRedirectBaseUrl: "https://example.test",
  redirectUriAllowlist: ["https://example.test/callback"],
};

function pageVaultRecord(input: {
  pageId: string;
  accessToken: string;
  vaultRecordId: string;
  credentialRefId: string;
}): SocialCredentialVaultRecordRow {
  return {
    vault_record_id:
      input.vaultRecordId as SocialCredentialVaultRecordRow["vault_record_id"],
    credential_ref_id:
      input.credentialRefId as SocialCredentialVaultRecordRow["credential_ref_id"],
    provider: "meta",
    credential_kind: "page_access_ref",
    account_ref_id: buildMetaPageVaultAccountRefId(input.pageId),
    provider_account_id: buildMetaPageVaultProviderAccountId(
      TARGET,
      input.pageId,
    ) as SocialCredentialVaultRecordRow["provider_account_id"],
    publication_target_id:
      TARGET as SocialCredentialVaultRecordRow["publication_target_id"],
    encrypted_payload_ref: serializeOAuthEnvelope(
      encryptOAuthSecret(input.accessToken, MASTER_KEY),
    ),
    key_version: "vault-master-v1",
    lifecycle_phase: "active",
    superseded_at: null,
    revoked_at: null,
    created_at: "2026-08-01T00:00:00.000Z",
    metadata_only: true,
    contains_plaintext: false,
    contains_ciphertext: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };
}

test("distinct Page IDs with identical last-4 digits get non-colliding vault identity keys", () => {
  assert.equal(redactMetaAccountId(PAGE_A), redactMetaAccountId(PAGE_B));
  const legacyColliding = `meta-page:${redactMetaAccountId(PAGE_A)}`;
  const refA = buildMetaPageVaultAccountRefId(PAGE_A);
  const refB = buildMetaPageVaultAccountRefId(PAGE_B);
  assert.notEqual(refA, refB);
  assert.notEqual(refA, legacyColliding);
  assert.notEqual(refB, legacyColliding);
  assert.ok(refA.startsWith("meta-page:"));
  assert.ok(refB.startsWith("meta-page:"));
  assert.ok(!refA.includes(PAGE_A));
  assert.ok(!refB.includes(PAGE_B));
  assert.notEqual(
    buildMetaPageVaultProviderAccountId(TARGET, PAGE_A),
    buildMetaPageVaultProviderAccountId(TARGET, PAGE_B),
  );
});

test("loading Page A cannot return Page B token when last-4 would collide", async () => {
  const storage = createInMemoryStorage({
    ...EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
    vault_records: [
      pageVaultRecord({
        pageId: PAGE_A,
        accessToken: "token-for-page-A-SECRET",
        vaultRecordId: "vault:page-a",
        credentialRefId: "cred-ref:page-a",
      }),
      pageVaultRecord({
        pageId: PAGE_B,
        accessToken: "token-for-page-B-SECRET",
        vaultRecordId: "vault:page-b",
        credentialRefId: "cred-ref:page-b",
      }),
    ],
  });
  configureSocialCredentialStoreTestDependencies(storage);

  const loadA = await loadMetaPageAccessTokenForPublicationTarget({
    publicationTargetId: TARGET,
    pageId: PAGE_A,
    config: TEST_CONFIG,
  });
  const loadB = await loadMetaPageAccessTokenForPublicationTarget({
    publicationTargetId: TARGET,
    pageId: PAGE_B,
    config: TEST_CONFIG,
  });
  assert.equal(loadA.ok, true);
  assert.equal(loadB.ok, true);
  if (loadA.ok && loadB.ok) {
    assert.equal(loadA.accessToken, "token-for-page-A-SECRET");
    assert.equal(loadB.accessToken, "token-for-page-B-SECRET");
    assert.notEqual(loadA.accessToken, loadB.accessToken);
    assert.notEqual(loadA.credentialRefId, loadB.credentialRefId);
    assert.ok(!JSON.stringify({ ...loadA, accessToken: "[redacted]" }).includes("SECRET"));
  }

  configureSocialCredentialStoreTestDependencies(null);
});

test("superseding Page A does not supersede Page B with shared last-4", async () => {
  const recordA = pageVaultRecord({
    pageId: PAGE_A,
    accessToken: "token-A-v1",
    vaultRecordId: "vault:page-a",
    credentialRefId: "cred-ref:page-a",
  });
  const recordB = pageVaultRecord({
    pageId: PAGE_B,
    accessToken: "token-B-v1",
    vaultRecordId: "vault:page-b",
    credentialRefId: "cred-ref:page-b",
  });
  const storage = createInMemoryStorage({
    ...EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
    vault_records: [recordA, recordB],
  });
  configureSocialCredentialStoreTestDependencies(storage);

  const identityA = {
    publicationTargetId: TARGET,
    providerAccountId: buildMetaPageVaultProviderAccountId(TARGET, PAGE_A),
    accountRefId: buildMetaPageVaultAccountRefId(PAGE_A),
  };
  const identityB = {
    publicationTargetId: TARGET,
    providerAccountId: buildMetaPageVaultProviderAccountId(TARGET, PAGE_B),
    accountRefId: buildMetaPageVaultAccountRefId(PAGE_B),
  };

  assert.equal(
    isActiveMetaPageAccessVaultRecordForIdentity(recordA, identityA),
    true,
  );
  assert.equal(
    isActiveMetaPageAccessVaultRecordForIdentity(recordB, identityA),
    false,
  );
  assert.equal(
    isActiveMetaPageAccessVaultRecordForIdentity(recordB, identityB),
    true,
  );

  // Apply the same supersede filter persist uses for Page A only.
  const nowIso = "2026-08-09T00:00:00.000Z";
  for (const prior of storage.listVaultRecords()) {
    if (!isActiveMetaPageAccessVaultRecordForIdentity(prior, identityA)) continue;
    await storage.updateVaultRecordDirect({
      ...prior,
      lifecycle_phase: "superseded",
      superseded_at: nowIso,
    });
  }
  await storage.insertVaultRecord(
    pageVaultRecord({
      pageId: PAGE_A,
      accessToken: "token-A-v2",
      vaultRecordId: "vault:page-a-v2",
      credentialRefId: "cred-ref:page-a-v2",
    }),
  );

  const loadA = await loadMetaPageAccessTokenForPublicationTarget({
    publicationTargetId: TARGET,
    pageId: PAGE_A,
    config: TEST_CONFIG,
  });
  const loadB = await loadMetaPageAccessTokenForPublicationTarget({
    publicationTargetId: TARGET,
    pageId: PAGE_B,
    config: TEST_CONFIG,
  });
  assert.equal(loadA.ok, true);
  assert.equal(loadB.ok, true);
  if (loadA.ok && loadB.ok) {
    assert.equal(loadA.accessToken, "token-A-v2");
    assert.equal(loadB.accessToken, "token-B-v1");
  }

  const remainingActiveB = storage
    .listVaultRecords()
    .filter((record) =>
      isActiveMetaPageAccessVaultRecordForIdentity(record, identityB),
    );
  assert.equal(remainingActiveB.length, 1);

  // Snapshot metadata must not expose raw tokens or raw Page IDs in account_ref_id.
  const snapshotJson = JSON.stringify(
    storage.listVaultRecords().map((record) => ({
      account_ref_id: record.account_ref_id,
      provider_account_id: record.provider_account_id,
      lifecycle_phase: record.lifecycle_phase,
      credential_ref_id: record.credential_ref_id,
    })),
  );
  assert.ok(!snapshotJson.includes("token-A"));
  assert.ok(!snapshotJson.includes("token-B"));
  assert.ok(!buildMetaPageVaultAccountRefId(PAGE_A).includes(PAGE_A));
  assert.notEqual(
    buildMetaPageVaultAccountRefId(PAGE_A),
    `meta-page:${redactMetaAccountId(PAGE_A)}`,
  );

  configureSocialCredentialStoreTestDependencies(null);
});

configureSocialCredentialStoreTestDependencies(null);
console.log("social-meta-page-vault-identity tests passed");
