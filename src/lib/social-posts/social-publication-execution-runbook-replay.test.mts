import assert from "node:assert/strict";

import { replaySocialPublicationExecutionRunbooks } from "./social-publication-execution-runbook-replay";
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

await test("computes runbook projections for each execution job", () => {
  const model: SocialPublicationExecutionPersistenceModel = {
    intents: [intentRecord("a"), intentRecord("b")],
    results: [],
  };

  const replay = replaySocialPublicationExecutionRunbooks(model).value;
  assert.equal(replay.summary.totalRunbookCount, 2);
  assert.equal(replay.grantsExecutionPermission, false);
  assert.equal(replay.executesNothing, true);
  assert.ok(replay.manualConfirmationRunbooks.length >= 1);
});

await test("marks ready runbooks when adapter hints and prerequisites align", () => {
  const model: SocialPublicationExecutionPersistenceModel = {
    intents: [intentRecord("ready")],
    results: [],
  };

  const replay = replaySocialPublicationExecutionRunbooks(model, {
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

  assert.equal(replay.summary.readyRunbookCount, 1);
  assert.equal(replay.readyRunbooks[0]?.runbookStatus, "ready");
  assert.equal(replay.readyRunbooks[0]?.missingAuthorityEvidence.length, 0);
  assert.ok(replay.readyRunbooks[0]?.manualConfirmationRequirements.length >= 2);
});

await test("reports missing checklist and adapter prerequisites for blocked jobs", () => {
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

  const replay = replaySocialPublicationExecutionRunbooks(model).value;
  assert.equal(replay.summary.blockedRunbookCount, 1);
  assert.ok(replay.blockedRunbooks[0]?.missingChecklistItems.length > 0);
  assert.ok(replay.blockedRunbooks[0]?.missingAdapterPrerequisites.length > 0);
  assert.ok(replay.blockedRunbooks[0]?.missingAuthorityEvidence.length > 0);
  assert.ok(replay.blockedRunbooks[0]?.runbook.rollbackNotes.length >= 1);
  assert.ok(replay.blockedRunbooks[0]?.runbook.auditExpectations.length >= 1);
});

await test("remains pure replay with no mutation side effects", () => {
  const model: SocialPublicationExecutionPersistenceModel = {
    intents: [intentRecord("pure")],
    results: [],
  };
  const before = JSON.stringify(model);
  replaySocialPublicationExecutionRunbooks(model);
  assert.equal(JSON.stringify(model), before);
});
