import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSocialPublicationLearningBridge,
  resolveSocialPublicationLearningBridgeMode,
} from "./social-publication-learning-bridge";
import type { SocialPublicationLearningInsightRecord } from "./social-publication-learning-repository";

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

await test("selects reference mode outside production", () => {
  const result = resolveSocialPublicationLearningBridgeMode({
    mode: "environment",
    runtimeEnvironment: "development",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.mode, "reference");
});

await test("rejects unsafe reference mode in production", () => {
  const result = createSocialPublicationLearningBridge({
    mode: "reference",
    runtimeEnvironment: "production",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "unsafe_reference_in_production");
});

await test("rejects invalid bridge mode configuration", () => {
  const result = createSocialPublicationLearningBridge({
    mode: "not-a-real-mode" as never,
    runtimeEnvironment: "development",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "configuration_invalid");
});

await test("fails closed in production when store is not configured", () => {
  const result = createSocialPublicationLearningBridge({
    mode: "production",
    runtimeEnvironment: "production",
    productionStoreConfigured: false,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "production_unavailable");
});

await test("fails closed in production even when a store flag claims configuration", () => {
  const result = createSocialPublicationLearningBridge({
    mode: "production",
    runtimeEnvironment: "production",
    productionStoreConfigured: true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "production_unavailable");
});

await test("reference bridge lists seeded insights", async () => {
  const bridge = createSocialPublicationLearningBridge({
    mode: "reference",
    runtimeEnvironment: "test",
    seed: { insights: [record()] },
  });
  assert.equal(bridge.ok, true);
  if (!bridge.ok) return;
  assert.equal(bridge.value.mode, "reference");

  const listed = await bridge.value.listLearningInsights({ candidate_type: "timing_pattern" });
  assert.equal(listed.ok, true);
  if (!listed.ok) return;
  assert.equal(listed.value.length, 1);
  assert.equal(listed.value[0]?.learning_insight_id, "learning-insight-1");
});

await test("reference bridge returns empty results for non-matching identity", async () => {
  const bridge = createSocialPublicationLearningBridge({
    mode: "reference",
    runtimeEnvironment: "test",
    seed: { insights: [record()] },
  });
  assert.equal(bridge.ok, true);
  if (!bridge.ok) return;

  const listed = await bridge.value.listLearningInsights({ candidate_type: "content_pattern" });
  assert.equal(listed.ok, true);
  if (!listed.ok) return;
  assert.equal(listed.value.length, 0);
});

await test("reference bridge loadByIdentity returns a scoped persistence model", async () => {
  const bridge = createSocialPublicationLearningBridge({
    mode: "reference",
    runtimeEnvironment: "test",
    seed: { insights: [record()] },
  });
  assert.equal(bridge.ok, true);
  if (!bridge.ok) return;

  const loaded = await bridge.value.loadByIdentity({ social_post_id: "social-post-1" });
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.equal(loaded.value.insights.length, 1);
});

await test("reference bridge snapshot returns the full persistence model", async () => {
  const bridge = createSocialPublicationLearningBridge({
    mode: "reference",
    runtimeEnvironment: "test",
    seed: { insights: [record()] },
  });
  assert.equal(bridge.ok, true);
  if (!bridge.ok) return;

  const snapshot = await bridge.value.snapshot();
  assert.equal(snapshot.ok, true);
  if (!snapshot.ok) return;
  assert.equal(snapshot.value.insights.length, 1);
});

await test("reference bridge rejects an invalid seed model", () => {
  const bridge = createSocialPublicationLearningBridge({
    mode: "reference",
    runtimeEnvironment: "test",
    seed: { insights: [record({ performs_no_model_training: false as true })] },
  });
  assert.equal(bridge.ok, false);
  if (bridge.ok) return;
  assert.equal(bridge.error.code, "validation_failed");
});

await test("bridge source contains no execution, store writes, SQL, network, or admin surface", () => {
  const sourcePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "social-publication-learning-bridge.ts",
  );
  const source = readFileSync(sourcePath, "utf8");
  for (const token of [
    "appendLearningInsight",
    "createSocialPublicationLearningStore",
    "insertLearningInsight",
    "from(",
    "insert(",
    "createClient(",
    "fetch(",
    "scheduleExecution",
    "publishFromLearning",
    "trainModel",
    "promoteToMemory",
    "NextRequest",
    "admin/social-posts",
  ]) {
    assert.equal(source.includes(token), false, `source must not include ${token}`);
  }
});
