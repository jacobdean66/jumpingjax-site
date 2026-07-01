import assert from "node:assert/strict";

import { replaySocialPublicationExecutionPlanner } from "./social-publication-execution-planner-replay";
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

await test("computes planned order and ready plans", () => {
  const model: SocialPublicationExecutionPersistenceModel = {
    intents: [intentRecord("b"), intentRecord("a")],
    results: [],
  };

  const replay = replaySocialPublicationExecutionPlanner(
    model,
    "2026-07-01T13:00:00.000Z",
  ).value;

  assert.equal(replay.summary.totalStepCount, 2);
  assert.equal(replay.summary.readyPlanCount, 2);
  assert.deepEqual(replay.executionOrder.map((step) => step.status), [
    "ready",
    "ready",
  ]);
  assert.equal(replay.grantsExecutionPermission, false);
  assert.equal(replay.executesNothing, true);
});

await test("buckets waiting plans by authority and reference failures", () => {
  const missingReference = {
    ...intentRecord("missing"),
    scope: {
      ...intentRecord("missing").scope,
      schedule_id: null,
      ledger_entry_id: null,
    },
  } as SocialPublicationExecutionIntentRecord;
  const authorityBlocked = intentRecord("authority", {
    authority: {
      ...intent("authority").authority,
      ownerApprovalSatisfied: false,
    },
  });

  const replay = replaySocialPublicationExecutionPlanner({
    intents: [missingReference, authorityBlocked],
    results: [],
  }).value;

  assert.equal(replay.summary.waitingPlanCount, 2);
  assert.equal(replay.summary.referenceFailureCount, 1);
  assert.equal(replay.summary.authorityFailureCount, 1);
  assert.equal(replay.summary.dependencyFailureCount, 2);
});

await test("buckets unsafe jobs as blocked plans", () => {
  const unsafe = {
    ...intentRecord("unsafe"),
    grants_execution_permission: true,
  } as unknown as SocialPublicationExecutionIntentRecord;

  const replay = replaySocialPublicationExecutionPlanner({
    intents: [unsafe],
    results: [],
  }).value;

  assert.equal(replay.summary.blockedPlanCount, 1);
  assert.equal(replay.blockedPlans[0].unsafe, true);
  assert.equal(replay.blockedPlans[0].couldRunLater, false);
});

await test("invalid persistence is read as diagnostics without planned steps", () => {
  const replay = replaySocialPublicationExecutionPlanner(
    {} as unknown as SocialPublicationExecutionPersistenceModel,
  ).value;

  assert.equal(replay.summary.totalStepCount, 0);
  assert.equal(replay.summary.errorCount > 0, true);
  assert.equal(replay.replayIntegrity.valid, false);
});
