import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  PublicationExecutionIntent,
  PublicationExecutionResult,
} from "./social-publication-execution";
import {
  mapPublicationExecutionIntentToIntentRecord,
  mapPublicationExecutionResultToResultRecord,
  type SocialPublicationExecutionIntentRecord,
} from "./social-publication-execution-repository";
import {
  missingAuthorityForExecutionIntent,
  replaySocialPublicationExecution,
} from "./social-publication-execution-replay";
import * as replayExports from "./social-publication-execution-replay";

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
  const base = intent();
  return {
    resultId: "execution-result-1",
    intentId: base.intentId,
    job: base.job,
    authority: base.authority,
    resultType: "execution_result_recorded",
    status: "completed",
    blockReasons: [],
    evidence: {
      evidenceId: "execution-evidence-1",
      evidenceKind: "authority_evidence",
      notes: null,
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

function intentRecord(input: Partial<PublicationExecutionIntent> = {}) {
  const mapped = mapPublicationExecutionIntentToIntentRecord(intent(input));
  assert.equal(mapped.ok, true, JSON.stringify(mapped.ok ? [] : mapped.error));
  return mapped.value;
}

function resultRecord(input: Partial<PublicationExecutionResult> = {}) {
  const mapped = mapPublicationExecutionResultToResultRecord(result(input));
  assert.equal(mapped.ok, true, JSON.stringify(mapped.ok ? [] : mapped.error));
  return mapped.value;
}

await test("replay groups pending preflight-passed completed failed and blocked jobs", () => {
  const pending = intentRecord({
    intentId: "execution-intent-pending",
    job: { ...intent().job, jobId: "execution-job-pending" },
    preflight: null,
  });
  const preflightPassed = intentRecord({
    intentId: "execution-intent-preflight-passed",
    job: { ...intent().job, jobId: "execution-job-preflight-passed" },
    preflight: { ...intent().preflight!, jobId: "execution-job-preflight-passed" },
  });
  const completedIntent = intentRecord();
  const completedResult = resultRecord();

  const failedIntent = intentRecord({
    intentId: "execution-intent-failed",
    job: { ...intent().job, jobId: "execution-job-failed" },
    preflight: { ...intent().preflight!, jobId: "execution-job-failed" },
  });
  const failedResult = resultRecord({
    resultId: "execution-result-failed",
    intentId: "execution-intent-failed",
    job: { ...result().job, jobId: "execution-job-failed" },
    status: "failed",
    blockReasons: [],
  });

  const blockedIntent = intentRecord({
    intentId: "execution-intent-blocked",
    job: {
      ...intent().job,
      jobId: "execution-job-blocked",
      references: { ...intent().job.references, scheduleId: null },
    },
    preflight: {
      ...intent().preflight!,
      jobId: "execution-job-blocked",
      status: "blocked",
      blockReasons: ["missing_schedule_intent"],
    },
    authority: { ...intent().authority, preflightPassed: false },
  });

  const replay = replaySocialPublicationExecution({
    intents: [pending, preflightPassed, completedIntent, failedIntent, blockedIntent],
    results: [completedResult, failedResult],
  }).value;

  assert.equal(replay.pendingJobs.length, 1);
  assert.equal(replay.preflightPassedJobs.length, 1);
  assert.equal(replay.completedJobs.length, 1);
  assert.equal(replay.failedJobs.length, 1);
  assert.equal(replay.blockedJobs.length, 1);
});

await test("replay identifies missing and sufficient authority evidence", () => {
  const blocked = intentRecord({
    job: {
      ...intent().job,
      references: { ...intent().job.references, ledgerEntryId: null },
    },
  });
  const replay = replaySocialPublicationExecution({
    intents: [intentRecord({ intentId: "execution-intent-good" }), blocked],
    results: [],
  }).value;

  assert.equal(replay.jobsWithSufficientAuthorityEvidence.length, 1);
  assert.equal(replay.jobsMissingAuthority.length, 1);
  assert.deepEqual(missingAuthorityForExecutionIntent(blocked), ["ledger_evidence"]);
});

await test("replay is computed only and grants no execution authority", () => {
  const replay = replaySocialPublicationExecution({
    intents: [intentRecord()],
    results: [],
  }).value;

  assert.equal(replay.computedOnly, true);
  assert.equal(replay.authoritative, false);
  assert.equal(replay.grantsExecutionPermission, false);
  assert.equal(replay.executesNothing, true);
  assert.equal(replay.publishesNothing, true);
  assert.equal(Object.isFrozen(replay), true);
});

await test("invalid models create diagnostics", () => {
  const invalid = {
    ...intentRecord(),
    executes_nothing: false,
  } as unknown as SocialPublicationExecutionIntentRecord;
  const replay = replaySocialPublicationExecution({
    intents: [invalid],
    results: [],
  }).value;

  assert.equal(replay.summary.errorCount > 0, true);
  assert.equal(replay.replayIntegrity.valid, false);
});

await test("module exports no execution publishing storage network or admin behavior", () => {
  const forbidden = [
    "executePublication",
    "publishSocialPost",
    "createServiceRoleClient",
    "createExecutionBridge",
    "renderExecutionAdmin",
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
      "social-publication-execution-replay.ts",
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
