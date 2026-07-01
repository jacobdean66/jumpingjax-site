import assert from "node:assert/strict";

import { replaySocialPublicationExecutionPreflight } from "./social-publication-execution-preflight-replay";
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

await test("buckets pass, missing reference, authority blocked, stale, and unsafe jobs", () => {
  const pass = intentRecord("pass");
  const missingReference = {
    ...intentRecord("missing"),
    scope: {
      ...intentRecord("missing").scope,
      ledger_entry_id: null,
      schedule_id: null,
    },
  } as SocialPublicationExecutionIntentRecord;
  const authorityBlocked = intentRecord("authority", {
    authority: {
      ...intent("authority").authority,
      ownerApprovalSatisfied: false,
    },
  });
  const stale = {
    ...intentRecord("stale"),
    updated_at: "2026-07-01T12:05:00.000Z",
    preflight_evaluated_at: "2026-07-01T12:00:00.000Z",
  } as SocialPublicationExecutionIntentRecord;
  const unsafe = {
    ...intentRecord("unsafe"),
    grants_execution_permission: true,
  } as unknown as SocialPublicationExecutionIntentRecord;
  const model: SocialPublicationExecutionPersistenceModel = {
    intents: [pass, missingReference, authorityBlocked, stale, unsafe],
    results: [],
  };

  const replay = replaySocialPublicationExecutionPreflight(model).value;

  assert.equal(replay.summary.totalJobCount, 5);
  assert.equal(replay.summary.preflightPassJobCount, 1);
  assert.equal(replay.summary.preflightBlockedJobCount, 3);
  assert.equal(replay.summary.missingReferenceJobCount, 1);
  assert.equal(replay.summary.authorityBlockedJobCount, 1);
  assert.equal(replay.summary.staleReferenceJobCount, 1);
  assert.equal(replay.summary.unsafeJobCount, 1);
  assert.equal(replay.grantsExecutionPermission, false);
  assert.equal(replay.executesNothing, true);
});

await test("invalid persistence reports errors and does not project jobs", () => {
  const invalid = {} as unknown as SocialPublicationExecutionPersistenceModel;

  const replay = replaySocialPublicationExecutionPreflight(invalid).value;

  assert.equal(replay.summary.totalJobCount, 0);
  assert.equal(replay.summary.errorCount > 0, true);
  assert.equal(replay.replayIntegrity.valid, false);
});
