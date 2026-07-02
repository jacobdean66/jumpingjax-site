import assert from "node:assert/strict";

import {
  mapPublicationExecutionIntentToIntentRecord,
  type PublicationExecutionIntent,
  type SocialPublicationExecutionIntentRecord,
  type SocialPublicationExecutionPersistenceModel,
} from "./social-publication-execution-repository";
import {
  replaySocialPlatformMetaAdapter,
  SOCIAL_PLATFORM_META_ADAPTER_REPLAY_VERSION,
  type SocialPlatformMetaAdapterJobHint,
} from "./social-platform-meta-adapter-replay";

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

await test("returns an empty Meta adapter replay for empty execution models", () => {
  const replay = replaySocialPlatformMetaAdapter(EMPTY_MODEL).value;
  assert.equal(replay.replayVersion, SOCIAL_PLATFORM_META_ADAPTER_REPLAY_VERSION);
  assert.equal(replay.summary.totalJobCount, 0);
  assert.equal(replay.summary.metaReadyJobCount, 0);
  assert.equal(replay.grantsExecutionPermission, false);
});

await test("computes facebook-ready and instagram-ready job buckets from hints", () => {
  const model: SocialPublicationExecutionPersistenceModel = {
    intents: [intentRecord("fb"), intentRecord("ig")],
    results: [],
  };

  const hints: SocialPlatformMetaAdapterJobHint[] = [
    {
      executionJobId: "execution-job-fb",
      publicationTargetId: "target-fb",
      platform: "facebook",
      channelId: "channel-fb",
      channelType: "facebook_page",
      postKind: "feed_post",
      mediaKinds: ["image_ref"],
      mediaRefCount: 1,
    },
    {
      executionJobId: "execution-job-ig",
      publicationTargetId: "target-ig",
      platform: "instagram",
      channelId: "channel-ig",
      channelType: "instagram_business_account",
      postKind: "story_post",
      mediaKinds: ["video_ref"],
      mediaRefCount: 1,
    },
  ];

  const replay = replaySocialPlatformMetaAdapter(model, { jobHints: hints }).value;
  assert.equal(replay.summary.facebookReadyJobCount, 1);
  assert.equal(replay.summary.instagramReadyJobCount, 1);
  assert.equal(replay.summary.metaReadyJobCount, 2);
  assert.equal(replay.summary.missingMediaJobCount, 0);
});

await test("flags missing media, unsupported channel, and missing capability jobs", () => {
  const model: SocialPublicationExecutionPersistenceModel = {
    intents: [intentRecord("blocked")],
    results: [],
  };

  const hints: SocialPlatformMetaAdapterJobHint[] = [
    {
      executionJobId: "execution-job-blocked",
      publicationTargetId: "target-blocked",
      platform: "facebook",
      channelId: "channel-fb",
      channelType: "instagram_business_account",
      postKind: "story_post",
      mediaKinds: ["video_ref"],
      mediaRefCount: 0,
    },
  ];

  const replay = replaySocialPlatformMetaAdapter(model, { jobHints: hints }).value;
  assert.equal(replay.summary.metaBlockedJobCount, 1);
  assert.equal(replay.summary.missingMediaJobCount, 1);
  assert.equal(replay.summary.unsupportedChannelJobCount, 1);
  assert.equal(replay.summary.missingCapabilityJobCount, 1);
});

console.log("social-platform-meta-adapter-replay tests passed");
