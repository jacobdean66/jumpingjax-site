import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  replaySocialPublicationLearning,
  type SocialPublicationLearningReadModel,
} from "./social-publication-learning-replay";
import type { SocialPublicationLearningInsightRecord } from "./social-publication-learning-repository";
import * as replayExports from "./social-publication-learning-replay";

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

function readModel(): SocialPublicationLearningReadModel {
  return replaySocialPublicationLearning({
    insights: [
      record(),
      record({
        learning_insight_id: "learning-insight-2" as SocialPublicationLearningInsightRecord["learning_insight_id"],
        insight_status: "blocked",
        confidence_score: null,
        confidence_level: null,
        blocked_reason: "Insufficient sample size to establish a pattern.",
        evidence_id: null,
        observed_at: "2026-07-02T12:00:00.000Z",
      }),
      record({
        learning_insight_id: "learning-insight-3" as SocialPublicationLearningInsightRecord["learning_insight_id"],
        insight_status: "accepted_for_review",
        candidate_type: "content_pattern",
        confidence_score: 0.9,
        confidence_level: "high",
        observed_at: "2026-07-03T12:00:00.000Z",
      }),
      record({
        learning_insight_id: "learning-insight-4" as SocialPublicationLearningInsightRecord["learning_insight_id"],
        insight_status: "rejected",
        candidate_type: "channel_pattern",
        confidence_score: 0.3,
        confidence_level: "low",
        rejected_reason: "Pattern did not hold across additional posts.",
        observed_at: "2026-07-04T12:00:00.000Z",
      }),
      record({
        learning_insight_id: "learning-insight-5" as SocialPublicationLearningInsightRecord["learning_insight_id"],
        candidate_type: "audience_pattern",
        scope: {
          social_post_id: "social-post-1" as SocialPublicationLearningInsightRecord["scope"]["social_post_id"],
          publication_target_id: "target-facebook-page-1" as SocialPublicationLearningInsightRecord["scope"]["publication_target_id"],
          campaign_id: "campaign-2" as SocialPublicationLearningInsightRecord["scope"]["campaign_id"],
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
        evidence_id: null,
        observed_at: "2026-07-05T12:00:00.000Z",
      }),
    ],
  }).value;
}

await test("replays candidate, blocked, accepted, and rejected insights", () => {
  const model = readModel();
  assert.equal(model.summary.totalInsightCount, 5);
  assert.equal(model.candidateInsights.length, 2);
  assert.equal(model.blockedInsights.length, 1);
  assert.equal(model.acceptedForReviewInsights.length, 1);
  assert.equal(model.rejectedInsights.length, 1);
});

await test("detects missing and sufficient evidence", () => {
  const model = readModel();
  assert.equal(model.insightsMissingEvidence.length, 2);
  assert.equal(model.insightsWithSufficientEvidence.length, 3);
  assert.equal(model.diagnostics.some((diagnostic) => diagnostic.code === "missing_evidence"), true);
});

await test("computes group summaries by candidate type, campaign, and social post without authority", () => {
  const model = readModel();
  const timing = model.summariesByCandidateType.find((summary) => summary.groupKey === "timing_pattern");
  assert.equal(timing?.candidateCount, 1);
  assert.equal(timing?.blockedCount, 1);
  assert.equal(timing?.authoritative, false);

  const campaignOne = model.summariesByCampaign.find((summary) => summary.groupKey === "campaign-1");
  assert.equal(campaignOne !== undefined, true);

  const postOne = model.summariesBySocialPost.find((summary) => summary.groupKey === "social-post-1");
  assert.equal(postOne !== undefined, true);
});

await test("invalid persistence produces diagnostics but no projections", () => {
  const result = replaySocialPublicationLearning({
    insights: [
      record({ learning_insight_id: "" as SocialPublicationLearningInsightRecord["learning_insight_id"] }),
    ],
  });
  assert.equal(result.value.replayIntegrity.valid, false);
  assert.equal(result.value.summary.errorCount > 0, true);
  assert.equal(result.value.summary.totalInsightCount, 0);
});

await test("exports no promotion, approval, schedule, publish, or training functions", () => {
  const forbidden = [
    "promoteInsight",
    "approveInsight",
    "scheduleFromInsight",
    "publishFromInsight",
    "trainModelFromInsight",
    "createLearningBridge",
    "createLearningAdmin",
  ];
  for (const name of forbidden) {
    assert.equal(Object.prototype.hasOwnProperty.call(replayExports, name), false);
  }
});

await test("replay source contains no network, scheduler, publisher, bridge, admin, or API integration", () => {
  const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "social-publication-learning-replay.ts");
  const source = readFileSync(sourcePath, "utf8");
  const forbidden = [
    "fetch(",
    "createClient(",
    "supabase",
    "appendPublisher",
    "appendScheduler",
    "createSocialPublicationLearningBridge",
    "NextRequest",
    "admin/social-posts",
  ];
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `source must not include ${token}`);
  }
});
