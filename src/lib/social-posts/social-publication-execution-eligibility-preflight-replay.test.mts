import assert from "node:assert/strict";

import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  type SocialCredentialPersistenceModel,
  type SocialCredentialProviderAccountRecord,
} from "./credentials/social-credential-repository";
import { replaySocialPublicationExecutionEligibilityPreflight } from "./social-publication-execution-eligibility-preflight-replay";
import {
  mapPublicationExecutionIntentToIntentRecord,
  type PublicationExecutionIntent,
  type SocialPublicationExecutionPersistenceModel,
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

function intent(
  id: string,
  input: Partial<PublicationExecutionIntent> = {},
): PublicationExecutionIntent {
  return {
    intentId: `execution-intent-${id}`,
    intentType: "prepare_execution_intent",
    job: {
      jobId: `execution-job-${id}`,
      jobType: "model_execution_job",
      references: {
        socialPostId: `social-post-${id}`,
        publicationTargetId: `target-${id}`,
        publisherRequestId: `publisher-request-${id}`,
        publisherResultId: `publisher-result-${id}`,
        publisherJobId: `publisher-job-${id}`,
        scheduleId: `schedule-${id}`,
        ledgerEntryId: `ledger-entry-${id}`,
        publicationManifestId: `manifest-${id}`,
        ownerApprovalId: `owner-approval-${id}`,
        approvalId: `approval-${id}`,
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
      ownerApprovalId: `owner-approval-${id}`,
      approvalId: `approval-${id}`,
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
      preflightId: `execution-preflight-${id}`,
      jobId: `execution-job-${id}`,
      status: "passed",
      blockReasons: [],
      evaluatedAt: "2026-07-01T12:00:00.000Z",
      computedOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      mutatesNoLowerLayers: true,
    },
    evidence: {
      evidenceId: `execution-evidence-${id}`,
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

function executionModel(
  intents: readonly PublicationExecutionIntent[],
): SocialPublicationExecutionPersistenceModel {
  return {
    intents: intents.map((item) => assertOk(mapPublicationExecutionIntentToIntentRecord(item))),
    results: [],
  };
}

await test("replays eligibility preflight across execution and credential models", () => {
  const replay = replaySocialPublicationExecutionEligibilityPreflight(
    executionModel([intent("1")]),
    {
      ...EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
      provider_accounts: [providerAccount({ publication_target_id: "target-1" as SocialCredentialProviderAccountRecord["publication_target_id"] })],
    } satisfies SocialCredentialPersistenceModel,
  ).value;

  assert.equal(replay.summary.totalJobCount, 1);
  assert.equal(replay.replayVersion, "d15-w3-v1");
  assert.equal(replay.grantsExecutionPermission, false);
  assert.equal(replay.replayIntegrity.replayCompatible, true);
  assert.equal(typeof replay.replayIntegrity.auditAppendCompatible, "boolean");
});

await test("buckets jobs by eligibility, credential, and orchestration readiness", () => {
  const replay = replaySocialPublicationExecutionEligibilityPreflight(
    executionModel([intent("1"), intent("2")]),
    EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  ).value;

  assert.equal(replay.summary.totalJobCount, 2);
  assert.equal(replay.summary.eligibilityBlockedJobCount, 2);
  assert.equal(replay.providerUnresolvedJobs.length, 2);
  assert.equal(replay.summary.providerUnresolvedJobCount, 2);
});

await test("reports replay integrity as valid for readable models", () => {
  const replay = replaySocialPublicationExecutionEligibilityPreflight(
    executionModel([intent("1")]),
    EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  ).value;

  assert.equal(replay.replayIntegrity.deterministic, true);
  assert.equal(replay.replayIntegrity.source, "publication_execution_eligibility_preflight_replay");
  assert.equal(typeof replay.replayIntegrity.valid, "boolean");
});
