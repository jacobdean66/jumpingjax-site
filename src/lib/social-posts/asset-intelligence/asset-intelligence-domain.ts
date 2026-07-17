import { facilityDateAndMinutes } from "@/lib/facility-parties/zoned-time";
import type { SocialMediaPlacement } from "../social-media-format-specs";
import {
  normalizeSeasonalText,
  seasonalTokenOrPhraseMatches,
} from "../seasonal-intelligence/seasonal-intelligence-domain";
import type {
  AssetAspectRatioClass,
  AssetCampaignAssessment,
  AssetCreativeNeed,
  AssetGap,
  AssetGapKind,
  AssetIntelligenceAsset,
  AssetIntelligenceCampaign,
  AssetOrientation,
  AssetReadiness,
} from "./asset-intelligence-types";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const RECENT_DAYS = 90;
const STALE_DAYS = 365;
const OVERUSE_COUNT = 3;

export const ASSET_INTELLIGENCE_TIME_ZONE = "America/New_York";

export function normalizeAssetText(value: string): string {
  return normalizeSeasonalText(value);
}

export function assetTokenOrPhraseMatches(haystack: string, needle: string): boolean {
  return seasonalTokenOrPhraseMatches(haystack, needle);
}

export function businessDateFromAsOf(asOf: string): string | null {
  if (DATE_PATTERN.test(asOf)) return asOf;
  const parsed = facilityDateAndMinutes(asOf);
  return parsed?.date ?? null;
}

