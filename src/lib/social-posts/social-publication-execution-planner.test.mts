import assert from "node:assert/strict";

import {
  hydrateSocialPublicationExecutionPlan,
  planSocialPublicationExecution,
  serializeSocialPublicationExecutionPlan,
  validateSocialPublicationExecutionPlan,
} from "./social-publication-execution-planner";
import { replaySocialPublicationExecutionPreflight } from "./social-publication-execution-preflight-replay";
import {
  mapPublicationExecutionIntentToIntentRecord,
  type PublicationExecutionIntent,
  type SocialPublicationExecutionIntentRecord,
  type SocialPublicationExecutionPersistenceModel,
} from "./social-publication-execution-repository";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function intent(
  id: string,
  input: Partial<PublicationExecutionIntent> = {},
): PublicationExecutionIntent {
  return {
    intentId: `execution-intent-${id}`,
    intentType: "prepare_execution_intent",
    job: {
      jobId: `execution-job-${id}`,
      jobType: "model_execution_job",
      references: {
        socialPostId: `social-post-${id}`,
        publicationTargetId: `target-${id}`,
        publisherRequestId: `publisher-request-${id}`,
        publisherResultId: `publisher-result-${id}`,
        publisherJobId: `publisher-job-${id}`,
        scheduleId: `schedule-${id}`,
        ledgerEntryId: `ledger-entry-${id}`,
        publicationManifestId: `manifest-${id}`,
        ownerApprovalId: `owner-approval-${id}`,
        approvalId: `approval-${id}`,
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
      ownerApprovalId: `owner-approval-${id}`,
      approvalId: `approval-${id}`,
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
      preflightId: `execution-preflight-${id}`,
      jobId: `execution-job-${id}`,
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

function assertOk<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) assert.fail(JSON.stringify(result.error));
  return result.value;
}

function intentRecord(
  id: string,
  input: Partial<PublicationExecutionIntent> = {},
): SocialPublicationExecutionIntentRecord {
  return assertOk(mapPublicationExecutionIntentToIntentRecord(intent(id, input)));
}

function planFromModel(model: SocialPublicationExecutionPersistenceModel) {
  const preflight = replaySocialPublicationExecutionPreflight(model).value;
  return planSocialPublicationExecution({
    planId: "execution-plan-test",
    createdAt: "2026-07-01T13:00:00.000Z",
    jobs: [
      ...preflight.preflightPassJobs,
      ...preflight.preflightBlockedJobs,
      ...preflight.staleReferenceJobs,
    ],
  });
}

await test("creates ordered read-only steps with ready jobs first", () => {
  const ready = intentRecord("ready");
  const missing = {
    ...intentRecord("missing"),
    scope: {
      ...intentRecord("missing").scope,
      ledger_entry_id: null,
    },
  } as SocialPublicationExecutionIntentRecord;
  const model = { intents: [missing, ready], results: [] };

  const plan = planFromModel(model);

  assert.equal(plan.valid, true);
  assert.equal(plan.steps.length, 2);
  assert.equal(plan.steps[0].status, "ready");
  assert.equal(plan.steps[0].priority, 100);
  assert.equal(plan.steps[1].status, "waiting");
  assert.deepEqual(plan.steps[1].missingReferences, ["ledger_evidence"]);
  assert.equal(plan.grantsExecutionPermission, false);
  assert.equal(plan.executesNothing, true);
});

await test("models authority and dependency blocking reasons", () => {
  const authorityBlocked = intentRecord("authority", {
    authority: {
      ...intent("authority").authority,
      publisherAuthoritySatisfied: false,
    },
  });
  const plan = planFromModel({ intents: [authorityBlocked], results: [] });
  const [step] = plan.steps;

  assert.equal(step.status, "waiting");
  assert.deepEqual(step.missingAuthority, ["publisher_authority"]);
  assert.equal(
    step.blockingReasons.includes("dependency_blocked:publisher_authority"),
    true,
  );
  assert.equal(
    step.dependencyGraph.some(
      (dependency) =>
        dependency.dependencyType === "publisher_authority" &&
        dependency.blocksStep,
    ),
    true,
  );
});

await test("serializes, hydrates, and validates plans", () => {
  const plan = planFromModel({ intents: [intentRecord("serialize")], results: [] });
  const serialized = serializeSocialPublicationExecutionPlan(plan);
  const hydrated = hydrateSocialPublicationExecutionPlan(serialized);
  if (!hydrated.ok) assert.fail(JSON.stringify(hydrated.diagnostics));

  assert.deepEqual(hydrated.value.steps.map((step) => step.executionJobId), [
    "execution-job-serialize",
  ]);
  assert.equal(validateSocialPublicationExecutionPlan(hydrated.value).valid, true);
});

await test("reports invalid plan shapes", () => {
  const validation = validateSocialPublicationExecutionPlan({
    planId: "",
    createdAt: "not-a-date",
    steps: [
      {
        stepId: "step-1",
        executionJobId: "",
        executionIntentId: "",
        order: 0,
        priority: -1,
        status: "run_now",
        dependsOn: ["step-1"],
      },
    ],
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.diagnostics.length >= 4, true);
});
