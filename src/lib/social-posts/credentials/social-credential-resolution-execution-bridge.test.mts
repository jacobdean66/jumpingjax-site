import assert from "node:assert/strict";

import {
  buildSocialCredentialResolutionExecutionPlan,
  hydrateSocialCredentialResolutionExecutionPlan,
  lookupRepositoryReferences,
  selectProviderReference,
  serializeSocialCredentialResolutionExecutionPlan,
  SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BRIDGE_VERSION,
} from "./social-credential-resolution-execution-bridge";
import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  type SocialCredentialPersistenceModel,
  type SocialCredentialProviderAccountRecord,
  type SocialCredentialVaultRecordRow,
} from "./social-credential-repository";
import { buildSocialCredentialRuntimeOrchestrationPlan } from "./social-credential-runtime-orchestrator";
import { replaySocialCredentialRuntimeOrchestrator } from "./social-credential-runtime-orchestrator-replay";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
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
    vault_record_id: "vr-meta-1" as SocialCredentialVaultRecordRow["vault_record_id"],
    credential_ref_id: "cred-ref-meta-1" as SocialCredentialVaultRecordRow["credential_ref_id"],
    provider: "meta",
    credential_kind: "page_access_ref",
    account_ref_id: "account-ref-meta-1",
    provider_account_id: "pa-meta-1" as SocialCredentialVaultRecordRow["provider_account_id"],
    publication_target_id: "target-1" as SocialCredentialVaultRecordRow["publication_target_id"],
    encrypted_payload_ref: "payload-ref-1",
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

function model(overrides: Partial<SocialCredentialPersistenceModel> = {}): SocialCredentialPersistenceModel {
  return {
    ...EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
    ...overrides,
  };
}

await test("builds deterministic provider reference selection", () => {
  const persistence = model({
    provider_accounts: [
      providerAccount({ provider_account_id: "pa-meta-2" as SocialCredentialProviderAccountRecord["provider_account_id"] }),
      providerAccount(),
    ],
  });
  const selection = selectProviderReference("meta", persistence);
  assert.equal(selection.selection?.providerAccountId, "pa-meta-1");
  assert.equal(selection.ambiguous, true);
  assert.equal(selection.selection?.referenceOnly, true);
  assert.equal(selection.selection?.grantsExecutionPermission, false);
});

await test("lookupRepositoryReferences reports missing credential references", () => {
  const persistence = model({ provider_accounts: [providerAccount()] });
  const selection = selectProviderReference("meta", persistence);
  const lookup = lookupRepositoryReferences("meta", persistence, selection.selection);
  assert.equal(lookup.credentialReferences.length > 0, true);
  assert.equal(lookup.credentialReferences.some((item) => !item.resolved), true);
  assert.ok(lookup.blockingReasons.includes("lifecycle_reference_missing"));
});

await test("builds orchestration-aware resolution execution plan", () => {
  const orchestrator = replaySocialCredentialRuntimeOrchestrator(model(), {
    now: "2026-07-01T00:00:00.000Z",
  }).value;
  const plan = buildSocialCredentialResolutionExecutionPlan({
    planId: "test-resolution-plan",
    createdAt: "2026-07-01T00:00:00.000Z",
    model: model(),
    orchestrationPlan: orchestrator.plan,
  });
  assert.equal(plan.bridgeVersion, SOCIAL_CREDENTIAL_RESOLUTION_EXECUTION_BRIDGE_VERSION);
  assert.equal(plan.providerPlans.length, 3);
  assert.equal(plan.grantsExecutionPermission, false);
  assert.equal(plan.executesNothing, true);
  assert.equal(plan.replayCompatible, true);
  assert.equal(plan.summary.totalProviderCount, 3);
});

await test("serializes and hydrates resolution execution plan deterministically", () => {
  const plan = buildSocialCredentialResolutionExecutionPlan({
    planId: "test-resolution-plan",
    createdAt: "2026-07-01T00:00:00.000Z",
    model: model(),
    orchestrationPlan: buildSocialCredentialRuntimeOrchestrationPlan({
      planId: "empty",
      createdAt: "2026-07-01T00:00:00.000Z",
      providerJobs: [],
    }),
  });
  const serialized = serializeSocialCredentialResolutionExecutionPlan(plan);
  const hydrated = hydrateSocialCredentialResolutionExecutionPlan(serialized);
  assert.equal(hydrated.ok, true);
  if (hydrated.ok) {
    assert.equal(hydrated.value.planId, plan.planId);
    assert.equal(hydrated.value.bridgeVersion, plan.bridgeVersion);
  }
});

await test("forbids execution permission in resolution execution contract", () => {
  const plan = buildSocialCredentialResolutionExecutionPlan({
    planId: "test-resolution-plan",
    createdAt: "2026-07-01T00:00:00.000Z",
    model: model({ provider_accounts: [providerAccount()], vault_records: [vaultRecord()] }),
    orchestrationPlan: replaySocialCredentialRuntimeOrchestrator(model({
      provider_accounts: [providerAccount()],
      vault_records: [vaultRecord()],
    })).value.plan,
  });
  for (const providerPlan of plan.providerPlans) {
    assert.equal(providerPlan.grantsExecutionPermission, false);
    assert.equal(providerPlan.executesNothing, true);
    assert.equal(providerPlan.mutatesNothing, true);
  }
});
