import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  PublicationPublisherRequest,
  PublicationPublisherResult,
} from "./social-publication-publisher";
import {
  mapPublicationPublisherRequestToRequestRecord,
  mapPublicationPublisherResultToResultRecord,
  type SocialPublicationPublisherRequestRecord,
} from "./social-publication-publisher-repository";
import {
  missingAuthorityForPublisherRequest,
  replaySocialPublicationPublisher,
} from "./social-publication-publisher-replay";
import * as replayExports from "./social-publication-publisher-replay";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function request(input: Partial<PublicationPublisherRequest> = {}): PublicationPublisherRequest {
  return {
    requestId: "publisher-request-1",
    job: {
      jobId: "publisher-job-1",
      jobType: "model_publication_job",
      references: {
        socialPostId: "social-post-1",
        publicationTargetId: "target-1",
        publicationManifestId: "manifest-1",
        ownerApprovalId: "owner-approval-1",
        approvalId: "approval-1",
        proposalId: "proposal-1",
        scheduleId: "schedule-1",
        ledgerEntryId: "ledger-entry-1",
        publicationAttemptId: "attempt-1",
      },
      createdAt: "2026-07-01T12:00:00.000Z",
      updatedAt: "2026-07-01T12:00:00.000Z",
      modelContractOnly: true,
      executesNothing: true,
      publishesNothing: true,
      schedulesNothing: true,
      mutatesLedger: false,
      mutatesTargets: false,
      mutatesApproval: false,
      mutatesManifest: false,
      persistsNothing: true,
    },
    channel: {
      channelId: "channel-facebook-1",
      platform: "facebook",
      channelType: "facebook_page",
      publicationTargetId: "target-1",
      externalChannelReference: null,
      displayName: null,
      identityOnly: true,
      containsCredentials: false,
      containsSdkClient: false,
      containsStorageReference: false,
      grantsPublishingPermission: false,
      publishesNothing: true,
    },
    authority: {
      authorityKind: "model",
      modelAuthorityOnly: true,
      ownerApprovalId: "owner-approval-1",
      approvalId: "approval-1",
      requiresOwnerApproval: true,
      ownerApprovalSatisfied: true,
      allowsExternalApiCall: false,
      allowsSdkUsage: false,
      allowsNetwork: false,
      allowsPublicationExecution: false,
      allowsPersistence: false,
      grantsPublishingPermission: false,
      canMutateLowerLayers: false,
    },
    requestSummary: {
      requestType: "prepare_publication_request",
      operation: "prepare_publication",
      mediaKind: "image",
      captionLength: 80,
      assetReferenceCount: 1,
      sanitizedSummary: {},
      containsFullPayload: false,
      containsSecrets: false,
      containsLowerLayerPayload: false,
    },
    evidenceSummary: null,
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
    ...input,
  };
}

function result(input: Partial<PublicationPublisherResult> = {}): PublicationPublisherResult {
  const base = request();
  return {
    resultId: "publisher-result-1",
    requestId: base.requestId,
    job: base.job,
    channel: base.channel,
    authority: base.authority,
    resultSummary: {
      resultType: "publication_request_prepared",
      status: "prepared",
      resultCode: "prepared",
      message: null,
      sanitizedSummary: {},
      externalPublicationId: null,
      externalUrl: null,
      containsFullResponse: false,
      containsSecrets: false,
    },
    errorSummary: null,
    evidenceSummary: null,
    createdAt: "2026-07-01T12:01:00.000Z",
    updatedAt: "2026-07-01T12:01:00.000Z",
    contractOnly: true,
    modelAuthorityOnly: true,
    executesNothing: true,
    publishesNothing: true,
    callsNoExternalApis: true,
    usesNoSdks: true,
    usesNoNetwork: true,
    persistsNothing: true,
    mutatesNoLowerLayers: true,
    recordsNoMetrics: true,
    performsNoLearning: true,
    currentPublishStatusAuthority: false,
    ...input,
  };
}

function requestRecord(input: Partial<PublicationPublisherRequest> = {}) {
  const mapped = mapPublicationPublisherRequestToRequestRecord(request(input));
  assert.equal(mapped.ok, true, JSON.stringify(mapped.ok ? [] : mapped.error));
  return mapped.value;
}

