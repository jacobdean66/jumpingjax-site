import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  appendSocialPublicationExecutionResult,
  configureSocialPublicationExecutionStoreTestDependencies,
  createSocialPublicationExecutionIntent,
  fetchSocialPublicationExecutionIntentRecordByIntentId,
  fetchSocialPublicationExecutionRecordsByJob,
  fetchSocialPublicationExecutionRecordsByManifest,
  fetchSocialPublicationExecutionRecordsByPost,
  fetchSocialPublicationExecutionRecordsByPublicationTarget,
  fetchSocialPublicationExecutionRows,
  fetchSocialPublicationExecutionRowsByJob,
  insertSocialPublicationExecutionEvidence,
  insertSocialPublicationExecutionMappedIntent,
  insertSocialPublicationExecutionMappedResult,
  isSocialPublicationExecutionStoreConfigured,
  type SocialPublicationExecutionReadFilter,
  type SocialPublicationExecutionStoreResult,
  type SocialPublicationExecutionStoreStorage,
} from "./social-publication-execution-store";
import * as storeExports from "./social-publication-execution-store";
import {
  mapPublicationExecutionIntentToIntentRecord,
  mapPublicationExecutionIntentToPersistenceMapping,
  mapPublicationExecutionResultToPersistenceMapping,
  mapPublicationExecutionResultToResultRecord,
} from "./social-publication-execution-mapper";
import type {
  SocialPublicationExecutionEvidenceRow,
  SocialPublicationExecutionIntentRow,
  SocialPublicationExecutionResultRow,
} from "./social-publication-execution-rows";
import type {
  SocialPublicationExecutionIntentRecord,
  SocialPublicationExecutionResultRecord,
} from "./social-publication-execution-repository";
import type {
  PublicationExecutionIntent,
  PublicationExecutionResult,
} from "./social-publication-execution";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  configureSocialPublicationExecutionStoreTestDependencies(null);
  await fn();
  console.log(`ok - ${name}`);
}

const IDS = {
  intent: "10000000-0000-4000-8000-000000000001",
  intentTwo: "10000000-0000-4000-8000-000000000005",
  job: "10000000-0000-4000-8000-000000000002",
  result: "10000000-0000-4000-8000-000000000003",
  socialPost: "50000000-0000-4000-8000-000000000001",
  target: "60000000-0000-4000-8000-000000000001",
  publisherRequest: "40000000-0000-4000-8000-000000000001",
  publisherResult: "40000000-0000-4000-8000-000000000002",
  publisherJob: "40000000-0000-4000-8000-000000000003",
  schedule: "20000000-0000-4000-8000-000000000001",
  ledgerEntry: "30000000-0000-4000-8000-000000000001",
  ownerApproval: "70000000-0000-4000-8000-000000000001",
  approval: "70000000-0000-4000-8000-000000000002",
  preflight: "90000000-0000-4000-8000-000000000001",
} as const;

