import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSocialPublicationMetricBridge,
  resolveSocialPublicationMetricBridgeMode,
} from "./social-publication-metrics-bridge";
import type { SocialPublicationMetricObservationRecord } from "./social-publication-metrics-repository";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function observation(): SocialPublicationMetricObservationRecord {
  return {
    metric_observation_id: "11111111-1111-4111-8111-111111111111" as SocialPublicationMetricObservationRecord["metric_observation_id"],
    observation_type: "publication_metric_observation",
    metric_name: "impressions",
    metric_status: "completed",
    metric_value: 1200,
    aggregation_type: "sum",
    observation_source: "manual_observation",
    scope: {
      social_post_id: "22222222-2222-4222-8222-222222222222" as SocialPublicationMetricObservationRecord["scope"]["social_post_id"],
      publication_target_id: "33333333-3333-4333-8333-333333333333" as SocialPublicationMetricObservationRecord["scope"]["publication_target_id"],
      publisher_request_id: null,
      publisher_result_id: null,
      publisher_job_id: null,
      schedule_id: null,
      ledger_entry_id: null,
      publication_manifest_id: "manifest-1" as SocialPublicationMetricObservationRecord["scope"]["publication_manifest_id"],
      owner_approval_id: null,
      approval_id: null,
      proposal_id: null,
    },
    evidence_id: null,
    observed_at: "2026-07-01T12:00:00.000Z",
    created_at: "2026-07-01T12:01:00.000Z",
    updated_at: "2026-07-01T12:02:00.000Z",
    passive_only: true,
    observation_only: true,
    references_only: true,
    contains_platform_payload: false,
    collects_no_metrics: true,
    calls_no_external_apis: true,
    uses_no_sdks: true,
    uses_no_network: true,
    executes_nothing: true,
    publishes_nothing: true,
    schedules_nothing: true,
    mutates_no_scheduler: true,
    mutates_no_publisher: true,
    mutates_no_ledger: true,
    mutates_no_approval: true,
    mutates_no_manifest: true,
    mutates_no_targets: true,
    persists_nothing: true,
    exposes_no_bridge: true,
    exposes_no_admin_ui: true,
    exposes_no_api_routes: true,
    performs_no_learning: true,
  };
}

await test("selects reference mode outside production", () => {
  const result = resolveSocialPublicationMetricBridgeMode({
    mode: "environment",
    runtimeEnvironment: "development",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.mode, "reference");
});

await test("rejects unsafe reference mode in production", () => {
  const result = createSocialPublicationMetricBridge({
    mode: "reference",
    runtimeEnvironment: "production",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "unsafe_reference_in_production");
});

await test("fails closed when production store is not configured", () => {
  const result = createSocialPublicationMetricBridge({
    mode: "production",
    runtimeEnvironment: "production",
    productionStoreConfigured: false,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "production_unavailable");
});

await test("reference bridge appends and filters observations", async () => {
  const bridge = createSocialPublicationMetricBridge({
    mode: "reference",
    runtimeEnvironment: "test",
  });
  assert.equal(bridge.ok, true);
  if (!bridge.ok) return;
  assert.equal((await bridge.value.appendMetricObservation(observation())).ok, true);

  const records = await bridge.value.listMetricRecords({ metric_name: "impressions" });
  assert.equal(records.ok, true);
  if (!records.ok) return;
  assert.equal(records.value.observations.length, 1);
});

await test("reference bridge rejects duplicate observations", async () => {
  const bridge = createSocialPublicationMetricBridge({
    mode: "reference",
    runtimeEnvironment: "test",
  });
  assert.equal(bridge.ok, true);
  if (!bridge.ok) return;
  assert.equal((await bridge.value.appendMetricObservation(observation())).ok, true);
  const duplicate = await bridge.value.appendMetricObservation(observation());
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error.code, "identity_collision");
});

await test("bridge source contains no collection, admin, route, scheduler, publisher execution, or learning", () => {
  const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "social-publication-metrics-bridge.ts");
  const source = readFileSync(sourcePath, "utf8");
  for (const token of [
    "collectMetrics",
    "fetchMetrics",
    "scheduleMetricCollection",
    "publishFromMetrics",
    "learnFromMetrics",
    "NextRequest",
    "admin/social-posts",
  ]) {
    assert.equal(source.includes(token), false, `source must not include ${token}`);
  }
});
