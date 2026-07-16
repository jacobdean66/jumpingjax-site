import type { SocialCampaign } from "../social-campaigns";
import type { SocialPost } from "../social-post-data";
import { replayMarketingMemory } from "../marketing-memory/marketing-memory-replay";
import { replaySeasonalIntelligence } from "../seasonal-intelligence/seasonal-intelligence-replay";
import { buildCampaignPlanner } from "./campaign-planner-service";
import type {
  CampaignPlannerCampaign,
  CampaignPlannerSnapshot,
} from "./campaign-planner-types";

function plannerCampaign(campaign: SocialCampaign): CampaignPlannerCampaign {
  return {
    id: campaign.id,
    label: campaign.label,
    description: campaign.description,
    businessFocus: campaign.businessFocus,
    defaultMediaType: campaign.defaultMediaType,
    goalTemplates: campaign.goalTemplates,
    captionAngles: campaign.captionAngles,
    promptAngles: campaign.promptAngles,
  };
}

export function replayCampaignPlanner(input: {
  posts: readonly SocialPost[];
  campaigns: readonly SocialCampaign[];
  generatedAt?: string;
}): CampaignPlannerSnapshot {
  const marketingMemory = replayMarketingMemory({
    posts: input.posts,
    campaigns: input.campaigns,
    generatedAt: input.generatedAt,
  });
  const seasonalIntelligence = replaySeasonalIntelligence({
    marketingMemory,
    asOf: input.generatedAt,
  });
  return buildCampaignPlanner({
    campaigns: input.campaigns.map(plannerCampaign),
    marketingMemory,
    seasonalIntelligence,
    generatedAt: input.generatedAt,
  });
}