function intent(input: Partial<PublicationExecutionIntent> = {}): PublicationExecutionIntent {
  return {
    intentId: IDS.intent,
    intentType: "prepare_execution_intent",
    job: {
      jobId: IDS.job,
      jobType: "model_execution_job",
      references: {
        socialPostId: IDS.socialPost,
        publicationTargetId: IDS.target,
        publisherRequestId: IDS.publisherRequest,
        publisherResultId: IDS.publisherResult,
        publisherJobId: IDS.publisherJob,
        scheduleId: IDS.schedule,
        ledgerEntryId: IDS.ledgerEntry,
        publicationManifestId: "manifest-2026-07-01-a",
        ownerApprovalId: IDS.ownerApproval,
        approvalId: IDS.approval,
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
      ownerApprovalId: IDS.ownerApproval,
      approvalId: IDS.approval,
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
      preflightId: IDS.preflight,
      jobId: IDS.job,
      status: "passed",
      blockReasons: [],
      evaluatedAt: "2026-07-01T12:00:00.000Z",
      computedOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      mutatesNoLowerLayers: true,
    },
    evidence: {
      evidenceId: "90000000-0000-4000-8000-000000000002",
      evidenceKind: "authority_evidence",
      notes: "owner approval confirmed",
      evidence: { checked: true },
      containsFullPayload: false,
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
    grantsExecutionPermission: false,
    ...input,
  };
}

function result(
  input: Partial<PublicationExecutionResult> = {},
  base: PublicationExecutionIntent = intent(),
): PublicationExecutionResult {
  return {
    resultId: IDS.result,
    intentId: base.intentId,
    job: base.job,
    authority: base.authority,
    resultType: "execution_result_recorded",
    status: "completed",
    blockReasons: [],
    evidence: {
      evidenceId: "90000000-0000-4000-8000-000000000003",
      evidenceKind: "authority_evidence",
      notes: "All authority satisfied at record time.",
      evidence: { completed: true },
      containsFullPayload: false,
      containsSecrets: false,
      provesExecution: false,
    },
    createdAt: "2026-07-01T12:05:00.000Z",
    updatedAt: "2026-07-01T12:05:00.000Z",
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
    currentExecutionStatusAuthority: false,
    grantsExecutionPermission: false,
    ...input,
  };
}

function assertMapperOk<T>(
  mapped: { ok: true; value: T } | { ok: false; errors: readonly unknown[] },
): T {
  assert.equal(mapped.ok, true, JSON.stringify(mapped.ok ? [] : mapped.errors));
  return mapped.value;
}

function intentRecord(
  input: Partial<PublicationExecutionIntent> = {},
): SocialPublicationExecutionIntentRecord {
  return assertMapperOk(mapPublicationExecutionIntentToIntentRecord(intent(input)));
}

function resultRecord(
  input: Partial<PublicationExecutionResult> = {},
): SocialPublicationExecutionResultRecord {
  return assertMapperOk(mapPublicationExecutionResultToResultRecord(result(input)));
}

function assertOk<T>(storeResult: SocialPublicationExecutionStoreResult<T>): T {
  assert.equal(storeResult.ok, true, JSON.stringify(storeResult.ok ? [] : storeResult.error));
  return storeResult.value;
}

function assertStoreError(
  storeResult: SocialPublicationExecutionStoreResult<unknown>,
  code: string,
): void {
  assert.equal(storeResult.ok, false);
  if (!storeResult.ok) assert.equal(storeResult.error.code, code);
}

class MemoryExecutionStorage implements SocialPublicationExecutionStoreStorage {
  intents: SocialPublicationExecutionIntentRow[] = [];
  results: SocialPublicationExecutionResultRow[] = [];
  evidence: SocialPublicationExecutionEvidenceRow[] = [];
  throwOnInsert = false;

  async insertIntent(
    row: SocialPublicationExecutionIntentRow,
  ): Promise<SocialPublicationExecutionIntentRow> {
    if (this.throwOnInsert) throw new Error("write failed");
    this.intents.push(clone(row));
    return clone(row);
  }

  async insertResult(
    row: SocialPublicationExecutionResultRow,
  ): Promise<SocialPublicationExecutionResultRow> {
    if (this.throwOnInsert) throw new Error("write failed");
    this.results.push(clone(row));
    return clone(row);
  }

  async insertEvidence(
    row: SocialPublicationExecutionEvidenceRow,
  ): Promise<SocialPublicationExecutionEvidenceRow> {
    if (this.throwOnInsert) throw new Error("write failed");
    this.evidence.push(clone(row));
    return clone(row);
  }

  async findIntentByIntentId(
    executionIntentId: string,
  ): Promise<SocialPublicationExecutionIntentRow | null> {
    return findOne(this.intents, "execution_intent_id", executionIntentId);
  }

  async findIntentByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationExecutionIntentRow | null> {
    return findOne(this.intents, "idempotency_key", idempotencyKey);
  }

  async findResultByResultId(
    executionResultId: string,
  ): Promise<SocialPublicationExecutionResultRow | null> {
    return findOne(this.results, "execution_result_id", executionResultId);
  }

  async findResultByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationExecutionResultRow | null> {
    return findOne(this.results, "idempotency_key", idempotencyKey);
  }

  async findEvidenceByEvidenceId(
    evidenceId: string,
  ): Promise<SocialPublicationExecutionEvidenceRow | null> {
    return findOne(this.evidence, "evidence_id", evidenceId);
  }

  async findEvidenceByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationExecutionEvidenceRow | null> {
    return findOne(this.evidence, "idempotency_key", idempotencyKey);
  }

  async fetchIntents(
    filter: SocialPublicationExecutionReadFilter = {},
  ): Promise<SocialPublicationExecutionIntentRow[]> {
    return this.intents.filter((row) => matchesIntentFilter(row, filter)).map(clone);
  }

  async fetchResults(
    filter: SocialPublicationExecutionReadFilter = {},
  ): Promise<SocialPublicationExecutionResultRow[]> {
    return this.results.filter((row) => matchesResultFilter(row, filter)).map(clone);
  }

  async fetchEvidence(
    filter: SocialPublicationExecutionReadFilter = {},
  ): Promise<SocialPublicationExecutionEvidenceRow[]> {
    return this.evidence.filter((row) => matchesEvidenceFilter(row, filter)).map(clone);
  }
}

await test("create writes an intent and append writes its result", async () => {
  const storage = new MemoryExecutionStorage();
  configureSocialPublicationExecutionStoreTestDependencies(storage);

  const created = assertOk(await createSocialPublicationExecutionIntent(intentRecord()));
  assert.equal(created.execution_intent_id, IDS.intent);
  assert.equal(storage.intents.length, 1);

  const appended = assertOk(await appendSocialPublicationExecutionResult(resultRecord()));
  assert.equal(appended.execution_intent_id, IDS.intent);
  assert.equal(storage.results.length, 1);

  const fetched = assertOk(
    await fetchSocialPublicationExecutionIntentRecordByIntentId(IDS.intent),
  );
  assert.equal(fetched?.execution_intent_id, IDS.intent);
});

await test("create rejects a duplicate intent identity", async () => {
  const storage = new MemoryExecutionStorage();
  configureSocialPublicationExecutionStoreTestDependencies(storage);

  assertOk(await createSocialPublicationExecutionIntent(intentRecord()));
  assertStoreError(
    await createSocialPublicationExecutionIntent(intentRecord()),
    "duplicate_identity",
  );
});

await test("append rejects a missing parent intent", async () => {
  const storage = new MemoryExecutionStorage();
  configureSocialPublicationExecutionStoreTestDependencies(storage);

  assertStoreError(
    await appendSocialPublicationExecutionResult(resultRecord()),
    "parent_missing",
  );
});

await test("append rejects a result scope that drifts from its parent intent", async () => {
  const storage = new MemoryExecutionStorage();
  configureSocialPublicationExecutionStoreTestDependencies(storage);

  assertOk(await createSocialPublicationExecutionIntent(intentRecord()));

  const driftedResult = resultRecord();
  const tampered: SocialPublicationExecutionResultRecord = {
    ...driftedResult,
    scope: {
      ...driftedResult.scope,
      publication_manifest_id: "manifest-drifted",
    } as SocialPublicationExecutionResultRecord["scope"],
  };

  assertStoreError(
    await appendSocialPublicationExecutionResult(tampered),
    "scope_mismatch",
  );
});

await test("duplicate idempotency keys are rejected before write", async () => {
  const storage = new MemoryExecutionStorage();
  configureSocialPublicationExecutionStoreTestDependencies(storage);

  assertOk(
    await createSocialPublicationExecutionIntent(intentRecord(), {
      idempotencyKey: "execution-intent-key-1",
    }),
  );
  assertStoreError(
    await createSocialPublicationExecutionIntent(
      intentRecord({ intentId: IDS.intentTwo }),
      { idempotencyKey: "execution-intent-key-1" },
    ),
    "duplicate_idempotency_key",
  );
});

await test("invalid records are rejected before storage access", async () => {
  const storage = new MemoryExecutionStorage();
  configureSocialPublicationExecutionStoreTestDependencies(storage);

  assertStoreError(
    await createSocialPublicationExecutionIntent({
      ...intentRecord(),
      executes_nothing: false,
    } as never),
    "validation_failed",
  );
  assert.equal(storage.intents.length, 0);
});

await test("mapped intent and result inserts persist evidence alongside their parent", async () => {
  const storage = new MemoryExecutionStorage();
  configureSocialPublicationExecutionStoreTestDependencies(storage);

  const mappedIntent = assertMapperOk(mapPublicationExecutionIntentToPersistenceMapping(intent()));
  const intentInsert = assertOk(await insertSocialPublicationExecutionMappedIntent(mappedIntent));
  assert.equal(intentInsert.intent.execution_intent_id, IDS.intent);
  assert.equal(intentInsert.evidence?.evidence_kind, "authority_evidence");
  assert.equal(storage.evidence.length, 1);

  const mappedResult = assertMapperOk(mapPublicationExecutionResultToPersistenceMapping(result()));
  const resultInsert = assertOk(await insertSocialPublicationExecutionMappedResult(mappedResult));
  assert.equal(resultInsert.result.execution_result_id, IDS.result);
  assert.equal(resultInsert.evidence?.evidence_kind, "authority_evidence");
  assert.equal(storage.evidence.length, 2);
});

await test("evidence requires a matching parent intent and result", async () => {
  const storage = new MemoryExecutionStorage();
  configureSocialPublicationExecutionStoreTestDependencies(storage);

  const mappedIntent = assertMapperOk(mapPublicationExecutionIntentToPersistenceMapping(intent()));
  const evidence = mappedIntent.evidence;
  assert.ok(evidence);
  if (!evidence) return;

  assertStoreError(
    await insertSocialPublicationExecutionEvidence(evidence),
    "parent_missing",
  );

  assertOk(await createSocialPublicationExecutionIntent(intentRecord()));
  const tamperedEvidence = {
    ...evidence,
    scope: {
      ...evidence.scope,
      publication_manifest_id: "manifest-drifted",
    } as typeof evidence.scope,
  };
  assertStoreError(
    await insertSocialPublicationExecutionEvidence(tamperedEvidence),
    "scope_mismatch",
  );
});

await test("read filters and fetch-by helpers return persisted records", async () => {
  const storage = new MemoryExecutionStorage();
  configureSocialPublicationExecutionStoreTestDependencies(storage);

  assertOk(await createSocialPublicationExecutionIntent(intentRecord()));
  assertOk(await appendSocialPublicationExecutionResult(resultRecord()));

  const rows = assertOk(await fetchSocialPublicationExecutionRowsByJob(IDS.job));
  assert.equal(rows.intents.length, 1);
  assert.equal(rows.results.length, 1);

  assert.equal(
    assertOk(await fetchSocialPublicationExecutionRecordsByPost(IDS.socialPost)).intents.length,
    1,
  );
  assert.equal(
    assertOk(await fetchSocialPublicationExecutionRecordsByPublicationTarget(IDS.target)).intents
      .length,
    1,
  );
  assert.equal(
    assertOk(
      await fetchSocialPublicationExecutionRecordsByManifest("manifest-2026-07-01-a"),
    ).intents.length,
    1,
  );
  assert.equal(
    assertOk(await fetchSocialPublicationExecutionRecordsByJob(IDS.job)).results.length,
    1,
  );

  const unfiltered = assertOk(await fetchSocialPublicationExecutionRows());
  assert.equal(unfiltered.intents.length, 1);
});

await test("safe config detection reflects Supabase service credentials", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal(isSocialPublicationExecutionStoreConfigured(), false);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    assert.equal(isSocialPublicationExecutionStoreConfigured(), true);
  } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

await test("service-role storage and failure handling are explicit", async () => {
  const storage = new MemoryExecutionStorage();
  storage.throwOnInsert = true;
  configureSocialPublicationExecutionStoreTestDependencies(storage);

  assertStoreError(
    await createSocialPublicationExecutionIntent(intentRecord()),
    "storage_error",
  );

  const sourcePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "social-publication-execution-store.ts",
  );
  const source = readFileSync(sourcePath, "utf8");

  assert.equal(source.includes("createServiceRoleClient"), true);
  assert.equal(source.includes(".update("), false);
  assert.equal(source.includes(".delete("), false);
  assert.equal(source.includes("executePublication("), false);
  assert.equal(source.includes("runExecution("), false);
});

await test("module exports no execution publish bridge admin or route behavior", () => {
  const exportedNames = Object.keys(storeExports).sort();
  const forbidden = [
    "executePublicationIntent",
    "runExecutionJob",
    "publishSocialPost",
    "createSocialPublicationExecutionBridge",
    "renderPublicationExecutionAdmin",
    "createPublicationExecutionRoute",
  ];

  for (const name of forbidden) {
    assert.equal(exportedNames.includes(name), false, name);
  }
});

await test("store source has no route worker cron bridge or UI implementation", () => {
  const sourcePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "social-publication-execution-store.ts",
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

function matchesIntentFilter(
  row: SocialPublicationExecutionIntentRow,
  filter: SocialPublicationExecutionReadFilter,
): boolean {
  return (
    (!filter.executionJobId || row.execution_job_id === filter.executionJobId) &&
    (!filter.socialPostId || row.social_post_id === filter.socialPostId) &&
    (!filter.publicationTargetId || row.publication_target_id === filter.publicationTargetId) &&
    (!filter.publicationManifestId ||
      row.publication_manifest_id === filter.publicationManifestId) &&
    (!filter.publisherRequestId || row.publisher_request_id === filter.publisherRequestId) &&
    (!filter.scheduleId || row.schedule_id === filter.scheduleId)
  );
}

function matchesResultFilter(
  row: SocialPublicationExecutionResultRow,
  filter: SocialPublicationExecutionReadFilter,
): boolean {
  return (
    (!filter.executionJobId || row.execution_job_id === filter.executionJobId) &&
    (!filter.socialPostId || row.social_post_id === filter.socialPostId) &&
    (!filter.publicationTargetId || row.publication_target_id === filter.publicationTargetId) &&
    (!filter.publicationManifestId ||
      row.publication_manifest_id === filter.publicationManifestId) &&
    (!filter.publisherRequestId || row.publisher_request_id === filter.publisherRequestId) &&
    (!filter.scheduleId || row.schedule_id === filter.scheduleId)
  );
}

function matchesEvidenceFilter(
  row: SocialPublicationExecutionEvidenceRow,
  filter: SocialPublicationExecutionReadFilter,
): boolean {
  return (
    (!filter.socialPostId || row.social_post_id === filter.socialPostId) &&
    (!filter.publicationTargetId || row.publication_target_id === filter.publicationTargetId) &&
    (!filter.publicationManifestId ||
      row.publication_manifest_id === filter.publicationManifestId) &&
    (!filter.publisherRequestId || row.publisher_request_id === filter.publisherRequestId) &&
    (!filter.scheduleId || row.schedule_id === filter.scheduleId)
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
