import type { SocialMediaPlacement } from "../social-media-format-specs";

export type AssetIntelligenceSource =
  | "post-media"
  | "catalog"
  | "brand"
  | "unknown";

export type AssetIntelligenceMediaType =
  | "image"
  | "video"
  | "graphic"
  | "testimonial"
  | "template"
  | "unknown";

export type AssetAspectRatioClass =
  | "square"
  | "portrait"
  | "landscape"
  | "reel"
  | "unknown";

export type AssetOrientation =
  | "horizontal"
  | "vertical"
  | "square"
  | "unknown";

export type AssetUsability = "usable" | "unapproved" | "unknown";

export type AssetReadiness =
  | "ready"
  | "partially-ready"
  | "insufficient"
  | "unknown";

export type AssetGapKind =
  | "no-relevant-asset"
  | "missing-square"
  | "missing-portrait-reel"
  | "missing-landscape"
  | "no-video"
  | "no-recent-asset"
  | "no-testimonial"
  | "insufficient-subject-coverage"
  | "repeated-overused-asset"
  | "unknown-dimensions"
  | "unusable-source";

export type AssetCreativeNeed =
  | "none"
  | "new-photography"
  | "new-video"
  | "new-graphics"
  | "new-testimonial"
  | "alternate-aspect-ratios"
  | "refresh-stale-assets";

export type AssetIntelligenceAsset = Readonly<{
  id: string;
  source: AssetIntelligenceSource;
  mediaType: AssetIntelligenceMediaType;
  title: string;
  sourceRecordId: string | null;
  sourcePathOrUrl: string | null;
  width: number | null;
  height: number | null;
  aspectRatioClass: AssetAspectRatioClass;
  orientation: AssetOrientation;
  supportedPlacements: readonly SocialMediaPlacement[];
  createdAt: string | null;
  ageDays: number | null;
  usability: AssetUsability;
  campaignHints: readonly string[];
  subjectHints: readonly string[];
  matchingTerms: readonly string[];
}>;

export type AssetIntelligenceCampaign = Readonly<{
  id: string;
  label: string;
  businessFocus: "rentals" | "facility-parties" | "both";
  defaultMediaType: "image" | "video";
  preferredImageKeywords: readonly string[];
}>;

export type AssetGap = Readonly<{
  kind: AssetGapKind;
  message: string;
}>;

export type AssetCampaignAssessment = Readonly<{
  campaignId: string;
  label: string;
  readiness: AssetReadiness;
  relevantAssetIds: readonly string[];
  relevantAssetCount: number;
  usableAssetCount: number;
  supportedPlacements: readonly SocialMediaPlacement[];
  aspectCoverage: Readonly<{
    square: boolean;
    portraitOrReel: boolean;
    landscape: boolean;
    unknown: boolean;
  }>;
  gaps: readonly AssetGap[];
  warnings: readonly string[];
  reasons: readonly string[];
  recommendedCreativeNeed: AssetCreativeNeed;
  assumptions: readonly string[];
}>;

export type AssetIntelligenceInput = Readonly<{
  assets: readonly AssetIntelligenceAsset[];
  campaigns: readonly AssetIntelligenceCampaign[];
  mediaHistory?: readonly Readonly<{ value: string; count: number }>[];
  asOf: string;
}>;

export type AssetIntelligenceSnapshot = Readonly<{
  generatedAt: string;
  businessDate: string | null;
  assets: readonly AssetIntelligenceAsset[];
  inventory: Readonly<{
    totalAssets: number;
    usableAssets: number;
    byMediaType: Readonly<Record<string, number>>;
    bySource: Readonly<Record<string, number>>;
    aspectCoverage: Readonly<{
      square: number;
      portraitOrReel: number;
      landscape: number;
      unknown: number;
    }>;
  }>;
  campaignAssessments: readonly AssetCampaignAssessment[];
  readyCampaignIds: readonly string[];
  partiallyReadyCampaignIds: readonly string[];
  insufficientCampaignIds: readonly string[];
  unknownCampaignIds: readonly string[];
  assumptions: readonly string[];
  warnings: readonly string[];
  constraints: Readonly<{
    readOnly: true;
    deterministic: true;
    performsNoWrites: true;
    performsNoNetworkCalls: true;
    uploadsNothing: true;
    deletesNothing: true;
    generatesNothing: true;
    schedulesNothing: true;
    publishesNothing: true;
    authoritative: false;
  }>;
}>;
