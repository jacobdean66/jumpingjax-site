import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  hydratePublicationLearningInsight,
  serializePublicationLearningInsight,
  sortPublicationLearningInsights,
  validatePublicationLearningInsight,
  type PublicationLearningInsight,
} from "./social-publication-learning";
import * as learningExports from "./social-publication-learning";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function insight(input: Partial<PublicationLearningInsight> = {}): PublicationLearningInsight {
  return {
    insightId: "learning-insight-1",
    insightType: "publication_learning_insight",
    candidateType: "timing_pattern",
    status: "candidate",
    confidenceScore: 0.62,
    confidenceLevel: "medium",
    source: "metrics_replay_summary",
    references: {
      socialPostId: "social-post-1",
      publicationTargetId: "target-facebook-page-1",
      campaignId: "campaign-1",
      metricObservationId: "metric-observation-1",
      publisherRequestId: null,
      publisherResultId: null,
      publisherJobId: null,
      scheduleId: null,
      ledgerEntryId: null,
      publicationManifestId: null,
      ownerApprovalId: null,
      approvalId: null,
      campaignMemoryId: null,
      decisionHistoryId: null,
    },
    evidence: {
      evidenceId: "learning-evidence-1",
      evidenceKind: "metrics_summary_reference",
      evidence: { observedPattern: "afternoon posts show higher engagement" },
      notes: "Derived from sanitized metrics replay summary.",
      containsPlatformPayload: false,
      containsSecrets: false,
      containsCredentials: false,
      containsModelWeights: false,
      containsTrainingData: false,
      providesRecommendation: false,
    },
    rationale: "Afternoon-published posts referencing this target show a repeated engagement pattern.",
    blockedReason: null,
    rejectedReason: null,
    observedAt: "2026-07-01T12:00:00.000Z",
    createdAt: "2026-07-01T12:01:00.000Z",
    updatedAt: "2026-07-01T12:01:00.000Z",
    passiveOnly: true,
    candidateOnly: true,
    explainable: true,
    referencesOnly: true,
    containsEmbeddedPayload: false,
    performsNoModelTraining: true,
    producesNoStateMutatingRecommendation: true,
    triggersNoAutomation: true,
    triggersNoScheduling: true,
    triggersNoPublishing: true,
    callsNoExternalApis: true,
    usesNoSdks: true,
    usesNoNetwork: true,
    persistsNothing: true,
    exposesNoBridge: true,
    exposesNoAdminUi: true,
    exposesNoApiRoutes: true,
    mutatesNoCampaignMemory: true,
    mutatesNoDecisionHistory: true,
    mutatesNoApproval: true,
    mutatesNoLedger: true,
    mutatesNoManifest: true,
    mutatesNoTargets: true,
    mutatesNoScheduler: true,
    mutatesNoPublisher: true,
    mutatesNoMetrics: true,
    ...input,
  };
}

await test("validates passive learning insights", () => {
  const result = validatePublicationLearningInsight(insight());
  assert.equal(result.ok, true);
});

await test("requires at least one reference by id", () => {
  const result = validatePublicationLearningInsight(
    insight({
      references: {
        socialPostId: null,
        publicationTargetId: null,
        campaignId: null,
        metricObservationId: null,
        publisherRequestId: null,
        publisherResultId: null,
        publisherJobId: null,
        scheduleId: null,
        ledgerEntryId: null,
        publicationManifestId: null,
        ownerApprovalId: null,
        approvalId: null,
        campaignMemoryId: null,
        decisionHistoryId: null,
      },
    }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "references_required"), true);
});

await test("requires confidence score and level to agree", () => {
  const result = validatePublicationLearningInsight(
    insight({ confidenceScore: 0.9, confidenceLevel: "low" }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "confidence_level_score_mismatch"), true);
});

await test("requires blocked reason for blocked insights", () => {
  const result = validatePublicationLearningInsight(
    insight({
      status: "blocked",
      confidenceScore: null,
      confidenceLevel: null,
      blockedReason: null,
    }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "blocked_reason_required"), true);
});

