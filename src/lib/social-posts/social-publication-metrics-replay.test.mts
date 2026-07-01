import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  replaySocialPublicationMetrics,
  type SocialPublicationMetricReadModel,
} from "./social-publication-metrics-replay";
import type { SocialPublicationMetricObservationRecord } from "./social-publication-metrics-repository";
import * as replayExports from "./social-publication-metrics-replay";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function record(
  input: Partial<SocialPublicationMetricObservationRecord> = {},
): SocialPublicationMetricObservationRecord {
  return {
    metric_observation_id: "metric-observation-1" as SocialPublicationMetricObservationRecord["metric_observation_id"],
    observation_type: "publication_metric_observation",
    metric_name: "impressions",
    metric_status: "completed",
    metric_value: 1200,
    aggregation_type: "sum",
    observation_source: "manual_observation",
    scope: {
      social_post_id: "social-post-1" as SocialPublicationMetricObservationRecord["scope"]["social_post_id"],
      publication_target_id: "target-facebook-page-1" as SocialPublicationMetricObservationRecord["scope"]["publication_target_id"],
      publisher_request_id: "publisher-request-1" as SocialPublicationMetricObservationRecord["scope"]["publisher_request_id"],
      publisher_result_id: "publisher-result-1" as SocialPublicationMetricObservationRecord["scope"]["publisher_result_id"],
      publisher_job_id: "publisher-job-1" as SocialPublicationMetricObservationRecord["scope"]["publisher_job_id"],
      schedule_id: "schedule-1" as SocialPublicationMetricObservationRecord["scope"]["schedule_id"],
      ledger_entry_id: "ledger-entry-1" as SocialPublicationMetricObservationRecord["scope"]["ledger_entry_id"],
      publication_manifest_id: "manifest-1" as SocialPublicationMetricObservationRecord["scope"]["publication_manifest_id"],
      owner_approval_id: "owner-approval-1" as SocialPublicationMetricObservationRecord["scope"]["owner_approval_id"],
      approval_id: "approval-1" as SocialPublicationMetricObservationRecord["scope"]["approval_id"],
      proposal_id: "proposal-1" as SocialPublicationMetricObservationRecord["scope"]["proposal_id"],
    },
    evidence_id: "metric-evidence-1" as SocialPublicationMetricObservationRecord["evidence_id"],
    observed_at: "2026-07-01T12:00:00.000Z",
    created_at: "2026-07-01T12:01:00.000Z",
    updated_at: "2026-07-01T12:01:00.000Z",
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
    ...input,
  };
}

function readModel(): SocialPublicationMetricReadModel {
  return replaySocialPublicationMetrics({
    observations: [
      record(),
      record({
        metric_observation_id: "metric-observation-2" as SocialPublicationMetricObservationRecord["metric_observation_id"],
        metric_name: "impressions",
        metric_value: 1800,
        observed_at: "2026-07-02T12:00:00.000Z",
      }),
      record({
        metric_observation_id: "metric-observation-3" as SocialPublicationMetricObservationRecord["metric_observation_id"],
        metric_name: "clicks",
        metric_status: "pending",
        metric_value: null,
        evidence_id: null,
      }),
      record({
        metric_observation_id: "metric-observation-4" as SocialPublicationMetricObservationRecord["metric_observation_id"],
        metric_name: "shares",
        metric_status: "failed",
        metric_value: null,
        evidence_id: null,
      }),
      record({
        metric_observation_id: "metric-observation-5" as SocialPublicationMetricObservationRecord["metric_observation_id"],
        metric_name: "reach",
        metric_status: "completed",
        metric_value: 900,
        evidence_id: null,
      }),
    ],
  }).value;
}

await test("replays pending, completed, and failed observations", () => {
  const model = readModel();
  assert.equal(model.summary.totalObservationCount, 5);
  assert.equal(model.pendingObservations.length, 1);
  assert.equal(model.completedObservations.length, 3);
  assert.equal(model.failedObservations.length, 1);
});

await test("detects missing and sufficient evidence", () => {
  const model = readModel();
  assert.equal(model.observationsMissingEvidence.length, 1);
  assert.equal(model.observationsMissingEvidence[0]?.metricObservationId, "metric-observation-5");
  assert.equal(model.observationsWithSufficientEvidence.length, 4);
  assert.equal(model.diagnostics.some((diagnostic) => diagnostic.code === "missing_evidence"), true);
});

await test("computes aggregate summaries without authority", () => {
  const model = readModel();
  const impressions = model.aggregateSummaries.find(
    (summary) => summary.metricName === "impressions",
  );
  assert.equal(impressions?.completedObservationCount, 2);
  assert.equal(impressions?.valueSum, 3000);
  assert.equal(impressions?.latestValue, 1800);
  assert.equal(impressions?.averageValue, 1500);
  assert.equal(impressions?.authoritative, false);
});

await test("invalid persistence produces diagnostics but no projections", () => {
  const result = replaySocialPublicationMetrics({
    observations: [
      record({ metric_observation_id: "" as SocialPublicationMetricObservationRecord["metric_observation_id"] }),
    ],
  });
  assert.equal(result.value.replayIntegrity.valid, false);
  assert.equal(result.value.summary.errorCount > 0, true);
  assert.equal(result.value.summary.totalObservationCount, 0);
});

await test("exports no execution, bridge, admin, collection, or learning functions", () => {
  const forbidden = [
    "collectMetrics",
    "scheduleMetricCollection",
    "publishFromMetrics",
    "createMetricBridge",
    "createMetricAdmin",
    "learnFromMetrics",
  ];
  for (const name of forbidden) {
    assert.equal(Object.prototype.hasOwnProperty.call(replayExports, name), false);
  }
});

await test("replay source contains no network, scheduler, publisher, bridge, admin, or API integration", () => {
  const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "social-publication-metrics-replay.ts");
  const source = readFileSync(sourcePath, "utf8");
  const forbidden = [
    "fetch(",
    "createClient(",
    "supabase",
    "appendPublisher",
    "appendScheduler",
    "createSocialPublicationMetricBridge",
    "NextRequest",
    "admin/social-posts",
  ];
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `source must not include ${token}`);
  }
});