function dateParts(value: string): { year: number; month: number; day: number } | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function daysBetweenDates(fromDate: string, toDate: string): number | null {
  const from = dateParts(fromDate);
  const to = dateParts(toDate);
  if (!from || !to) return null;
  const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
  const toUtc = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export function classifyAspectRatio(
  width: number | null,
  height: number | null,
): {
  aspectRatioClass: AssetAspectRatioClass;
  orientation: AssetOrientation;
  supportedPlacements: readonly SocialMediaPlacement[];
} {
  if (width == null || height == null || width <= 0 || height <= 0) {
    return {
      aspectRatioClass: "unknown",
      orientation: "unknown",
      supportedPlacements: [],
    };
  }

  const ratio = width / height;
  if (Math.abs(ratio - 1) <= 0.05) {
    return {
      aspectRatioClass: "square",
      orientation: "square",
      supportedPlacements: ["feed", "carousel", "search"],
    };
  }
  if (ratio <= 0.62) {
    return {
      aspectRatioClass: "reel",
      orientation: "vertical",
      supportedPlacements: ["story", "reel"],
    };
  }
  if (ratio < 1) {
    return {
      aspectRatioClass: "portrait",
      orientation: "vertical",
      supportedPlacements: ["feed", "carousel"],
    };
  }
  return {
    aspectRatioClass: "landscape",
    orientation: "horizontal",
    supportedPlacements: ["feed", "search"],
  };
}

export function ageDaysForAsset(
  createdAt: string | null,
  asOfBusinessDate: string | null,
): number | null {
  if (!createdAt || !asOfBusinessDate) return null;
  const createdDate = DATE_PATTERN.test(createdAt)
    ? createdAt
    : facilityDateAndMinutes(createdAt)?.date ?? null;
  if (!createdDate) return null;
  const days = daysBetweenDates(createdDate, asOfBusinessDate);
  return days == null || days < 0 ? null : days;
}

function assetSearchText(asset: AssetIntelligenceAsset): string {
  return [
    asset.title,
    ...asset.matchingTerms,
    ...asset.campaignHints,
    ...asset.subjectHints,
  ].join(" ");
}

export function assetMatchesCampaign(
  asset: AssetIntelligenceAsset,
  campaign: AssetIntelligenceCampaign,
): boolean {
  const assetText = assetSearchText(asset);
  const needles = [
    ...campaign.preferredImageKeywords,
    ...normalizeAssetText(campaign.label).split(" ").filter((token) => token.length >= 4),
    ...normalizeAssetText(campaign.id).split("-").filter((token) => token.length >= 4),
  ];

  if (needles.length === 0) {
    return false;
  }

  return needles.some((needle) => assetTokenOrPhraseMatches(assetText, needle));
}

function mediaHistoryCount(
  asset: AssetIntelligenceAsset,
  mediaHistory: readonly Readonly<{ value: string; count: number }>[],
): number {
  if (!asset.sourcePathOrUrl) return 0;
  const path = asset.sourcePathOrUrl;
  let total = 0;
  for (const item of mediaHistory) {
    if (
      assetTokenOrPhraseMatches(item.value, path) ||
      item.value === path ||
      normalizeAssetText(item.value) === normalizeAssetText(path)
    ) {
      total += item.count;
    }
  }
  return total;
}

function duplicateInventoryCount(
  asset: AssetIntelligenceAsset,
  assets: readonly AssetIntelligenceAsset[],
): number {
  if (!asset.sourcePathOrUrl) return 1;
  const path = normalizeAssetText(asset.sourcePathOrUrl);
  return assets.filter(
    (candidate) =>
      candidate.sourcePathOrUrl &&
      normalizeAssetText(candidate.sourcePathOrUrl) === path,
  ).length;
}

function pushGap(gaps: AssetGap[], kind: AssetGapKind, message: string): void {
  if (!gaps.some((gap) => gap.kind === kind)) {
    gaps.push({ kind, message });
  }
}

function creativeNeedFromGaps(
  gaps: readonly AssetGap[],
  campaign: AssetIntelligenceCampaign,
): AssetCreativeNeed {
  const kinds = new Set(gaps.map((gap) => gap.kind));
  if (kinds.has("no-testimonial") && /testimonial|customer|review/.test(campaign.id)) {
    return "new-testimonial";
  }
  if (kinds.has("no-video") && campaign.defaultMediaType === "video") {
    return "new-video";
  }
  if (kinds.has("missing-square") || kinds.has("missing-portrait-reel") || kinds.has("missing-landscape")) {
    return "alternate-aspect-ratios";
  }
  if (kinds.has("no-recent-asset") || kinds.has("repeated-overused-asset")) {
    return "refresh-stale-assets";
  }
  if (kinds.has("no-relevant-asset") || kinds.has("insufficient-subject-coverage")) {
    return "new-photography";
  }
  if (kinds.has("unusable-source")) {
    return "new-graphics";
  }
  return "none";
}

/**
 * Documented Wave 8 asset readiness:
 * - insufficient: no relevant assets
 * - unknown: inventory empty for evaluation context, or only unknown-dimension unusable signals
 * - partially-ready: relevant assets exist but gaps remain
 * - ready: ≥1 usable relevant asset with square or portrait/reel coverage and no critical absence gaps
 */
export function assessCampaignAssets(input: {
  campaign: AssetIntelligenceCampaign;
  assets: readonly AssetIntelligenceAsset[];
  mediaHistory: readonly Readonly<{ value: string; count: number }>[];
  businessDate: string | null;
}): AssetCampaignAssessment {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [];
  const gaps: AssetGap[] = [];

  if (input.assets.length === 0) {
    assumptions.push("No asset inventory was provided; readiness is unknown.");
    pushGap(gaps, "no-relevant-asset", "No assets were available to evaluate.");
    return {
      campaignId: input.campaign.id,
      label: input.campaign.label,
      readiness: "unknown",
      relevantAssetIds: [],
      relevantAssetCount: 0,
      usableAssetCount: 0,
      supportedPlacements: [],
      aspectCoverage: {
        square: false,
        portraitOrReel: false,
        landscape: false,
        unknown: false,
      },
      gaps,
      warnings: ["Asset inventory is empty; no creative readiness claim is made."],
      reasons: ["No assets were supplied for this evaluation."],
      recommendedCreativeNeed: "new-photography",
      assumptions,
    };
  }

  const relevant = input.assets
    .filter((asset) => assetMatchesCampaign(asset, input.campaign))
    .slice()
    .sort((left, right) =>
      left.title.localeCompare(right.title) || left.id.localeCompare(right.id),
    );

  if (relevant.length === 0) {
    pushGap(gaps, "no-relevant-asset", "No existing assets matched this campaign's subjects or keywords.");
    pushGap(
      gaps,
      "insufficient-subject-coverage",
      "Preferred image keywords did not match any known asset terms.",
    );
    return {
      campaignId: input.campaign.id,
      label: input.campaign.label,
      readiness: "insufficient",
      relevantAssetIds: [],
      relevantAssetCount: 0,
      usableAssetCount: 0,
      supportedPlacements: [],
      aspectCoverage: {
        square: false,
        portraitOrReel: false,
        landscape: false,
        unknown: false,
      },
      gaps,
      warnings: ["No relevant assets were found for this campaign."],
      reasons: ["Deterministic keyword matching found no relevant existing assets."],
      recommendedCreativeNeed: "new-photography",
      assumptions: [
        "Matching uses Wave 7 normalized token/phrase rules against asset titles and tags.",
      ],
    };
  }

  const usable = relevant.filter((asset) => asset.usability === "usable");
  const unusable = relevant.filter((asset) => asset.usability === "unapproved");
  const aspectCoverage = {
    square: relevant.some((asset) => asset.aspectRatioClass === "square"),
    portraitOrReel: relevant.some(
      (asset) =>
        asset.aspectRatioClass === "portrait" || asset.aspectRatioClass === "reel",
    ),
    landscape: relevant.some((asset) => asset.aspectRatioClass === "landscape"),
    unknown: relevant.some((asset) => asset.aspectRatioClass === "unknown"),
  };

  const placements = Array.from(
    new Set(relevant.flatMap((asset) => [...asset.supportedPlacements])),
  ).sort() as SocialMediaPlacement[];

  reasons.push(
    `${relevant.length} relevant asset${relevant.length === 1 ? "" : "s"} matched this campaign.`,
  );
  if (usable.length > 0) {
    reasons.push(`${usable.length} usable asset${usable.length === 1 ? "" : "s"} are available.`);
  }

  if (aspectCoverage.unknown) {
    pushGap(
      gaps,
      "unknown-dimensions",
      "One or more relevant assets have unknown dimensions; placement coverage is incomplete.",
    );
    assumptions.push("Assets without width/height are treated as unknown aspect coverage.");
  }
  if (!aspectCoverage.square) {
    pushGap(gaps, "missing-square", "No square (1:1) relevant asset was found.");
  }
  if (!aspectCoverage.portraitOrReel) {
    pushGap(
      gaps,
      "missing-portrait-reel",
      "No portrait or reel (vertical) relevant asset was found.",
    );
  }
  if (!aspectCoverage.landscape) {
    pushGap(gaps, "missing-landscape", "No landscape relevant asset was found.");
  }

  const hasVideo = relevant.some((asset) => asset.mediaType === "video");
  if (input.campaign.defaultMediaType === "video" && !hasVideo) {
    pushGap(gaps, "no-video", "Campaign prefers video but no relevant video asset was found.");
  }

  const isTestimonialCampaign = ["testimonial", "customer", "review"].some((token) =>
    assetTokenOrPhraseMatches(`${input.campaign.id} ${input.campaign.label}`, token),
  );
  if (isTestimonialCampaign) {
    const hasTestimonial = relevant.some(
      (asset) =>
        asset.mediaType === "testimonial" ||
        asset.matchingTerms.some((term) =>
          ["testimonial", "review", "customer"].some((needle) =>
            assetTokenOrPhraseMatches(term, needle),
          ),
        ),
    );
    if (!hasTestimonial) {
      pushGap(gaps, "no-testimonial", "No testimonial-tagged asset was found for this campaign.");
    }
  }

  if (unusable.length > 0 && usable.length === 0) {
    pushGap(gaps, "unusable-source", "Relevant assets exist but none are marked usable.");
  }

  let hasRecent = false;
  let hasStaleOnly = true;
  let overused = false;
  for (const asset of relevant) {
    const age =
      asset.ageDays ??
      ageDaysForAsset(asset.createdAt, input.businessDate);
    if (age != null && age <= RECENT_DAYS) {
      hasRecent = true;
      hasStaleOnly = false;
    } else if (age != null && age <= STALE_DAYS) {
      hasStaleOnly = false;
    }

    const historyCount = mediaHistoryCount(asset, input.mediaHistory);
    const inventoryCount = duplicateInventoryCount(asset, input.assets);
    if (historyCount >= OVERUSE_COUNT || inventoryCount >= OVERUSE_COUNT) {
      overused = true;
    }
  }

  if (relevant.every((asset) => (asset.ageDays ?? ageDaysForAsset(asset.createdAt, input.businessDate)) == null)) {
    assumptions.push("Asset ages are unknown when created dates are missing.");
    hasStaleOnly = false;
  } else if (!hasRecent) {
    pushGap(gaps, "no-recent-asset", `No relevant asset newer than ${RECENT_DAYS} days was found.`);
    if (hasStaleOnly) {
      warnings.push("Relevant assets appear stale; consider refreshing creative.");
    }
  }

  if (overused) {
    pushGap(
      gaps,
      "repeated-overused-asset",
      "A relevant asset appears repeatedly in inventory or media history.",
    );
    warnings.push("Repeated asset use may reduce creative freshness.");
  }

  let readiness: AssetReadiness;
  if (usable.length === 0) {
    readiness = unusable.length > 0 ? "insufficient" : "unknown";
    if (readiness === "unknown") {
      assumptions.push("Relevant assets lack usable/approved state; readiness stays unknown.");
    }
  } else if (
    (aspectCoverage.square || aspectCoverage.portraitOrReel) &&
    !(input.campaign.defaultMediaType === "video" && !hasVideo && usable.length < 2) &&
    !gaps.some((gap) =>
      gap.kind === "no-relevant-asset" || gap.kind === "unusable-source",
    )
  ) {
    // Ready when usable assets cover a primary still format. Video gap alone keeps partially-ready.
    if (input.campaign.defaultMediaType === "video" && !hasVideo) {
      readiness = "partially-ready";
      reasons.push("Still assets exist, but preferred video creative is still missing.");
    } else if (!aspectCoverage.square || !aspectCoverage.portraitOrReel) {
      readiness = "partially-ready";
      reasons.push("Usable assets exist, but aspect-ratio coverage is incomplete.");
    } else {
      readiness = "ready";
      reasons.push("Usable assets cover square and vertical placements for creative production.");
    }
  } else {
    readiness = "partially-ready";
    reasons.push("Relevant assets exist, but important gaps remain.");
  }

  // Stable gap ordering by kind then message
  gaps.sort((left, right) => left.kind.localeCompare(right.kind) || left.message.localeCompare(right.message));

  return {
    campaignId: input.campaign.id,
    label: input.campaign.label,
    readiness,
    relevantAssetIds: relevant.map((asset) => asset.id),
    relevantAssetCount: relevant.length,
    usableAssetCount: usable.length,
    supportedPlacements: placements,
    aspectCoverage,
    gaps,
    warnings,
    reasons,
    recommendedCreativeNeed: creativeNeedFromGaps(gaps, input.campaign),
    assumptions,
  };
}

/**
 * Documented Wave 8 Campaign Planner asset score contract (bounded, non-stacking):
 * - ready → +2 once
 * - else partially-ready → +1 once
 * - repeated/overused gap present → −1 once
 * - insufficient / unknown → 0 (warnings only; no unsupported penalty)
 * Seasonal scoring remains unchanged and is applied separately.
 */
export function assetPlannerScoreDelta(assessment: AssetCampaignAssessment): {
  scoreDelta: number;
  reasons: string[];
  cautions: string[];
} {
  const reasons: string[] = [];
  const cautions: string[] = [];
  let scoreDelta = 0;

  if (assessment.readiness === "ready") {
    scoreDelta += 2;
    reasons.push(
      `Asset Intelligence marks ${assessment.label} ready (${assessment.usableAssetCount} usable asset${assessment.usableAssetCount === 1 ? "" : "s"}).`,
    );
  } else if (assessment.readiness === "partially-ready") {
    scoreDelta += 1;
    reasons.push(
      `Asset Intelligence marks ${assessment.label} partially ready with remaining creative gaps.`,
    );
  } else if (assessment.readiness === "insufficient") {
    cautions.push(`Asset Intelligence found no relevant assets for ${assessment.label}.`);
  } else {
    cautions.push(`Asset Intelligence readiness is unknown for ${assessment.label}.`);
  }

  if (assessment.gaps.some((gap) => gap.kind === "repeated-overused-asset")) {
    scoreDelta -= 1;
    cautions.push("Relevant creative appears overused; refresh before prioritizing this campaign.");
  }

  for (const warning of assessment.warnings) {
    if (!cautions.includes(warning)) cautions.push(warning);
  }

  return { scoreDelta, reasons, cautions };
}
