import type { AssetIntelligenceSnapshot } from "../asset-intelligence/asset-intelligence-types";
import type { MarketingMemorySnapshot } from "../marketing-memory/marketing-memory-types";
import type { SeasonalIntelligenceSnapshot } from "../seasonal-intelligence/seasonal-intelligence-types";

export type CampaignPlannerCampaign = Readonly<{
  id: string;
  label: string;
  description: string;
  businessFocus: "rentals" | "facility-parties" | "both";
  defaultMediaType: "image" | "video";
  goalTemplates: readonly string[];
  captionAngles: readonly string[];
  promptAngles: readonly string[];
}>;

export type CampaignPlannerCandidate = Readonly<{
  campaignId: string;
  label: string;
  businessFocus: CampaignPlannerCampaign["businessFocus"];
  defaultMediaType: CampaignPlannerCampaign["defaultMediaType"];
  score: number;
  rank: number;
  status: "recommended" | "review";
  reasons: readonly string[];
  cautions: readonly string[];
  referenceGoal: string | null;
  referenceCaptionAngle: string | null;
  referencePromptAngle: string | null;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
}>;

export type CampaignPlannerInput = Readonly<{
  campaigns: readonly CampaignPlannerCampaign[];
  marketingMemory: MarketingMemorySnapshot;
  seasonalIntelligence?: SeasonalIntelligenceSnapshot;
  assetIntelligence?: AssetIntelligenceSnapshot;
  generatedAt?: string;
}>;

export type CampaignPlannerSnapshot = Readonly<{
  generatedAt: string;
  candidates: readonly CampaignPlannerCandidate[];
  recommendedCandidates: readonly CampaignPlannerCandidate[];
  reviewCandidates: readonly CampaignPlannerCandidate[];
  summary: Readonly<{
    campaignCount: number;
    recommendedCount: number;
    reviewCount: number;
    duplicateRiskCount: number;
    activeSeasonalOpportunityCount: number;
    readyAssetCampaignCount: number;
  }>;
  seasonalIntelligence: SeasonalIntelligenceSnapshot;
  assetIntelligence: AssetIntelligenceSnapshot;
  constraints: Readonly<{
    readOnly: true;
    deterministic: true;
    performsNoWrites: true;
    performsNoNetworkCalls: true;
    createsNoDrafts: true;
    schedulesNothing: true;
    publishesNothing: true;
    authoritative: false;
  }>;
}>;
