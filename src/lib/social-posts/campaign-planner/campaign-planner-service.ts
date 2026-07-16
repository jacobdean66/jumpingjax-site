import { emptySeasonalIntelligenceSnapshot } from "../seasonal-intelligence/seasonal-intelligence-service";
import { planCampaignCandidate } from "./campaign-planner-domain";
import type {
  CampaignPlannerCandidate,
  CampaignPlannerInput,
  CampaignPlannerSnapshot,
} from "./campaign-planner-types";

export function buildCampaignPlanner(
  input: CampaignPlannerInput,
): CampaignPlannerSnapshot {
  const generatedAt = input.generatedAt ?? input.marketingMemory.generatedAt;
  const seasonalIntelligence =
    input.seasonalIntelligence ?? emptySeasonalIntelligenceSnapshot(generatedAt);

  const candidates = input.campaigns
    .map((campaign, index) => planCampaignCandidate({
      campaign,
      memory: input.marketingMemory,
      seasonalIntelligence,
      index,
    }))
    .sort((left, right) =>
      right.score - left.score ||
      left.label.localeCompare(right.label) ||
      left.campaignId.localeCompare(right.campaignId),
    )
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
    })) as readonly CampaignPlannerCandidate[];

  const recommendedCandidates = candidates.filter(
    (candidate) => candidate.status === "recommended",
  );
  const reviewCandidates = candidates.filter(
    (candidate) => candidate.status === "review",
  );

  return deepFreeze({
    generatedAt,
    candidates,
    seasonalIntelligence,
    recommendedCandidates,
    reviewCandidates,
    summary: {
      campaignCount: candidates.length,
      recommendedCount: recommendedCandidates.length,
      reviewCount: reviewCandidates.length,
      duplicateRiskCount: input.marketingMemory.duplicateRisk.length,
      activeSeasonalOpportunityCount: seasonalIntelligence.activeOpportunities.length,
    },
    constraints: {
      readOnly: true,
      deterministic: true,
      performsNoWrites: true,
      performsNoNetworkCalls: true,
      createsNoDrafts: true,
      schedulesNothing: true,
      publishesNothing: true,
      authoritative: false,
    },
  });
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
