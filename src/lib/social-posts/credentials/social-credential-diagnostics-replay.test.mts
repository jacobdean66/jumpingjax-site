import assert from "node:assert/strict";

import {
  replaySocialCredentialAdminDiagnostics,
} from "./social-credential-diagnostics-replay";
import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  type SocialCredentialAuditEventRecord,
  type SocialCredentialKeyVersionRecord,
  type SocialCredentialLifecycleStateRecord,
  type SocialCredentialPersistenceModel,
  type SocialCredentialProviderAccountRecord,
} from "./social-credential-repository";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function model(overrides: Partial<SocialCredentialPersistenceModel> = {}): SocialCredentialPersistenceModel {
  return {
    ...EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
    ...overrides,
  };
}

function providerAccount(): SocialCredentialProviderAccountRecord {
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

function lifecycleState(): SocialCredentialLifecycleStateRecord {
  return {
    lifecycle_state_id: "state-1" as SocialCredentialLifecycleStateRecord["lifecycle_state_id"],
    credential_ref_id: "cred-ref-1" as SocialCredentialLifecycleStateRecord["credential_ref_id"],
    account_ref_id: "account-ref-meta-1",
    provider: "meta",
    authorization_state: "authorized",
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

function auditEvent(): SocialCredentialAuditEventRecord {
  return {
    audit_event_id: "audit-1" as SocialCredentialAuditEventRecord["audit_event_id"],
    credential_ref_id: "cred-ref-1" as SocialCredentialAuditEventRecord["credential_ref_id"],
    actor_admin_id: null,
    action: "create",
    outcome: "success",
    sanitized_detail: "Reference metadata registered.",
    created_at: "2026-01-01T00:00:00.000Z",
    append_only: true,
    contains_secrets: false,
    grants_execution_permission: false,
    executes_nothing: true,
    publishes_nothing: true,
  };
}

function keyVersion(): SocialCredentialKeyVersionRecord {
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

await test("computes blocked persistence readiness without storage access", () => {
  const diagnostics = replaySocialCredentialAdminDiagnostics();

  assert.equal(diagnostics.persistenceModelValid, true);
  assert.equal(diagnostics.domainMappingValid, true);
  assert.equal(diagnostics.credentialPersistenceReady, false);
  assert.equal(diagnostics.storageContractAllowsSql, false);
  assert.equal(diagnostics.storageContractAllowsSupabase, false);
  assert.equal(diagnostics.storageContractAllowsEncryption, false);
  assert.equal(diagnostics.grantsExecutionPermission, false);
  assert.ok(diagnostics.missingStorageDependencies.includes("provider_account:meta"));
});

await test("summarizes lifecycle rows from reference-only model", () => {
  const diagnostics = replaySocialCredentialAdminDiagnostics(
    model({
      provider_accounts: [providerAccount()],
      lifecycle_states: [lifecycleState()],
      audit_events: [auditEvent()],
      key_versions: [keyVersion()],
    }),
  );

  assert.equal(diagnostics.lifecycleSummary.lifecycleStateCount, 1);
  assert.equal(diagnostics.lifecycleSummary.activeLifecycleStateCount, 1);
  assert.equal(diagnostics.lifecycleSummary.lifecyclePhaseCounts.active, 1);
  assert.equal(diagnostics.lifecycleSummary.providerLifecycleCounts.meta, 1);
  assert.equal(diagnostics.lifecycleSummary.auditEventCount, 1);
  assert.equal(diagnostics.lifecycleSummary.keyVersionStatusCounts.active, 1);
});

await test("surfaces repository validation failures as diagnostics", () => {
  const diagnostics = replaySocialCredentialAdminDiagnostics(
    model({
      provider_accounts: [
        {
          ...providerAccount(),
          provider: "unsupported",
        } as unknown as SocialCredentialProviderAccountRecord,
      ],
    }),
  );

  assert.equal(diagnostics.persistenceModelValid, false);
  assert.equal(
    diagnostics.diagnostics.some((diagnostic) => diagnostic.code === "repository_validation_failed"),
    true,
  );
});

console.log("social-credential-diagnostics-replay tests passed");
