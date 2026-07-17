import type { CreativeBrief, CreativeBriefReadiness } from "../creative-brief-intelligence/creative-brief-intelligence-types";

export type ContentDraftSpecificationReadiness = CreativeBriefReadiness;

export type ContentSectionId = "hook" | "primary-message" | "supporting-proof" | "cta";

export type ContentSectionRequirement = Readonly<{
  sectionId: ContentSectionId;
  purpose: string;
  requiredFactIds: readonly string[];
  permittedThemes: readonly string[];
  prohibitedImplications: readonly string[];
  optional: boolean;
  requiresReview: boolean;
}>;

export type MessageHierarchyItem = Readonly<{
  order: number;
  sectionId: ContentSectionId;
  importance: "primary" | "secondary" | "supporting" | "closing";
  structuralGuidance: string;
}>;

export type AllowedFactualClaim = Readonly<{
  claimId: string;
  claimText: string;
  sourceCategory:
    | "objective"
    | "service-area"
    | "price"
    | "seasonal-lifecycle"
    | "other-safe-fact";
  sourceReference: string;
  permittedUsageContext: string;
  qualification: string | null;
  priceKind: "starting-price" | "package-price" | null;
}>;

export type PricingConstraints = Readonly<{
  allowedPriceClaimIds: readonly string[];
  allowedPriceKinds: readonly ("starting-price" | "package-price")[];
  selectionSource: "creative-brief-intelligence";
  newMatchingForbidden: true;
  emptySafeClaimSet: boolean;
}>;

export type CtaConstraints = Readonly<{
  allowedIntent: string;
  permittedActionCategories: readonly string[];
  destinationType: string;
  prohibitedAvailabilityImplications: readonly string[];
  prohibitedScarcityImplications: readonly string[];
  requiresHumanReview: boolean;
  structuralGuidance: string;
}>;

export type PlatformPlacementRequirement = Readonly<{
  platform: string;
  placement: string;
  format: string;
  orientation: string;
  aspectRatioTarget: string;
  characterOrLengthTarget: string;
  mediaRequirement: string;
  placementConfidence: "known" | "unknown";
  formatRuleSource: string;
}>;

export type AssetSlot = Readonly<{
  slotId: string;
  purpose: string;
  selectedAssetIds: readonly string[];
  requiredAssetType: string;
  aspectOrOrientationRequirement: string;
  videoPreference: "required" | "preferred" | "optional" | "not-applicable";
  assetReadiness: string;
  missingAssetDetails: readonly string[];
  authoritativeDimensionStatus: "known" | "unknown" | "not-applicable";
}>;

export type AccessibilityRequirement = Readonly<{
  requirementId: string;
  description: string;
  status: "required" | "unknown" | "not-applicable";
}>;

export type MissingInput = Readonly<{
  inputId: string;
  category:
    | "availability"
    | "testimonial"
    | "asset-dimensions"
    | "required-video"
    | "price-authorization"
    | "placement-certainty"
    | "event-information"
    | "other-fact"
    | "other-asset";
  message: string;
}>;

export type ReviewGate = Readonly<{
  gateId: string;
  reason: string;
  blocking: boolean;
  sourceCondition: string;
}>;

export type ContentDraftSpecificationContentPurpose = Readonly<{
  businessObjective: string;
  intendedAudience: string;
  contentIntent: string;
  campaignAngleReference: string;
  placementOrPlatformTarget: string;
}>;

export type ContentDraftSpecification = Readonly<{
  id: string;
  sourceBriefId: string;
  campaignId: string;
  campaignName: string;
  plannerRank: number;
  plannerScore: number;
  evaluationDate: string | null;
  asOf: string;
  pipelineReferences: Readonly<{
    creativeBriefId: string;
    creativeBriefGeneratedAt: string;
    marketingMemoryGeneratedAt: string;
    seasonalBusinessDate: string | null;
    assetIntelligenceGeneratedAt: string;
    campaignPlannerGeneratedAt: string;
  }>;
  contentPurpose: ContentDraftSpecificationContentPurpose;
  requiredContentSections: readonly ContentSectionRequirement[];
  messageHierarchy: readonly MessageHierarchyItem[];
  allowedFactualClaims: readonly AllowedFactualClaim[];
  pricingConstraints: PricingConstraints;
  prohibitedClaims: readonly string[];
  ctaConstraints: CtaConstraints;
  platformPlacementRequirements: readonly PlatformPlacementRequirement[];
  assetSlots: readonly AssetSlot[];
  accessibilityRequirements: readonly AccessibilityRequirement[];
  missingInputs: readonly MissingInput[];
  reviewGates: readonly ReviewGate[];
  generationReadiness: ContentDraftSpecificationReadiness;
  diagnostics: readonly string[];
  /** Explicit markers: this object is not publishable social content. */
  specificationOnly: true;
  nonPublishable: true;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
}>;

export type ContentDraftSpecificationSkip = Readonly<{
  sourceBriefId: string;
  campaignId: string;
  reason: string;
}>;

export type ContentDraftSpecificationInput = Readonly<{
  creativeBriefs: Readonly<{
    generatedAt: string;
    evaluationDate: string | null;
    briefs: readonly CreativeBrief[];
  }>;
  asOf: string;
}>;

export type ContentDraftSpecificationSnapshot = Readonly<{
  generatedAt: string;
  evaluationDate: string | null;
  specifications: readonly ContentDraftSpecification[];
  skippedBriefs: readonly ContentDraftSpecificationSkip[];
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
  diagnostics: readonly string[];
  constraints: Readonly<{
    readOnly: true;
    deterministic: true;
    performsNoWrites: true;
    performsNoNetworkCalls: true;
    createsNoDrafts: true;
    generatesNoFinalCopy: true;
    generatesNoMedia: true;
    schedulesNothing: true;
    publishesNothing: true;
    approvesNothing: true;
    executesNothing: true;
    authoritative: false;
  }>;
}>;
