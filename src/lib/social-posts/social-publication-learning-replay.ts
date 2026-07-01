import {
  validateSocialPublicationLearningPersistenceModel,
  type SocialPublicationLearningInsightRecord,
  type SocialPublicationLearningPersistenceModel,
} from "./social-publication-learning-repository";

export const SOCIAL_PUBLICATION_LEARNING_REPLAY_DIAGNOSTIC_CODES = [
  "persistence_validation_failed",
  "missing_evidence",
] as const;

export type SocialPublicationLearningReplayDiagnosticCode =
  (typeof SOCIAL_PUBLICATION_LEARNING_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPublicationLearningReplayDiagnostic = Readonly<{
  code: SocialPublicationLearningReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPublicationLearningInsightProjection = Readonly<{
  learningInsightId: string;
  candidateType: SocialPublicationLearningInsightRecord["candidate_type"];
  insightStatus: SocialPublicationLearningInsightRecord["insight_status"];
  confidenceScore: number | null;
  confidenceLevel: SocialPublicationLearningInsightRecord["confidence_level"];
  socialPostId: string | null;
  publicationTargetId: string | null;
  campaignId: string | null;
  metricObservationId: string | null;
  campaignMemoryId: string | null;
  decisionHistoryId: string | null;
  evidenceId: string | null;
  missingEvidence: boolean;
  rationale: string;
  blockedReason: string | null;
  rejectedReason: string | null;
  observedAt: string;
  updatedAt: string;
  computedOnly: true;
  authoritative: false;
  triggersNoPromotion: true;
  triggersNoApproval: true;
  triggersNoScheduling: true;
  triggersNoPublishing: true;
}>;

export type SocialPublicationLearningGroupSummary = Readonly<{
  groupKey: string;
  candidateCount: number;
  blockedCount: number;
  acceptedForReviewCount: number;
  rejectedCount: number;
  missingEvidenceCount: number;
  averageConfidenceScore: number | null;
  computedOnly: true;
  authoritative: false;
}>;

export type SocialPublicationLearningReplaySummary = Readonly<{
  totalInsightCount: number;
  candidateCount: number;
  blockedCount: number;
  acceptedForReviewCount: number;
  rejectedCount: number;
  missingEvidenceCount: number;
  sufficientEvidenceCount: number;
  candidateTypeSummaryCount: number;
  campaignSummaryCount: number;
  socialPostSummaryCount: number;
  diagnosticCount: number;
  errorCount: number;
  computedOnly: true;
  authoritative: false;
  triggersNoPromotion: true;
  triggersNoApproval: true;
  triggersNoScheduling: true;
  triggersNoPublishing: true;
  performsNoModelTraining: true;
}>;

export type SocialPublicationLearningReadModel = Readonly<{
  candidateInsights: readonly SocialPublicationLearningInsightProjection[];
  blockedInsights: readonly SocialPublicationLearningInsightProjection[];
  acceptedForReviewInsights: readonly SocialPublicationLearningInsightProjection[];
  rejectedInsights: readonly SocialPublicationLearningInsightProjection[];
  insightsMissingEvidence: readonly SocialPublicationLearningInsightProjection[];
  insightsWithSufficientEvidence: readonly SocialPublicationLearningInsightProjection[];
  summariesByCandidateType: readonly SocialPublicationLearningGroupSummary[];
  summariesByCampaign: readonly SocialPublicationLearningGroupSummary[];
  summariesBySocialPost: readonly SocialPublicationLearningGroupSummary[];
  diagnostics: readonly SocialPublicationLearningReplayDiagnostic[];
  summary: SocialPublicationLearningReplaySummary;
  replayIntegrity: Readonly<{
    valid: boolean;
    deterministic: true;
    source: "publication_learning_replay";
    computedOnly: true;
    authoritative: false;
  }>;
  computedOnly: true;
  authoritative: false;
  triggersNoPromotion: true;
  triggersNoApproval: true;
  triggersNoScheduling: true;
  triggersNoPublishing: true;
  performsNoModelTraining: true;
}>;

export type SocialPublicationLearningReplayResult = Readonly<{
  ok: true;
  value: SocialPublicationLearningReadModel;
}>;

export function replaySocialPublicationLearning(
  model: SocialPublicationLearningPersistenceModel,
): SocialPublicationLearningReplayResult {
  const diagnostics: SocialPublicationLearningReplayDiagnostic[] = [];
  const validation = validateSocialPublicationLearningPersistenceModel(model);
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
        model.insights.map((insight, index) => {
          const projection = projectInsight(insight);
          if (projection.missingEvidence) {
            diagnostics.push({
              code: "missing_evidence",
              path: `insights.${index}.evidence_id`,
              message: "Learning insight is missing sanitized evidence.",
              severity: "warning",
            });
          }
          return projection;
        }),
      )
    : [];

  const candidateInsights = projections.filter((insight) => insight.insightStatus === "candidate");
  const blockedInsights = projections.filter((insight) => insight.insightStatus === "blocked");
  const acceptedForReviewInsights = projections.filter(
    (insight) => insight.insightStatus === "accepted_for_review",
  );
  const rejectedInsights = projections.filter((insight) => insight.insightStatus === "rejected");
  const insightsMissingEvidence = projections.filter((insight) => insight.missingEvidence);
  const insightsWithSufficientEvidence = projections.filter((insight) => !insight.missingEvidence);

  const summariesByCandidateType = summarizeByGroup(projections, (insight) => insight.candidateType);
  const summariesByCampaign = summarizeByGroup(projections, (insight) => insight.campaignId);
  const summariesBySocialPost = summarizeByGroup(projections, (insight) => insight.socialPostId);

  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;

  return {
    ok: true,
    value: deepFreeze({
      candidateInsights,
      blockedInsights,
      acceptedForReviewInsights,
      rejectedInsights,
      insightsMissingEvidence,
      insightsWithSufficientEvidence,
      summariesByCandidateType,
      summariesByCampaign,
      summariesBySocialPost,
      diagnostics,
      summary: {
        totalInsightCount: projections.length,
        candidateCount: candidateInsights.length,
        blockedCount: blockedInsights.length,
        acceptedForReviewCount: acceptedForReviewInsights.length,
        rejectedCount: rejectedInsights.length,
        missingEvidenceCount: insightsMissingEvidence.length,
        sufficientEvidenceCount: insightsWithSufficientEvidence.length,
        candidateTypeSummaryCount: summariesByCandidateType.length,
        campaignSummaryCount: summariesByCampaign.length,
        socialPostSummaryCount: summariesBySocialPost.length,
        diagnosticCount: diagnostics.length,
        errorCount,
        computedOnly: true,
        authoritative: false,
        triggersNoPromotion: true,
        triggersNoApproval: true,
        triggersNoScheduling: true,
        triggersNoPublishing: true,
        performsNoModelTraining: true,
      },
      replayIntegrity: {
        valid: errorCount === 0,
        deterministic: true,
        source: "publication_learning_replay",
        computedOnly: true,
        authoritative: false,
      },
      computedOnly: true,
      authoritative: false,
      triggersNoPromotion: true,
      triggersNoApproval: true,
      triggersNoScheduling: true,
      triggersNoPublishing: true,
      performsNoModelTraining: true,
    }),
  };
}

function projectInsight(
  insight: SocialPublicationLearningInsightRecord,
): SocialPublicationLearningInsightProjection {
  const missingEvidence = !insight.evidence_id;
  return {
    learningInsightId: insight.learning_insight_id,
    candidateType: insight.candidate_type,
    insightStatus: insight.insight_status,
    confidenceScore: insight.confidence_score,
    confidenceLevel: insight.confidence_level,
    socialPostId: insight.scope.social_post_id,
    publicationTargetId: insight.scope.publication_target_id,
    campaignId: insight.scope.campaign_id,
    metricObservationId: insight.scope.metric_observation_id,
    campaignMemoryId: insight.scope.campaign_memory_id,
    decisionHistoryId: insight.scope.decision_history_id,
    evidenceId: insight.evidence_id,
    missingEvidence,
    rationale: insight.rationale,
    blockedReason: insight.blocked_reason,
    rejectedReason: insight.rejected_reason,
    observedAt: insight.observed_at,
    updatedAt: insight.updated_at,
    computedOnly: true,
    authoritative: false,
    triggersNoPromotion: true,
    triggersNoApproval: true,
    triggersNoScheduling: true,
    triggersNoPublishing: true,
  };
}

function summarizeByGroup(
  projections: readonly SocialPublicationLearningInsightProjection[],
  keySelector: (insight: SocialPublicationLearningInsightProjection) => string | null,
): readonly SocialPublicationLearningGroupSummary[] {
  const byGroup = new Map<string, SocialPublicationLearningInsightProjection[]>();
  for (const projection of projections) {
    const key = keySelector(projection);
    if (key === null) continue;
    const current = byGroup.get(key) ?? [];
    current.push(projection);
    byGroup.set(key, current);
  }

  return deepFreeze(
    [...byGroup.entries()]
      .map(([groupKey, groupProjections]) => {
        const scores = groupProjections
          .map((projection) => projection.confidenceScore)
          .filter((score): score is number => typeof score === "number");
        const summary: SocialPublicationLearningGroupSummary = {
          groupKey,
          candidateCount: groupProjections.filter((p) => p.insightStatus === "candidate").length,
          blockedCount: groupProjections.filter((p) => p.insightStatus === "blocked").length,
          acceptedForReviewCount: groupProjections.filter(
            (p) => p.insightStatus === "accepted_for_review",
          ).length,
          rejectedCount: groupProjections.filter((p) => p.insightStatus === "rejected").length,
          missingEvidenceCount: groupProjections.filter((p) => p.missingEvidence).length,
          averageConfidenceScore:
            scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
          computedOnly: true,
          authoritative: false,
        };
        return summary;
      })
      .sort((left, right) => left.groupKey.localeCompare(right.groupKey)),
  );
}

function sortProjections(
  projections: readonly SocialPublicationLearningInsightProjection[],
): readonly SocialPublicationLearningInsightProjection[] {
  return deepFreeze(
    [...projections].sort((left, right) => {
      const observed = Date.parse(left.observedAt) - Date.parse(right.observedAt);
      if (observed !== 0) return observed;
      return left.learningInsightId.localeCompare(right.learningInsightId);
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