function resultRecord(input: Partial<PublicationPublisherResult> = {}) {
  const mapped = mapPublicationPublisherResultToResultRecord(result(input));
  assert.equal(mapped.ok, true, JSON.stringify(mapped.ok ? [] : mapped.error));
  return mapped.value;
}

await test("replay groups pending completed failed and blocked jobs", () => {
  const pending = requestRecord({
    requestId: "publisher-request-pending",
    job: { ...request().job, jobId: "publisher-job-pending" },
  });
  const completedResult = resultRecord();
  const failedResult = resultRecord({
    resultId: "publisher-result-failed",
    requestId: "publisher-request-failed",
    job: { ...result().job, jobId: "publisher-job-failed" },
    resultSummary: {
      ...result().resultSummary,
      resultType: "publication_request_rejected",
      status: "rejected",
    },
  });
  const failedRequest = requestRecord({
    requestId: "publisher-request-failed",
    job: { ...request().job, jobId: "publisher-job-failed" },
  });
  const blocked = requestRecord({
    requestId: "publisher-request-blocked",
    job: {
      ...request().job,
      jobId: "publisher-job-blocked",
      references: { ...request().job.references, scheduleId: null },
    },
  });

  const replay = replaySocialPublicationPublisher({
    requests: [pending, requestRecord(), failedRequest, blocked],
    results: [completedResult, failedResult],
  }).value;

  assert.equal(replay.pendingJobs.length, 1);
  assert.equal(replay.completedJobs.length, 1);
  assert.equal(replay.failedJobs.length, 1);
  assert.equal(replay.blockedJobs.length, 1);
});

await test("replay identifies missing and sufficient authority evidence", () => {
  const blocked = requestRecord({
    job: {
      ...request().job,
      references: { ...request().job.references, ledgerEntryId: null },
    },
  });
  const replay = replaySocialPublicationPublisher({
    requests: [requestRecord({ requestId: "publisher-request-good" }), blocked],
    results: [],
  }).value;

  assert.equal(replay.jobsWithSufficientAuthorityEvidence.length, 1);
  assert.equal(replay.jobsMissingAuthority.length, 1);
  assert.deepEqual(missingAuthorityForPublisherRequest(blocked), ["ledger_evidence"]);
});

await test("replay is computed only and grants no authority", () => {
  const replay = replaySocialPublicationPublisher({
    requests: [requestRecord()],
    results: [],
  }).value;

  assert.equal(replay.computedOnly, true);
  assert.equal(replay.authoritative, false);
  assert.equal(replay.grantsPublishingPermission, false);
  assert.equal(replay.executesNothing, true);
  assert.equal(replay.publishesNothing, true);
  assert.equal(Object.isFrozen(replay), true);
});

await test("invalid models create diagnostics", () => {
  const invalid = {
    ...requestRecord(),
    executes_nothing: false,
  } as unknown as SocialPublicationPublisherRequestRecord;
  const replay = replaySocialPublicationPublisher({
    requests: [invalid],
    results: [],
  }).value;

  assert.equal(replay.summary.errorCount > 0, true);
  assert.equal(replay.replayIntegrity.valid, false);
});

await test("module exports no publisher execution storage network or admin behavior", () => {
  const forbidden = [
    "publishSocialPost",
    "executePublication",
    "createServiceRoleClient",
    "createPublisherBridge",
    "renderPublisherAdmin",
    "recordPublicationMetrics",
    "learnFromPublication",
  ];

  for (const name of forbidden) {
    assert.equal(name in replayExports, false, name);
  }
});

await test("source has no persistence, route, network, timer, metric, or learning implementation", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-publication-publisher-replay.ts",
    ),
    "utf8",
  );
  const forbiddenFragments = [
    "createServiceRoleClient",
    "from(\"",
    "from('",
    "fetch(",
    "next/",
    "app/api",
    "setInterval(",
    "setTimeout(",
    "publishSocialPost",
    "executePublication",
    "recordPublicationMetrics",
    "learnFromPublication",
  ];

  for (const fragment of forbiddenFragments) {
    assert.equal(source.includes(fragment), false, fragment);
  }
});
