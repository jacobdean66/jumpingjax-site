import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  appendSocialPublicationPublisherResult,
  configureSocialPublicationPublisherStoreTestDependencies,
  createSocialPublicationPublisherRequest,
  fetchSocialPublicationPublisherRecordsByJob,
  fetchSocialPublicationPublisherRecordsByManifest,
  fetchSocialPublicationPublisherRecordsByPost,
  fetchSocialPublicationPublisherRecordsByPublicationTarget,
  fetchSocialPublicationPublisherRequestRecordByRequestId,
  fetchSocialPublicationPublisherRows,
  fetchSocialPublicationPublisherRowsByJob,
  insertSocialPublicationPublisherEvidence,
  insertSocialPublicationPublisherMappedRequest,
  insertSocialPublicationPublisherMappedResult,
  isSocialPublicationPublisherStoreConfigured,
  type SocialPublicationPublisherReadFilter,
  type SocialPublicationPublisherStoreResult,
  type SocialPublicationPublisherStoreStorage,
} from "./social-publication-publisher-store";
import * as storeExports from "./social-publication-publisher-store";
import {
  mapPublicationPublisherRequestToPersistenceMapping,
  mapPublicationPublisherRequestToRequestRecord,
  mapPublicationPublisherResultToPersistenceMapping,
  mapPublicationPublisherResultToResultRecord,
} from "./social-publication-publisher-mapper";
import type {
  SocialPublicationPublisherEvidenceRow,
  SocialPublicationPublisherRequestRow,
  SocialPublicationPublisherResultRow,
} from "./social-publication-publisher-rows";
import type {
  SocialPublicationPublisherRequestRecord,
  SocialPublicationPublisherResultRecord,
} from "./social-publication-publisher-repository";
import type {
  PublicationPublisherRequest,
  PublicationPublisherResult,
} from "./social-publication-publisher";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  configureSocialPublicationPublisherStoreTestDependencies(null);
  await fn();
  console.log(`ok - ${name}`);
}

const IDS = {
  request: "10000000-0000-4000-8000-000000000001",
  job: "10000000-0000-4000-8000-000000000002",
  result: "10000000-0000-4000-8000-000000000003",
  requestTwo: "10000000-0000-4000-8000-000000000005",
  socialPost: "50000000-0000-4000-8000-000000000001",
  target: "60000000-0000-4000-8000-000000000001",
  schedule: "20000000-0000-4000-8000-000000000001",
  ledgerEntry: "30000000-0000-4000-8000-000000000001",
  attempt: "30000000-0000-4000-8000-000000000002",
  ownerApproval: "70000000-0000-4000-8000-000000000001",
  approval: "70000000-0000-4000-8000-000000000002",
  proposal: "70000000-0000-4000-8000-000000000003",
} as const;

