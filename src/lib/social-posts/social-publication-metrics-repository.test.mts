import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createReferenceSocialPublicationMetricRepository,
  metricObservationToRecord,
  metricRecordToObservation,
  validateSocialPublicationMetricObservationRecord,
  validateSocialPublicationMetricPersistenceModel,
  type SocialPublicationMetricObservationRecord,
} from "./social-publication-metrics-repository";
import * as repositoryExports from "./social-publication-metrics-repository";

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

await test("validates metric observation records", () => {
  const result = validateSocialPublicationMetricObservationRecord(record());
  assert.equal(result.ok, true);
});

await test("validates persistence model identity uniqueness", () => {
  const result = validateSocialPublicationMetricPersistenceModel({
    observations: [record(), record()],
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "identity_not_separated"), true);
});

await test("rejects invalid record invariants", () => {
  const result = validateSocialPublicationMetricObservationRecord(
    record({ collects_no_metrics: false as true }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "contract_invariant_failed"), true);
});

await test("maps domain observations to records and back", () => {
  const mapped = metricObservationToRecord({
    observationId: "metric-observation-2",
    observationType: "publication_metric_observation",
    metricName: "clicks",
    metricStatus: "completed",
    metricValue: 42,
    aggregationType: "sum",
    source: "manual_observation",
    references: {
      socialPostId: "social-post-1",
      publicationTargetId: "target-facebook-page-1",
      publisherRequestId: null,
      publisherResultId: null,
      publisherJobId: null,
      scheduleId: "schedule-1",
      ledgerEntryId: null,
      publicationManifestId: "manifest-1",
      ownerApprovalId: null,
      approvalId: null,
      proposalId: null,
    },
    evidence: null,
    observedAt: "2026-07-01T12:00:00.000Z",
    createdAt: "2026-07-01T12:01:00.000Z",
    updatedAt: "2026-07-01T12:01:00.000Z",
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
  });
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  assert.equal(mapped.value.metric_name, "clicks");
  const hydrated = metricRecordToObservation(mapped.value);
  assert.equal(hydrated.ok, true);
  if (!hydrated.ok) return;
  assert.equal(hydrated.value.metricName, "clicks");
});

await test("reference repository appends and filters records", () => {
  const repository = createReferenceSocialPublicationMetricRepository();
  const first = repository.appendMetricObservation({ observation: record() });
  const second = repository.appendMetricObservation({
    observation: record({
      metric_observation_id: "metric-observation-2" as SocialPublicationMetricObservationRecord["metric_observation_id"],
      metric_name: "clicks",
      metric_value: 42,
    }),
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);

  const filtered = repository.listMetricObservations({ metric_name: "clicks" });
  assert.equal(filtered.ok, true);
  if (!filtered.ok) return;
  assert.equal(filtered.value.length, 1);
  assert.equal(filtered.value[0]?.metric_observation_id, "metric-observation-2");
});

await test("reference repository rejects duplicate identities", () => {
  const repository = createReferenceSocialPublicationMetricRepository();
  assert.equal(repository.appendMetricObservation({ observation: record() }).ok, true);
  const duplicate = repository.appendMetricObservation({ observation: record() });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error.code, "identity_collision");
});

await test("exports no store, bridge, SQL, Supabase, or API surface", () => {
  const forbidden = [
    "createSocialPublicationMetricStore",
    "createSocialPublicationMetricBridge",
    "createMetricAdminPage",
    "createMetricRoute",
    "insertMetricObservation",
  ];
  for (const name of forbidden) {
    assert.equal(Object.prototype.hasOwnProperty.call(repositoryExports, name), false);
  }
});

await test("repository source contains no SQL, Supabase, bridge, admin, or network", () => {
  const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "social-publication-metrics-repository.ts");
  const source = readFileSync(sourcePath, "utf8");
  const forbidden = [
    "from(",
    "insert(",
    "createClient(",
    "supabase",
    "fetch(",
    "NextRequest",
    "admin/social-posts",
    "createSocialPublicationMetricBridge",
  ];
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `source must not include ${token}`);
  }
});
