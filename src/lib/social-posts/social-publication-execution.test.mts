import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertPublicationExecutionIntentSafe,
  assertPublicationExecutionResultSafe,
  hydratePublicationExecutionIntent,
  hydratePublicationExecutionResult,
  isPublicationExecutionBlockReason,
  isPublicationExecutionIntentType,
  isPublicationExecutionJobType,
  isPublicationExecutionPreflightStatus,
  isPublicationExecutionResultStatus,
  isPublicationExecutionResultType,
  serializePublicationExecutionIntent,
  serializePublicationExecutionResult,
  sortPublicationExecutionIntentsByUpdatedAt,
  validatePublicationExecutionIntent,
  validatePublicationExecutionResult,
  type PublicationExecutionIntent,
  type PublicationExecutionResult,
} from "./social-publication-execution";
import * as executionExports from "./social-publication-execution";

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
        publicationTargetId: "target-facebook-page-1",
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
      preflightPassed: false,
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
      status: "not_run",
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
    authority: {
      ...baseIntent.authority,
      preflightPassed: true,
    },
    resultType: "execution_result_recorded",
    status: "blocked",
    blockReasons: ["missing_owner_approval"],
    evidence: {
      evidenceId: "execution-evidence-1",
      evidenceKind: "preflight_evidence",
      notes: "Owner approval was not yet satisfied.",
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

function intentCodes(
  validation: ReturnType<typeof validatePublicationExecutionIntent>,
): string[] {
  return validation.ok ? [] : validation.errors.map((error) => error.code);
}

function resultCodes(
  validation: ReturnType<typeof validatePublicationExecutionResult>,
): string[] {
  return validation.ok ? [] : validation.errors.map((error) => error.code);
}

await test("valid model-only execution intent", () => {
  assert.equal(validatePublicationExecutionIntent(intent()).ok, true);
});

await test("valid blocked execution result", () => {
  assert.equal(validatePublicationExecutionResult(result()).ok, true);
});

await test("execution vocabulary helpers", () => {
  assert.equal(isPublicationExecutionJobType("model_execution_job"), true);
  assert.equal(isPublicationExecutionIntentType("prepare_execution_intent"), true);
  assert.equal(isPublicationExecutionResultType("execution_result_recorded"), true);
  assert.equal(isPublicationExecutionPreflightStatus("passed"), true);
  assert.equal(isPublicationExecutionPreflightStatus("unknown"), false);
  assert.equal(isPublicationExecutionResultStatus("completed"), true);
  assert.equal(isPublicationExecutionBlockReason("missing_owner_approval"), true);
  assert.equal(isPublicationExecutionBlockReason("not_a_reason"), false);
});

await test("missing ids are rejected", () => {
  const validation = validatePublicationExecutionIntent(
    intent({
      intentId: "",
      job: {
        ...intent().job,
        jobId: "",
        references: {
          ...intent().job.references,
          socialPostId: "",
          publicationTargetId: "",
        },
      },
      createdAt: "",
      updatedAt: "",
    }),
  );

  assert.equal(intentCodes(validation).includes("intent_id_required"), true);
  assert.equal(intentCodes(validation).includes("job_id_required"), true);
  assert.equal(intentCodes(validation).includes("social_post_id_required"), true);
  assert.equal(intentCodes(validation).includes("publication_target_id_required"), true);
  assert.equal(intentCodes(validation).includes("created_at_required"), true);
  assert.equal(intentCodes(validation).includes("updated_at_required"), true);
});

await test("authority must stay model-only and never grant execution", () => {
  const validation = validatePublicationExecutionIntent(
    intent({
      authority: {
        ...intent().authority,
        allowsNetwork: true as false,
        allowsExecution: true as false,
      },
    }),
  );

  assert.deepEqual(intentCodes(validation), ["authority_invalid"]);
});

await test("preflight blocked status requires block reasons", () => {
  const validation = validatePublicationExecutionIntent(
    intent({
      preflight: {
        ...intent().preflight!,
        status: "blocked",
        blockReasons: [],
      },
    }),
  );

  assert.equal(intentCodes(validation).includes("block_reasons_required"), true);
});

await test("preflight passed status forbids block reasons", () => {
  const validation = validatePublicationExecutionIntent(
    intent({
      preflight: {
        ...intent().preflight!,
        status: "passed",
        blockReasons: ["missing_owner_approval"],
      },
    }),
  );

  assert.equal(intentCodes(validation).includes("block_reasons_forbidden"), true);
});

await test("preflight must reference its own job", () => {
  const validation = validatePublicationExecutionIntent(
    intent({
      preflight: {
        ...intent().preflight!,
        jobId: "some-other-job",
      },
    }),
  );

  assert.equal(intentCodes(validation).includes("preflight_job_mismatch"), true);
});

await test("unknown block reasons are rejected", () => {
  const validation = validatePublicationExecutionResult(
    result({
      status: "blocked",
      blockReasons: ["not_a_real_reason" as never],
    }),
  );

  assert.equal(resultCodes(validation).includes("block_reason_invalid"), true);
});

await test("completed status requires satisfied authority", () => {
  const validation = validatePublicationExecutionResult(
    result({
      status: "completed",
      blockReasons: [],
      authority: {
        ...intent().authority,
        preflightPassed: false,
      },
    }),
  );

  assert.equal(resultCodes(validation).includes("result_invariant_failed"), true);
});

await test("completed status accepted with fully satisfied authority", () => {
  const validation = validatePublicationExecutionResult(
    result({
      status: "completed",
      blockReasons: [],
      evidence: {
        evidenceId: "execution-evidence-2",
        evidenceKind: "authority_evidence",
        notes: "All authority checks satisfied.",
        evidence: {},
        containsFullPayload: false,
        containsSecrets: false,
        provesExecution: false,
      },
      authority: {
        ...intent().authority,
        ownerApprovalSatisfied: true,
        publisherAuthoritySatisfied: true,
        preflightPassed: true,
      },
    }),
  );

  assert.equal(validation.ok, true);
});

await test("blocked and failed results require evidence", () => {
  const validation = validatePublicationExecutionResult(
    result({ evidence: null }),
  );

  assert.equal(resultCodes(validation).includes("evidence_required"), true);
});

await test("intent invariant blocks execution posture drift", () => {
  const validation = validatePublicationExecutionIntent(
    intent({
      executesNothing: false as true,
      callsNoExternalApis: false as true,
    }),
  );

  assert.deepEqual(intentCodes(validation), ["intent_invariant_failed"]);
});

await test("result invariant blocks current-status-authority claims", () => {
  const validation = validatePublicationExecutionResult(
    result({ currentExecutionStatusAuthority: true as false }),
  );

  assert.deepEqual(resultCodes(validation), ["result_invariant_failed"]);
});

await test("recursive unsafe state checks reject secrets, external APIs, and SDKs", () => {
  const validation = validatePublicationExecutionIntent(
    intent({
      evidence: {
        evidenceId: "execution-evidence-3",
        evidenceKind: "operator_note",
        notes: null,
        evidence: {
          accessToken: "secret",
          facebookApi: "graph",
          sdkClient: "graph-sdk",
        },
        containsFullPayload: false,
        containsSecrets: false,
        provesExecution: false,
      },
    }),
  );

  assert.equal(intentCodes(validation).includes("secret_forbidden"), true);
  assert.equal(intentCodes(validation).includes("external_api_forbidden"), true);
  assert.equal(intentCodes(validation).includes("sdk_forbidden"), true);
});

await test("recursive unsafe state checks reject cron, workers, and queues", () => {
  const validation = validatePublicationExecutionIntent(
    intent({
      evidence: {
        evidenceId: "execution-evidence-4",
        evidenceKind: "operator_note",
        notes: null,
        evidence: {
          cronExpression: "* * * * *",
          queueName: "execution",
          workerId: "worker-1",
        },
        containsFullPayload: false,
        containsSecrets: false,
        provesExecution: false,
      },
    }),
  );

  assert.equal(intentCodes(validation).includes("cron_or_timer_forbidden"), true);
  assert.equal(intentCodes(validation).includes("worker_or_queue_forbidden"), true);
});

await test("recursive unsafe state checks reject lower-layer payloads and mutations", () => {
  const validation = validatePublicationExecutionIntent(
    intent({
      evidence: {
        evidenceId: "execution-evidence-5",
        evidenceKind: "operator_note",
        notes: null,
        evidence: {
          manifestPayload: { caption: "full payload" },
          appendLedgerEntry: true,
          storagePath: "private/path",
          schedulerBridge: "bridge",
        },
        containsFullPayload: false,
        containsSecrets: false,
        provesExecution: false,
      },
    }),
  );

  assert.equal(intentCodes(validation).includes("lower_layer_payload_forbidden"), true);
  assert.equal(intentCodes(validation).includes("lower_layer_mutation_forbidden"), true);
  assert.equal(intentCodes(validation).includes("storage_forbidden"), true);
  assert.equal(intentCodes(validation).includes("bridge_forbidden"), true);
});

await test("recursive unsafe state checks reject execution triggers, metrics, and learning", () => {
  const validation = validatePublicationExecutionResult(
    result({
      evidence: {
        evidenceId: "execution-evidence-6",
        evidenceKind: "operator_note",
        notes: null,
        evidence: {
          publishPost: "do-it",
          executedPostId: "post-1",
          metrics: { impressions: 10 },
          learningSignal: "boost",
        },
        containsFullPayload: false,
        containsSecrets: false,
        provesExecution: false,
      },
    }),
  );

  assert.equal(resultCodes(validation).includes("execution_trigger_forbidden"), true);
  assert.equal(resultCodes(validation).includes("mutable_execution_state_forbidden"), true);
  assert.equal(resultCodes(validation).includes("metrics_state_forbidden"), true);
  assert.equal(resultCodes(validation).includes("learning_state_forbidden"), true);
});

await test("serialization and hydration round-trip intent", () => {
  const serialized = serializePublicationExecutionIntent(intent());
  const hydrated = hydratePublicationExecutionIntent(serialized);

  assert.equal(hydrated.ok, true);
  assert.deepEqual(hydrated.value, intent());
});

await test("serialization and hydration round-trip result", () => {
  const serialized = serializePublicationExecutionResult(result());
  const hydrated = hydratePublicationExecutionResult(serialized);

  assert.equal(hydrated.ok, true);
  assert.deepEqual(hydrated.value, result());
});

await test("assert helpers throw on unsafe contracts", () => {
  assert.doesNotThrow(() => assertPublicationExecutionIntentSafe(intent()));
  assert.doesNotThrow(() => assertPublicationExecutionResultSafe(result()));
  assert.throws(() =>
    assertPublicationExecutionIntentSafe(intent({ usesNoNetwork: false as true })),
  );
  assert.throws(() =>
    assertPublicationExecutionResultSafe(
      result({ currentExecutionStatusAuthority: true as false }),
    ),
  );
});

await test("sorts intents by updated time and identity", () => {
  const sorted = sortPublicationExecutionIntentsByUpdatedAt([
    intent({ intentId: "execution-intent-2", updatedAt: "2026-07-01T13:00:00.000Z" }),
    intent({ intentId: "execution-intent-1", updatedAt: "2026-07-01T13:00:00.000Z" }),
    intent({ intentId: "execution-intent-3", updatedAt: "2026-07-01T12:00:00.000Z" }),
  ]);

  assert.deepEqual(
    sorted.map((entry) => entry.intentId),
    ["execution-intent-3", "execution-intent-1", "execution-intent-2"],
  );
});

await test("forbidden exports are absent", () => {
  const forbidden = [
    "createPublicationExecutionRepository",
    "execute",
    "executeJob",
    "executePublication",
    "publish",
    "publishPost",
    "callFacebook",
    "callInstagram",
    "callTikTok",
    "callLinkedIn",
    "callGoogle",
    "createWorker",
    "createQueue",
    "createApiRoute",
    "runScheduler",
    "runPublisher",
  ];

  for (const name of forbidden) {
    assert.equal(name in executionExports, false, name);
  }
});

await test("module has no forbidden imports or implementations", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "social-publication-execution.ts"),
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
