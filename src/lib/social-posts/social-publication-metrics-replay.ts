import {
  validateSocialPublicationMetricPersistenceModel,
  type SocialPublicationMetricObservationRecord,
  type SocialPublicationMetricPersistenceModel,
} from "./social-publication-metrics-repository";

export const SOCIAL_PUBLICATION_METRIC_REPLAY_DIAGNOSTIC_CODES = [
  "persistence_validation_failed",
  "missing_evidence",
] as const;

export type SocialPublicationMetricReplayDiagnosticCode =
  (typeof SOCIAL_PUBLICATION_METRIC_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPublicationMetricReplayDiagnostic = Readonly<{
  code: SocialPublicationMetricReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPublicationMetricObservationProjection = Readonly<{
  metricObservationId: string;
  metricName: SocialPublicationMetricObservationRecord["metric_name"];
  metricStatus: SocialPublicationMetricObservationRecord["metric_status"];
  metricValue: number | null;
  aggregationType: SocialPublicationMetricObservationRecord["aggregation_type"];
  socialPostId: string;
  publicationTargetId: string;
  publisherRequestId: string | null;
  publisherResultId: string | null;
  publisherJobId: string | null;
  scheduleId: string | null;
  ledgerEntryId: string | null;
  publicationManifestId: string | null;
  evidenceId: string | null;
  missingEvidence: boolean;
  observedAt: string;
  updatedAt: string;
  computedOnly: true;
  authoritative: false;
  triggersNoPublishing: true;
  triggersNoScheduling: true;
  performsNoLearning: true;
}>;

export type SocialPublicationMetricAggregateSummary = Readonly<{
  metricName: SocialPublicationMetricObservationRecord["metric_name"];
  completedObservationCount: number;
  failedObservationCount: number;
  pendingObservationCount: number;
  valueCount: number;
  valueSum: number;
  latestValue: number | null;
  averageValue: number | null;
  computedOnly: true;
  authoritative: false;
}>;

export type SocialPublicationMetricReplaySummary = Readonly<{
  totalObservationCount: number;
  pendingObservationCount: number;
  completedObservationCount: number;
  failedObservationCount: number;
  missingEvidenceCount: number;
  sufficientEvidenceCount: number;
  aggregateCount: number;
  diagnosticCount: number;
  errorCount: number;
  computedOnly: true;
  authoritative: false;
  triggersNoPublishing: true;
  triggersNoScheduling: true;
  collectsNoMetrics: true;
  performsNoLearning: true;
}>;

export type SocialPublicationMetricReadModel = Readonly<{
  pendingObservations: readonly SocialPublicationMetricObservationProjection[];
  completedObservations: readonly SocialPublicationMetricObservationProjection[];
  failedObservations: readonly SocialPublicationMetricObservationProjection[];
  observationsMissingEvidence: readonly SocialPublicationMetricObservationProjection[];
  observationsWithSufficientEvidence: readonly SocialPublicationMetricObservationProjection[];
  aggregateSummaries: readonly SocialPublicationMetricAggregateSummary[];
  diagnostics: readonly SocialPublicationMetricReplayDiagnostic[];
  summary: SocialPublicationMetricReplaySummary;
  replayIntegrity: Readonly<{
    valid: boolean;
    deterministic: true;
    source: "publication_metrics_replay";
    computedOnly: true;
    authoritative: false;
  }>;
  computedOnly: true;
  authoritative: false;
  triggersNoPublishing: true;
  triggersNoScheduling: true;
  collectsNoMetrics: true;
  performsNoLearning: true;
}>;

export type SocialPublicationMetricReplayResult = Readonly<{
  ok: true;
  value: SocialPublicationMetricReadModel;
}>;

export function replaySocialPublicationMetrics(
  model: SocialPublicationMetricPersistenceModel,
): SocialPublicationMetricReplayResult {
  const diagnostics: SocialPublicationMetricReplayDiagnostic[] = [];
  const validation = validateSocialPublicationMetricPersistenceModel(model);
  if (!validation.ok) {
    for (const validationError of validation.errors) {
      diagnostics.push({
        code: "persistence_validation_failed",
        path: validationError.path,
        message: validationError.message,
        severity: "error",
      });
    }
  }

  const projections = validation.ok
    ? sortProjections(
        model.observations.map((observation, index) => {
          const projection = projectObservation(observation);
          if (projection.missingEvidence) {
            diagnostics.push({
              code: "missing_evidence",
              path: `observations.${index}.evidence_id`,
              message: "Completed metric observation is missing sanitized evidence.",
              severity: "warning",
            });
          }
          return projection;
        }),
      )
    : [];

  const pendingObservations = projections.filter(
    (observation) => observation.metricStatus === "pending",
  );
  const completedObservations = projections.filter(
    (observation) => observation.metricStatus === "completed",
  );
  const failedObservations = projections.filter(
    (observation) => observation.metricStatus === "failed",
  );
  const observationsMissingEvidence = projections.filter(
    (observation) => observation.missingEvidence,
  );
  const observationsWithSufficientEvidence = projections.filter(
    (observation) => !observation.missingEvidence,
  );
  const aggregateSummaries = summarizeAggregates(projections);
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error")
    .length;

  return {
    ok: true,
    value: deepFreeze({
      pendingObservations,
      completedObservations,
      failedObservations,
      observationsMissingEvidence,
      observationsWithSufficientEvidence,
      aggregateSummaries,
      diagnostics,
      summary: {
        totalObservationCount: projections.length,
        pendingObservationCount: pendingObservations.length,
        completedObservationCount: completedObservations.length,
        failedObservationCount: failedObservations.length,
        missingEvidenceCount: observationsMissingEvidence.length,
        sufficientEvidenceCount: observationsWithSufficientEvidence.length,
        aggregateCount: aggregateSummaries.length,
        diagnosticCount: diagnostics.length,
        errorCount,
        computedOnly: true,
        authoritative: false,
        triggersNoPublishing: true,
        triggersNoScheduling: true,
        collectsNoMetrics: true,
        performsNoLearning: true,
      },
      replayIntegrity: {
        valid: errorCount === 0,
        deterministic: true,
        source: "publication_metrics_replay",
        computedOnly: true,
        authoritative: false,
      },
      computedOnly: true,
      authoritative: false,
      triggersNoPublishing: true,
      triggersNoScheduling: true,
      collectsNoMetrics: true,
      performsNoLearning: true,
    }),
  };
}

function projectObservation(
  observation: SocialPublicationMetricObservationRecord,
): SocialPublicationMetricObservationProjection {
  const missingEvidence =
    observation.metric_status === "completed" && !observation.evidence_id;
  return {
    metricObservationId: observation.metric_observation_id,
    metricName: observation.metric_name,
    metricStatus: observation.metric_status,
    metricValue: observation.metric_value,
    aggregationType: observation.aggregation_type,
    socialPostId: observation.scope.social_post_id,
    publicationTargetId: observation.scope.publication_target_id,
    publisherRequestId: observation.scope.publisher_request_id,
    publisherResultId: observation.scope.publisher_result_id,
    publisherJobId: observation.scope.publisher_job_id,
    scheduleId: observation.scope.schedule_id,
    ledgerEntryId: observation.scope.ledger_entry_id,
    publicationManifestId: observation.scope.publication_manifest_id,
    evidenceId: observation.evidence_id,
    missingEvidence,
    observedAt: observation.observed_at,
    updatedAt: observation.updated_at,
    computedOnly: true,
    authoritative: false,
    triggersNoPublishing: true,
    triggersNoScheduling: true,
    performsNoLearning: true,
  };
}

function summarizeAggregates(
  projections: readonly SocialPublicationMetricObservationProjection[],
): readonly SocialPublicationMetricAggregateSummary[] {
  const byMetric = new Map<
    SocialPublicationMetricObservationRecord["metric_name"],
    SocialPublicationMetricObservationProjection[]
  >();
  for (const projection of projections) {
    const current = byMetric.get(projection.metricName) ?? [];
    current.push(projection);
    byMetric.set(projection.metricName, current);
  }

  return deepFreeze(
    [...byMetric.entries()]
      .map(([metricName, metricProjections]) => {
        const completed = metricProjections.filter(
          (projection) => projection.metricStatus === "completed",
        );
        const values = completed
          .map((projection) => projection.metricValue)
          .filter((value): value is number => typeof value === "number");
        const valueSum = values.reduce((sum, value) => sum + value, 0);
        const latest = completed
          .filter((projection) => typeof projection.metricValue === "number")
          .sort((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt))[0];
        const summary: SocialPublicationMetricAggregateSummary = {
          metricName,
          completedObservationCount: completed.length,
          failedObservationCount: metricProjections.filter(
            (projection) => projection.metricStatus === "failed",
          ).length,
          pendingObservationCount: metricProjections.filter(
            (projection) => projection.metricStatus === "pending",
          ).length,
          valueCount: values.length,
          valueSum,
          latestValue: latest?.metricValue ?? null,
          averageValue: values.length > 0 ? valueSum / values.length : null,
          computedOnly: true,
          authoritative: false,
        };
        return summary;
      })
      .sort((left, right) => left.metricName.localeCompare(right.metricName)),
  );
}

function sortProjections(
  projections: readonly SocialPublicationMetricObservationProjection[],
): readonly SocialPublicationMetricObservationProjection[] {
  return deepFreeze(
    [...projections].sort((left, right) => {
      const observed = Date.parse(left.observedAt) - Date.parse(right.observedAt);
      if (observed !== 0) return observed;
      return left.metricObservationId.localeCompare(right.metricObservationId);
    }),
  );
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return value;
}
