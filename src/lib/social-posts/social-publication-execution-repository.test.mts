import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createReferenceSocialPublicationExecutionRepository,
  hydrateSocialPublicationExecutionPersistenceModel,
  mapIntentRecordToPublicationExecutionIntent,
  mapPublicationExecutionIntentToIntentRecord,
  mapPublicationExecutionResultToResultRecord,
  mapResultRecordToPublicationExecutionResult,
  serializeSocialPublicationExecutionPersistenceModel,
  validateSocialPublicationExecutionAppendResultRequest,
  validateSocialPublicationExecutionCreateIntentRequest,
  validateSocialPublicationExecutionPersistenceModel,
  validateSocialPublicationExecutionRepositoryIdentity,
  validateSocialPublicationExecutionIntentRecord,
  validateSocialPublicationExecutionResultRecord,
  type PublicationExecutionIntent,
  type PublicationExecutionResult,
  type SocialPublicationExecutionRecordValidationResult,
} from "./social-publication-execution-repository";
import * as repositoryExports from "./social-publication-execution-repository";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function intent(input: Partial<PublicationExecutionIntent> = {}): PublicationExecutionIntent {
  return {
    intentId: "execution-intent-1",
    intentType: "prepare_execution_intent",
    job: {
      jobId: "execution-job-1",
      jobType: "model_execution_job",
      references: {
        socialPostId: "social-post-1",
        publicationTargetId: "target-1",
        publisherRequestId: "publisher-request-1",
        publisherResultId: "publisher-result-1",
        publisherJobId: "publisher-job-1",
        scheduleId: "schedule-1",
        ledgerEntryId: "ledger-entry-1",
        publicationManifestId: "manifest-1",
        ownerApprovalId: "owner-approval-1",
        approvalId: "approval-1",
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
      ownerApprovalId: "owner-approval-1",
      approvalId: "approval-1",
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
      preflightId: "execution-preflight-1",
      jobId: "execution-job-1",
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

function result(input: Partial<PublicationExecutionResult> = {}): PublicationExecutionResult {
  const baseIntent = intent();

  return {
    resultId: "execution-result-1",
    intentId: baseIntent.intentId,
    job: baseIntent.job,
    authority: baseIntent.authority,
    resultType: "execution_result_recorded",
    status: "completed",
    blockReasons: [],
    evidence: {
      evidenceId: "execution-evidence-1",
      evidenceKind: "authority_evidence",
      notes: "All authority satisfied at record time.",
      evidence: {},
      containsFullPayload: false,
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
    currentExecutionStatusAuthority: false,
    grantsExecutionPermission: false,
    ...input,
  };
}

function codes(result: SocialPublicationExecutionRecordValidationResult): readonly string[] {
  return result.ok ? [] : result.errors.map((error) => error.code);
}

function assertOk<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) {
    assert.fail(JSON.stringify(result.error));
  }
  return result.value;
}

await test("domain intent and result map to reference-only records", () => {
  const intentRecord = assertOk(mapPublicationExecutionIntentToIntentRecord(intent()));
  const resultRecord = assertOk(mapPublicationExecutionResultToResultRecord(result()));

  assert.equal(intentRecord.execution_intent_id, "execution-intent-1");
  assert.equal(intentRecord.scope.social_post_id, "social-post-1");
  assert.equal(intentRecord.references_only, true);
  assert.equal(intentRecord.executes_nothing, true);
  assert.equal(resultRecord.execution_result_id, "execution-result-1");
  assert.equal(resultRecord.current_execution_status_authority, false);
});

await test("records hydrate back into safe domain shapes", () => {
  const intentRecord = assertOk(mapPublicationExecutionIntentToIntentRecord(intent()));
  const resultRecord = assertOk(mapPublicationExecutionResultToResultRecord(result()));
  const hydratedIntent = assertOk(mapIntentRecordToPublicationExecutionIntent(intentRecord));
  const hydratedResult = assertOk(mapResultRecordToPublicationExecutionResult(resultRecord));

  assert.equal(hydratedIntent.intentId, "execution-intent-1");
  assert.equal(hydratedIntent.preflight?.status, "passed");
  assert.equal(hydratedResult.resultId, "execution-result-1");
  assert.equal(hydratedResult.status, "completed");
});

await test("create and append request validators accept records", () => {
  const intentRecord = assertOk(mapPublicationExecutionIntentToIntentRecord(intent()));
  const resultRecord = assertOk(mapPublicationExecutionResultToResultRecord(result()));

  assert.equal(validateSocialPublicationExecutionCreateIntentRequest({ intent: intentRecord }).ok, true);
  assert.equal(validateSocialPublicationExecutionAppendResultRequest({ result: resultRecord }).ok, true);
});

await test("repository identity requires a non-empty field", () => {
  assert.equal(validateSocialPublicationExecutionRepositoryIdentity({}).ok, false);
  assert.equal(
    validateSocialPublicationExecutionRepositoryIdentity({ execution_job_id: "execution-job-1" }).ok,
    true,
  );
});

await test("model validates relationships and identity uniqueness", () => {
  const intentRecord = assertOk(mapPublicationExecutionIntentToIntentRecord(intent()));
  const resultRecord = assertOk(mapPublicationExecutionResultToResultRecord(result()));

  assert.equal(
    validateSocialPublicationExecutionPersistenceModel({
      intents: [intentRecord],
      results: [resultRecord],
    }).ok,
    true,
  );

  const duplicate = validateSocialPublicationExecutionPersistenceModel({
    intents: [intentRecord, intentRecord],
    results: [],
  });
  assert.equal(codes(duplicate).includes("identity_not_separated"), true);

  const orphan = validateSocialPublicationExecutionPersistenceModel({
    intents: [],
    results: [resultRecord],
  });
  assert.equal(codes(orphan).includes("relationship_invalid"), true);
});

await test("result scope must match intent scope", () => {
  const intentRecord = assertOk(mapPublicationExecutionIntentToIntentRecord(intent()));
  const resultRecord = {
    ...assertOk(mapPublicationExecutionResultToResultRecord(result())),
    scope: {
      ...intentRecord.scope,
      publication_target_id: "target-2",
    },
  };

  const validation = validateSocialPublicationExecutionPersistenceModel({
    intents: [intentRecord],
    results: [resultRecord],
  });

  assert.equal(codes(validation).includes("relationship_invalid"), true);
});

await test("contract invariant drift is rejected", () => {
  const record = {
    ...assertOk(mapPublicationExecutionIntentToIntentRecord(intent())),
    calls_no_external_apis: false,
  };

  assert.deepEqual(codes(validateSocialPublicationExecutionIntentRecord(record)), [
    "contract_invariant_failed",
  ]);
});

await test("invalid preflight status and timestamp are rejected", () => {
  const record = {
    ...assertOk(mapPublicationExecutionIntentToIntentRecord(intent())),
    preflight_status: "unknown-status",
    requested_at: "not-a-date",
  };
  const validation = validateSocialPublicationExecutionIntentRecord(record);

  assert.equal(codes(validation).includes("preflight_status_invalid"), true);
  assert.equal(codes(validation).includes("timestamp_invalid"), true);
});

await test("unknown block reasons on result records are rejected", () => {
  const record = {
    ...assertOk(mapPublicationExecutionResultToResultRecord(result({ status: "blocked", blockReasons: ["missing_owner_approval"] }))),
    block_reasons: ["not_a_real_reason"],
  };
  const validation = validateSocialPublicationExecutionResultRecord(record);

  assert.equal(codes(validation).includes("block_reason_invalid"), true);
});

await test("lower-layer payloads, execution, metrics, and learning are forbidden", () => {
  const record = {
    ...assertOk(mapPublicationExecutionResultToResultRecord(result())),
    diagnostics: {
      publicationManifest: { copied: true },
      executionPlan: { step: "call-network" },
      metrics: { reach: 1 },
      learning: { note: "train" },
      accessToken: "secret",
    },
  };
  const validation = validateSocialPublicationExecutionResultRecord(record);

  assert.equal(codes(validation).includes("lower_layer_payload_forbidden"), true);
  assert.equal(codes(validation).includes("execution_forbidden"), true);
  assert.equal(codes(validation).includes("metrics_state_forbidden"), true);
  assert.equal(codes(validation).includes("learning_state_forbidden"), true);
  assert.equal(codes(validation).includes("secret_forbidden"), true);
});

await test("lower-layer mutation and publisher/scheduler execution are forbidden", () => {
  const record = {
    ...assertOk(mapPublicationExecutionResultToResultRecord(result())),
    diagnostics: {
      writeLedger: true,
      runScheduler: true,
      runPublisher: true,
    },
  };
  const validation = validateSocialPublicationExecutionResultRecord(record);

  assert.equal(codes(validation).includes("lower_layer_mutation_forbidden"), true);
  assert.equal(codes(validation).includes("scheduler_execution_forbidden"), true);
  assert.equal(codes(validation).includes("publisher_execution_forbidden"), true);
});

await test("serialization and hydration are deterministic and immutable", () => {
  const intentOne = assertOk(mapPublicationExecutionIntentToIntentRecord(intent()));
  const intentTwo = assertOk(
    mapPublicationExecutionIntentToIntentRecord(
      intent({
        intentId: "execution-intent-2",
        job: { ...intent().job, jobId: "execution-job-2" },
        preflight: { ...intent().preflight!, jobId: "execution-job-2" },
        createdAt: "2026-07-01T12:02:00.000Z",
      }),
    ),
  );
  const serialized = serializeSocialPublicationExecutionPersistenceModel({
    intents: [intentTwo, intentOne],
    results: [],
  });
  const hydrated = assertOk(hydrateSocialPublicationExecutionPersistenceModel(serialized));

  assert.equal(serializeSocialPublicationExecutionPersistenceModel(hydrated), serialized);
  assert.deepEqual(
    hydrated.intents.map((item) => item.execution_intent_id),
    ["execution-intent-1", "execution-intent-2"],
  );
  assert.equal(Object.isFrozen(hydrated), true);
  assert.equal(Object.isFrozen(hydrated.intents[0]), true);
});

await test("in-memory reference repository creates, appends, lists, and snapshots", () => {
  const repository = createReferenceSocialPublicationExecutionRepository();
  const intentRecord = assertOk(mapPublicationExecutionIntentToIntentRecord(intent()));
  const resultRecord = assertOk(mapPublicationExecutionResultToResultRecord(result()));

  assertOk(repository.createExecutionIntent({ intent: intentRecord }));
  assertOk(repository.appendExecutionResult({ result: resultRecord }));

  const duplicate = repository.createExecutionIntent({ intent: intentRecord });
  assert.equal(duplicate.ok, false);

  const listed = assertOk(repository.listExecutionIntents({ execution_job_id: "execution-job-1" }));
  assert.equal(listed.length, 1);

  const scoped = assertOk(repository.getExecutionRecordsByIdentity({ social_post_id: "social-post-1" }));
  assert.equal(scoped.intents.length, 1);
  assert.equal(scoped.results.length, 1);

  const snapshot = assertOk(repository.snapshot());
  assert.equal(snapshot.intents.length, 1);
  assert.equal(snapshot.results.length, 1);
});

await test("module exports no store factory bridge execution publisher scheduler or API behavior", () => {
  const forbidden = [
    "createSocialPublicationExecutionStore",
    "createServiceRoleClient",
    "executePublication",
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
      "social-publication-execution-repository.ts",
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
