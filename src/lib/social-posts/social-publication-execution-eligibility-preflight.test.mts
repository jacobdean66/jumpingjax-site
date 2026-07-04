import assert from "node:assert/strict";

import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  type SocialCredentialPersistenceModel,
  type SocialCredentialProviderAccountRecord,
  type SocialCredentialVaultRecordRow,
} from "./credentials/social-credential-repository";
import { replaySocialCredentialRuntimeOrchestrator } from "./credentials/social-credential-runtime-orchestrator-replay";
import {
  evaluateSocialPublicationExecutionEligibilityPreflight,
  resolveProvidersForPublicationTarget,
  SOCIAL_PUBLICATION_EXECUTION_ELIGIBILITY_PREFLIGHT_VERSION,
} from "./social-publication-execution-eligibility-preflight";
import { buildSocialPublicationExecutionEligibilityPreflightContext } from "./social-publication-execution-eligibility-preflight-replay";
import {
  mapPublicationExecutionIntentToIntentRecord,
  type PublicationExecutionIntent,
  type SocialPublicationExecutionIntentRecord,
} from "./social-publication-execution-repository";

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

function credentialModel(
  overrides: Partial<SocialCredentialPersistenceModel> = {},
): SocialCredentialPersistenceModel {
  return {
    ...EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
    ...overrides,
  };
}

function intent(input: Partial<PublicationExecutionIntent> = {}): PublicationExecutionIntent {
  return {
    intentId: "execution-intent-1",
    intentType: "prepare_execution_intent",
    job: {
      jobId: "execution-job-1",
      jobType: "model_execution_job",
      references: {
        socialPostId: "social-post-1",
        publicationTargetId: "target-1",
        publisherRequestId: "publisher-request-1",
        publisherResultId: "publisher-result-1",
        publisherJobId: "publisher-job-1",
        scheduleId: "schedule-1",
        ledgerEntryId: "ledger-entry-1",
        publicationManifestId: "manifest-1",
        ownerApprovalId: "owner-approval-1",
        approvalId: "approval-1",
        metricObservationId: null,
        learningInsightId: null,
        campaignMemoryId: null,
        decisionHistoryId: null,
      },
      createdAt: "2026-07-01T12:00:00.000Z",
      updatedAt: "2026-07-01T12:00:00.000Z",
      modelContractOnly: true,
      executesNothing: true,
      publishesNothing: true,
      grantsExecutionPermission: false,
      mutatesLedger: false,
      mutatesTargets: false,
      mutatesApproval: false,
      mutatesManifest: false,
      mutatesScheduler: false,
      mutatesPublisher: false,
      persistsNothing: true,
    },
    authority: {
      authorityKind: "model",
      modelAuthorityOnly: true,
      ownerApprovalId: "owner-approval-1",
      approvalId: "approval-1",
      requiresOwnerApproval: true,
      ownerApprovalSatisfied: true,
      requiresPublisherAuthority: true,
      publisherAuthoritySatisfied: true,
      requiresPreflightPass: true,
      preflightPassed: true,
      allowsExternalApiCall: false,
      allowsSdkUsage: false,
      allowsNetwork: false,
      allowsExecution: false,
      allowsPersistence: false,
      grantsExecutionPermission: false,
      canMutateLowerLayers: false,
    },
    preflight: {
      preflightId: "execution-preflight-1",
      jobId: "execution-job-1",
      status: "passed",
      blockReasons: [],
      evaluatedAt: "2026-07-01T12:00:00.000Z",
      computedOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      mutatesNoLowerLayers: true,
    },
    evidence: {
      evidenceId: "execution-evidence-1",
      evidenceKind: "preflight_evidence",
      notes: "preflight checked",
      evidence: {},
      containsFullPayload: false,
      containsSecrets: false,
      provesExecution: false,
    },
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z",
    contractOnly: true,
    modelAuthorityOnly: true,
    executesNothing: true,
    publishesNothing: true,
    callsNoExternalApis: true,
    usesNoSdks: true,
    usesNoNetwork: true,
    startsNoWorkers: true,
    startsNoTimers: true,
    createsNoQueues: true,
    exposesNoApiRoutes: true,
    exposesNoAdminUi: true,
    mutatesNoSql: true,
    mutatesNoSupabase: true,
    mutatesNoBridge: true,
    mutatesNoStorage: true,
    mutatesNoLowerLayers: true,
    recordsNoMetrics: true,
    performsNoLearning: true,
    grantsExecutionPermission: false,
    ...input,
  };
}

