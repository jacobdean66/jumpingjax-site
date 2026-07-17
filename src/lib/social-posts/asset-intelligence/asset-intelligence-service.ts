import {
  ageDaysForAsset,
  assessCampaignAssets,
  businessDateFromAsOf,
  classifyAspectRatio,
} from "./asset-intelligence-domain";
import type {
  AssetIntelligenceAsset,
  AssetIntelligenceInput,
  AssetIntelligenceSnapshot,
} from "./asset-intelligence-types";

function countBy(values: readonly string[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function normalizeAsset(
  asset: AssetIntelligenceAsset,
  businessDate: string | null,
): AssetIntelligenceAsset {
  const classified =
    asset.aspectRatioClass === "unknown" && asset.width != null && asset.height != null
      ? classifyAspectRatio(asset.width, asset.height)
      : null;

  return {
    ...asset,
    aspectRatioClass: classified?.aspectRatioClass ?? asset.aspectRatioClass,
    orientation: classified?.orientation ?? asset.orientation,
    supportedPlacements: classified?.supportedPlacements ?? asset.supportedPlacements,
    ageDays: asset.ageDays ?? ageDaysForAsset(asset.createdAt, businessDate),
  };
}

export function buildAssetIntelligence(
  input: AssetIntelligenceInput,
): AssetIntelligenceSnapshot {
  const businessDate = businessDateFromAsOf(input.asOf);
  const mediaHistory = input.mediaHistory ?? [];
  const assets = input.assets
    .map((asset) => normalizeAsset(asset, businessDate))
    .slice()
    .sort((left, right) =>
      left.title.localeCompare(right.title) || left.id.localeCompare(right.id),
    );

  const campaignAssessments = input.campaigns
    .map((campaign) =>
      assessCampaignAssets({
        campaign,
        assets,
        mediaHistory,
        businessDate,
      }),
    )
    .slice()
    .sort((left, right) =>
      left.label.localeCompare(right.label) || left.campaignId.localeCompare(right.campaignId),
    );

  const assumptions = Array.from(
    new Set([
      "Asset Intelligence is read-only and does not upload, generate, approve, schedule, or publish media.",
      "Matching reuses Wave 7 normalized token and contiguous-phrase rules.",
      "Missing dimensions produce unknown aspect coverage rather than invented sizes.",
      "School calendars, local festivals, and unverified testimonials are never invented.",
      ...campaignAssessments.flatMap((assessment) => assessment.assumptions),
    ]),
  ).sort((left, right) => left.localeCompare(right));

  const warnings = Array.from(
    new Set(campaignAssessments.flatMap((assessment) => assessment.warnings)),
  ).sort((left, right) => left.localeCompare(right));

  return deepFreeze({
    generatedAt: input.asOf,
    businessDate,
    assets,
    inventory: {
      totalAssets: assets.length,
      usableAssets: assets.filter((asset) => asset.usability === "usable").length,
      byMediaType: countBy(assets.map((asset) => asset.mediaType)),
      bySource: countBy(assets.map((asset) => asset.source)),
      aspectCoverage: {
        square: assets.filter((asset) => asset.aspectRatioClass === "square").length,
        portraitOrReel: assets.filter(
          (asset) =>
            asset.aspectRatioClass === "portrait" || asset.aspectRatioClass === "reel",
        ).length,
        landscape: assets.filter((asset) => asset.aspectRatioClass === "landscape").length,
        unknown: assets.filter((asset) => asset.aspectRatioClass === "unknown").length,
      },
    },
    campaignAssessments,
    readyCampaignIds: campaignAssessments
      .filter((assessment) => assessment.readiness === "ready")
      .map((assessment) => assessment.campaignId),
    partiallyReadyCampaignIds: campaignAssessments
      .filter((assessment) => assessment.readiness === "partially-ready")
      .map((assessment) => assessment.campaignId),
    insufficientCampaignIds: campaignAssessments
      .filter((assessment) => assessment.readiness === "insufficient")
      .map((assessment) => assessment.campaignId),
    unknownCampaignIds: campaignAssessments
      .filter((assessment) => assessment.readiness === "unknown")
      .map((assessment) => assessment.campaignId),
    assumptions,
    warnings,
    constraints: {
      readOnly: true,
      deterministic: true,
      performsNoWrites: true,
      performsNoNetworkCalls: true,
      uploadsNothing: true,
      deletesNothing: true,
      generatesNothing: true,
      schedulesNothing: true,
      publishesNothing: true,
      authoritative: false,
    },
  });
}

export function emptyAssetIntelligenceSnapshot(asOf: string): AssetIntelligenceSnapshot {
  return buildAssetIntelligence({
    assets: [],
    campaigns: [],
    asOf,
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
