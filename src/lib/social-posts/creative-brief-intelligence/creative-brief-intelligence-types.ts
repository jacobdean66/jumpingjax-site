import type { AssetCampaignAssessment } from "../asset-intelligence/asset-intelligence-types";
import type {
  CampaignPlannerCampaign,
  CampaignPlannerCandidate,
  CampaignPlannerSnapshot,
} from "../campaign-planner/campaign-planner-types";
import type { SocialMediaPlacement } from "../social-media-format-specs";
import type { SeasonalOpportunityEvaluation } from "../seasonal-intelligence/seasonal-intelligence-types";

export type CreativeBriefReadiness =
  | "ready"
  | "needs-assets"
  | "needs-facts"
  | "needs-review"
  | "blocked"
  | "unknown";

export type CreativeBriefContentFormat =
  | "still-image"
  | "short-video"
  | "carousel"
  | "story"
  | "reel"
  | "unknown";

export type CreativeBriefRequiredAsset = Readonly<{
  kind:
    | "video"
    | "still-image"
    | "square"
    | "portrait-reel"
    | "landscape"
    | "testimonial"
    | "alternate-aspect-ratio"
    | "refresh";
  message: string;
}>;

export type CreativeBriefAuthoritativePrice = Readonly<{
  source: "rental-catalog" | "facility-package";
  id: string;
  label: string;
  amountUsd: number;
  priceKind: "starting-price" | "package-price";
}>;

export type CreativeBriefAuthoritativeFacts = Readonly<{
  serviceAreas: readonly string[];
  city: string;
  state: string;
  rentalStartingPrices: readonly CreativeBriefAuthoritativePrice[];
  facilityPackagePrices: readonly CreativeBriefAuthoritativePrice[];
  /**
   * Explicit campaignId → authoritative price ids (rental slug or facility package id).
   * Price claims are fail-closed: absent or empty selectors yield no price facts.
   */
  campaignPriceIds?: Readonly<Record<string, readonly string[]>>;
}>;

export type CreativeBriefAudience = Readonly<{
  customerSegment: string;
  useCase: string;
  serviceAreaContext: string | null;
  assumptions: readonly string[];
}>;

export type CreativeBriefMessageStrategy = Readonly<{
  primaryAngle: string;
  hookDirection: string;
  primaryMessage: string;
  supportingProofPoints: readonly string[];
  offerOrValueProposition: string;
  callToAction: string;
  toneGuidance: string;
}>;

export type CreativeBriefContentStrategy = Readonly<{
  recommendedFormat: CreativeBriefContentFormat;
  recommendedPlacements: readonly SocialMediaPlacement[];
  placementConfidence: "known" | "unknown";
  recommendedAssetIds: readonly string[];
  assetUsageGuidance: readonly string[];
  requiredNewAssets: readonly CreativeBriefRequiredAsset[];
  aspectRatioNeeds: readonly string[];
  videoOrStillRequirement: "video-preferred" | "still-acceptable" | "video-required-gap";
}>;

export type CreativeBriefSeasonalContext = Readonly<{
  matchedOpportunityKeys: readonly string[];
  lifecycleStates: readonly string[];
  urgencyGuidance: string | null;
  timingWarnings: readonly string[];
}>;

export type CreativeBriefMemoryConstraints = Readonly<{
  repetitionWarnings: readonly string[];
  differentiationGuidance: string | null;
  duplicateRiskMessages: readonly string[];
}>;

export type CreativeBrief = Readonly<{
  id: string;
  campaignId: string;
  campaignTitle: string;
  objective: string;
  evaluationDate: string | null;
  generatedAt: string;
  plannerRank: number;
  plannerScore: number;
  plannerStatus: CampaignPlannerCandidate["status"];
  audience: CreativeBriefAudience;
  messageStrategy: CreativeBriefMessageStrategy;
  contentStrategy: CreativeBriefContentStrategy;
  seasonalContext: CreativeBriefSeasonalContext;
  memoryConstraints: CreativeBriefMemoryConstraints;
  safeFactualClaims: readonly string[];
  assumptions: readonly string[];
  warnings: readonly string[];
  prohibitedClaims: readonly string[];
  missingFacts: readonly string[];
  missingAssets: readonly string[];
  readiness: CreativeBriefReadiness;
  diagnostics: readonly string[];
  pipelineReferences: Readonly<{
    marketingMemoryGeneratedAt: string;
    seasonalBusinessDate: string | null;
    assetIntelligenceGeneratedAt: string;
    campaignPlannerGeneratedAt: string;
    assetAssessment: AssetCampaignAssessment | null;
    seasonalMatches: readonly SeasonalOpportunityEvaluation[];
  }>;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
}>;

export type CreativeBriefIntelligenceInput = Readonly<{
  campaignPlanner: CampaignPlannerSnapshot;
  campaigns: readonly CampaignPlannerCampaign[];
  asOf: string;
  authoritativeFacts?: CreativeBriefAuthoritativeFacts;
}>;

export type CreativeBriefIntelligenceSnapshot = Readonly<{
  generatedAt: string;
  evaluationDate: string | null;
  briefs: readonly CreativeBrief[];
  readinessSummary: Readonly<{
    ready: number;
    needsAssets: number;
    needsFacts: number;
    needsReview: number;
    blocked: number;
    unknown: number;
  }>;
  assumptions: readonly string[];
  warnings: readonly string[];
  constraints: Readonly<{
    readOnly: true;
    deterministic: true;
    performsNoWrites: true;
    performsNoNetworkCalls: true;
    createsNoDrafts: true;
    generatesNothing: true;
    schedulesNothing: true;
    publishesNothing: true;
    approvesNothing: true;
    executesNothing: true;
    authoritative: false;
  }>;
}>;