function assertOk<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) assert.fail(JSON.stringify(result.error));
  return result.value;
}

function intentRecord(input: Partial<PublicationExecutionIntent> = {}) {
  return assertOk(mapPublicationExecutionIntentToIntentRecord(intent(input)));
}

await test("exposes D15 Wave 3 eligibility preflight version", () => {
  assert.equal(
    SOCIAL_PUBLICATION_EXECUTION_ELIGIBILITY_PREFLIGHT_VERSION,
    "d15-w3-v1",
  );
});

await test("resolves providers for publication target deterministically", () => {
  const resolution = resolveProvidersForPublicationTarget(
    "target-1",
    credentialModel({ provider_accounts: [providerAccount()] }),
  );
  assert.deepEqual(resolution.providers, ["meta"]);
  assert.equal(resolution.unresolved, false);
});

await test("blocks when provider cannot be resolved for publication target", () => {
  const record = intentRecord();
  const { context } = buildSocialPublicationExecutionEligibilityPreflightContext(
    credentialModel(),
    "2026-07-01T00:00:00.000Z",
  );
  const evaluation = evaluateSocialPublicationExecutionEligibilityPreflight(record, null, context);

  assert.equal(evaluation.status, "block");
  assert.equal(
    evaluation.blockingReasons.some((reason) => reason.code === "provider_unresolved"),
    true,
  );
  assert.equal(evaluation.grantsExecutionPermission, false);
});

await test("aggregates deterministic blocking reasons across readiness layers", () => {
  const record = intentRecord();
  const model = credentialModel({ provider_accounts: [providerAccount()] });
  const { context } = buildSocialPublicationExecutionEligibilityPreflightContext(
    model,
    "2026-07-01T00:00:00.000Z",
  );
  const evaluation = evaluateSocialPublicationExecutionEligibilityPreflight(record, null, context);

  assert.equal(evaluation.status, "block");
  assert.deepEqual(
    evaluation.aggregatedBlockingCodes,
    [...evaluation.aggregatedBlockingCodes].sort((left, right) => left.localeCompare(right)),
  );
  assert.equal(
    evaluation.blockingReasons.some((reason) => reason.category === "credential_readiness"),
    true,
  );
});

await test("blocks when D10 preflight fails even if credential provider resolves", () => {
  const base = intentRecord();
  const missing = {
    ...base,
    scope: {
      ...base.scope,
      owner_approval_id: null,
    },
  } as SocialPublicationExecutionIntentRecord;
  const { context } = buildSocialPublicationExecutionEligibilityPreflightContext(
    credentialModel({ provider_accounts: [providerAccount()] }),
    "2026-07-01T00:00:00.000Z",
  );
  const evaluation = evaluateSocialPublicationExecutionEligibilityPreflight(missing, null, context);

  assert.equal(evaluation.status, "block");
  assert.equal(evaluation.d10Preflight.status, "block");
  assert.equal(
    evaluation.blockingReasons.some((reason) => reason.category === "d10_preflight"),
    true,
  );
});

await test("builds orchestration-aware eligibility context from runtime replays", () => {
  const model = credentialModel({
    provider_accounts: [providerAccount()],
    vault_records: [vaultRecord()],
  });
  const orchestrator = replaySocialCredentialRuntimeOrchestrator(model).value;
  const { context, diagnostics } = buildSocialPublicationExecutionEligibilityPreflightContext(
    model,
    "2026-07-01T00:00:00.000Z",
  );

  assert.equal(context.providerContexts.meta?.orchestratorProvider?.provider, "meta");
  assert.equal(context.providerContexts.meta?.resolutionProvider?.provider, "meta");
  assert.equal(orchestrator.summary.totalProviderCount, 3);
  assert.equal(Array.isArray(diagnostics), true);
});
