import assert from "node:assert/strict";

import { replaySocialPublicationExecutionCoordinator } from "./social-publication-execution-coordinator-replay";
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

await test("computes coordinator projections for each execution job", () => {
  const model: SocialPublicationExecutionPersistenceModel = {
    intents: [intentRecord("a"), intentRecord("b")],
    results: [],
  };

  const replay = replaySocialPublicationExecutionCoordinator(model).value;
  assert.equal(replay.summary.totalJobCount, 2);
  assert.equal(replay.grantsExecutionPermission, false);
  assert.equal(replay.executesNothing, true);
  assert.equal(replay.plan.orderedPipeline.length, 6);
  assert.ok(replay.plan.pipelineSummary.totalJobCount === 2);
});

await test("marks fully coordinated jobs when all layers align", () => {
  const model: SocialPublicationExecutionPersistenceModel = {
    intents: [intentRecord("ready")],
    results: [],
  };

  const replay = replaySocialPublicationExecutionCoordinator(model, {
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

  assert.equal(replay.summary.fullyCoordinatedJobCount, 1);
  assert.equal(replay.fullyCoordinatedJobs[0]?.coordinationStatus, "coordinated");
  assert.equal(replay.fullyCoordinatedJobs[0]?.adapterReady, true);
  assert.equal(replay.fullyCoordinatedJobs[0]?.runbookReady, true);
  assert.equal(replay.fullyCoordinatedJobs[0]?.dependencyFailures.length, 0);
  assert.equal(replay.fullyCoordinatedJobs[0]?.authorityFailures.length, 0);
  assert.ok(replay.fullyCoordinatedJobs[0]?.pipelinePhases.length === 6);
});

await test("reports dependency and authority failures for blocked jobs", () => {
  const model: SocialPublicationExecutionPersistenceModel = {
    intents: [
      intentRecord("blocked", {
        authority: {
          authorityKind: "model",
          modelAuthorityOnly: true,
          ownerApprovalId: "owner-approval-blocked",
          approvalId: "approval-blocked",
          requiresOwnerApproval: true,
          ownerApprovalSatisfied: false,
          requiresPublisherAuthority: true,
          publisherAuthoritySatisfied: false,
          requiresPreflightPass: true,
          preflightPassed: false,
          allowsExternalApiCall: false,
          allowsSdkUsage: false,
          allowsNetwork: false,
          allowsExecution: false,
          allowsPersistence: false,
          grantsExecutionPermission: false,
          canMutateLowerLayers: false,
        },
      }),
    ],
    results: [],
  };

  const replay = replaySocialPublicationExecutionCoordinator(model).value;
  assert.equal(replay.summary.blockedJobCount, 1);
  assert.ok(replay.blockedJobs[0]?.dependencyFailures.length > 0);
  assert.ok(replay.blockedJobs[0]?.authorityFailures.length > 0);
  assert.ok(replay.dependencyFailureJobs.length >= 1);
  assert.ok(replay.authorityFailureJobs.length >= 1);
  assert.equal(replay.blockedJobs[0]?.adapterReady, false);
  assert.equal(replay.blockedJobs[0]?.runbookReady, false);
});

await test("remains pure replay with no mutation side effects", () => {
  const model: SocialPublicationExecutionPersistenceModel = {
    intents: [intentRecord("pure")],
    results: [],
  };
  const before = JSON.stringify(model);
  replaySocialPublicationExecutionCoordinator(model);
  assert.equal(JSON.stringify(model), before);
});
