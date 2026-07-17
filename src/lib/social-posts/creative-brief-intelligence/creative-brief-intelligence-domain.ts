import { businessDateFromAsOf } from "../asset-intelligence/asset-intelligence-domain";
import type { AssetCampaignAssessment } from "../asset-intelligence/asset-intelligence-types";
import type {
  CampaignPlannerCampaign,
  CampaignPlannerCandidate,
  CampaignPlannerSnapshot,
} from "../campaign-planner/campaign-planner-types";
import { campaignBusinessFocusMatchesSeasonal } from "../seasonal-intelligence/seasonal-intelligence-domain";
import type { SeasonalOpportunityEvaluation } from "../seasonal-intelligence/seasonal-intelligence-types";
import type { SocialMediaPlacement } from "../social-media-format-specs";
import type {
  CreativeBrief,
  CreativeBriefAuthoritativeFacts,
  CreativeBriefAuthoritativePrice,
  CreativeBriefContentFormat,
  CreativeBriefReadiness,
  CreativeBriefRequiredAsset,
} from "./creative-brief-intelligence-types";

export const CREATIVE_BRIEF_INTELLIGENCE_TIME_ZONE = "America/New_York";

const TONE_GUIDANCE =
  "Family-friendly, clean, local, and helpful. Keep claims verifiable and avoid hype that invents scarcity, discounts, or testimonials.";

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((left, right) =>
    left.localeCompare(right),
  );
}

export function campaignLookup(
  campaigns: readonly CampaignPlannerCampaign[],
  campaignId: string,
): CampaignPlannerCampaign | null {
  return campaigns.find((campaign) => campaign.id === campaignId) ?? null;
}

function assetAssessmentFor(
  planner: CampaignPlannerSnapshot,
  campaignId: string,
): AssetCampaignAssessment | null {
  return (
    planner.assetIntelligence.campaignAssessments.find(
      (assessment) => assessment.campaignId === campaignId,
    ) ?? null
  );
}

