import assert from "node:assert/strict";

import {
  evaluateSocialPublicationExecutionPreflight,
} from "./social-publication-execution-preflight";
import {
  mapPublicationExecutionIntentToIntentRecord,
  mapPublicationExecutionResultToResultRecord,
  type PublicationExecutionIntent,
  type PublicationExecutionResult,
  type SocialPublicationExecutionIntentRecord,
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
    evidence: {
      evidenceId: "execution-evidence-1",
      evidenceKind: "preflight_evidence",
      notes: "preflight checked",
      evidence: {},
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
      evidenceId: "execution-result-evidence-1",
      evidenceKind: "authority_evidence",
      notes: "authority satisfied",
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

function intentRecord(input: Partial<PublicationExecutionIntent> = {}) {
  return assertOk(mapPublicationExecutionIntentToIntentRecord(intent(input)));
}

function resultRecord(input: Partial<PublicationExecutionResult> = {}) {
  return assertOk(mapPublicationExecutionResultToResultRecord(result(input)));
}

await test("passes when required references and authority are present", () => {
  const evaluation = evaluateSocialPublicationExecutionPreflight(intentRecord());

  assert.equal(evaluation.status, "pass");
  assert.equal(evaluation.diagnostics.length, 0);
  assert.equal(evaluation.grantsExecutionPermission, false);
  assert.equal(evaluation.executesNothing, true);
});

await test("blocks with missing reference diagnostics", () => {
  const base = intentRecord();
  const missing = {
    ...base,
    scope: {
      ...base.scope,
      owner_approval_id: null,
      ledger_entry_id: null,
      publisher_request_id: null,
      schedule_id: null,
      publication_manifest_id: null,
    },
  } as SocialPublicationExecutionIntentRecord;
  const evaluation = evaluateSocialPublicationExecutionPreflight(missing);

  assert.equal(evaluation.status, "block");
  assert.deepEqual(evaluation.missingReferences, [
    "owner_approval",
    "ledger_evidence",
    "publisher_request",
    "scheduler_intent",
    "publication_manifest",
  ]);
  assert.equal(
    evaluation.diagnostics.every((diagnostic) => diagnostic.category === "missing_reference"),
    true,
  );
  assert.equal(evaluation.couldRunLater, true);
});

await test("blocks when authority evidence is missing", () => {
  const record = intentRecord({
    authority: {
      ...intent().authority,
      ownerApprovalSatisfied: false,
      publisherAuthoritySatisfied: false,
    },
  });
  const evaluation = evaluateSocialPublicationExecutionPreflight(record);

  assert.equal(evaluation.status, "block");
  assert.deepEqual(evaluation.authority.missingAuthority, [
    "owner_approval",
    "publisher_authority",
  ]);
});

await test("blocks when existing preflight or result state is blocked", () => {
  const preflightBlocked = intentRecord({
    preflight: {
      ...intent().preflight!,
      status: "blocked",
      blockReasons: ["schedule_not_due"],
    },
  });
  const resultBlocked = resultRecord({
    status: "blocked",
    blockReasons: ["authority_insufficient"],
    evidence: {
      evidenceId: "execution-result-evidence-2",
      evidenceKind: "authority_evidence",
      notes: "blocked",
      evidence: {},
      containsFullPayload: false,
      containsSecrets: false,
      provesExecution: false,
    },
  });
  const evaluation = evaluateSocialPublicationExecutionPreflight(
    preflightBlocked,
    resultBlocked,
  );

  assert.equal(evaluation.status, "block");
  assert.deepEqual(evaluation.blockedStates, ["preflight", "result"]);
});

await test("unsafe contracts block and cannot theoretically run later", () => {
  const base = intentRecord();
  const unsafe = {
    ...base,
    grants_execution_permission: true,
  } as unknown as SocialPublicationExecutionIntentRecord;
  const evaluation = evaluateSocialPublicationExecutionPreflight(unsafe);

  assert.equal(evaluation.status, "block");
  assert.equal(
    evaluation.diagnostics.some((diagnostic) => diagnostic.category === "unsafe"),
    true,
  );
  assert.equal(evaluation.couldRunLater, false);
});
