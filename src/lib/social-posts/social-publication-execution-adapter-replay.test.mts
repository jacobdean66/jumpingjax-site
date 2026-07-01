import assert from "node:assert/strict";

import { replaySocialPublicationExecutionAdapters } from "./social-publication-execution-adapter-replay";
import { SOCIAL_PUBLICATION_EXECUTION_DRY_RUN_ADAPTER_CONTRACTS } from "./social-publication-execution-adapter-dry-run";
import {
  mapPublicationExecutionIntentToIntentRecord,
  type PublicationExecutionIntent,
  type SocialPublicationExecutionIntentRecord,
  type SocialPublicationExecutionPersistenceModel,
} from "./social-publication-execution-repository";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
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
    evidence: null,
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

function intentRecord(
  id: string,
  input: Partial<PublicationExecutionIntent> = {},
): SocialPublicationExecutionIntentRecord {
  return assertOk(mapPublicationExecutionIntentToIntentRecord(intent(id, input)));
}

await test("reports available dry-run adapters by default", () => {
  const replay = replaySocialPublicationExecutionAdapters({
    intents: [intentRecord("a")],
    results: [],
  }).value;

  assert.equal(replay.availableAdapters.length, 2);
  assert.deepEqual(
    replay.availableAdapters.map((adapter) => adapter.identity.adapterId),
    SOCIAL_PUBLICATION_EXECUTION_DRY_RUN_ADAPTER_CONTRACTS.map((adapter) => adapter.identity.adapterId),
  );
  assert.equal(replay.grantsExecutionPermission, false);
});

await test("marks adapter-ready jobs when channel hints and planner readiness align", () => {
  const model: SocialPublicationExecutionPersistenceModel = {
    intents: [intentRecord("ready")],
    results: [],
  };

  const replay = replaySocialPublicationExecutionAdapters(model, {
    channelHints: [
      {
        executionJobId: "execution-job-ready",
        publicationTargetId: "target-ready",
        platform: "facebook",
        channelId: "channel-ready",
        channelType: "facebook_page",
      },
    ],
  }).value;

  assert.equal(replay.summary.adapterReadyJobCount, 1);
  assert.equal(replay.adapterReadyJobs[0]?.requiredAdapterId, "execution-adapter-facebook-dry-run");
  assert.equal(replay.adapterReadyJobs[0]?.dryRunCapable, true);
});

await test("buckets unsupported channels and missing adapters", () => {
  const model: SocialPublicationExecutionPersistenceModel = {
    intents: [intentRecord("blocked"), intentRecord("unsupported")],
    results: [],
  };

  const replay = replaySocialPublicationExecutionAdapters(model, {
    adapters: [SOCIAL_PUBLICATION_EXECUTION_DRY_RUN_ADAPTER_CONTRACTS[0]],
    channelHints: [
      {
        executionJobId: "execution-job-blocked",
        publicationTargetId: "target-blocked",
        platform: "instagram",
        channelId: "channel-blocked",
        channelType: "instagram_business_account",
      },
      {
        executionJobId: "execution-job-unsupported",
        publicationTargetId: "target-unsupported",
        platform: "facebook",
        channelId: "channel-unsupported",
        channelType: "instagram_business_account",
      },
    ],
  }).value;

  assert.deepEqual(replay.missingAdapters, ["instagram"]);
  assert.equal(replay.summary.unsupportedChannelJobCount, 1);
  assert.ok(replay.adapterBlockedJobs.length >= 1);
});

await test("blocks jobs when channel hints are unresolved", () => {
  const replay = replaySocialPublicationExecutionAdapters({
    intents: [intentRecord("no-hint")],
    results: [],
  }).value;

  assert.equal(replay.summary.adapterReadyJobCount, 0);
  assert.equal(replay.adapterBlockedJobs[0]?.blockingReasons.includes("channel_unresolved"), true);
});
