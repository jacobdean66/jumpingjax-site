import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createReferenceSocialPublicationLearningRepository,
  learningInsightToRecord,
  learningRecordToInsight,
  validateSocialPublicationLearningInsightRecord,
  validateSocialPublicationLearningPersistenceModel,
  type SocialPublicationLearningInsightRecord,
} from "./social-publication-learning-repository";
import * as repositoryExports from "./social-publication-learning-repository";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function record(
  input: Partial<SocialPublicationLearningInsightRecord> = {},
): SocialPublicationLearningInsightRecord {
  return {
    learning_insight_id: "learning-insight-1" as SocialPublicationLearningInsightRecord["learning_insight_id"],
    insight_type: "publication_learning_insight",
    candidate_type: "timing_pattern",
    insight_status: "candidate",
    confidence_score: 0.62,
    confidence_level: "medium",
    learning_source: "metrics_replay_summary",
    scope: {
      social_post_id: "social-post-1" as SocialPublicationLearningInsightRecord["scope"]["social_post_id"],
      publication_target_id: "target-facebook-page-1" as SocialPublicationLearningInsightRecord["scope"]["publication_target_id"],
      campaign_id: "campaign-1" as SocialPublicationLearningInsightRecord["scope"]["campaign_id"],
      metric_observation_id: "metric-observation-1" as SocialPublicationLearningInsightRecord["scope"]["metric_observation_id"],
      publisher_request_id: null,
      publisher_result_id: null,
      publisher_job_id: null,
      schedule_id: null,
      ledger_entry_id: null,
      publication_manifest_id: null,
      owner_approval_id: null,
      approval_id: null,
      campaign_memory_id: null,
      decision_history_id: null,
    },
    evidence_id: "learning-evidence-1" as SocialPublicationLearningInsightRecord["evidence_id"],
    rationale: "Afternoon-published posts referencing this target show a repeated engagement pattern.",
    blocked_reason: null,
    rejected_reason: null,
    observed_at: "2026-07-01T12:00:00.000Z",
    created_at: "2026-07-01T12:01:00.000Z",
    updated_at: "2026-07-01T12:01:00.000Z",
    passive_only: true,
    candidate_only: true,
    explainable: true,
    references_only: true,
    contains_embedded_payload: false,
    performs_no_model_training: true,
    produces_no_state_mutating_recommendation: true,
    triggers_no_automation: true,
    triggers_no_scheduling: true,
    triggers_no_publishing: true,
    calls_no_external_apis: true,
    uses_no_sdks: true,
    uses_no_network: true,
    persists_nothing: true,
    exposes_no_bridge: true,
    exposes_no_admin_ui: true,
    exposes_no_api_routes: true,
    mutates_no_campaign_memory: true,
    mutates_no_decision_history: true,
    mutates_no_approval: true,
    mutates_no_ledger: true,
    mutates_no_manifest: true,
    mutates_no_targets: true,
    mutates_no_scheduler: true,
    mutates_no_publisher: true,
    mutates_no_metrics: true,
    ...input,
  };
}

await test("validates learning insight records", () => {
  const result = validateSocialPublicationLearningInsightRecord(record());
  assert.equal(result.ok, true);
});

await test("validates persistence model identity uniqueness", () => {
  const result = validateSocialPublicationLearningPersistenceModel({
    insights: [record(), record()],
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "identity_not_separated"), true);
});

await test("rejects invalid record invariants", () => {
  const result = validateSocialPublicationLearningInsightRecord(
    record({ performs_no_model_training: false as true }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "contract_invariant_failed"), true);
});

await test("requires at least one reference in scope", () => {
  const result = validateSocialPublicationLearningInsightRecord(
    record({
      scope: {
        social_post_id: null,
        publication_target_id: null,
        campaign_id: null,
        metric_observation_id: null,
        publisher_request_id: null,
        publisher_result_id: null,
        publisher_job_id: null,
        schedule_id: null,
        ledger_entry_id: null,
        publication_manifest_id: null,
        owner_approval_id: null,
        approval_id: null,
        campaign_memory_id: null,
        decision_history_id: null,
      },
    }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "relationship_invalid"), true);
});

await test("maps domain insights to records and back", () => {
  const mapped = learningInsightToRecord({
    insightId: "learning-insight-2",
    insightType: "publication_learning_insight",
    candidateType: "content_pattern",
    status: "accepted_for_review",
    confidenceScore: 0.85,
    confidenceLevel: "high",
    source: "manual_review",
    references: {
      socialPostId: "social-post-1",
      publicationTargetId: null,
      campaignId: "campaign-1",
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
      decisionHistoryId: "decision-1",
    },
    evidence: null,
    rationale: "Video assets referencing this campaign consistently outperform static images.",
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
  });
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  assert.equal(mapped.value.candidate_type, "content_pattern");
  const hydrated = learningRecordToInsight(mapped.value);
  assert.equal(hydrated.ok, true);
  if (!hydrated.ok) return;
  assert.equal(hydrated.value.candidateType, "content_pattern");
});

await test("reference repository appends and filters records", () => {
  const repository = createReferenceSocialPublicationLearningRepository();
  const first = repository.appendLearningInsight({ insight: record() });
  const second = repository.appendLearningInsight({
    insight: record({
      learning_insight_id: "learning-insight-2" as SocialPublicationLearningInsightRecord["learning_insight_id"],
      candidate_type: "content_pattern",
    }),
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);

  const filtered = repository.listLearningInsights({ candidate_type: "content_pattern" });
  assert.equal(filtered.ok, true);
  if (!filtered.ok) return;
  assert.equal(filtered.value.length, 1);
  assert.equal(filtered.value[0]?.learning_insight_id, "learning-insight-2");
});

await test("reference repository rejects duplicate identities", () => {
  const repository = createReferenceSocialPublicationLearningRepository();
  assert.equal(repository.appendLearningInsight({ insight: record() }).ok, true);
  const duplicate = repository.appendLearningInsight({ insight: record() });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error.code, "identity_collision");
});

await test("exports no store, bridge, SQL, Supabase, or API surface", () => {
  const forbidden = [
    "createSocialPublicationLearningStore",
    "createSocialPublicationLearningBridge",
    "createLearningAdminPage",
    "createLearningRoute",
    "insertLearningInsight",
  ];
  for (const name of forbidden) {
    assert.equal(Object.prototype.hasOwnProperty.call(repositoryExports, name), false);
  }
});

await test("repository source contains no SQL, Supabase, bridge, admin, or network", () => {
  const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "social-publication-learning-repository.ts");
  const source = readFileSync(sourcePath, "utf8");
  const forbidden = [
    "from(",
    "insert(",
    "createClient(",
    "supabase",
    "fetch(",
    "NextRequest",
    "admin/social-posts",
    "createSocialPublicationLearningBridge",
  ];
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `source must not include ${token}`);
  }
});
