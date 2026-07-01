import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  hydratePublicationMetricObservation,
  serializePublicationMetricObservation,
  sortPublicationMetricObservations,
  validatePublicationMetricObservation,
  type PublicationMetricObservation,
} from "./social-publication-metrics";
import * as metricsExports from "./social-publication-metrics";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function observation(input: Partial<PublicationMetricObservation> = {}): PublicationMetricObservation {
  return {
    observationId: "metric-observation-1",
    observationType: "publication_metric_observation",
    metricName: "impressions",
    metricStatus: "completed",
    metricValue: 1200,
    aggregationType: "sum",
    source: "manual_observation",
    references: {
      socialPostId: "social-post-1",
      publicationTargetId: "target-facebook-page-1",
      publisherRequestId: "publisher-request-1",
      publisherResultId: "publisher-result-1",
      publisherJobId: "publisher-job-1",
      scheduleId: "schedule-1",
      ledgerEntryId: "ledger-entry-1",
      publicationManifestId: "manifest-1",
      ownerApprovalId: "owner-approval-1",
      approvalId: "approval-1",
      proposalId: "proposal-1",
    },
    evidence: {
      evidenceId: "metric-evidence-1",
      evidenceKind: "manual_note",
      evidence: { report: "sanitized weekly owner report" },
      notes: "Manual observation copied from sanitized report.",
      externalReportReference: "owner-report-2026-07-01",
      containsPlatformPayload: false,
      containsSecrets: false,
      containsCredentials: false,
      containsSdkClient: false,
      containsRawApiResponse: false,
      provesCollection: false,
    },
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
    ...input,
  };
}

await test("validates passive metric observations", () => {
  const result = validatePublicationMetricObservation(observation());
  assert.equal(result.ok, true);
});

await test("requires completed observations to carry numeric values", () => {
  const result = validatePublicationMetricObservation(
    observation({ metricValue: null }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "value_invalid"), true);
});

await test("requires pending observations to omit values", () => {
  const result = validatePublicationMetricObservation(
    observation({ metricStatus: "pending", metricValue: 4 }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "value_invalid"), true);
});

await test("rejects platform payloads and credentials", () => {
  const result = validatePublicationMetricObservation(
    observation({
      evidence: {
        evidenceId: "metric-evidence-1",
        evidenceKind: "manual_note",
        evidence: { rawMetrics: { impressions: 1 }, accessToken: "secret" },
        notes: null,
        externalReportReference: null,
        containsPlatformPayload: false,
        containsSecrets: false,
        containsCredentials: false,
        containsSdkClient: false,
        containsRawApiResponse: false,
        provesCollection: false,
      },
    }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "platform_payload_forbidden"), true);
  assert.equal(result.errors.some((error) => error.code === "secret_forbidden"), true);
});

await test("rejects execution, collection, and learning state", () => {
  const result = validatePublicationMetricObservation(
    observation({
      evidence: {
        evidenceId: "metric-evidence-1",
        evidenceKind: "manual_note",
        evidence: { fetch: "https://example.invalid", queue: "metrics", learning: true },
        notes: null,
        externalReportReference: null,
        containsPlatformPayload: false,
        containsSecrets: false,
        containsCredentials: false,
        containsSdkClient: false,
        containsRawApiResponse: false,
        provesCollection: false,
      },
    }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "network_forbidden"), true);
  assert.equal(result.errors.some((error) => error.code === "execution_forbidden"), true);
  assert.equal(result.errors.some((error) => error.code === "learning_state_forbidden"), true);
});

await test("serializes and hydrates validated observations", () => {
  const serialized = serializePublicationMetricObservation(observation());
  const hydrated = hydratePublicationMetricObservation(serialized);
  assert.equal(hydrated.observationId, "metric-observation-1");
  assert.equal(Object.isFrozen(hydrated), true);
});

await test("sorts observations by observed time and identity", () => {
  const sorted = sortPublicationMetricObservations([
    observation({ observationId: "metric-observation-2", observedAt: "2026-07-01T13:00:00.000Z" }),
    observation({ observationId: "metric-observation-1", observedAt: "2026-07-01T13:00:00.000Z" }),
    observation({ observationId: "metric-observation-3", observedAt: "2026-07-01T12:00:00.000Z" }),
  ]);
  assert.deepEqual(
    sorted.map((entry) => entry.observationId),
    ["metric-observation-3", "metric-observation-1", "metric-observation-2"],
  );
});

await test("exports no forbidden execution or integration functions", () => {
  const forbidden = [
    "collectMetrics",
    "fetchMetrics",
    "publishMetrics",
    "scheduleMetricsCollection",
    "createMetricBridge",
    "createMetricStore",
  ];
  for (const name of forbidden) {
    assert.equal(Object.prototype.hasOwnProperty.call(metricsExports, name), false);
  }
});

await test("source contains no network, SDK, SQL, bridge, admin, or API route integration", () => {
  const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "social-publication-metrics.ts");
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
  ];
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `source must not include ${token}`);
  }
});
