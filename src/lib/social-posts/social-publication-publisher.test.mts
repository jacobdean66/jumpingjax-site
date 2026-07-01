import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertPublicationPublisherRequestSafe,
  assertPublicationPublisherResultSafe,
  hydratePublicationPublisherRequest,
  hydratePublicationPublisherResult,
  isPublicationPublisherChannelPlatform,
  isPublicationPublisherChannelType,
  isPublicationPublisherJobType,
  isPublicationPublisherRequestType,
  isPublicationPublisherResultType,
  serializePublicationPublisherRequest,
  serializePublicationPublisherResult,
  validatePublicationPublisherRequest,
  validatePublicationPublisherResult,
  type PublicationPublisherJsonObject,
  type PublicationPublisherRequest,
  type PublicationPublisherResult,
} from "./social-publication-publisher";
import * as publisherExports from "./social-publication-publisher";

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
        publicationTargetId: "target-facebook-page-1",
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
      channelId: "channel-facebook-page-1",
      platform: "facebook",
      channelType: "facebook_page",
      publicationTargetId: "target-facebook-page-1",
      externalChannelReference: "facebook-page-123",
      displayName: "Jumping Jax Facebook Page",
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
      captionLength: 120,
      assetReferenceCount: 1,
      sanitizedSummary: {
        captionCharacters: 120,
        mediaReferences: 1,
      },
      containsFullPayload: false,
      containsSecrets: false,
      containsLowerLayerPayload: false,
    },
    evidenceSummary: {
      evidenceKind: "authority_check",
      notes: "Owner approval was referenced, not mutated.",
      externalReference: null,
      evidence: {
        ownerApprovalSatisfied: true,
      },
      containsFullPayload: false,
      containsFullResponse: false,
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
    ...input,
  };
}

