import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  hydrateSocialPublicationPublisherPersistenceModel,
  mapPublicationPublisherRequestToRequestRecord,
  mapPublicationPublisherResultToResultRecord,
  mapRequestRecordToPublicationPublisherRequest,
  mapResultRecordToPublicationPublisherResult,
  serializeSocialPublicationPublisherPersistenceModel,
  validateSocialPublicationPublisherAppendResultRequest,
  validateSocialPublicationPublisherCreateRequest,
  validateSocialPublicationPublisherPersistenceModel,
  validateSocialPublicationPublisherRepositoryIdentity,
  validateSocialPublicationPublisherRequestRecord,
  validateSocialPublicationPublisherResultRecord,
  type PublicationPublisherRequest,
  type PublicationPublisherResult,
  type SocialPublicationPublisherRecordValidationResult,
} from "./social-publication-publisher-repository";
import * as repositoryExports from "./social-publication-publisher-repository";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function request(
  input: Partial<PublicationPublisherRequest> = {},
): PublicationPublisherRequest {
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

function codes(result: SocialPublicationPublisherRecordValidationResult): readonly string[] {
  return result.ok ? [] : result.errors.map((error) => error.code);
}

function assertOk<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) {
    assert.fail(JSON.stringify(result.error));
  }
  return result.value;
}

await test("domain request and result map to reference-only records", () => {
  const requestRecord = assertOk(mapPublicationPublisherRequestToRequestRecord(request()));
  const resultRecord = assertOk(mapPublicationPublisherResultToResultRecord(result()));

  assert.equal(requestRecord.publisher_request_id, "publisher-request-1");
  assert.equal(requestRecord.scope.social_post_id, "social-post-1");
  assert.equal(requestRecord.references_only, true);
  assert.equal(requestRecord.executes_nothing, true);
  assert.equal(resultRecord.publisher_result_id, "publisher-result-1");
  assert.equal(resultRecord.current_publish_status_authority, false);
  assert.equal(JSON.stringify(requestRecord).includes("sanitizedSummary"), false);
});

await test("records hydrate back into safe domain shapes", () => {
  const requestRecord = assertOk(mapPublicationPublisherRequestToRequestRecord(request()));
  const resultRecord = assertOk(mapPublicationPublisherResultToResultRecord(result()));
  const hydratedRequest = assertOk(mapRequestRecordToPublicationPublisherRequest(requestRecord));
  const hydratedResult = assertOk(mapResultRecordToPublicationPublisherResult(resultRecord));

  assert.equal(hydratedRequest.requestId, "publisher-request-1");
  assert.equal(hydratedRequest.requestSummary.assetReferenceCount, 0);
  assert.equal(hydratedResult.resultId, "publisher-result-1");
  assert.equal(hydratedResult.resultSummary.externalPublicationId, null);
});

await test("create and append request validators accept records", () => {
  const requestRecord = assertOk(mapPublicationPublisherRequestToRequestRecord(request()));
  const resultRecord = assertOk(mapPublicationPublisherResultToResultRecord(result()));

  assert.equal(validateSocialPublicationPublisherCreateRequest({ request: requestRecord }).ok, true);
  assert.equal(validateSocialPublicationPublisherAppendResultRequest({ result: resultRecord }).ok, true);
});

await test("repository identity requires a non-empty field", () => {
  assert.equal(validateSocialPublicationPublisherRepositoryIdentity({}).ok, false);
  assert.equal(
    validateSocialPublicationPublisherRepositoryIdentity({ publisher_job_id: "publisher-job-1" }).ok,
    true,
  );
});

await test("model validates relationships and identity uniqueness", () => {
  const requestRecord = assertOk(mapPublicationPublisherRequestToRequestRecord(request()));
  const resultRecord = assertOk(mapPublicationPublisherResultToResultRecord(result()));

  assert.equal(
    validateSocialPublicationPublisherPersistenceModel({
      requests: [requestRecord],
      results: [resultRecord],
    }).ok,
    true,
  );

  const duplicate = validateSocialPublicationPublisherPersistenceModel({
    requests: [requestRecord, requestRecord],
    results: [],
  });
  assert.equal(codes(duplicate).includes("identity_not_separated"), true);

  const orphan = validateSocialPublicationPublisherPersistenceModel({
    requests: [],
    results: [resultRecord],
  });
  assert.equal(codes(orphan).includes("relationship_invalid"), true);
});

await test("result scope must match request scope", () => {
  const requestRecord = assertOk(mapPublicationPublisherRequestToRequestRecord(request()));
  const resultRecord = {
    ...assertOk(mapPublicationPublisherResultToResultRecord(result())),
    scope: {
      ...requestRecord.scope,
      publication_target_id: "target-2",
    },
  };

  const validation = validateSocialPublicationPublisherPersistenceModel({
    requests: [requestRecord],
    results: [resultRecord],
  });

  assert.equal(codes(validation).includes("relationship_invalid"), true);
});