function request(
  input: Partial<PublicationPublisherRequest> = {},
): PublicationPublisherRequest {
  return {
    requestId: IDS.request,
    job: {
      jobId: IDS.job,
      jobType: "model_publication_job",
      references: {
        socialPostId: IDS.socialPost,
        publicationTargetId: IDS.target,
        publicationManifestId: "manifest-2026-06-30-a",
        ownerApprovalId: IDS.ownerApproval,
        approvalId: IDS.approval,
        proposalId: IDS.proposal,
        scheduleId: IDS.schedule,
        ledgerEntryId: IDS.ledgerEntry,
        publicationAttemptId: IDS.attempt,
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
      publicationTargetId: IDS.target,
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
      ownerApprovalId: IDS.ownerApproval,
      approvalId: IDS.approval,
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
    resultId: IDS.result,
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
    evidenceSummary: null,
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

function assertMapperOk<T>(
  mapped: { ok: true; value: T } | { ok: false; errors: readonly unknown[] },
): T {
  assert.equal(mapped.ok, true, JSON.stringify(mapped.ok ? [] : mapped.errors));
  return mapped.value;
}

function requestRecord(
  input: Partial<PublicationPublisherRequest> = {},
): SocialPublicationPublisherRequestRecord {
  return assertMapperOk(mapPublicationPublisherRequestToRequestRecord(request(input)));
}

function resultRecord(
  input: Partial<PublicationPublisherResult> = {},
): SocialPublicationPublisherResultRecord {
  return assertMapperOk(mapPublicationPublisherResultToResultRecord(result(input)));
}

function assertOk<T>(storeResult: SocialPublicationPublisherStoreResult<T>): T {
  assert.equal(storeResult.ok, true, JSON.stringify(storeResult.ok ? [] : storeResult.error));
  return storeResult.value;
}

function assertStoreError(
  storeResult: SocialPublicationPublisherStoreResult<unknown>,
  code: string,
): void {
  assert.equal(storeResult.ok, false);
  if (!storeResult.ok) assert.equal(storeResult.error.code, code);
}

class MemoryPublisherStorage implements SocialPublicationPublisherStoreStorage {
  requests: SocialPublicationPublisherRequestRow[] = [];
  results: SocialPublicationPublisherResultRow[] = [];
  evidence: SocialPublicationPublisherEvidenceRow[] = [];
  throwOnInsert = false;

  async insertRequest(
    row: SocialPublicationPublisherRequestRow,
  ): Promise<SocialPublicationPublisherRequestRow> {
    if (this.throwOnInsert) throw new Error("write failed");
    this.requests.push(clone(row));
    return clone(row);
  }

  async insertResult(
    row: SocialPublicationPublisherResultRow,
  ): Promise<SocialPublicationPublisherResultRow> {
    if (this.throwOnInsert) throw new Error("write failed");
    this.results.push(clone(row));
    return clone(row);
  }

  async insertEvidence(
    row: SocialPublicationPublisherEvidenceRow,
  ): Promise<SocialPublicationPublisherEvidenceRow> {
    if (this.throwOnInsert) throw new Error("write failed");
    this.evidence.push(clone(row));
    return clone(row);
  }

  async findRequestByRequestId(
    publisherRequestId: string,
  ): Promise<SocialPublicationPublisherRequestRow | null> {
    return findOne(this.requests, "publisher_request_id", publisherRequestId);
  }

  async findRequestByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationPublisherRequestRow | null> {
    return findOne(this.requests, "idempotency_key", idempotencyKey);
  }

  async findResultByResultId(
    publisherResultId: string,
  ): Promise<SocialPublicationPublisherResultRow | null> {
    return findOne(this.results, "publisher_result_id", publisherResultId);
  }

  async findResultByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationPublisherResultRow | null> {
    return findOne(this.results, "idempotency_key", idempotencyKey);
  }

  async findEvidenceByEvidenceId(
    evidenceId: string,
  ): Promise<SocialPublicationPublisherEvidenceRow | null> {
    return findOne(this.evidence, "evidence_id", evidenceId);
  }

  async findEvidenceByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationPublisherEvidenceRow | null> {
    return findOne(this.evidence, "idempotency_key", idempotencyKey);
  }

  async fetchRequests(
    filter: SocialPublicationPublisherReadFilter = {},
  ): Promise<SocialPublicationPublisherRequestRow[]> {
    return this.requests
      .filter((row) => matchesRequestFilter(row, filter))
      .map(clone);
  }

  async fetchResults(
    filter: SocialPublicationPublisherReadFilter = {},
  ): Promise<SocialPublicationPublisherResultRow[]> {
    return this.results
      .filter((row) => matchesResultFilter(row, filter))
      .map(clone);
  }

  async fetchEvidence(
    filter: SocialPublicationPublisherReadFilter = {},
  ): Promise<SocialPublicationPublisherEvidenceRow[]> {
    return this.evidence.filter((row) => matchesEvidenceFilter(row, filter)).map(clone);
  }
}

await test("create writes a request and append writes its result", async () => {
  const storage = new MemoryPublisherStorage();
  configureSocialPublicationPublisherStoreTestDependencies(storage);

  const created = assertOk(await createSocialPublicationPublisherRequest(requestRecord()));
  assert.equal(created.publisher_request_id, IDS.request);
  assert.equal(storage.requests.length, 1);

  const appended = assertOk(
    await appendSocialPublicationPublisherResult(resultRecord()),
  );
  assert.equal(appended.publisher_request_id, IDS.request);
  assert.equal(storage.results.length, 1);

  const fetched = assertOk(
    await fetchSocialPublicationPublisherRequestRecordByRequestId(IDS.request),
  );
  assert.equal(fetched?.publisher_request_id, IDS.request);
});

await test("create rejects a duplicate request identity", async () => {
  const storage = new MemoryPublisherStorage();
  configureSocialPublicationPublisherStoreTestDependencies(storage);

  assertOk(await createSocialPublicationPublisherRequest(requestRecord()));
  assertStoreError(
    await createSocialPublicationPublisherRequest(requestRecord()),
    "duplicate_identity",
  );
});

await test("append rejects a missing parent request", async () => {
  const storage = new MemoryPublisherStorage();
  configureSocialPublicationPublisherStoreTestDependencies(storage);

  assertStoreError(
    await appendSocialPublicationPublisherResult(resultRecord()),
    "parent_missing",
  );
});

await test("append rejects a result scope that drifts from its parent request", async () => {
  const storage = new MemoryPublisherStorage();
  configureSocialPublicationPublisherStoreTestDependencies(storage);

  assertOk(await createSocialPublicationPublisherRequest(requestRecord()));

  const driftedResult = resultRecord();
  const tampered: SocialPublicationPublisherResultRecord = {
    ...driftedResult,
    scope: {
      ...driftedResult.scope,
      publication_manifest_id: "manifest-drifted",
    } as SocialPublicationPublisherResultRecord["scope"],
  };

  assertStoreError(
    await appendSocialPublicationPublisherResult(tampered),
    "scope_mismatch",
  );
});

await test("duplicate idempotency keys are rejected before write", async () => {
  const storage = new MemoryPublisherStorage();
  configureSocialPublicationPublisherStoreTestDependencies(storage);

  assertOk(
    await createSocialPublicationPublisherRequest(requestRecord(), {
      idempotencyKey: "publisher-request-key-1",
    }),
  );
  assertStoreError(
    await createSocialPublicationPublisherRequest(
      requestRecord({ requestId: IDS.requestTwo }),
      { idempotencyKey: "publisher-request-key-1" },
    ),
    "duplicate_idempotency_key",
  );
});

await test("invalid records are rejected before storage access", async () => {
  const storage = new MemoryPublisherStorage();
  configureSocialPublicationPublisherStoreTestDependencies(storage);

  assertStoreError(
    await createSocialPublicationPublisherRequest({
      ...requestRecord(),
      executes_nothing: false,
    } as never),
    "validation_failed",
  );
  assert.equal(storage.requests.length, 0);
});

await test("mapped request and result inserts persist evidence alongside their parent", async () => {
  const storage = new MemoryPublisherStorage();
  configureSocialPublicationPublisherStoreTestDependencies(storage);

  const mappedRequest = assertMapperOk(
    mapPublicationPublisherRequestToPersistenceMapping(request()),
  );
  const requestInsert = assertOk(
    await insertSocialPublicationPublisherMappedRequest(mappedRequest),
  );
  assert.equal(requestInsert.request.publisher_request_id, IDS.request);
  assert.equal(requestInsert.evidence?.evidence_kind, "authority_check");
  assert.equal(storage.evidence.length, 1);

  const mappedResult = assertMapperOk(
    mapPublicationPublisherResultToPersistenceMapping(
      result({
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
      }),
    ),
  );
  const resultInsert = assertOk(
    await insertSocialPublicationPublisherMappedResult(mappedResult),
  );
  assert.equal(resultInsert.result.publisher_result_id, IDS.result);
  assert.equal(resultInsert.evidence?.evidence_kind, "result_contract");
  assert.equal(storage.evidence.length, 2);
});

await test("evidence requires a matching parent request and result", async () => {
  const storage = new MemoryPublisherStorage();
  configureSocialPublicationPublisherStoreTestDependencies(storage);

  const mappedRequest = assertMapperOk(
    mapPublicationPublisherRequestToPersistenceMapping(request()),
  );
  const evidence = mappedRequest.evidence;
  assert.ok(evidence);
  if (!evidence) return;

  assertStoreError(
    await insertSocialPublicationPublisherEvidence(evidence),
    "parent_missing",
  );

  assertOk(await createSocialPublicationPublisherRequest(requestRecord()));
  const tamperedEvidence = {
    ...evidence,
    scope: {
      ...evidence.scope,
      publication_manifest_id: "manifest-drifted",
    } as typeof evidence.scope,
  };
  assertStoreError(
    await insertSocialPublicationPublisherEvidence(tamperedEvidence),
    "scope_mismatch",
  );
});

await test("read filters and fetch-by helpers return persisted records", async () => {
  const storage = new MemoryPublisherStorage();
  configureSocialPublicationPublisherStoreTestDependencies(storage);

  assertOk(await createSocialPublicationPublisherRequest(requestRecord()));
  assertOk(await appendSocialPublicationPublisherResult(resultRecord()));

  const rows = assertOk(await fetchSocialPublicationPublisherRowsByJob(IDS.job));
  assert.equal(rows.requests.length, 1);
  assert.equal(rows.results.length, 1);

  assert.equal(
    assertOk(await fetchSocialPublicationPublisherRecordsByPost(IDS.socialPost)).requests
      .length,
    1,
  );
  assert.equal(
    assertOk(
      await fetchSocialPublicationPublisherRecordsByPublicationTarget(IDS.target),
    ).requests.length,
    1,
  );
  assert.equal(
    assertOk(
      await fetchSocialPublicationPublisherRecordsByManifest("manifest-2026-06-30-a"),
    ).requests.length,
    1,
  );
  assert.equal(
    assertOk(await fetchSocialPublicationPublisherRecordsByJob(IDS.job)).results.length,
    1,
  );

  const unfiltered = assertOk(await fetchSocialPublicationPublisherRows());
  assert.equal(unfiltered.requests.length, 1);
});

await test("safe config detection reflects Supabase service credentials", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal(isSocialPublicationPublisherStoreConfigured(), false);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    assert.equal(isSocialPublicationPublisherStoreConfigured(), true);
  } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

await test("service-role storage and failure handling are explicit", async () => {
  const storage = new MemoryPublisherStorage();
  storage.throwOnInsert = true;
  configureSocialPublicationPublisherStoreTestDependencies(storage);

  assertStoreError(
    await createSocialPublicationPublisherRequest(requestRecord()),
    "storage_error",
  );

  const sourcePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "social-publication-publisher-store.ts",
  );
  const source = readFileSync(sourcePath, "utf8");

  assert.equal(source.includes("createServiceRoleClient"), true);
  assert.equal(source.includes(".update("), false);
  assert.equal(source.includes(".delete("), false);
  assert.equal(source.includes("publishPost("), false);
  assert.equal(source.includes("executePublication("), false);
});

await test("module exports no execution publish bridge admin or route behavior", () => {
  const exportedNames = Object.keys(storeExports).sort();
  const forbidden = [
    "publishSocialPost",
    "executePublication",
    "recordPublicationMetrics",
    "learnFromPublication",
    "createSocialPublicationPublisherBridge",
    "renderPublicationPublisherAdmin",
    "createPublicationPublisherRoute",
  ];

  for (const name of forbidden) {
    assert.equal(exportedNames.includes(name), false, name);
  }
});

await test("store source has no route worker cron bridge or UI implementation", () => {
  const sourcePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "social-publication-publisher-store.ts",
  );
  const source = readFileSync(sourcePath, "utf8");
  const forbiddenSnippets = [
    "next/",
    "react",
    "app/api",
    "NextRequest",
    "NextResponse",
    "cron",
    "new Worker",
    "bridge",
    "setInterval(",
    "setTimeout(",
    "facebook.com",
    "instagram.com",
    "graph.facebook",
  ];

  for (const snippet of forbiddenSnippets) {
    assert.equal(source.includes(snippet), false, snippet);
  }
});

function matchesRequestFilter(
  row: SocialPublicationPublisherRequestRow,
  filter: SocialPublicationPublisherReadFilter,
): boolean {
  return (
    (!filter.publisherJobId || row.publisher_job_id === filter.publisherJobId) &&
    (!filter.socialPostId || row.social_post_id === filter.socialPostId) &&
    (!filter.publicationTargetId || row.publication_target_id === filter.publicationTargetId) &&
    (!filter.publicationManifestId ||
      row.publication_manifest_id === filter.publicationManifestId)
  );
}

function matchesResultFilter(
  row: SocialPublicationPublisherResultRow,
  filter: SocialPublicationPublisherReadFilter,
): boolean {
  return (
    (!filter.publisherJobId || row.publisher_job_id === filter.publisherJobId) &&
    (!filter.socialPostId || row.social_post_id === filter.socialPostId) &&
    (!filter.publicationTargetId || row.publication_target_id === filter.publicationTargetId) &&
    (!filter.publicationManifestId ||
      row.publication_manifest_id === filter.publicationManifestId)
  );
}

function matchesEvidenceFilter(
  row: SocialPublicationPublisherEvidenceRow,
  filter: SocialPublicationPublisherReadFilter,
): boolean {
  return (
    (!filter.socialPostId || row.social_post_id === filter.socialPostId) &&
    (!filter.publicationTargetId || row.publication_target_id === filter.publicationTargetId) &&
    (!filter.publicationManifestId ||
      row.publication_manifest_id === filter.publicationManifestId)
  );
}

function findOne<TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  key: keyof TRow,
  value: string,
): TRow | null {
  return clone(rows.find((row) => row[key] === value) ?? null);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