function campaignMatchesSeasonalOpportunity(
  campaign: CampaignPlannerCampaign,
  opportunity: SeasonalOpportunityEvaluation,
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

function matchedSeasonalOpportunities(input: {
  campaign: CampaignPlannerCampaign;
  planner: CampaignPlannerSnapshot;
}): readonly SeasonalOpportunityEvaluation[] {
  const seasonal = input.planner.seasonalIntelligence;
  return [
    ...seasonal.activeOpportunities,
    ...seasonal.upcomingOpportunities,
    ...seasonal.passedOpportunities,
  ]
    .filter((opportunity) => campaignMatchesSeasonalOpportunity(input.campaign, opportunity))
    .slice()
    .sort((left, right) =>
      left.opportunityKey.localeCompare(right.opportunityKey) ||
      left.name.localeCompare(right.name),
    );
}

function audienceFor(
  campaign: CampaignPlannerCampaign,
  facts: CreativeBriefAuthoritativeFacts | null,
): CreativeBrief["audience"] {
  const segmentByFocus: Record<CampaignPlannerCampaign["businessFocus"], string> = {
    rentals: "Local families and organizers planning backyard or venue events",
    "facility-parties": "Families booking private or package parties at the Jumping Jax facility",
    both: "Local families considering either rentals or facility party bookings",
  };

  const assumptions: string[] = [];
  let serviceAreaContext: string | null = null;
  if (facts && facts.serviceAreas.length > 0) {
    const areas = facts.serviceAreas.slice().sort((left, right) => left.localeCompare(right));
    serviceAreaContext =
      `Configured service area centered on ${facts.city}, ${facts.state}: ${areas.join(", ")}.`;
  } else {
    assumptions.push(
      "Service-area copy is omitted because authoritative location facts were not supplied.",
    );
  }

  return {
    customerSegment: segmentByFocus[campaign.businessFocus],
    useCase: campaign.description,
    serviceAreaContext,
    assumptions: uniqueSorted(assumptions),
  };
}

function callToActionFor(campaign: CampaignPlannerCampaign): string {
  if (campaign.businessFocus === "facility-parties") {
    return "Invite families to inquire about facility party packages and party rooms.";
  }
  if (campaign.businessFocus === "both") {
    return "Invite families to explore rental options or facility party packages.";
  }
  return "Invite families to check rental options and request a booking quote.";
}

function contentFormatFor(
  campaign: CampaignPlannerCampaign,
  assessment: AssetCampaignAssessment | null,
): {
  format: CreativeBriefContentFormat;
  videoOrStillRequirement: CreativeBrief["contentStrategy"]["videoOrStillRequirement"];
} {
  if (campaign.defaultMediaType === "video") {
    const noVideoGap = assessment?.gaps.some((gap) => gap.kind === "no-video") ?? false;
    if (noVideoGap) {
      return {
        format: "short-video",
        videoOrStillRequirement: "video-required-gap",
      };
    }
    return { format: "reel", videoOrStillRequirement: "video-preferred" };
  }
  return { format: "still-image", videoOrStillRequirement: "still-acceptable" };
}

function placementsFor(
  assessment: AssetCampaignAssessment | null,
  seasonalMatches: readonly SeasonalOpportunityEvaluation[],
): {
  placements: readonly SocialMediaPlacement[];
  confidence: "known" | "unknown";
} {
  if (assessment && assessment.supportedPlacements.length > 0) {
    return {
      placements: assessment.supportedPlacements.slice().sort((left, right) =>
        left.localeCompare(right),
      ),
      confidence: "known",
    };
  }

  const seasonalPlacements = uniqueSorted(
    seasonalMatches.flatMap((match) => match.recommendedPlacements),
  ).filter((value): value is SocialMediaPlacement =>
    value === "feed" ||
    value === "story" ||
    value === "reel" ||
    value === "carousel" ||
    value === "search",
  );

  if (seasonalPlacements.length > 0) {
    return { placements: seasonalPlacements, confidence: "unknown" };
  }

  return { placements: [], confidence: "unknown" };
}

function requiredAssetsFromAssessment(
  campaign: CampaignPlannerCampaign,
  assessment: AssetCampaignAssessment | null,
): readonly CreativeBriefRequiredAsset[] {
  if (!assessment) {
    return [
      {
        kind: "still-image",
        message: "No asset assessment is available; creative production needs verified assets first.",
      },
    ];
  }

  const required: CreativeBriefRequiredAsset[] = [];
  for (const gap of assessment.gaps) {
    switch (gap.kind) {
      case "no-video":
        required.push({ kind: "video", message: gap.message });
        break;
      case "missing-square":
        required.push({ kind: "square", message: gap.message });
        break;
      case "missing-portrait-reel":
        required.push({ kind: "portrait-reel", message: gap.message });
        break;
      case "missing-landscape":
        required.push({ kind: "landscape", message: gap.message });
        break;
      case "no-testimonial":
        required.push({ kind: "testimonial", message: gap.message });
        break;
      case "no-relevant-asset":
      case "insufficient-subject-coverage":
        required.push({ kind: "still-image", message: gap.message });
        break;
      case "repeated-overused-asset":
      case "no-recent-asset":
        required.push({ kind: "refresh", message: gap.message });
        break;
      case "unknown-dimensions":
        required.push({
          kind: "alternate-aspect-ratio",
          message: gap.message,
        });
        break;
      case "unusable-source":
        required.push({ kind: "still-image", message: gap.message });
        break;
      default:
        break;
    }
  }

  if (campaign.id === "customer-testimonials") {
    const hasTestimonialGap = assessment.gaps.some((gap) => gap.kind === "no-testimonial");
    if (hasTestimonialGap || assessment.usableAssetCount === 0) {
      if (!required.some((item) => item.kind === "testimonial")) {
        required.push({
          kind: "testimonial",
          message: "Testimonial campaigns require verified customer testimonial assets.",
        });
      }
    }
  }

  return required
    .slice()
    .sort((left, right) =>
      left.kind.localeCompare(right.kind) || left.message.localeCompare(right.message),
    );
}

function aspectRatioNeeds(
  assessment: AssetCampaignAssessment | null,
  required: readonly CreativeBriefRequiredAsset[],
): readonly string[] {
  const needs: string[] = [];
  if (required.some((item) => item.kind === "square")) needs.push("1:1 square");
  if (required.some((item) => item.kind === "portrait-reel")) {
    needs.push("4:5 portrait or 9:16 reel");
  }
  if (required.some((item) => item.kind === "landscape")) needs.push("1.91:1 landscape");
  if (assessment?.aspectCoverage.unknown) {
    needs.push("Verified dimensions before claiming placement fit");
  }
  return uniqueSorted(needs);
}

/**
 * Fail-closed default allowlist. Broad token matching is intentionally not used:
 * generic words like party/water/slide previously attached unrelated catalog prices.
 */
const DEFAULT_CAMPAIGN_PRICE_IDS: Readonly<Record<string, readonly string[]>> = {
  "private-parties": ["private-weekend-90", "private-weekend-120"],
};

function priceAllowedForBusinessFocus(
  campaign: CampaignPlannerCampaign,
  price: CreativeBriefAuthoritativePrice,
): boolean {
  if (campaign.businessFocus === "rentals") {
    return price.source === "rental-catalog";
  }
  if (campaign.businessFocus === "facility-parties") {
    return price.source === "facility-package";
  }
  return true;
}

function selectedPriceIds(
  campaign: CampaignPlannerCampaign,
  facts: CreativeBriefAuthoritativeFacts,
): readonly string[] {
  if (
    facts.campaignPriceIds != null &&
    Object.prototype.hasOwnProperty.call(facts.campaignPriceIds, campaign.id)
  ) {
    return uniqueSorted(facts.campaignPriceIds[campaign.id] ?? []);
  }
  return uniqueSorted(DEFAULT_CAMPAIGN_PRICE_IDS[campaign.id] ?? []);
}

export type CreativeBriefPriceSelection = Readonly<{
  prices: readonly CreativeBriefAuthoritativePrice[];
  ambiguous: boolean;
  missingSelectedIds: readonly string[];
  warning: string | null;
}>;

export function selectAuthoritativePrices(input: {
  campaign: CampaignPlannerCampaign;
  facts: CreativeBriefAuthoritativeFacts | null;
}): CreativeBriefPriceSelection {
  if (!input.facts) {
    return { prices: [], ambiguous: false, missingSelectedIds: [], warning: null };
  }

  const selectedIds = selectedPriceIds(input.campaign, input.facts);
  if (selectedIds.length === 0) {
    return {
      prices: [],
      ambiguous: false,
      missingSelectedIds: [],
      warning: null,
    };
  }

  const catalog = [...input.facts.rentalStartingPrices, ...input.facts.facilityPackagePrices];
  const byId = new Map(catalog.map((price) => [price.id, price]));
  const missingSelectedIds = selectedIds.filter((id) => !byId.has(id));
  const matched = selectedIds
    .map((id) => byId.get(id))
    .filter((price): price is CreativeBriefAuthoritativePrice => price != null)
    .filter((price) => priceAllowedForBusinessFocus(input.campaign, price))
    .slice()
    .sort((left, right) =>
      left.source.localeCompare(right.source) ||
      left.id.localeCompare(right.id) ||
      left.label.localeCompare(right.label),
    );

  // Multiple explicitly allowlisted ids are treated as intentional option sets
  // (for example private package durations), not ambiguous token collisions.
  return {
    prices: matched,
    ambiguous: false,
    missingSelectedIds,
    warning:
      missingSelectedIds.length > 0
        ? `Configured price id(s) were missing from authoritative facts: ${missingSelectedIds.join(", ")}.`
        : null,
  };
}

function formatPriceClaim(price: CreativeBriefAuthoritativePrice): string {
  const kindLabel =
    price.priceKind === "package-price"
      ? "package price reference"
      : "catalog starting-price reference";
  return `${price.label} ${kindLabel} is $${price.amountUsd.toFixed(2)} (${price.source}).`;
}

function buildProhibitedClaims(input: {
  campaign: CampaignPlannerCampaign;
  assessment: AssetCampaignAssessment | null;
  prices: readonly CreativeBriefAuthoritativePrice[];
  seasonalMatches: readonly SeasonalOpportunityEvaluation[];
}): readonly string[] {
  const prohibited: string[] = [
    "Do not invent discounts, coupons, or sale percentages.",
    "Do not invent school calendars, local festivals, weather forecasts, or scarcity counts.",
    "Do not invent package contents, inventory counts, or booking deadlines.",
  ];

  if (input.prices.length === 0) {
    prohibited.push(
      "Do not state specific prices; no matching authoritative catalog price was selected for this brief.",
    );
  }

  if (input.campaign.id === "customer-testimonials") {
    const missingTestimonial =
      !input.assessment ||
      input.assessment.gaps.some((gap) => gap.kind === "no-testimonial") ||
      input.assessment.usableAssetCount === 0;
    if (missingTestimonial) {
      prohibited.push("Do not invent customer quotes, star ratings, or unnamed testimonials.");
    }
  }

  if (input.campaign.id === "last-minute-availability") {
    prohibited.push(
      "Do not claim specific open dates, remaining slots, or guaranteed same-week availability.",
    );
  }

  const hasFinalCallOrActive = input.seasonalMatches.some(
    (match) => match.lifecycleState === "final-call" || match.lifecycleState === "active",
  );
  if (hasFinalCallOrActive) {
    prohibited.push(
      "Do not invent false scarcity such as limited stock counts or fake countdown urgency.",
    );
  }

  if (input.assessment?.aspectCoverage.unknown) {
    prohibited.push(
      "Do not claim verified placement fit while asset dimensions remain unknown.",
    );
  }

  return uniqueSorted(prohibited);
}

function seasonalUrgencyGuidance(
  matches: readonly SeasonalOpportunityEvaluation[],
): { guidance: string | null; warnings: readonly string[] } {
  const warnings: string[] = [];
  const finalCall = matches.find((match) => match.lifecycleState === "final-call");
  const active = matches.find((match) => match.lifecycleState === "active");
  const preparation = matches.find((match) => match.lifecycleState === "preparation");
  const passed = matches.find((match) => match.lifecycleState === "passed");

  if (passed && !finalCall && !active && !preparation) {
    warnings.push(
      `${passed.name} has already passed; do not present it as a current booking window.`,
    );
    return { guidance: null, warnings: uniqueSorted(warnings) };
  }

  if (finalCall) {
    warnings.push(
      `${finalCall.name} is in final-call; urgency may reference the seasonal window ending without inventing scarcity.`,
    );
    return {
      guidance:
        `Seasonal final-call guidance for ${finalCall.name}: emphasize the remaining seasonal window without inventing stock limits.`,
      warnings: uniqueSorted(warnings),
    };
  }

  if (active) {
    return {
      guidance:
        `Seasonal active guidance for ${active.name}: keep messaging timely to the current seasonal window.`,
      warnings: uniqueSorted(warnings),
    };
  }

  if (preparation) {
    return {
      guidance:
        `Seasonal preparation guidance for ${preparation.name}: plan creative now; do not claim the opportunity is already live.`,
      warnings: uniqueSorted(warnings),
    };
  }

  return { guidance: null, warnings: uniqueSorted(warnings) };
}

function memoryConstraintsFor(
  candidate: CampaignPlannerCandidate,
): CreativeBrief["memoryConstraints"] {
  const repetitionWarnings = uniqueSorted(
    candidate.cautions.filter((caution) =>
      /used |duplicate|repetition|active approved|scheduled history/i.test(caution),
    ),
  );

  return {
    repetitionWarnings,
    differentiationGuidance:
      repetitionWarnings.length > 0
        ? "Differentiate with a fresh angle, unused media, or a distinct proof point from prior posts."
        : null,
    duplicateRiskMessages: repetitionWarnings,
  };
}

function computeReadiness(input: {
  candidate: CampaignPlannerCandidate;
  assessment: AssetCampaignAssessment | null;
  requiredAssets: readonly CreativeBriefRequiredAsset[];
  missingFacts: readonly string[];
  seasonalMatches: readonly SeasonalOpportunityEvaluation[];
}): CreativeBriefReadiness {
  if (!input.assessment) return "unknown";
  if (input.assessment.readiness === "unknown") return "unknown";

  const noRelevant = input.assessment.gaps.some((gap) => gap.kind === "no-relevant-asset");
  if (input.assessment.readiness === "insufficient" && noRelevant) return "blocked";

  const passedOnly =
    input.seasonalMatches.length > 0 &&
    input.seasonalMatches.every((match) => match.lifecycleState === "passed");
  if (passedOnly) return "blocked";

  if (input.missingFacts.length > 0) return "needs-facts";

  const assetBlocking = input.requiredAssets.some((item) =>
    item.kind === "video" ||
    item.kind === "testimonial" ||
    item.kind === "still-image" ||
    item.kind === "square" ||
    item.kind === "portrait-reel" ||
    item.kind === "landscape",
  );
  if (
    input.assessment.readiness === "insufficient" ||
    (assetBlocking && input.assessment.readiness !== "ready")
  ) {
    return "needs-assets";
  }

  if (
    input.candidate.status === "review" ||
    input.candidate.cautions.length > 0 ||
    input.assessment.gaps.some((gap) => gap.kind === "repeated-overused-asset")
  ) {
    return "needs-review";
  }

  if (input.assessment.readiness === "partially-ready") {
    return "needs-assets";
  }

  return "ready";
}

export function buildCreativeBrief(input: {
  candidate: CampaignPlannerCandidate;
  campaign: CampaignPlannerCampaign;
  planner: CampaignPlannerSnapshot;
  asOf: string;
  evaluationDate: string | null;
  authoritativeFacts: CreativeBriefAuthoritativeFacts | null;
}): CreativeBrief {
  const assessment = assetAssessmentFor(input.planner, input.candidate.campaignId);
  const seasonalMatches = matchedSeasonalOpportunities({
    campaign: input.campaign,
    planner: input.planner,
  });
  const seasonal = seasonalUrgencyGuidance(seasonalMatches);
  const priceSelection = selectAuthoritativePrices({
    campaign: input.campaign,
    facts: input.authoritativeFacts,
  });
  const prices = priceSelection.prices;
  const requiredNewAssets = requiredAssetsFromAssessment(input.campaign, assessment);
  const formatInfo = contentFormatFor(input.campaign, assessment);
  const placementInfo = placementsFor(assessment, seasonalMatches);
  const memory = memoryConstraintsFor(input.candidate);
  const audience = audienceFor(input.campaign, input.authoritativeFacts);

  const primaryAngle =
    input.candidate.referencePromptAngle ??
    input.candidate.referenceCaptionAngle ??
    input.campaign.description;
  const hookDirection =
    input.candidate.referenceCaptionAngle ??
    input.campaign.captionAngles[0] ??
    input.campaign.description;
  const primaryMessage =
    input.candidate.referenceGoal ??
    input.campaign.goalTemplates[0] ??
    input.campaign.description;

  const supportingProofPoints = uniqueSorted([
    input.campaign.description,
    ...input.candidate.reasons.slice(0, 3),
    ...prices.map(
      (price) =>
        `Authoritative ${price.source} ${price.priceKind} for ${price.label}: $${price.amountUsd.toFixed(2)}.`,
    ),
  ]);

  const offerOrValueProposition =
    prices.length > 1
      ? `Lead with catalog-backed value using only these verified price options: ${prices.map((price) => price.label).join("; ")}.`
      : prices.length === 1
        ? `Lead with catalog-backed value using only the verified ${prices[0]!.priceKind} for ${prices[0]!.label}.`
        : "Lead with convenience, clean setup, and local family-friendly fun without stating unverified prices.";

  const missingFacts: string[] = [];
  if (!input.authoritativeFacts) {
    missingFacts.push(
      "Authoritative business location and catalog price facts were not supplied.",
    );
  }
  if (input.campaign.id === "last-minute-availability") {
    missingFacts.push(
      "Live booking availability was not supplied and must not be invented.",
    );
  }
  if (priceSelection.missingSelectedIds.length > 0) {
    missingFacts.push(
      `Configured authoritative price id(s) are missing: ${priceSelection.missingSelectedIds.join(", ")}.`,
    );
  }
  if (
    /price|discount|sale|deal|\$/i.test(
      `${input.campaign.label} ${input.campaign.description} ${primaryMessage}`,
    ) &&
    prices.length === 0
  ) {
    missingFacts.push(
      "Price-led messaging was requested without a matching authoritative catalog price.",
    );
  }

  const prohibitedClaims = buildProhibitedClaims({
    campaign: input.campaign,
    assessment,
    prices,
    seasonalMatches,
  });

  const assumptions = uniqueSorted([
    "Creative Brief Intelligence is structured and rule-based; it does not generate final captions or media.",
    "Planner ranking and scores are preserved from Campaign Planner.",
    "Unsupported business facts become assumptions, warnings, or prohibited claims.",
    "Price claims require explicit campaign-to-price id mapping; generic token matching is not used.",
    ...audience.assumptions,
    ...(assessment?.assumptions ?? []),
  ]);

  const warnings = uniqueSorted([
    ...input.candidate.cautions,
    ...(assessment?.warnings ?? []),
    ...seasonal.warnings,
    ...memory.repetitionWarnings,
    ...(priceSelection.warning ? [priceSelection.warning] : []),
    ...(placementInfo.confidence === "unknown"
      ? [
          "Recommended placements are guidance only because asset dimensions or placement support are unknown.",
        ]
      : []),
  ]);

  const missingAssets = uniqueSorted(requiredNewAssets.map((item) => item.message));
  const readiness = computeReadiness({
    candidate: input.candidate,
    assessment,
    requiredAssets: requiredNewAssets,
    missingFacts: uniqueSorted(missingFacts),
    seasonalMatches,
  });

  const safeFactualClaims = uniqueSorted([
    `Campaign objective reference: ${primaryMessage}`,
    ...(audience.serviceAreaContext ? [audience.serviceAreaContext] : []),
    ...prices.map(formatPriceClaim),
    ...seasonalMatches.map(
      (match) =>
        `${match.name} seasonal lifecycle is ${match.lifecycleState} as of the evaluation date.`,
    ),
  ]);

  const assetUsageGuidance = uniqueSorted([
    ...(assessment?.relevantAssetIds.length
      ? [
          `Prefer existing relevant assets in deterministic order: ${assessment.relevantAssetIds.join(", ")}.`,
        ]
      : ["No verified relevant assets were selected for reuse."]),
    ...(assessment?.gaps.some((gap) => gap.kind === "repeated-overused-asset")
      ? ["Avoid repeating overused assets; choose an alternate verified asset when available."]
      : []),
    ...(placementInfo.confidence === "unknown"
      ? ["Do not assert placement-ready crops until dimensions are known."]
      : [`Known supported placements: ${placementInfo.placements.join(", ")}.`]),
  ]);

  const diagnostics = uniqueSorted([
    `readiness:${readiness}`,
    `planner-status:${input.candidate.status}`,
    `asset-readiness:${assessment?.readiness ?? "missing"}`,
    `placement-confidence:${placementInfo.confidence}`,
    `seasonal-matches:${seasonalMatches.length}`,
    `required-assets:${requiredNewAssets.length}`,
    `prohibited-claims:${prohibitedClaims.length}`,
  ]);

  return {
    id: `brief:${input.candidate.campaignId}:${input.evaluationDate ?? "unknown-date"}`,
    campaignId: input.candidate.campaignId,
    campaignTitle: input.candidate.label,
    objective: primaryMessage,
    evaluationDate: input.evaluationDate,
    generatedAt: input.asOf,
    plannerRank: input.candidate.rank,
    plannerScore: input.candidate.score,
    plannerStatus: input.candidate.status,
    audience,
    messageStrategy: {
      primaryAngle,
      hookDirection,
      primaryMessage,
      supportingProofPoints,
      offerOrValueProposition,
      callToAction: callToActionFor(input.campaign),
      toneGuidance: TONE_GUIDANCE,
    },
    contentStrategy: {
      recommendedFormat: formatInfo.format,
      recommendedPlacements: placementInfo.placements,
      placementConfidence: placementInfo.confidence,
      recommendedAssetIds: assessment?.relevantAssetIds ?? [],
      assetUsageGuidance,
      requiredNewAssets,
      aspectRatioNeeds: aspectRatioNeeds(assessment, requiredNewAssets),
      videoOrStillRequirement: formatInfo.videoOrStillRequirement,
    },
    seasonalContext: {
      matchedOpportunityKeys: seasonalMatches.map((match) => match.opportunityKey),
      lifecycleStates: uniqueSorted(seasonalMatches.map((match) => match.lifecycleState)),
      urgencyGuidance: seasonal.guidance,
      timingWarnings: seasonal.warnings,
    },
    memoryConstraints: memory,
    safeFactualClaims,
    assumptions,
    warnings,
    prohibitedClaims,
    missingFacts: uniqueSorted(missingFacts),
    missingAssets,
    readiness,
    diagnostics,
    pipelineReferences: {
      marketingMemoryGeneratedAt: input.planner.generatedAt,
      seasonalBusinessDate: input.planner.seasonalIntelligence.businessDate,
      assetIntelligenceGeneratedAt: input.planner.assetIntelligence.generatedAt,
      campaignPlannerGeneratedAt: input.planner.generatedAt,
      assetAssessment: assessment,
      seasonalMatches,
    },
    computedOnly: true,
    readOnly: true,
    authoritative: false,
  };
}

export { businessDateFromAsOf };
