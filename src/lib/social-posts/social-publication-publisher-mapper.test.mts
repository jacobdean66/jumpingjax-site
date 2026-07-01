import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  hydratePublicationPublisherMappedRequest,
  hydratePublicationPublisherMappedResult,
  mapPublicationPublisherRequestToPersistenceMapping,
  mapPublicationPublisherRequestToRequestRecord,
  mapPublicationPublisherResultToPersistenceMapping,
  mapPublicationPublisherResultToResultRecord,
  previewPublicationPublisherRequestPersistenceMapping,
  previewPublicationPublisherResultPersistenceMapping,
  publicationPublisherMappedRequestsEqual,
  publicationPublisherMappedResultsEqual,
  serializePublicationPublisherMappedRequest,
  serializePublicationPublisherMappedResult,
  validatePublicationPublisherRequestForPersistenceMapping,
  validatePublicationPublisherResultForPersistenceMapping,
} from "./social-publication-publisher-mapper";
import * as mapperExports from "./social-publication-publisher-mapper";
import type {
  PublicationPublisherRequest,
  PublicationPublisherResult,
} from "./social-publication-publisher";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function request(
  input: Partial<PublicationPublisherRequest> = {},
): PublicationPublisherRequest {
  return {
    requestId: "request-1",
    job: {
      jobId: "job-1",
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
      createdAt: "2026-06-30T12:00:00.000Z",
      updatedAt: "2026-06-30T12:00:00.000Z",
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
      channelId: "channel-1",
      platform: "facebook",
      channelType: "facebook_page",
      publicationTargetId: "target-facebook-page-1",
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
      captionLength: 42,
      assetReferenceCount: 1,
      sanitizedSummary: {},
      containsFullPayload: false,
      containsSecrets: false,
      containsLowerLayerPayload: false,
    },
    evidenceSummary: {
      evidenceKind: "authority_check",
      notes: "owner approval confirmed",
      externalReference: null,
      evidence: { checked: true },
      containsFullPayload: false,
      containsFullResponse: false,
      containsSecrets: false,
      provesExecution: false,
    },
    createdAt: "2026-06-30T12:00:00.000Z",
    updatedAt: "2026-06-30T12:00:00.000Z",
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

function result(
  input: Partial<PublicationPublisherResult> = {},
  base: PublicationPublisherRequest = request(),
): PublicationPublisherResult {
  return {
    resultId: "result-1",
    requestId: base.requestId,
    job: base.job,
    channel: base.channel,
    authority: base.authority,
    resultSummary: {
      resultType: "publication_request_prepared",
      status: "prepared",
      resultCode: "prepared_ok",
      message: null,
      sanitizedSummary: {},
      externalPublicationId: null,
      externalUrl: null,
      containsFullResponse: false,
      containsSecrets: false,
    },
    errorSummary: null,
    evidenceSummary: {
      evidenceKind: "result_contract",
      notes: "prepared successfully",
      externalReference: null,
      evidence: { prepared: true },
      containsFullPayload: false,
      containsFullResponse: false,
      containsSecrets: false,
      provesExecution: false,
    },
    createdAt: "2026-06-30T12:05:00.000Z",
    updatedAt: "2026-06-30T12:05:00.000Z",
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

function assertOk<T>(
  result: { ok: true; value: T } | { ok: false; errors: readonly unknown[] },
): T {
  assert.equal(result.ok, true, JSON.stringify("errors" in result ? result.errors : []));
  return result.value;
}

function codes(
  result: { ok: true } | { ok: false; errors: readonly { code: string }[] },
): string[] {
  return result.ok ? [] : result.errors.map((error) => error.code);
}

await test("valid request maps to a validated request record", () => {
  const record = assertOk(mapPublicationPublisherRequestToRequestRecord(request()));

  assert.equal(record.publisher_request_id, "request-1");
  assert.equal(record.scope.social_post_id, "social-post-1");
  assert.equal(Object.isFrozen(record), true);
});

await test("mapped request carries safety flags, evidence, and wraps the request record", () => {
  const mapped = assertOk(mapPublicationPublisherRequestToPersistenceMapping(request()));

  assert.equal(mapped.sourceRequestId, "request-1");
  assert.equal(mapped.deterministic, true);
  assert.equal(mapped.persisted, false);
  assert.equal(mapped.referencesOnly, true);
  assert.equal(mapped.executesNothing, true);
  assert.equal(mapped.publishesNothing, true);
  assert.equal(mapped.recordsNoMetrics, true);
  assert.equal(mapped.performsNoLearning, true);
  assert.equal(mapped.request.publisher_request_id, "request-1");
  assert.equal(mapped.evidence?.evidence_kind, "authority_check");
  assert.equal(mapped.evidence?.publisher_request_id, mapped.request.publisher_request_id);
  assert.equal(mapped.evidence?.publisher_result_id, null);
});

await test("valid result maps to a validated result record", () => {
  const record = assertOk(mapPublicationPublisherResultToResultRecord(result()));

  assert.equal(record.publisher_result_id, "result-1");
  assert.equal(record.publisher_request_id, "request-1");
  assert.equal(Object.isFrozen(record), true);
});

await test("mapped result carries safety flags, evidence, and wraps the result record", () => {
  const mapped = assertOk(mapPublicationPublisherResultToPersistenceMapping(result()));

  assert.equal(mapped.sourceResultId, "result-1");
  assert.equal(mapped.sourceRequestId, "request-1");
  assert.equal(mapped.deterministic, true);
  assert.equal(mapped.persisted, false);
  assert.equal(mapped.executesNothing, true);
  assert.equal(mapped.publishesNothing, true);
  assert.equal(mapped.result.publisher_result_id, "result-1");
  assert.equal(mapped.evidence?.evidence_kind, "result_contract");
  assert.equal(mapped.evidence?.publisher_result_id, mapped.result.publisher_result_id);
});

await test("evidence ids are deterministic for the same source id", () => {
  const first = assertOk(mapPublicationPublisherRequestToPersistenceMapping(request()));
  const second = assertOk(mapPublicationPublisherRequestToPersistenceMapping(request()));

  assert.equal(first.evidence?.evidence_id, second.evidence?.evidence_id);
});

await test("preview mapping matches the direct mapping", () => {
  const mapped = assertOk(mapPublicationPublisherRequestToPersistenceMapping(request()));
  const preview = assertOk(previewPublicationPublisherRequestPersistenceMapping(request()));

  assert.equal(publicationPublisherMappedRequestsEqual(mapped, preview), true);
});

await test("preview result mapping matches the direct mapping", () => {
  const mapped = assertOk(mapPublicationPublisherResultToPersistenceMapping(result()));
  const preview = assertOk(previewPublicationPublisherResultPersistenceMapping(result()));

  assert.equal(publicationPublisherMappedResultsEqual(mapped, preview), true);
});

await test("invalid domain request is rejected before mapping", () => {
  const invalid = mapPublicationPublisherRequestToRequestRecord(
    request({ requestId: "" }),
  );

  assert.equal(invalid.ok, false);
  assert.equal(codes(invalid).includes("domain_validation_failed"), true);
});

await test("invalid domain result is rejected before mapping", () => {
  const invalid = mapPublicationPublisherResultToResultRecord(
    result({ resultId: "" }),
  );

  assert.equal(invalid.ok, false);
  assert.equal(codes(invalid).includes("domain_validation_failed"), true);
});

await test("timestamp ordering violations are rejected", () => {
  const requestResult = validatePublicationPublisherRequestForPersistenceMapping(
    request({
      createdAt: "2026-06-30T12:00:00.000Z",
      updatedAt: "2026-06-30T11:00:00.000Z",
    }),
  );
  const resultResult = validatePublicationPublisherResultForPersistenceMapping(
    result({
      createdAt: "2026-06-30T12:05:00.000Z",
      updatedAt: "2026-06-30T11:05:00.000Z",
    }),
  );

  assert.equal(requestResult.ok, false);
  assert.equal(codes(requestResult).includes("timestamp_ordering_invalid"), true);
  assert.equal(resultResult.ok, false);
  assert.equal(codes(resultResult).includes("timestamp_ordering_invalid"), true);
});

await test("forbidden mapper state is rejected even if attached via unknown fields", () => {
  const tainted = {
    ...request(),
    requestSummary: {
      ...request().requestSummary,
      accessToken: "abc",
    },
  };

  const mapped = mapPublicationPublisherRequestToRequestRecord(
    tainted as unknown as PublicationPublisherRequest,
  );

  assert.equal(mapped.ok, false);
  assert.equal(codes(mapped).includes("domain_validation_failed"), true);
});

await test("serialize and hydrate request round-trip preserves equality", () => {
  const mapped = assertOk(mapPublicationPublisherRequestToPersistenceMapping(request()));
  const serialized = serializePublicationPublisherMappedRequest(mapped);
  const hydrated = assertOk(hydratePublicationPublisherMappedRequest(serialized));

  assert.equal(publicationPublisherMappedRequestsEqual(mapped, hydrated), true);
  assert.equal(Object.isFrozen(hydrated), true);
});

await test("serialize and hydrate result round-trip preserves equality", () => {
  const mapped = assertOk(mapPublicationPublisherResultToPersistenceMapping(result()));
  const serialized = serializePublicationPublisherMappedResult(mapped);
  const hydrated = assertOk(hydratePublicationPublisherMappedResult(serialized));

  assert.equal(publicationPublisherMappedResultsEqual(mapped, hydrated), true);
  assert.equal(Object.isFrozen(hydrated), true);
});

await test("hydrate rejects malformed JSON and shapes", () => {
  const invalidRequestJson = hydratePublicationPublisherMappedRequest("not json");
  const invalidRequestShape = hydratePublicationPublisherMappedRequest(
    JSON.stringify({ sourceRequestId: "request-1" }),
  );
  const invalidResultJson = hydratePublicationPublisherMappedResult("not json");
  const invalidResultShape = hydratePublicationPublisherMappedResult(
    JSON.stringify({ sourceResultId: "result-1" }),
  );

  assert.equal(invalidRequestJson.ok, false);
  assert.equal(invalidRequestShape.ok, false);
  assert.equal(invalidResultJson.ok, false);
  assert.equal(invalidResultShape.ok, false);
});

await test("mapper exposes no execution, bridge, or store implementation", () => {
  const forbidden: readonly (keyof typeof mapperExports | string)[] = [
    "createServiceRoleClient",
    "createSocialPublicationPublisherStore",
    "publishPost",
    "executePublication",
    "runScheduler",
  ];

  for (const name of forbidden) {
    assert.equal(name in mapperExports, false, name);
  }
});

await test("mapper source has no Supabase, network, or execution implementation", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "social-publication-publisher-mapper.ts"),
    "utf8",
  );
  const forbiddenFragments = [
    "createServiceRoleClient",
    "@supabase",
    "from(\"",
    "from('",
    "insert(",
    "update(",
    "delete(",
    "select(",
    "next/",
    "react",
    "@/app",
    "app/api",
    "fetch(",
    "setInterval(",
    "setTimeout(",
    "publishPost(",
    "schedulePost(",
    "facebook.com",
    "instagram.com",
    "graph.facebook",
  ];

  for (const fragment of forbiddenFragments) {
    assert.equal(source.includes(fragment), false, fragment);
  }
});
