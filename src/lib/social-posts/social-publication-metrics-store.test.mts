import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  appendSocialPublicationMetricObservation,
  configureSocialPublicationMetricStoreTestDependencies,
  fetchSocialPublicationMetricRecords,
  insertSocialPublicationMetricEvidence,
  type SocialPublicationMetricStoreStorage,
} from "./social-publication-metrics-store";
import type {
  SocialPublicationMetricEvidenceRecord,
  SocialPublicationMetricEvidenceRow,
  SocialPublicationMetricObservationRow,
} from "./social-publication-metrics-rows";
import type { SocialPublicationMetricObservationRecord } from "./social-publication-metrics-repository";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } finally {
    configureSocialPublicationMetricStoreTestDependencies(null);
  }
}

function observationRecord(
  input: Partial<SocialPublicationMetricObservationRecord> = {},
): SocialPublicationMetricObservationRecord {
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
    evidence_id: "99999999-9999-4999-8999-999999999999" as SocialPublicationMetricObservationRecord["evidence_id"],
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
    ...input,
  };
}

function evidenceRecord(
  observation = observationRecord(),
): SocialPublicationMetricEvidenceRecord {
  return {
    evidence_id: observation.evidence_id!,
    metric_observation_id: observation.metric_observation_id,
    evidence_kind: "manual_note",
    notes: "Sanitized owner report.",
    evidence: { report: "sanitized" },
    external_report_reference: "report-1",
    scope: observation.scope,
    recorded_at: observation.updated_at,
    recorded_by_actor: "analytics",
    recorded_source: "publication_metrics_domain",
    contains_platform_payload: false,
    contains_secrets: false,
    contains_credentials: false,
    contains_sdk_client: false,
    contains_raw_api_response: false,
    proves_collection: false,
    append_only: true,
    immutable: true,
  };
}

function createMemoryStorage(): SocialPublicationMetricStoreStorage {
  const observations: SocialPublicationMetricObservationRow[] = [];
  const evidence: SocialPublicationMetricEvidenceRow[] = [];

  function match(row: Record<string, unknown>, filter: Record<string, string | undefined>) {
    return Object.entries(filter).every(([, value]) => value === undefined) &&
      true || Object.entries(filter).every(([key, value]) => value === undefined || row[key] === value);
  }

  return {
    async insertObservation(row) {
      observations.push(JSON.parse(JSON.stringify(row)));
      return row;
    },
    async insertEvidence(row) {
      evidence.push(JSON.parse(JSON.stringify(row)));
      return row;
    },
    async findObservationByObservationId(id) {
      return observations.find((row) => row.metric_observation_id === id) ?? null;
    },
    async findObservationByIdempotencyKey(key) {
      return observations.find((row) => row.idempotency_key === key) ?? null;
    },
    async findEvidenceByEvidenceId(id) {
      return evidence.find((row) => row.evidence_id === id) ?? null;
    },
    async findEvidenceByIdempotencyKey(key) {
      return evidence.find((row) => row.idempotency_key === key) ?? null;
    },
    async fetchObservations(filter) {
      return observations.filter((row) =>
        match(row as unknown as Record<string, unknown>, {
          metric_observation_id: filter.metricObservationId,
          metric_name: filter.metricName,
          metric_status: filter.metricStatus,
          social_post_id: filter.socialPostId,
          publication_target_id: filter.publicationTargetId,
          publication_manifest_id: filter.publicationManifestId,
        }),
      );
    },
    async fetchEvidence(filter) {
      return evidence.filter((row) =>
        match(row as unknown as Record<string, unknown>, {
          metric_observation_id: filter.metricObservationId,
          social_post_id: filter.socialPostId,
          publication_target_id: filter.publicationTargetId,
          publication_manifest_id: filter.publicationManifestId,
        }),
      );
    },
  };
}

await test("appends observations through configured storage", async () => {
  configureSocialPublicationMetricStoreTestDependencies(createMemoryStorage());
  const result = await appendSocialPublicationMetricObservation(observationRecord(), {
    idempotencyKey: "obs-1",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.metric_name, "impressions");
});

await test("rejects duplicate observation identity", async () => {
  configureSocialPublicationMetricStoreTestDependencies(createMemoryStorage());
  assert.equal((await appendSocialPublicationMetricObservation(observationRecord())).ok, true);
  const duplicate = await appendSocialPublicationMetricObservation(observationRecord());
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error.code, "duplicate_identity");
});

await test("inserts evidence only after parent observation exists", async () => {
  configureSocialPublicationMetricStoreTestDependencies(createMemoryStorage());
  const observation = observationRecord();
  const missing = await insertSocialPublicationMetricEvidence(evidenceRecord(observation));
  assert.equal(missing.ok, false);
  assert.equal(missing.error.code, "parent_missing");

  assert.equal((await appendSocialPublicationMetricObservation(observation)).ok, true);
  const inserted = await insertSocialPublicationMetricEvidence(evidenceRecord(observation));
  assert.equal(inserted.ok, true);
});

await test("fetches repository records by filter", async () => {
  configureSocialPublicationMetricStoreTestDependencies(createMemoryStorage());
  await appendSocialPublicationMetricObservation(observationRecord());
  await appendSocialPublicationMetricObservation(
    observationRecord({
      metric_observation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as SocialPublicationMetricObservationRecord["metric_observation_id"],
      metric_name: "clicks",
      metric_value: 44,
    }),
  );

  const records = await fetchSocialPublicationMetricRecords({ metricName: "clicks" });
  assert.equal(records.ok, true);
  if (!records.ok) return;
  assert.equal(records.value.observations.length, 1);
  assert.equal(records.value.observations[0]?.metric_name, "clicks");
});

await test("store source contains no collection, scheduler execution, admin route, or learning implementation", () => {
  const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "social-publication-metrics-store.ts");
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
