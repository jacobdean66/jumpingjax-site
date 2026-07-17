import {
  getFormatSpecsForPlatformPlacement,
  getPublicationTargetAspectRatiosForPlacement,
  isSocialPostPlacement,
  type SocialMediaPlacement,
  type SocialMediaPlatform,
  SOCIAL_MEDIA_PLATFORMS,
} from "../social-media-format-specs";
import type { CreativeBrief } from "../creative-brief-intelligence/creative-brief-intelligence-types";
import type {
  AccessibilityRequirement,
  AllowedFactualClaim,
  AssetSlot,
  ContentDraftSpecification,
  ContentDraftSpecificationReadiness,
  ContentSectionRequirement,
  CtaConstraints,
  MissingInput,
  PlatformPlacementRequirement,
  PricingConstraints,
  ReviewGate,
} from "./content-draft-specification-types";

export const CONTENT_DRAFT_SPECIFICATION_TIME_ZONE = "America/New_York";

/**
 * Fail-closed readiness precedence (strictest first):
 * blocked → needs-facts → needs-assets → needs-review → unknown → ready
 */
export const GENERATION_READINESS_PRECEDENCE: readonly ContentDraftSpecificationReadiness[] = [
  "blocked",
  "needs-facts",
  "needs-assets",
  "needs-review",
  "unknown",
  "ready",
] as const;

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((left, right) =>
    left.localeCompare(right),
  );
}