function result(input: Partial<PublicationPublisherResult> = {}): PublicationPublisherResult {
  const baseRequest = request();

  return {
    resultId: "publisher-result-1",
    requestId: baseRequest.requestId,
    job: baseRequest.job,
    channel: baseRequest.channel,
    authority: baseRequest.authority,
    resultSummary: {
      resultType: "publication_request_prepared",
      status: "prepared",
      resultCode: "ready_for_external_executor",
      message: "Publisher contract prepared without executing publication.",
      sanitizedSummary: {
        readyForExecutor: true,
      },
      externalPublicationId: null,
      externalUrl: null,
      containsFullResponse: false,
      containsSecrets: false,
    },
    errorSummary: null,
    evidenceSummary: {
      evidenceKind: "result_contract",
      notes: "No external platform was contacted.",
      externalReference: null,
      evidence: {},
      containsFullPayload: false,
      containsFullResponse: false,
      containsSecrets: false,
      provesExecution: false,
    },
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

function requestCodes(
  validation: ReturnType<typeof validatePublicationPublisherRequest>,
): string[] {
  return validation.ok ? [] : validation.errors.map((error) => error.code);
}

function resultCodes(
  validation: ReturnType<typeof validatePublicationPublisherResult>,
): string[] {
  return validation.ok ? [] : validation.errors.map((error) => error.code);
}

function withRequestSummary(
  value: PublicationPublisherJsonObject,
): PublicationPublisherRequest {
  return request({
    requestSummary: {
      requestType: "prepare_publication_request",
      operation: "prepare_publication",
      mediaKind: "image",
      captionLength: 120,
      assetReferenceCount: 1,
      sanitizedSummary: value,
      containsFullPayload: false,
      containsSecrets: false,
      containsLowerLayerPayload: false,
    },
  });
}

await test("valid model-only publisher request", () => {
  assert.equal(validatePublicationPublisherRequest(request()).ok, true);
});

await test("valid model-only publisher result", () => {
  assert.equal(validatePublicationPublisherResult(result()).ok, true);
});

await test("publisher vocabulary helpers", () => {
  assert.equal(isPublicationPublisherJobType("model_publication_job"), true);
  assert.equal(isPublicationPublisherRequestType("prepare_publication_request"), true);
  assert.equal(isPublicationPublisherResultType("publication_request_prepared"), true);
  assert.equal(isPublicationPublisherChannelPlatform("facebook"), true);
  assert.equal(isPublicationPublisherChannelType("facebook_page"), true);
  assert.equal(isPublicationPublisherChannelType("profile"), false);
});

await test("missing ids rejected", () => {
  const validation = validatePublicationPublisherRequest(
    request({
      requestId: "",
      job: {
        ...request().job,
        jobId: "",
        references: {
          socialPostId: "",
          publicationTargetId: "",
          publicationManifestId: "",
          ownerApprovalId: "",
          approvalId: "",
          proposalId: "",
          scheduleId: "",
          ledgerEntryId: "",
          publicationAttemptId: "",
        },
      },
      channel: {
        ...request().channel,
        channelId: "",
        publicationTargetId: "",
      },
      createdAt: "",
      updatedAt: "",
    }),
  );

  assert.deepEqual(requestCodes(validation), [
    "request_id_required",
    "job_id_required",
    "social_post_id_required",
    "publication_target_id_required",
    "publication_manifest_id_invalid",
    "approval_reference_invalid",
    "approval_reference_invalid",
    "approval_reference_invalid",
    "schedule_id_invalid",
    "ledger_id_invalid",
    "ledger_id_invalid",
    "channel_id_required",
    "publication_target_id_required",
    "created_at_required",
    "updated_at_required",
  ]);
});

await test("channel type must match platform", () => {
  const validation = validatePublicationPublisherRequest(
    request({
      channel: {
        ...request().channel,
        platform: "instagram",
        channelType: "facebook_page",
      },
    }),
  );

  assert.equal(requestCodes(validation).includes("channel_identity_invalid"), true);
});

await test("authority must stay model-only", () => {
  const validation = validatePublicationPublisherRequest(
    request({
      authority: {
        ...request().authority,
        allowsNetwork: true as false,
        allowsPublicationExecution: true as false,
      },
    }),
  );

  assert.deepEqual(requestCodes(validation), ["authority_invalid"]);
});

await test("request invariant blocks execution posture", () => {
  const validation = validatePublicationPublisherRequest(
    request({
      publishesNothing: false as true,
      callsNoExternalApis: false as true,
    }),
  );

  assert.deepEqual(requestCodes(validation), ["request_invariant_failed"]);
});

await test("result invariant blocks external publication claims", () => {
  const validation = validatePublicationPublisherResult(
    result({
      resultSummary: {
        ...result().resultSummary,
        externalPublicationId: "facebook-post-1" as unknown as null,
      },
    }),
  );

  assert.deepEqual(resultCodes(validation), ["result_invariant_failed"]);
});

await test("recursive unsafe state checks reject secrets and APIs", () => {
  const validation = validatePublicationPublisherRequest(
    withRequestSummary({
      nested: {
        access_token: "secret",
        externalApi: "graph",
      },
    }),
  );

  assert.equal(requestCodes(validation).includes("secret_forbidden"), true);
  assert.equal(requestCodes(validation).includes("external_api_forbidden"), true);
});

await test("recursive unsafe state checks reject execution infrastructure", () => {
  const validation = validatePublicationPublisherRequest(
    withRequestSummary({
      nested: {
        cronExpression: "* * * * *",
        queueName: "publisher",
        workerId: "worker-1",
      },
    }),
  );

  assert.equal(requestCodes(validation).includes("cron_or_timer_forbidden"), true);
  assert.equal(requestCodes(validation).includes("worker_or_queue_forbidden"), true);
});

await test("recursive unsafe state checks reject lower-layer payloads and mutations", () => {
  const validation = validatePublicationPublisherRequest(
    withRequestSummary({
      nested: {
        manifestPayload: { caption: "full payload" },
        appendLedgerEntry: true,
        storagePath: "private/path",
        schedulerBridge: "bridge",
      },
    }),
  );

  assert.equal(requestCodes(validation).includes("lower_layer_payload_forbidden"), true);
  assert.equal(requestCodes(validation).includes("lower_layer_mutation_forbidden"), true);
  assert.equal(requestCodes(validation).includes("storage_forbidden"), true);
  assert.equal(requestCodes(validation).includes("bridge_forbidden"), true);
});

await test("recursive unsafe state checks reject publication and status state", () => {
  const validation = validatePublicationPublisherResult(
    result({
      evidenceSummary: {
        evidenceKind: "result_contract",
        notes: null,
        externalReference: null,
        evidence: {
          publishPost: "do-it",
          publishedPostId: "post-1",
          metrics: { impressions: 10 },
          learningSignal: "boost",
        },
        containsFullPayload: false,
        containsFullResponse: false,
        containsSecrets: false,
        provesExecution: false,
      },
    }),
  );

  assert.equal(resultCodes(validation).includes("publish_execution_forbidden"), true);
  assert.equal(resultCodes(validation).includes("mutable_publish_state_forbidden"), true);
  assert.equal(resultCodes(validation).includes("metrics_state_forbidden"), true);
  assert.equal(resultCodes(validation).includes("learning_state_forbidden"), true);
});

await test("serialization and hydration round-trip request", () => {
  const serialized = serializePublicationPublisherRequest(request());
  const hydrated = hydratePublicationPublisherRequest(serialized);

  assert.equal(hydrated.ok, true);
  assert.deepEqual(hydrated.value, request());
});

await test("serialization and hydration round-trip result", () => {
  const serialized = serializePublicationPublisherResult(result());
  const hydrated = hydratePublicationPublisherResult(serialized);

  assert.equal(hydrated.ok, true);
  assert.deepEqual(hydrated.value, result());
});

await test("assert helpers throw on unsafe contracts", () => {
  assert.doesNotThrow(() => assertPublicationPublisherRequestSafe(request()));
  assert.doesNotThrow(() => assertPublicationPublisherResultSafe(result()));
  assert.throws(() =>
    assertPublicationPublisherRequestSafe(
      request({ usesNoNetwork: false as true }),
    ),
  );
  assert.throws(() =>
    assertPublicationPublisherResultSafe(
      result({ currentPublishStatusAuthority: true as false }),
    ),
  );
});

await test("forbidden exports are absent", () => {
  const forbidden = [
    "createPublicationPublisherRepository",
    "publish",
    "publishPost",
    "publishToTarget",
    "executePublication",
    "callFacebook",
    "callInstagram",
    "createWorker",
    "createQueue",
    "createApiRoute",
    "createD9",
  ];

  for (const name of forbidden) {
    assert.equal(name in publisherExports, false, name);
  }
});

await test("module has no forbidden imports or implementations", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-publication-publisher.ts",
    ),
    "utf8",
  );
  const forbiddenFragments = [
    "import ",
    "createServiceRoleClient",
    "from(\"",
    "from('",
    "next/",
    "react",
    "@/app",
    "app/api",
    "@supabase",
    "googleapis",
    "openai",
    "fetch(",
    "XMLHttpRequest",
    "setInterval(",
    "setTimeout(",
    "cron(",
    "new Worker",
    "queue.add",
    "publishPost(",
    "publishToTarget(",
    "executePublication(",
    "localStorage",
    "storage.from",
  ];

  for (const fragment of forbiddenFragments) {
    assert.equal(source.includes(fragment), false, fragment);
  }
});