await test("contract invariant drift is rejected", () => {
  const record = {
    ...assertOk(mapPublicationPublisherRequestToRequestRecord(request())),
    calls_no_external_apis: false,
  };

  assert.deepEqual(codes(validateSocialPublicationPublisherRequestRecord(record)), [
    "contract_invariant_failed",
  ]);
});

await test("invalid channel and timestamp are rejected", () => {
  const record = {
    ...assertOk(mapPublicationPublisherRequestToRequestRecord(request())),
    channel_platform: "instagram",
    requested_at: "not-a-date",
  };
  const validation = validateSocialPublicationPublisherRequestRecord(record);

  assert.equal(codes(validation).includes("channel_invalid"), true);
  assert.equal(codes(validation).includes("timestamp_invalid"), true);
});

await test("lower-layer payloads, execution, metrics, and learning are forbidden", () => {
  const record = {
    ...assertOk(mapPublicationPublisherResultToResultRecord(result())),
    diagnostics: {
      publicationManifest: { copied: true },
      executionPlan: { step: "call-network" },
      metrics: { reach: 1 },
      learning: { note: "train" },
      accessToken: "secret",
    },
  };
  const validation = validateSocialPublicationPublisherResultRecord(record);

  assert.equal(codes(validation).includes("lower_layer_payload_forbidden"), true);
  assert.equal(codes(validation).includes("execution_forbidden"), true);
  assert.equal(codes(validation).includes("metrics_state_forbidden"), true);
  assert.equal(codes(validation).includes("learning_state_forbidden"), true);
  assert.equal(codes(validation).includes("secret_forbidden"), true);
});

await test("lower-layer mutation and scheduler execution are forbidden", () => {
  const record = {
    ...assertOk(mapPublicationPublisherResultToResultRecord(result())),
    diagnostics: {
      writeLedger: true,
      runScheduler: true,
    },
  };
  const validation = validateSocialPublicationPublisherResultRecord(record);

  assert.equal(codes(validation).includes("lower_layer_mutation_forbidden"), true);
  assert.equal(codes(validation).includes("scheduler_execution_forbidden"), true);
});

await test("serialization and hydration are deterministic and immutable", () => {
  const requestOne = assertOk(mapPublicationPublisherRequestToRequestRecord(request()));
  const requestTwo = {
    ...assertOk(
      mapPublicationPublisherRequestToRequestRecord(
        request({
          requestId: "publisher-request-2",
          job: {
            ...request().job,
            jobId: "publisher-job-2",
          },
          createdAt: "2026-07-01T12:02:00.000Z",
        }),
      ),
    ),
    requested_at: "2026-07-01T12:02:00.000Z",
  };
  const serialized = serializeSocialPublicationPublisherPersistenceModel({
    requests: [requestTwo, requestOne],
    results: [],
  });
  const hydrated = assertOk(hydrateSocialPublicationPublisherPersistenceModel(serialized));

  assert.equal(serializeSocialPublicationPublisherPersistenceModel(hydrated), serialized);
  assert.deepEqual(
    hydrated.requests.map((item) => item.publisher_request_id),
    ["publisher-request-1", "publisher-request-2"],
  );
  assert.equal(Object.isFrozen(hydrated), true);
  assert.equal(Object.isFrozen(hydrated.requests[0]), true);
});

await test("module exports no store factory bridge execution scheduler metrics or API behavior", () => {
  const forbidden = [
    "createSocialPublicationPublisherRepository",
    "createPublicationPublisherStore",
    "createServiceRoleClient",
    "publishSocialPost",
    "publishPost",
    "publishToTarget",
    "runPublisher",
    "runScheduler",
    "schedulePublication",
    "recordPublicationMetrics",
    "learnFromPublication",
  ];

  for (const name of forbidden) {
    assert.equal(name in repositoryExports, false, name);
  }
});

await test("source has no SQL, production store, network, cron, worker, bridge, API, or UI implementation", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-publication-publisher-repository.ts",
    ),
    "utf8",
  );
  const forbiddenFragments = [
    "create table",
    "alter table",
    "createServiceRoleClient",
    "from(\"",
    "from('",
    "fetch(",
    "axios",
    "next/",
    "app/api",
    "setInterval(",
    "setTimeout(",
    "new Worker(",
    "worker_threads",
    "queueMicrotask",
    "publishSocialPost(",
    "executePublication(",
    "recordPublicationMetrics(",
    "learnFromPublication(",
  ];

  for (const fragment of forbiddenFragments) {
    assert.equal(source.includes(fragment), false, fragment);
  }
});