await test("requires rejected reason for rejected insights", () => {
  const result = validatePublicationLearningInsight(
    insight({
      status: "rejected",
      confidenceScore: null,
      confidenceLevel: null,
      rejectedReason: null,
    }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "rejected_reason_required"), true);
});

await test("rejects reasons carried by the wrong status", () => {
  const result = validatePublicationLearningInsight(
    insight({ blockedReason: "missing evidence" }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "blocked_reason_forbidden"), true);
});

await test("requires an explainable rationale", () => {
  const result = validatePublicationLearningInsight(insight({ rationale: "" }));
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "rationale_required"), true);
});

await test("rejects embedded payloads, secrets, and model training state", () => {
  const result = validatePublicationLearningInsight(
    insight({
      evidence: {
        evidenceId: "learning-evidence-1",
        evidenceKind: "manual_note",
        evidence: { rawMetrics: { impressions: 1 }, accessToken: "secret", modelWeights: [1, 2] },
        notes: null,
        containsPlatformPayload: false,
        containsSecrets: false,
        containsCredentials: false,
        containsModelWeights: false,
        containsTrainingData: false,
        providesRecommendation: false,
      },
    }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "platform_payload_forbidden"), true);
  assert.equal(result.errors.some((error) => error.code === "secret_forbidden"), true);
  assert.equal(result.errors.some((error) => error.code === "model_training_forbidden"), true);
});

await test("rejects execution and state-mutating recommendation keys", () => {
  const result = validatePublicationLearningInsight(
    insight({
      evidence: {
        evidenceId: "learning-evidence-1",
        evidenceKind: "manual_note",
        evidence: { fetch: "https://example.invalid", autoPublish: true, queue: "learning" },
        notes: null,
        containsPlatformPayload: false,
        containsSecrets: false,
        containsCredentials: false,
        containsModelWeights: false,
        containsTrainingData: false,
        providesRecommendation: false,
      },
    }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "network_forbidden"), true);
  assert.equal(result.errors.some((error) => error.code === "execution_forbidden"), true);
  assert.equal(result.errors.some((error) => error.code === "state_mutation_forbidden"), true);
});

await test("serializes and hydrates validated insights", () => {
  const serialized = serializePublicationLearningInsight(insight());
  const hydrated = hydratePublicationLearningInsight(serialized);
  assert.equal(hydrated.insightId, "learning-insight-1");
  assert.equal(Object.isFrozen(hydrated), true);
});

await test("sorts insights by observed time and identity", () => {
  const sorted = sortPublicationLearningInsights([
    insight({ insightId: "learning-insight-2", observedAt: "2026-07-01T13:00:00.000Z" }),
    insight({ insightId: "learning-insight-1", observedAt: "2026-07-01T13:00:00.000Z" }),
    insight({ insightId: "learning-insight-3", observedAt: "2026-07-01T12:00:00.000Z" }),
  ]);
  assert.deepEqual(
    sorted.map((entry) => entry.insightId),
    ["learning-insight-3", "learning-insight-1", "learning-insight-2"],
  );
});

await test("exports no forbidden automation, training, or integration functions", () => {
  const forbidden = [
    "trainModel",
    "promoteInsight",
    "applyRecommendation",
    "publishFromLearning",
    "scheduleFromLearning",
    "createLearningBridge",
    "createLearningStore",
  ];
  for (const name of forbidden) {
    assert.equal(Object.prototype.hasOwnProperty.call(learningExports, name), false);
  }
});

await test("source contains no network, SDK, SQL, bridge, admin, or API route integration", () => {
  const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "social-publication-learning.ts");
  const source = readFileSync(sourcePath, "utf8");
  const forbidden = [
    "fetch(",
    "createClient(",
    "supabase",
    "OAuth",
    "setTimeout(",
    "setInterval(",
    "NextRequest",
    "Response.json",
    "admin/social-posts",
    "openai",
  ];
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `source must not include ${token}`);
  }
});
