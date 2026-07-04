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
  assert.equal(diagnostics.storageSchemaSummary.storageSchemaReady, true);
  assert.equal(diagnostics.storageSchemaSummary.requiredCollectionCount, 5);
  assert.equal(diagnostics.storageSchemaSummary.missingCollections.length, 0);
  assert.equal(diagnostics.repositoryCompletenessSummary.repositoryContractComplete, true);
  assert.equal(
    diagnostics.repositoryCompletenessSummary.availableReadOperations.length,
    diagnostics.repositoryCompletenessSummary.requiredReadOperationCount,
  );
  assert.equal(diagnostics.repositoryCompletenessSummary.failingReadOperations.length, 0);
  assert.equal(diagnostics.repositoryCompletenessSummary.missingMutationOperations.length, 0);
  assert.equal(diagnostics.repositoryCompletenessSummary.verificationIssueCount, 0);
  assert.equal(diagnostics.repositoryCompletenessSummary.capabilityCoverage.complete, true);
  assert.equal(diagnostics.repositoryCompletenessSummary.readinessCoverage.requiredCount, 3);
  assert.equal(diagnostics.repositoryCompletenessSummary.readinessCoverage.complete, true);
  assert.equal(diagnostics.repositoryCompletenessSummary.adapterCoverage.complete, true);
  assert.equal(diagnostics.repositoryCompletenessSummary.replayCompatibility.complete, true);
  assert.equal(
    diagnostics.repositoryCompletenessSummary.appendOnlyAuditCompatibility.complete,
    true,
  );
  assert.equal(diagnostics.repositoryCompletenessSummary.getOnlyDiagnostics.complete, true);
  assert.equal(
    diagnostics.repositoryCompletenessSummary.getOnlyDiagnostics.inspectedMutationOperationCount,
    0,
  );
  assert.equal(diagnostics.repositoryCompletenessSummary.invokesMutationOperations, false);
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

await test("computes schema validation summaries without authoritative readiness", () => {
  const diagnostics = replaySocialCredentialAdminDiagnostics();

  assert.equal(diagnostics.schemaValidationSummary.persistenceErrorCount, 0);
  assert.equal(diagnostics.schemaValidationSummary.domainMappingErrorCount, 0);
  assert.equal(diagnostics.schemaValidationSummary.blockCount > 0, true);
  assert.equal(diagnostics.schemaValidationSummary.validForReadiness, false);
  assert.equal(diagnostics.schemaValidationSummary.readOnly, true);
  assert.equal(diagnostics.schemaValidationSummary.authoritative, false);
  assert.equal(
    diagnostics.diagnostics.some((diagnostic) => diagnostic.code === "schema_validation_summary_computed"),
    true,
  );
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
  assert.equal(diagnostics.schemaValidationSummary.persistenceErrorCount > 0, true);
  assert.equal(diagnostics.schemaValidationSummary.validForReadiness, false);
  assert.equal(
    diagnostics.diagnostics.some((diagnostic) => diagnostic.code === "repository_validation_failed"),
    true,
  );
});

await test("keeps repository verification deterministic when row validation fails", () => {
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
  assert.equal(diagnostics.repositoryCompletenessSummary.repositoryContractComplete, true);
  assert.equal(diagnostics.repositoryCompletenessSummary.verificationIssueCount, 0);
  assert.equal(diagnostics.repositoryCompletenessSummary.availableMutationOperations.length > 0, true);
});

console.log("social-credential-diagnostics-replay tests passed");
