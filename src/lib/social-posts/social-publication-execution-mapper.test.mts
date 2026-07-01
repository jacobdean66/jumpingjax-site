import assert from "node:assert/strict";

import {
  hydratePublicationExecutionMappedIntent,
  hydratePublicationExecutionMappedResult,
  mapPublicationExecutionIntentToPersistenceMapping,
  mapPublicationExecutionResultToPersistenceMapping,
  previewPublicationExecutionIntentPersistenceMapping,
  publicationExecutionMappedIntentsEqual,
  publicationExecutionMappedResultsEqual,
  serializePublicationExecutionMappedIntent,
  serializePublicationExecutionMappedResult,
  validatePublicationExecutionIntentForPersistenceMapping,
  validatePublicationExecutionResultForPersistenceMapping,
} from "./social-publication-execution-mapper";
import type {
  PublicationExecutionIntent,
  PublicationExecutionResult,
} from "./social-publication-execution";

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
    evidence: {
      evidenceId: "execution-evidence-intent-1",
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
    resultId: "execution-result-1",
    intentId: base.intentId,
    job: base.job,
    authority: base.authority,
    resultType: "execution_result_recorded",
    status: "completed",
    blockReasons: [],
    evidence: {
      evidenceId: "execution-evidence-result-1",
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

await test("valid intents and results pass persistence-mapping validation", () => {
  assertMapperOk(validatePublicationExecutionIntentForPersistenceMapping(intent()));
  assertMapperOk(validatePublicationExecutionResultForPersistenceMapping(result()));
});

await test("persistence-mapping validation rejects updatedAt before createdAt", () => {
  const invalid = validatePublicationExecutionIntentForPersistenceMapping(
    intent({ updatedAt: "2026-07-01T11:00:00.000Z" }),
  );
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.ok(invalid.errors.some((error) => error.code === "timestamp_ordering_invalid"));
  }
});

await test("persistence-mapping validation rejects forbidden mapper state", () => {
  const invalid = validatePublicationExecutionResultForPersistenceMapping({
    ...result(),
    executePublication: true,
  } as never);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.ok(invalid.errors.some((error) => error.code === "domain_validation_failed"));
  }
});

await test("mapping an intent produces a record plus sanitized evidence", () => {
  const mapped = assertMapperOk(mapPublicationExecutionIntentToPersistenceMapping(intent()));
  assert.equal(mapped.sourceIntentId, "execution-intent-1");
  assert.equal(mapped.intent.execution_intent_id, "execution-intent-1");
  assert.equal(mapped.evidence?.evidence_kind, "authority_evidence");
  assert.equal(mapped.evidence?.execution_result_id, null);
  assert.equal(mapped.executesNothing, true);
  assert.equal(mapped.publishesNothing, true);
});

await test("mapping a result produces a record plus sanitized evidence linked to the result", () => {
  const mapped = assertMapperOk(mapPublicationExecutionResultToPersistenceMapping(result()));
  assert.equal(mapped.sourceResultId, "execution-result-1");
  assert.equal(mapped.result.execution_result_id, "execution-result-1");
  assert.equal(mapped.evidence?.execution_result_id, "execution-result-1");
  assert.equal(mapped.evidence?.execution_intent_id, "execution-intent-1");
});

await test("mapping without evidence yields a null evidence record", () => {
  const mapped = assertMapperOk(
    mapPublicationExecutionIntentToPersistenceMapping(intent({ evidence: null })),
  );
  assert.equal(mapped.evidence, null);
});

await test("preview mapping matches the direct mapping helper", () => {
  const direct = assertMapperOk(mapPublicationExecutionIntentToPersistenceMapping(intent()));
  const preview = assertMapperOk(previewPublicationExecutionIntentPersistenceMapping(intent()));
  assert.equal(
    publicationExecutionMappedIntentsEqual(direct, preview),
    true,
  );
});

await test("mapped intents and results serialize and hydrate deterministically", () => {
  const mappedIntent = assertMapperOk(mapPublicationExecutionIntentToPersistenceMapping(intent()));
  const serializedIntent = serializePublicationExecutionMappedIntent(mappedIntent);
  const hydratedIntent = assertMapperOk(hydratePublicationExecutionMappedIntent(serializedIntent));
  assert.equal(publicationExecutionMappedIntentsEqual(mappedIntent, hydratedIntent), true);

  const mappedResult = assertMapperOk(mapPublicationExecutionResultToPersistenceMapping(result()));
  const serializedResult = serializePublicationExecutionMappedResult(mappedResult);
  const hydratedResult = assertMapperOk(hydratePublicationExecutionMappedResult(serializedResult));
  assert.equal(publicationExecutionMappedResultsEqual(mappedResult, hydratedResult), true);
});

await test("evidence ids are deterministic for the same source id", () => {
  const first = assertMapperOk(mapPublicationExecutionIntentToPersistenceMapping(intent()));
  const second = assertMapperOk(mapPublicationExecutionIntentToPersistenceMapping(intent()));
  assert.equal(first.evidence?.evidence_id, second.evidence?.evidence_id);
});
