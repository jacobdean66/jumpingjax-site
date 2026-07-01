import assert from "node:assert/strict";

import {
  createSocialPublicationExecutionBridge,
  resolveSocialPublicationExecutionBridgeMode,
  validateSocialPublicationExecutionBridgeModel,
  type SocialPublicationExecutionBridge,
} from "./social-publication-execution-bridge";
import {
  mapPublicationExecutionIntentToIntentRecord,
  mapPublicationExecutionResultToResultRecord,
  type PublicationExecutionIntent,
  type PublicationExecutionResult,
  type SocialPublicationExecutionPersistenceModel,
} from "./social-publication-execution-repository";

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

function assertOk<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) assert.fail(JSON.stringify(result.error));
  return result.value;
}

function model(): SocialPublicationExecutionPersistenceModel {
  return {
    intents: [assertOk(mapPublicationExecutionIntentToIntentRecord(intent()))],
    results: [assertOk(mapPublicationExecutionResultToResultRecord(result()))],
  };
}

await test("environment mode resolves to reference outside production", () => {
  const resolved = assertOk(
    resolveSocialPublicationExecutionBridgeMode({
      mode: "environment",
      runtimeEnvironment: "development",
    }),
  );

  assert.equal(resolved.mode, "reference");
});

await test("reference mode is rejected in production", () => {
  const result = createSocialPublicationExecutionBridge({
    mode: "reference",
    runtimeEnvironment: "production",
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "unsafe_reference_in_production");
});

await test("production mode fails closed when storage is unavailable", () => {
  const result = createSocialPublicationExecutionBridge({
    mode: "production",
    runtimeEnvironment: "production",
    productionStoreConfigured: false,
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "production_unavailable");
});

await test("reference bridge lists seeded execution records without execution authority", async () => {
  const bridge = assertOk(
    createSocialPublicationExecutionBridge({
      mode: "reference",
      runtimeEnvironment: "test",
      seed: model(),
    }),
  );

  const snapshot = assertOk(await bridge.snapshot());
  const records = assertOk(await bridge.listExecutionRecords({ social_post_id: "social-post-1" }));

  assert.equal(bridge.mode, "reference");
  assert.equal(bridge.createsNoExecution, true);
  assert.equal(snapshot.intents.length, 1);
  assert.equal(records.results.length, 1);
  assert.equal(records.results[0]?.grants_execution_permission, false);
});

await test("reference bridge creates intents and appends results as records only", async () => {
  const bridge = assertOk(
    createSocialPublicationExecutionBridge({
      mode: "reference",
      runtimeEnvironment: "test",
    }),
  );
  const intentRecord = assertOk(mapPublicationExecutionIntentToIntentRecord(intent()));
  const resultRecord = assertOk(mapPublicationExecutionResultToResultRecord(result()));

  assertOk(await bridge.createExecutionIntent(intentRecord));
  assertOk(await bridge.appendExecutionResult(resultRecord));

  const records = assertOk(await bridge.listExecutionRecords());
  assert.equal(records.intents.length, 1);
  assert.equal(records.results.length, 1);
});

await test("production bridge supports injected test implementation without storage access", async () => {
  const seeded = model();
  const implementation: SocialPublicationExecutionBridge = {
    mode: "production",
    createsNoExecution: true,
    createExecutionIntent: async (record) => ({ ok: true, value: record }),
    appendExecutionResult: async (record) => ({ ok: true, value: record }),
    listExecutionRecords: async () => ({ ok: true, value: seeded }),
    listExecutionIntents: async () => ({ ok: true, value: seeded.intents }),
    listExecutionResults: async () => ({ ok: true, value: seeded.results }),
    loadByIdentity: async () => ({ ok: true, value: seeded }),
    snapshot: async () => ({ ok: true, value: seeded }),
  };

  const bridge = assertOk(
    createSocialPublicationExecutionBridge({
      mode: "production",
      runtimeEnvironment: "production",
      productionStoreConfigured: true,
      implementation,
    }),
  );
  const records = assertOk(await bridge.listExecutionRecords());

  assert.equal(bridge.mode, "production");
  assert.equal(records.intents.length, 1);
});

await test("bridge model validation rejects malformed persistence", () => {
  const result = validateSocialPublicationExecutionBridgeModel({ intents: [] });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "validation_failed");
});
