import assert from "node:assert/strict";

import {
  mapPublicationExecutionIntentToIntentRecord,
  type PublicationExecutionIntent,
  type SocialPublicationExecutionIntentRecord,
  type SocialPublicationExecutionPersistenceModel,
} from "./social-publication-execution-repository";
import {
  replaySocialPlatformLinkedinAdapter,
  SOCIAL_PLATFORM_LINKEDIN_ADAPTER_REPLAY_VERSION,
  type SocialPlatformLinkedinAdapterJobHint,
} from "./social-platform-linkedin-adapter-replay";

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

const EMPTY_MODEL: SocialPublicationExecutionPersistenceModel = Object.freeze({
  intents: [],
  results: [],
});

await test("returns an empty LinkedIn adapter replay for empty execution models", () => {
  const replay = replaySocialPlatformLinkedinAdapter(EMPTY_MODEL).value;
  assert.equal(replay.replayVersion, SOCIAL_PLATFORM_LINKEDIN_ADAPTER_REPLAY_VERSION);
  assert.equal(replay.summary.totalJobCount, 0);
  assert.equal(replay.summary.linkedinReadyJobCount, 0);
  assert.equal(replay.grantsExecutionPermission, false);
});

await test("computes article-post-ready and feed-post-ready job buckets from hints", () => {
  const model: SocialPublicationExecutionPersistenceModel = {
    intents: [intentRecord("article"), intentRecord("feed")],
    results: [],
  };

  const hints: SocialPlatformLinkedinAdapterJobHint[] = [
    {
      executionJobId: "execution-job-article",
      publicationTargetId: "target-article",
      platform: "linkedin",
      channelId: "channel-article",
      channelType: "linkedin_company_page",
      postKind: "article_post",
      mediaKinds: ["image_ref"],
      mediaRefCount: 1,
    },
    {
      executionJobId: "execution-job-feed",
      publicationTargetId: "target-feed",
      platform: "linkedin",
      channelId: "channel-feed",
      channelType: "linkedin_company_page",
      postKind: "feed_post",
      mediaKinds: ["image_ref"],
      mediaRefCount: 1,
    },
  ];

  const replay = replaySocialPlatformLinkedinAdapter(model, { jobHints: hints }).value;
  assert.equal(replay.summary.articlePostReadyJobCount, 1);
  assert.equal(replay.summary.feedPostReadyJobCount, 1);
  assert.equal(replay.summary.linkedinReadyJobCount, 2);
  assert.equal(replay.summary.missingMediaJobCount, 0);
});

await test("flags missing media and unsupported channel jobs", () => {
  const model: SocialPublicationExecutionPersistenceModel = {
    intents: [intentRecord("blocked")],
    results: [],
  };

  const hints: SocialPlatformLinkedinAdapterJobHint[] = [
    {
      executionJobId: "execution-job-blocked",
      publicationTargetId: "target-blocked",
      platform: "linkedin",
      channelId: "channel-blocked",
      channelType: "tiktok_business_account" as SocialPlatformLinkedinAdapterJobHint["channelType"],
      postKind: "article_post",
      mediaKinds: ["image_ref"],
      mediaRefCount: 0,
    },
  ];

  const replay = replaySocialPlatformLinkedinAdapter(model, { jobHints: hints }).value;
  assert.equal(replay.summary.linkedinBlockedJobCount, 1);
  assert.equal(replay.summary.missingMediaJobCount, 1);
  assert.equal(replay.summary.unsupportedChannelJobCount, 1);
});

console.log("social-platform-linkedin-adapter-replay tests passed");