function stableHashFragment(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function strictestReadiness(
  values: readonly ContentDraftSpecificationReadiness[],
): ContentDraftSpecificationReadiness {
  let best: ContentDraftSpecificationReadiness = "ready";
  let bestIndex = GENERATION_READINESS_PRECEDENCE.length - 1;
  for (const value of values) {
    const index = GENERATION_READINESS_PRECEDENCE.indexOf(value);
    if (index >= 0 && index < bestIndex) {
      best = value;
      bestIndex = index;
    }
  }
  return best;
}

function classifyClaim(claim: string): AllowedFactualClaim["sourceCategory"] {
  if (/package price reference|catalog starting-price reference|\$\d/i.test(claim)) {
    return "price";
  }
  if (/service area|centered on/i.test(claim)) return "service-area";
  if (/seasonal lifecycle/i.test(claim)) return "seasonal-lifecycle";
  if (/campaign objective reference/i.test(claim)) return "objective";
  return "other-safe-fact";
}

function detectPriceKind(claim: string): AllowedFactualClaim["priceKind"] {
  if (/package price reference/i.test(claim)) return "package-price";
  if (/starting-price/i.test(claim)) return "starting-price";
  return null;
}

function buildAllowedClaims(brief: CreativeBrief): readonly AllowedFactualClaim[] {
  return brief.safeFactualClaims
    .slice()
    .sort((left, right) => left.localeCompare(right))
    .map((claimText, index) => {
      const sourceCategory = classifyClaim(claimText);
      const priceKind = detectPriceKind(claimText);
      return {
        claimId: `claim:${brief.campaignId}:${sourceCategory}:${stableHashFragment(claimText)}:${index}`,
        claimText,
        sourceCategory,
        sourceReference: `creative-brief:${brief.id}`,
        permittedUsageContext:
          sourceCategory === "price"
            ? "May appear only as a verified price fact inside supporting-proof; never as a discount or limited-time offer."
            : "May appear only as a supporting factual claim inherited from Creative Brief Intelligence.",
        qualification:
          sourceCategory === "price"
            ? "Preserve exact amount and price-kind classification from the creative brief."
            : null,
        priceKind,
      };
    });
}

function buildPricingConstraints(
  claims: readonly AllowedFactualClaim[],
): PricingConstraints {
  const priceClaims = claims.filter((claim) => claim.sourceCategory === "price");
  const kinds = uniqueSorted(
    priceClaims
      .map((claim) => claim.priceKind)
      .filter((kind): kind is "starting-price" | "package-price" => kind != null),
  ) as readonly ("starting-price" | "package-price")[];

  return {
    allowedPriceClaimIds: priceClaims.map((claim) => claim.claimId),
    allowedPriceKinds: kinds,
    selectionSource: "creative-brief-intelligence",
    newMatchingForbidden: true,
    emptySafeClaimSet: claims.length === 0,
  };
}

function themeKeywords(brief: CreativeBrief): readonly string[] {
  return uniqueSorted([
    brief.campaignId.replace(/-/g, " "),
    brief.pipelineReferences.assetAssessment?.campaignId ?? "",
    ...brief.seasonalContext.matchedOpportunityKeys.map((key) => key.replace(/:/g, " ")),
    brief.contentStrategy.recommendedFormat,
    ...brief.contentStrategy.recommendedPlacements,
  ]);
}

function buildContentSections(
  brief: CreativeBrief,
  claims: readonly AllowedFactualClaim[],
): readonly ContentSectionRequirement[] {
  const themes = themeKeywords(brief);
  const priceClaimIds = claims
    .filter((claim) => claim.sourceCategory === "price")
    .map((claim) => claim.claimId);
  const factIds = claims.map((claim) => claim.claimId);

  const sharedProhibitions = uniqueSorted([
    "Do not invent discounts, sales, or limited-time prices.",
    "Do not invent inventory, open dates, or live availability.",
    "Do not invent scarcity, selling-out language, or unsupported deadlines.",
    "Do not invent testimonials, quotations, or review statements.",
    "Do not invent weather, school schedules, local events, or package contents.",
    "Do not invent service areas or prices beyond inherited safe claims.",
    ...brief.prohibitedClaims,
  ]);

  return [
    {
      sectionId: "hook",
      purpose: "Open with a seasonal or problem-oriented hook aligned to the creative brief angle.",
      requiredFactIds: [],
      permittedThemes: themes,
      prohibitedImplications: sharedProhibitions,
      optional: false,
      requiresReview: brief.readiness === "needs-review" || brief.readiness === "blocked",
    },
    {
      sectionId: "primary-message",
      purpose:
        "State the primary campaign objective as a structural message requirement, not finished marketing copy.",
      requiredFactIds: claims
        .filter((claim) => claim.sourceCategory === "objective")
        .map((claim) => claim.claimId),
      permittedThemes: themes,
      prohibitedImplications: sharedProhibitions,
      optional: false,
      requiresReview: true,
    },
    {
      sectionId: "supporting-proof",
      purpose:
        priceClaimIds.length > 0
          ? "Include only inherited supported proof points and any allowlisted verified prices."
          : "Include only inherited supported proof points; do not introduce prices.",
      requiredFactIds: factIds.filter((id) => !id.includes(":objective:")),
      permittedThemes: themes,
      prohibitedImplications: sharedProhibitions,
      optional: factIds.length === 0,
      requiresReview: claims.length === 0 || priceClaimIds.length > 0,
    },
    {
      sectionId: "cta",
      purpose: "Close with a constrained call-to-action that invites inquiry without implying availability.",
      requiredFactIds: [],
      permittedThemes: themes,
      prohibitedImplications: uniqueSorted([
        ...sharedProhibitions,
        "Do not imply current open dates or immediate inventory.",
        "Do not imply guaranteed availability or automatic acceptance.",
      ]),
      optional: false,
      requiresReview: brief.campaignId === "last-minute-availability",
    },
  ];
}

function buildMessageHierarchy(): ContentDraftSpecification["messageHierarchy"] {
  return [
    {
      order: 1,
      sectionId: "hook",
      importance: "primary",
      structuralGuidance: "Lead with the hook requirement before any proof or CTA.",
    },
    {
      order: 2,
      sectionId: "primary-message",
      importance: "secondary",
      structuralGuidance: "Follow the hook with the primary campaign message requirement.",
    },
    {
      order: 3,
      sectionId: "supporting-proof",
      importance: "supporting",
      structuralGuidance: "Support the primary message only with inherited safe factual claims.",
    },
    {
      order: 4,
      sectionId: "cta",
      importance: "closing",
      structuralGuidance: "End with the constrained CTA requirement; do not invent urgency.",
    },
  ];
}

function inferBusinessFocus(brief: CreativeBrief): "facility-parties" | "both" | "rentals" {
  const segment = brief.audience.customerSegment.toLowerCase();
  if (segment.includes("facility party") || brief.campaignId === "private-parties") {
    return "facility-parties";
  }
  if (segment.includes("either rentals or facility") || segment.includes("rentals or facility")) {
    return "both";
  }
  return "rentals";
}

function buildCtaConstraints(brief: CreativeBrief): CtaConstraints {
  const focus = inferBusinessFocus(brief);
  const destinationType =
    focus === "facility-parties"
      ? "facility-party-information"
      : focus === "both"
        ? "rentals-or-facility-options"
        : "rental-options-or-booking-inquiry";

  const allowedIntent =
    focus === "facility-parties"
      ? "view-party-information"
      : focus === "both"
        ? "explore-rentals-or-party-options"
        : "explore-rentals-or-begin-booking-inquiry";

  const structuralGuidance =
    focus === "facility-parties"
      ? "CTA must invite the customer to view party information or inquire about packages."
      : focus === "both"
        ? "CTA must invite the customer to explore rental options or facility party packages."
        : "CTA must invite the customer to explore rentals or begin a booking inquiry.";

  const prohibitedAvailability = uniqueSorted([
    "Do not claim current open dates.",
    "Do not claim immediate inventory.",
    "Do not claim guaranteed availability.",
    "Do not claim remaining quantities.",
    "Do not claim room availability.",
    "Do not claim automatic acceptance.",
    ...(brief.campaignId === "last-minute-availability"
      ? [
          "Do not imply same-week availability.",
          "Do not imply open-date urgency without live availability facts.",
        ]
      : []),
  ]);

  return {
    allowedIntent,
    permittedActionCategories: uniqueSorted([
      "learn-more",
      "view-options",
      "view-party-information",
      "explore-rentals",
      "contact-business",
      "begin-booking-inquiry",
    ]),
    destinationType,
    prohibitedAvailabilityImplications: prohibitedAvailability,
    prohibitedScarcityImplications: uniqueSorted([
      "Do not invent scarcity counts.",
      "Do not invent selling-out language.",
      "Do not convert seasonal timing into false scarcity.",
      ...brief.prohibitedClaims.filter((claim) => /scarcity|limited|countdown/i.test(claim)),
    ]),
    requiresHumanReview:
      brief.campaignId === "last-minute-availability" ||
      brief.readiness === "needs-review" ||
      brief.readiness === "blocked",
    structuralGuidance,
  };
}

function orientationForAspect(aspectRatio: string): string {
  if (aspectRatio === "1:1") return "square";
  if (aspectRatio === "9:16" || aspectRatio === "4:5" || aspectRatio === "3:4") {
    return "portrait";
  }
  if (aspectRatio === "16:9" || aspectRatio === "1.91:1") return "landscape";
  return "unknown";
}

function buildPlatformPlacementRequirements(
  brief: CreativeBrief,
): readonly PlatformPlacementRequirement[] {
  const placements = brief.contentStrategy.recommendedPlacements;
  const confidence = brief.contentStrategy.placementConfidence;
  const mediaRequirement =
    brief.contentStrategy.videoOrStillRequirement === "video-required-gap"
      ? "video-required"
      : brief.contentStrategy.videoOrStillRequirement === "video-preferred"
        ? "video-preferred"
        : brief.contentStrategy.videoOrStillRequirement === "still-acceptable"
          ? "still-acceptable"
          : "unknown";

  if (placements.length === 0) {
    return [
      {
        platform: "unknown",
        placement: "unknown",
        format: brief.contentStrategy.recommendedFormat,
        orientation: "unknown",
        aspectRatioTarget: "unknown",
        characterOrLengthTarget: "unknown",
        mediaRequirement,
        placementConfidence: "unknown",
        formatRuleSource: "unknown",
      },
    ];
  }

  const requirements: PlatformPlacementRequirement[] = [];
  for (const placement of placements.slice().sort((left, right) => left.localeCompare(right))) {
    if (!isSocialPostPlacement(placement)) {
      requirements.push({
        platform: "unknown",
        placement,
        format: brief.contentStrategy.recommendedFormat,
        orientation: "unknown",
        aspectRatioTarget: "unknown",
        characterOrLengthTarget: "unknown",
        mediaRequirement,
        placementConfidence: "unknown",
        formatRuleSource: "unknown",
      });
      continue;
    }

    const aspectTargets = getPublicationTargetAspectRatiosForPlacement(placement);
    const platformHits = (SOCIAL_MEDIA_PLATFORMS as readonly SocialMediaPlatform[])
      .map((platform) => ({
        platform,
        specs: getFormatSpecsForPlatformPlacement(platform, placement as SocialMediaPlacement),
      }))
      .filter((entry) => entry.specs.length > 0);

    if (confidence === "unknown" || platformHits.length === 0 || aspectTargets.length === 0) {
      requirements.push({
        platform: "unknown",
        placement,
        format: brief.contentStrategy.recommendedFormat,
        orientation: "unknown",
        aspectRatioTarget: "unknown",
        characterOrLengthTarget: "unknown",
        mediaRequirement,
        placementConfidence: "unknown",
        formatRuleSource:
          platformHits.length > 0 ? "social-media-format-specs-incomplete" : "unknown",
      });
      continue;
    }

    for (const hit of platformHits) {
      const primary = hit.specs[0]!;
      requirements.push({
        platform: hit.platform,
        placement,
        format: primary.label,
        orientation: orientationForAspect(primary.aspectRatio),
        aspectRatioTarget: aspectTargets.join("|"),
        characterOrLengthTarget: "unknown",
        mediaRequirement,
        placementConfidence: confidence,
        formatRuleSource: "social-media-format-specs",
      });
    }
  }

  return requirements
    .slice()
    .sort(
      (left, right) =>
        left.platform.localeCompare(right.platform) ||
        left.placement.localeCompare(right.placement) ||
        left.format.localeCompare(right.format),
    );
}

function buildAssetSlots(brief: CreativeBrief): readonly AssetSlot[] {
  const assessment = brief.pipelineReferences.assetAssessment;
  const dimensionStatus: AssetSlot["authoritativeDimensionStatus"] =
    assessment == null
      ? "unknown"
      : assessment.aspectCoverage.unknown
        ? "unknown"
        : "known";

  const videoPreference: AssetSlot["videoPreference"] =
    brief.contentStrategy.videoOrStillRequirement === "video-required-gap"
      ? "required"
      : brief.contentStrategy.videoOrStillRequirement === "video-preferred"
        ? "preferred"
        : brief.contentStrategy.videoOrStillRequirement === "still-acceptable"
          ? "optional"
          : "not-applicable";

  const selected: AssetSlot = {
    slotId: `slot:selected:${brief.campaignId}`,
    purpose: "Primary selected media for the future draft generation layer.",
    selectedAssetIds: brief.contentStrategy.recommendedAssetIds.slice().sort((a, b) =>
      a.localeCompare(b),
    ),
    requiredAssetType:
      videoPreference === "required" || videoPreference === "preferred" ? "video" : "still-image",
    aspectOrOrientationRequirement:
      brief.contentStrategy.aspectRatioNeeds.length > 0
        ? brief.contentStrategy.aspectRatioNeeds.join("; ")
        : "unknown",
    videoPreference,
    assetReadiness: assessment?.readiness ?? "unknown",
    missingAssetDetails: uniqueSorted(brief.missingAssets),
    authoritativeDimensionStatus: dimensionStatus,
  };

  const gapSlots = brief.contentStrategy.requiredNewAssets
    .slice()
    .sort((left, right) =>
      left.kind.localeCompare(right.kind) || left.message.localeCompare(right.message),
    )
    .map((item, index) => ({
      slotId: `slot:required:${brief.campaignId}:${item.kind}:${index}`,
      purpose: item.message,
      selectedAssetIds: [] as readonly string[],
      requiredAssetType: item.kind,
      aspectOrOrientationRequirement:
        item.kind === "square"
          ? "1:1"
          : item.kind === "portrait-reel"
            ? "4:5 or 9:16"
            : item.kind === "landscape"
              ? "1.91:1"
              : "unknown",
      videoPreference:
        item.kind === "video"
          ? ("required" as const)
          : videoPreference,
      assetReadiness: "missing",
      missingAssetDetails: [item.message],
      authoritativeDimensionStatus:
        item.kind === "alternate-aspect-ratio" ? ("unknown" as const) : dimensionStatus,
    }));

  return [selected, ...gapSlots];
}

function buildAccessibilityRequirements(brief: CreativeBrief): readonly AccessibilityRequirement[] {
  const hasImage =
    brief.contentStrategy.recommendedFormat === "still-image" ||
    brief.contentStrategy.videoOrStillRequirement === "still-acceptable" ||
    brief.contentStrategy.recommendedAssetIds.length > 0;
  const hasVideo =
    brief.contentStrategy.recommendedFormat === "short-video" ||
    brief.contentStrategy.recommendedFormat === "reel" ||
    brief.contentStrategy.videoOrStillRequirement === "video-preferred" ||
    brief.contentStrategy.videoOrStillRequirement === "video-required-gap";

  const requirements: AccessibilityRequirement[] = [
    {
      requirementId: "alt-text-for-images",
      description: "Alt text is required for any image asset used by a future generation layer.",
      status: hasImage ? "required" : "not-applicable",
    },
    {
      requirementId: "captions-or-transcript-for-video",
      description: "Captions or a transcript are required for video where video media is used.",
      status: hasVideo ? "required" : "not-applicable",
    },
    {
      requirementId: "claims-not-image-only",
      description:
        "Essential factual claims must not depend solely on text embedded in an image.",
      status: "required",
    },
    {
      requirementId: "visible-text-preserves-claim-restrictions",
      description:
        "Any visible text in generated media must preserve inherited claim and pricing restrictions.",
      status: "required",
    },
    {
      requirementId: "unknown-accessibility-gaps",
      description: "Additional platform accessibility rules remain unknown until documented.",
      status: "unknown",
    },
  ];

  return requirements
    .slice()
    .sort((left, right) => left.requirementId.localeCompare(right.requirementId));
}

function buildMissingInputs(brief: CreativeBrief): readonly MissingInput[] {
  const inputs: MissingInput[] = [];

  for (const fact of brief.missingFacts) {
    const category: MissingInput["category"] = /availability/i.test(fact)
      ? "availability"
      : /price/i.test(fact)
        ? "price-authorization"
        : /testimonial/i.test(fact)
          ? "testimonial"
          : "other-fact";
    inputs.push({
      inputId: `missing-fact:${stableHashFragment(fact)}`,
      category,
      message: fact,
    });
  }

  for (const asset of brief.missingAssets) {
    const category: MissingInput["category"] = /video/i.test(asset)
      ? "required-video"
      : /dimension|aspect|placement fit/i.test(asset)
        ? "asset-dimensions"
        : /testimonial/i.test(asset)
          ? "testimonial"
          : "other-asset";
    inputs.push({
      inputId: `missing-asset:${stableHashFragment(asset)}`,
      category,
      message: asset,
    });
  }

  if (brief.contentStrategy.placementConfidence === "unknown") {
    inputs.push({
      inputId: "missing-placement-certainty",
      category: "placement-certainty",
      message: "Authoritative placement certainty is unknown for this specification.",
    });
  }

  if (brief.pipelineReferences.assetAssessment?.aspectCoverage.unknown) {
    inputs.push({
      inputId: "missing-authoritative-dimensions",
      category: "asset-dimensions",
      message: "Selected asset dimensions remain unknown and must not be invented.",
    });
  }

  if (brief.campaignId === "customer-testimonials") {
    const hasTestimonialGap =
      brief.contentStrategy.requiredNewAssets.some((item) => item.kind === "testimonial") ||
      brief.prohibitedClaims.some((claim) => /testimonial|quotes/i.test(claim));
    if (hasTestimonialGap) {
      inputs.push({
        inputId: "missing-authoritative-testimonial",
        category: "testimonial",
        message: "No authoritative testimonial fact or asset is available.",
      });
    }
  }

  return inputs
    .slice()
    .sort(
      (left, right) =>
        left.category.localeCompare(right.category) ||
        left.inputId.localeCompare(right.inputId) ||
        left.message.localeCompare(right.message),
    );
}

function buildReviewGates(
  brief: CreativeBrief,
  claims: readonly AllowedFactualClaim[],
  missingInputs: readonly MissingInput[],
  placementRequirements: readonly PlatformPlacementRequirement[],
): readonly ReviewGate[] {
  const gates: ReviewGate[] = [
    {
      gateId: "final-copy-review",
      reason: "Future final copy must be reviewed before any publishable use.",
      blocking: true,
      sourceCondition: "Wave 10 specifications are non-publishable by design.",
    },
    {
      gateId: "factual-claim-review",
      reason: "Inherited factual claims require human review before generation.",
      blocking: claims.length === 0,
      sourceCondition:
        claims.length === 0
          ? "Empty safe-claim set from Creative Brief Intelligence."
          : "Non-empty inherited safe-claim set.",
    },
  ];

  if (claims.some((claim) => claim.sourceCategory === "price")) {
    gates.push({
      gateId: "price-review",
      reason: "Price facts require human review before customer-facing use.",
      blocking: false,
      sourceCondition: "Creative brief includes allowlisted price claims.",
    });
  }

  if (missingInputs.some((input) => input.category === "availability")) {
    gates.push({
      gateId: "availability-review",
      reason: "Availability-oriented content is blocked without live availability facts.",
      blocking: true,
      sourceCondition: "Missing live availability facts.",
    });
  }

  if (missingInputs.some((input) => input.category === "testimonial")) {
    gates.push({
      gateId: "testimonial-review",
      reason: "Testimonial content remains gated without authoritative testimonial data.",
      blocking: true,
      sourceCondition: "Missing authoritative testimonial.",
    });
  }

  if (
    missingInputs.some(
      (input) =>
        input.category === "required-video" ||
        input.category === "asset-dimensions" ||
        input.category === "other-asset",
    ) ||
    brief.missingAssets.length > 0
  ) {
    gates.push({
      gateId: "asset-review",
      reason: "Asset gaps or unknown dimensions require review before generation readiness.",
      blocking: true,
      sourceCondition: "Missing or unverified assets from Creative Brief Intelligence.",
    });
  }

  if (
    brief.contentStrategy.placementConfidence === "unknown" ||
    placementRequirements.some((item) => item.placementConfidence === "unknown")
  ) {
    gates.push({
      gateId: "placement-review",
      reason: "Placement requirements are unknown or incomplete.",
      blocking: brief.contentStrategy.recommendedPlacements.length > 0,
      sourceCondition: "Creative brief placement confidence is unknown.",
    });
  }

  gates.push({
    gateId: "accessibility-review",
    reason: "Accessibility production requirements must be satisfied by a later generation layer.",
    blocking: false,
    sourceCondition: "Specification-only accessibility requirements.",
  });

  return gates
    .slice()
    .sort((left, right) => left.gateId.localeCompare(right.gateId));
}

function buildSpecificationProhibitions(brief: CreativeBrief): readonly string[] {
  return uniqueSorted([
    ...brief.prohibitedClaims,
    "Do not generate a finished caption, advertisement, headline set, script, or social post.",
    "Do not invent discounts, sales, or limited-time prices.",
    "Do not invent inventory counts, open dates, scarcity, or selling-out language.",
    "Do not invent deadlines unsupported by authoritative seasonal timing.",
    "Do not invent testimonials, quotations, review statements, or performance claims.",
    "Do not invent safety guarantees, weather, school schedules, or local events.",
    "Do not invent package contents, service areas, or prices beyond inherited safe claims.",
    "Do not imply live room or rental availability without authoritative availability facts.",
    "Do not convert seasonal timing urgency into false scarcity.",
  ]);
}

function computeGenerationReadiness(input: {
  brief: CreativeBrief;
  missingInputs: readonly MissingInput[];
  reviewGates: readonly ReviewGate[];
  assetSlots: readonly AssetSlot[];
  placementRequirements: readonly PlatformPlacementRequirement[];
  claims: readonly AllowedFactualClaim[];
}): ContentDraftSpecificationReadiness {
  const signals: ContentDraftSpecificationReadiness[] = [input.brief.readiness];

  if (input.brief.readiness === "blocked" || input.brief.readiness === "unknown") {
    signals.push(input.brief.readiness);
  }

  if (input.reviewGates.some((gate) => gate.blocking && gate.gateId !== "final-copy-review")) {
    if (input.missingInputs.some((item) => item.category === "availability")) {
      signals.push("needs-facts");
    } else if (input.missingInputs.some((item) => item.category === "testimonial")) {
      signals.push("needs-facts");
    } else if (
      input.missingInputs.some(
        (item) =>
          item.category === "required-video" ||
          item.category === "asset-dimensions" ||
          item.category === "other-asset",
      )
    ) {
      signals.push("needs-assets");
    } else if (
      input.placementRequirements.some((item) => item.placementConfidence === "unknown") &&
      input.brief.contentStrategy.recommendedPlacements.length > 0
    ) {
      signals.push("needs-review");
    } else {
      signals.push("needs-review");
    }
  }

  if (input.missingInputs.some((item) => item.category === "availability" || item.category === "price-authorization")) {
    signals.push("needs-facts");
  }

  if (input.claims.length === 0 && input.brief.missingFacts.length > 0) {
    signals.push("needs-facts");
  }

  const videoRequired =
    input.brief.contentStrategy.videoOrStillRequirement === "video-required-gap" ||
    input.brief.contentStrategy.videoOrStillRequirement === "video-preferred";
  const videoMissing = input.assetSlots.some(
    (slot) =>
      (slot.videoPreference === "required" || slot.videoPreference === "preferred") &&
      (slot.assetReadiness === "missing" ||
        slot.missingAssetDetails.some((detail) => /video/i.test(detail)) ||
        (slot.selectedAssetIds.length === 0 && slot.requiredAssetType === "video")),
  );
  if (videoRequired && videoMissing) {
    signals.push("needs-assets");
  }

  if (
    input.assetSlots.some((slot) => slot.authoritativeDimensionStatus === "unknown") &&
    input.brief.contentStrategy.placementConfidence === "unknown"
  ) {
    signals.push("needs-assets");
  }

  if (input.brief.contentStrategy.requiredNewAssets.length > 0) {
    signals.push("needs-assets");
  }

  // final-copy-review is always present and blocking for publication, but does not
  // by itself prevent a future generation layer from being marked ready for drafting.
  const nonCopyBlocking = input.reviewGates.filter(
    (gate) => gate.blocking && gate.gateId !== "final-copy-review",
  );
  if (nonCopyBlocking.length > 0 && !signals.includes("needs-facts") && !signals.includes("needs-assets") && !signals.includes("blocked")) {
    signals.push("needs-review");
  }

  return strictestReadiness(signals);
}

export function buildContentDraftSpecification(input: {
  brief: CreativeBrief;
  asOf: string;
  evaluationDate: string | null;
}): ContentDraftSpecification {
  const { brief } = input;
  const allowedFactualClaims = buildAllowedClaims(brief);
  const pricingConstraints = buildPricingConstraints(allowedFactualClaims);
  const requiredContentSections = buildContentSections(brief, allowedFactualClaims);
  const ctaConstraints = buildCtaConstraints(brief);
  const platformPlacementRequirements = buildPlatformPlacementRequirements(brief);
  const assetSlots = buildAssetSlots(brief);
  const accessibilityRequirements = buildAccessibilityRequirements(brief);
  const missingInputs = buildMissingInputs(brief);
  const prohibitedClaims = buildSpecificationProhibitions(brief);
  const reviewGates = buildReviewGates(
    brief,
    allowedFactualClaims,
    missingInputs,
    platformPlacementRequirements,
  );
  const generationReadiness = computeGenerationReadiness({
    brief,
    missingInputs,
    reviewGates,
    assetSlots,
    placementRequirements: platformPlacementRequirements,
    claims: allowedFactualClaims,
  });

  const diagnostics = uniqueSorted([
    `source-brief:${brief.id}`,
    `readiness:${generationReadiness}`,
    `inherited-brief-readiness:${brief.readiness}`,
    `inherited-claims:${allowedFactualClaims.length}`,
    `inherited-prohibitions:${brief.prohibitedClaims.length}`,
    `missing-inputs:${missingInputs.length}`,
    `asset-slots:${assetSlots.length}`,
    `placement-unknown:${platformPlacementRequirements.filter((item) => item.placementConfidence === "unknown").length}`,
    `review-gates:${reviewGates.length}`,
    `planner-rank:${brief.plannerRank}`,
    `planner-score:${brief.plannerScore}`,
    "ordering-preserved:true",
    "final-copy-generated:false",
  ]);

  return {
    id: `spec:${brief.campaignId}:${input.evaluationDate ?? "unknown-date"}`,
    sourceBriefId: brief.id,
    campaignId: brief.campaignId,
    campaignName: brief.campaignTitle,
    plannerRank: brief.plannerRank,
    plannerScore: brief.plannerScore,
    evaluationDate: input.evaluationDate,
    asOf: input.asOf,
    pipelineReferences: {
      creativeBriefId: brief.id,
      creativeBriefGeneratedAt: brief.generatedAt,
      marketingMemoryGeneratedAt: brief.pipelineReferences.marketingMemoryGeneratedAt,
      seasonalBusinessDate: brief.pipelineReferences.seasonalBusinessDate,
      assetIntelligenceGeneratedAt: brief.pipelineReferences.assetIntelligenceGeneratedAt,
      campaignPlannerGeneratedAt: brief.pipelineReferences.campaignPlannerGeneratedAt,
    },
    contentPurpose: {
      businessObjective: brief.objective,
      intendedAudience: brief.audience.customerSegment,
      contentIntent:
        "Produce a non-publishable content draft specification for a later generation and review layer.",
      campaignAngleReference: `creative-brief-angle:${brief.id}`,
      placementOrPlatformTarget:
        brief.contentStrategy.recommendedPlacements.length > 0
          ? brief.contentStrategy.recommendedPlacements.join(", ")
          : "unknown",
    },
    requiredContentSections,
    messageHierarchy: buildMessageHierarchy(),
    allowedFactualClaims,
    pricingConstraints,
    prohibitedClaims,
    ctaConstraints,
    platformPlacementRequirements,
    assetSlots,
    accessibilityRequirements,
    missingInputs,
    reviewGates,
    generationReadiness,
    diagnostics,
    specificationOnly: true,
    nonPublishable: true,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
  };
}
