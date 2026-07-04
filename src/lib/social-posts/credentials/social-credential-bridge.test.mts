import assert from "node:assert/strict";

import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  type SocialCredentialPersistenceModel,
  type SocialCredentialProviderAccountRecord,
} from "./social-credential-repository";
import {
  createSocialCredentialBridge,
} from "./social-credential-bridge";
import {
  configureSocialCredentialStoreTestDependencies,
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

function createBridgeStorage(
  seed: SocialCredentialPersistenceModel = EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
): SocialCredentialStoreStorage {
  let providerAccounts = [...seed.provider_accounts].map((record) => clone(record));

  return {
    async loadSnapshot() {
      return clone({
        ...EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
        provider_accounts: providerAccounts,
      });
    },
    async insertProviderAccount(record) {
      providerAccounts = [...providerAccounts, clone(record)];
      return clone(record);
    },
    async updateProviderAccount() {
      throw new Error("updateProviderAccount not used in this test");
    },
    async deleteProviderAccount() {
      throw new Error("deleteProviderAccount not used in this test");
    },
    async insertVaultRecord() {
      throw new Error("insertVaultRecord not used in this test");
    },
    async updateVaultRecord() {
      throw new Error("updateVaultRecord not used in this test");
    },
    async deleteVaultRecord() {
      throw new Error("deleteVaultRecord not used in this test");
    },
    async insertLifecycleState() {
      throw new Error("insertLifecycleState not used in this test");
    },
    async updateLifecycleState() {
      throw new Error("updateLifecycleState not used in this test");
    },
    async deleteLifecycleState() {
      throw new Error("deleteLifecycleState not used in this test");
    },
    async insertAuditEvent() {
      throw new Error("insertAuditEvent not used in this test");
    },
    async insertKeyVersion() {
      throw new Error("insertKeyVersion not used in this test");
    },
    async updateKeyVersion() {
      throw new Error("updateKeyVersion not used in this test");
    },
    async deleteKeyVersion() {
      throw new Error("deleteKeyVersion not used in this test");
    },
  };
}

await test("rejects reference mode in production runtime", () => {
  const bridge = createSocialCredentialBridge({
    mode: "reference",
    runtimeEnvironment: "production",
  });

  assert.equal(bridge.ok, false);
  if (!bridge.ok) {
    assert.equal(bridge.error.code, "unsafe_reference_in_production");
  }
});

await test("creates provider accounts through the production bridge", async () => {
  configureSocialCredentialStoreTestDependencies(createBridgeStorage());

  const bridge = createSocialCredentialBridge({
    mode: "production",
    runtimeEnvironment: "test",
    productionStoreConfigured: true,
  });
  assert.equal(bridge.ok, true);
  if (!bridge.ok) return;

  const created = await bridge.value.createProviderAccount({
    providerAccount: providerAccount(),
  });
  assert.equal(created.ok, true);

  const snapshot = await bridge.value.snapshot();
  assert.equal(snapshot.ok, true);
  if (snapshot.ok) {
    assert.equal(snapshot.value.provider_accounts.length, 1);
    assert.equal(snapshot.value.provider_accounts[0].provider, "meta");
  }
});

await test("surfaces validation failures without mutating the store", async () => {
  configureSocialCredentialStoreTestDependencies(createBridgeStorage());

  const bridge = createSocialCredentialBridge({
    mode: "production",
    runtimeEnvironment: "test",
    productionStoreConfigured: true,
  });
  assert.equal(bridge.ok, true);
  if (!bridge.ok) return;

  const invalid = await bridge.value.createProviderAccount({
    providerAccount: {
      ...providerAccount(),
      grants_execution_permission: true,
    } as unknown as SocialCredentialProviderAccountRecord,
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.error.code, "validation_failed");
  }

  const snapshot = await bridge.value.snapshot();
  assert.equal(snapshot.ok, true);
  if (snapshot.ok) {
    assert.equal(snapshot.value.provider_accounts.length, 0);
  }
});

configureSocialCredentialStoreTestDependencies(null);
console.log("social-credential-bridge tests passed");
