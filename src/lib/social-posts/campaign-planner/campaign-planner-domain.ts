import type {
  CampaignPlannerCampaign,
  CampaignPlannerCandidate,
} from "./campaign-planner-types";
import type {
  MarketingMemoryDuplicateWarning,
  MarketingMemoryHistoryItem,
  MarketingMemorySnapshot,
} from "../marketing-memory/marketing-memory-types";
import { campaignBusinessFocusMatchesSeasonal } from "../seasonal-intelligence/seasonal-intelligence-domain";
import type { SeasonalIntelligenceSnapshot } from "../seasonal-intelligence/seasonal-intelligence-types";

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function historyForCampaign(
  campaign: CampaignPlannerCampaign,
  history: readonly MarketingMemoryHistoryItem[],
): MarketingMemoryHistoryItem | null {
  return (
    history.find((item) => normalized(item.value) === normalized(campaign.label)) ??
    history.find((item) => normalized(item.value) === normalized(campaign.id)) ??
    null
  );
}

function campaignWarnings(
  campaign: CampaignPlannerCampaign,
  warnings: readonly MarketingMemoryDuplicateWarning[],
): readonly MarketingMemoryDuplicateWarning[] {
  const campaignTerms = [campaign.id, campaign.label].map(normalized);
  return warnings.filter((warning) => {
    const value = normalized(warning.value);
    return campaignTerms.some((term) => value.includes(term) || term.includes(value));
  });
}

function referenceAt<T>(values: readonly T[], index: number): T | null {
  return values.length === 0 ? null : values[index % values.length] ?? null;
}

function campaignMatchesSeasonalOpportunity(
  campaign: CampaignPlannerCampaign,
  opportunity: SeasonalIntelligenceSnapshot["activeOpportunities"][number],
): boolean {
  return opportunity.recommendedBusinessFocus.some((focus) =>
    campaignBusinessFocusMatchesSeasonal({
      campaignFocus: campaign.businessFocus,
      campaignLabel: campaign.label,
      campaignId: campaign.id,
      seasonalFocus: focus,
    }),
  );
}

/**
 * Documented Wave 7 seasonal score contract (single positive boost, single repetition penalty):
 * - active or final-call match → +4
 * - else preparation match → +2
 * - moderate/high repetition on a matched active/final-call opportunity → −2 once
 */
function seasonalPlannerGuidance(input: {
  campaign: CampaignPlannerCampaign;
  seasonal: SeasonalIntelligenceSnapshot;
}): { scoreDelta: number; reasons: string[]; cautions: string[] } {
  const reasons: string[] = [];
  const cautions: string[] = [];
  let matchedActiveOrFinalCall = false;
  let matchedPreparation = false;
  let matchedRepetition = false;

  for (const opportunity of input.seasonal.activeOpportunities) {
    if (!campaignMatchesSeasonalOpportunity(input.campaign, opportunity)) continue;

    matchedActiveOrFinalCall = true;
    reasons.push(
      `${opportunity.name} is ${opportunity.lifecycleState}; this campaign aligns with the current seasonal opportunity.`,
    );
    if (opportunity.repetitionRisk === "high" || opportunity.repetitionRisk === "moderate") {
      matchedRepetition = true;
      cautions.push(
        `${opportunity.name} has ${opportunity.repetitionRisk} seasonal repetition risk.`,
      );
    }
  }

  for (const opportunity of input.seasonal.upcomingOpportunities) {
    if (opportunity.lifecycleState !== "preparation") continue;
    if (!campaignMatchesSeasonalOpportunity(input.campaign, opportunity)) continue;
    matchedPreparation = true;
    reasons.push(`${opportunity.name} enters preparation soon; consider planning this campaign angle.`);
  }

  let scoreDelta = 0;
  if (matchedActiveOrFinalCall) {
    scoreDelta += 4;
  } else if (matchedPreparation) {
    scoreDelta += 2;
  }
  if (matchedRepetition) {
    scoreDelta -= 2;
  }

  return { scoreDelta, reasons, cautions };
}

export function planCampaignCandidate(input: {
  campaign: CampaignPlannerCampaign;
  memory: MarketingMemorySnapshot;
  seasonalIntelligence: SeasonalIntelligenceSnapshot;
  index: number;
}): Omit<CampaignPlannerCandidate, "rank"> {
  const recent = historyForCampaign(input.campaign, input.memory.campaignHistory);
  const active = historyForCampaign(input.campaign, input.memory.activeCampaigns);
  const warnings = campaignWarnings(input.campaign, input.memory.duplicateRisk);
  const reasons: string[] = [];
  const cautions: string[] = [];
  let score = 100;

  if (!recent) {
    reasons.push("No prior campaign history was found, so this campaign adds rotation.");
  } else {
    score -= Math.min(recent.count * 15, 45);
    cautions.push(`Used ${recent.count} time${recent.count === 1 ? "" : "s"} in recorded history.`);
  }

  if (active) {
    score -= 30;
    cautions.push("This campaign appears in active approved or scheduled history.");
  }

  if (warnings.length > 0) {
    score -= Math.min(warnings.length * 10, 30);
    cautions.push(`${warnings.length} related duplicate-risk warning${warnings.length === 1 ? "" : "s"} should be reviewed.`);
  }

  if (input.memory.seasonalHistory.length > 0) {
    reasons.push("Seasonal messaging exists in history; review it before selecting a related angle.");
  }
  if (input.memory.mediaHistory.length > 0) {
    reasons.push("Use a media asset not shown in recent history when practical.");
  }

  const seasonal = seasonalPlannerGuidance({
    campaign: input.campaign,
    seasonal: input.seasonalIntelligence,
  });
  score += seasonal.scoreDelta;
  reasons.push(...seasonal.reasons);
  cautions.push(...seasonal.cautions);

  if (reasons.length === 0) {
    reasons.push("Campaign rotation is based on the available read-only history.");
  }

  const status = cautions.length === 0 ? "recommended" : "review";
  return {
    campaignId: input.campaign.id,
    label: input.campaign.label,
    businessFocus: input.campaign.businessFocus,
    defaultMediaType: input.campaign.defaultMediaType,
    score: Math.max(score, 0),
    status,
    reasons,
    cautions,
    referenceGoal: referenceAt(input.campaign.goalTemplates, input.index),
    referenceCaptionAngle: referenceAt(input.campaign.captionAngles, input.index),
    referencePromptAngle: referenceAt(input.campaign.promptAngles, input.index),
    computedOnly: true,
    readOnly: true,
    authoritative: false,
  };
}
