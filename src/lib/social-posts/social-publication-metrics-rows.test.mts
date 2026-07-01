import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  mapPublicationMetricObservationToRows,
  mapSocialPublicationMetricObservationRecordToRow,
  mapSocialPublicationMetricObservationRowToRecord,
  mapSocialPublicationMetricRowToDomain,
  mapSocialPublicationMetricRowsToRepositoryModel,
  validateSocialPublicationMetricObservationRow,
  validateSocialPublicationMetricRowsModel,
  type SocialPublicationMetricObservationRow,
} from "./social-publication-metrics-rows";
import type { PublicationMetricObservation } from "./social-publication-metrics";
import type { SocialPublicationMetricObservationRecord } from "./social-publication-metrics-repository";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function record(): SocialPublicationMetricObservationRecord {
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
      publisher_request_id: "44444444-4444-4444-8444-444444444444" as SocialPublicationMetricObservationRecord["scope"]["publisher_request_id"],
      publisher_result_id: null,
      publisher_job_id: "55555555-5555-4555-8555-555555555555" as SocialPublicationMetricObservationRecord["scope"]["publisher_job_id"],
      schedule_id: "66666666-6666-4666-8666-666666666666" as SocialPublicationMetricObservationRecord["scope"]["schedule_id"],
      ledger_entry_id: "77777777-7777-4777-8777-777777777777" as SocialPublicationMetricObservationRecord["scope"]["ledger_entry_id"],
      publication_manifest_id: "manifest-1" as SocialPublicationMetricObservationRecord["scope"]["publication_manifest_id"],
      owner_approval_id: "88888888-8888-4888-8888-888888888888" as SocialPublicationMetricObservationRecord["scope"]["owner_approval_id"],
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
  };
}

function observation(): PublicationMetricObservation {
  return {
    observationId: "11111111-1111-4111-8111-111111111111",
    observationType: "publication_metric_observation",
    metricName: "clicks",
    metricStatus: "completed",
    metricValue: 42,
    aggregationType: "sum",
    source: "manual_observation",
    references: {
      socialPostId: "22222222-2222-4222-8222-222222222222",
      publicationTargetId: "33333333-3333-4333-8333-333333333333",
      publisherRequestId: null,
      publisherResultId: null,
      publisherJobId: null,
      scheduleId: null,
      ledgerEntryId: null,
      publicationManifestId: "manifest-1",
      ownerApprovalId: null,
      approvalId: null,
      proposalId: null,
    },
    evidence: {
      evidenceId: "99999999-9999-4999-8999-999999999999",
      evidenceKind: "manual_note",
      evidence: { report: "sanitized" },
      notes: "Sanitized manual observation.",
      externalReportReference: "report-1",
      containsPlatformPayload: false,
      containsSecrets: false,
      containsCredentials: false,
      containsSdkClient: false,
      containsRawApiResponse: false,
      provesCollection: false,
    },
    observedAt: "2026-07-01T12:00:00.000Z",
    createdAt: "2026-07-01T12:01:00.000Z",
    updatedAt: "2026-07-01T12:02:00.000Z",
    passiveOnly: true,
    observationOnly: true,
    computedOnly: false,
    authoritative: false,
    referencesOnly: true,
    containsPlatformPayload: false,
    collectsNoMetrics: true,
    callsNoExternalApis: true,
    usesNoSdks: true,
    usesNoNetwork: true,
    executesNothing: true,
    publishesNothing: true,
    schedulesNothing: true,
    mutatesNoScheduler: true,
    mutatesNoPublisher: true,
    mutatesNoLedger: true,
    mutatesNoApproval: true,
    mutatesNoManifest: true,
    mutatesNoTargets: true,
    persistsNothing: true,
    exposesNoBridge: true,
    exposesNoAdminUi: true,
    exposesNoApiRoutes: true,
    performsNoLearning: true,
  };
}

await test("maps metric observation records to rows and back", () => {
  const row = mapSocialPublicationMetricObservationRecordToRow(record(), {
    idempotency_key: "metric-observation-1",
  });
  assert.equal(row.ok, true);
  if (!row.ok) return;
  assert.equal(row.value.collects_no_metrics, true);
  assert.equal(row.value.idempotency_key, "metric-observation-1");

  const mapped = mapSocialPublicationMetricObservationRowToRecord(row.value);
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  assert.equal(mapped.value.metric_name, "impressions");
  assert.equal(mapped.value.scope.publisher_request_id, "44444444-4444-4444-8444-444444444444");
});

await test("maps domain observations to observation and evidence rows", () => {
  const mapped = mapPublicationMetricObservationToRows(observation());
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  assert.equal(mapped.value.observation.metric_name, "clicks");
  assert.equal(mapped.value.evidence?.evidence_kind, "manual_note");
  assert.equal(mapped.value.evidence?.contains_raw_api_response, false);

  const domain = mapSocialPublicationMetricRowToDomain(
    mapped.value.observation,
    mapped.value.evidence,
  );
  assert.equal(domain.ok, true);
  if (!domain.ok) return;
  assert.equal(domain.value.evidence?.externalReportReference, "report-1");
});

await test("rejects forbidden platform payloads", () => {
  const mapped = mapSocialPublicationMetricObservationRecordToRow(record());
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  const unsafe = {
    ...mapped.value,
    evidence: { rawMetrics: { impressions: 1 } },
  } as unknown as SocialPublicationMetricObservationRow;
  const validation = validateSocialPublicationMetricObservationRow(unsafe);
  assert.equal(validation.ok, false);
  assert.equal(validation.errors.some((error) => error.code === "platform_payload_forbidden"), true);
});

await test("rejects mutation and execution state", () => {
  const mapped = mapSocialPublicationMetricObservationRecordToRow(record());
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  const unsafe = {
    ...mapped.value,
    mutateScheduler: true,
    queue: "metrics",
  } as unknown as SocialPublicationMetricObservationRow;
  const validation = validateSocialPublicationMetricObservationRow(unsafe);
  assert.equal(validation.ok, false);
  assert.equal(validation.errors.some((error) => error.code === "lower_layer_mutation_forbidden"), true);
  assert.equal(validation.errors.some((error) => error.code === "execution_forbidden"), true);
});

await test("maps rows model to repository model", () => {
  const row = mapSocialPublicationMetricObservationRecordToRow(record());
  assert.equal(row.ok, true);
  if (!row.ok) return;
  const validation = validateSocialPublicationMetricRowsModel({
    observations: [row.value],
    evidence: [],
  });
  assert.equal(validation.ok, true);

  const mapped = mapSocialPublicationMetricRowsToRepositoryModel({
    observations: [row.value],
    evidence: [],
  });
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  assert.equal(mapped.value.observations.length, 1);
});

await test("row source contains no collection, network, bridge, admin, or API route implementation", () => {
  const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "social-publication-metrics-rows.ts");
  const source = readFileSync(sourcePath, "utf8");
  for (const token of [
    "fetch(",
    "createClient(",
    ".from(",
    "NextRequest",
    "admin/social-posts",
    "collectMetrics",
    "createSocialPublicationMetricsBridge",
  ]) {
    assert.equal(source.includes(token), false, `source must not include ${token}`);
  }
});
