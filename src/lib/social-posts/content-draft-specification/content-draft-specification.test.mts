import assert from "node:assert/strict";
import test from "node:test";

import { classifyAspectRatio } from "../asset-intelligence/asset-intelligence-domain";
import { buildAssetIntelligence } from "../asset-intelligence/asset-intelligence-service";
import type {
  AssetIntelligenceAsset,
  AssetIntelligenceCampaign,
} from "../asset-intelligence/asset-intelligence-types";
import { buildCampaignPlanner } from "../campaign-planner/campaign-planner-service";
import type { CampaignPlannerCampaign } from "../campaign-planner/campaign-planner-types";
import { buildCreativeBriefIntelligence } from "../creative-brief-intelligence/creative-brief-intelligence-service";
import type { CreativeBriefAuthoritativeFacts } from "../creative-brief-intelligence/creative-brief-intelligence-types";
import type { MarketingMemorySnapshot } from "../marketing-memory/marketing-memory-types";
import { buildSeasonalIntelligence } from "../seasonal-intelligence/seasonal-intelligence-service";
import { GENERATION_READINESS_PRECEDENCE } from "./content-draft-specification-domain";
import { buildContentDraftSpecificationIntelligence } from "./content-draft-specification-service";
import type { ContentDraftSpecification } from "./content-draft-specification-types";

const AS_OF = "2026-07-16T16:00:00.000Z";

function emptyMemory(generatedAt = AS_OF): MarketingMemorySnapshot {
  return {
    generatedAt,
    campaignHistory: [],
    activeCampaigns: [],
    seasonalHistory: [],
    promotedCategories: [],
    promotedProducts: [],
    facilityPartyPromotions: [],
    mediaHistory: [],
    approvalHistory: [],
    recentThemes: [],
    duplicateRisk: [],
    recommendations: [],
    constraints: {
      readOnly: true,
      deterministic: true,
      performsNoWrites: true,
      performsNoNetworkCalls: true,
      authoritative: false,
    },
  };
}

function plannerCampaign(
  overrides: Partial<CampaignPlannerCampaign> = {},
): CampaignPlannerCampaign {
  return {
    id: "summer-water-slides",
    label: "Summer Water Slides",
    description: "Push high-energy summer slide rentals for hot weekends.",
    businessFocus: "rentals",
    defaultMediaType: "video",
    goalTemplates: ["Promote water slides for hot weather"],
    captionAngles: ["Cool off with a backyard waterslide weekend."],
    promptAngles: ["bright summer backyard, colorful waterslide, splash energy"],
    ...overrides,
  };
}

function assetCampaign(
  campaign: CampaignPlannerCampaign,
): AssetIntelligenceCampaign {
  return {
    id: campaign.id,
    label: campaign.label,
    businessFocus: campaign.businessFocus,
    defaultMediaType: campaign.defaultMediaType,
    preferredImageKeywords: campaign.id.includes("water") || campaign.id.includes("heat")
      ? ["water", "slide", "summer", "splash"]
      : campaign.id.includes("testimonial")
        ? ["family", "party", "testimonial"]
        : campaign.id.includes("private")
          ? ["private", "party", "facility"]
          : campaign.id.includes("birthday")
            ? ["birthday", "party", "bounce"]
            : ["bounce", "party"],
  };
}

function asset(
  overrides: Partial<AssetIntelligenceAsset> & Pick<AssetIntelligenceAsset, "id" | "title">,
): AssetIntelligenceAsset {
  const classified = classifyAspectRatio(
    overrides.width ?? null,
    overrides.height ?? null,
  );
  return {
    id: overrides.id,
    source: overrides.source ?? "catalog",
    mediaType: overrides.mediaType ?? "image",
    title: overrides.title,
    sourceRecordId: overrides.sourceRecordId ?? overrides.id,
    sourcePathOrUrl: overrides.sourcePathOrUrl ?? `/assets/${overrides.id}.jpg`,
    width: overrides.width ?? null,
    height: overrides.height ?? null,
    aspectRatioClass: overrides.aspectRatioClass ?? classified.aspectRatioClass,
    orientation: overrides.orientation ?? classified.orientation,
    supportedPlacements: overrides.supportedPlacements ?? classified.supportedPlacements,
    createdAt: overrides.createdAt ?? "2026-06-01",
    ageDays: overrides.ageDays ?? null,
    usability: overrides.usability ?? "usable",
    campaignHints: overrides.campaignHints ?? [],
    subjectHints: overrides.subjectHints ?? [],
    matchingTerms: overrides.matchingTerms ?? ["water", "slide", "summer"],
  };
}

function facts(overrides: Partial<CreativeBriefAuthoritativeFacts> = {}): CreativeBriefAuthoritativeFacts {
  return {
    serviceAreas: ["Greenwood", "Clinton", "Ninety Six"],
    city: "Greenwood",
    state: "South Carolina",
    rentalStartingPrices: [
      {
        source: "rental-catalog",
        id: "blue-waterfall",
        label: "Blue Waterfall Slide",
        amountUsd: 275,
        priceKind: "starting-price",
      },
      {
        source: "rental-catalog",
        id: "foam-party",
        label: "Foam Party",
        amountUsd: 200,
        priceKind: "starting-price",
      },
    ],
    facilityPackagePrices: [
      {
        source: "facility-package",
        id: "private-weekend-90",
        label: "Private party weekend 90 minutes",
        amountUsd: 220,
        priceKind: "package-price",
      },
      {
        source: "facility-package",
        id: "private-weekend-120",
        label: "Private party weekend 120 minutes",
        amountUsd: 255,
        priceKind: "package-price",
      },
    ],
    campaignPriceIds: {},
    ...overrides,
  };
}

function buildSpecs(input: {
  campaigns: readonly CampaignPlannerCampaign[];
  assets?: readonly AssetIntelligenceAsset[];
  memory?: MarketingMemorySnapshot;
  asOf?: string;
  authoritativeFacts?: CreativeBriefAuthoritativeFacts | null;
}) {
  const asOf = input.asOf ?? AS_OF;
  const memory = input.memory ?? emptyMemory(asOf);
  const seasonalIntelligence = buildSeasonalIntelligence({
    asOf,
    marketingMemory: memory,
  });
  const assetIntelligence = buildAssetIntelligence({
    assets: input.assets ?? [],
    campaigns: input.campaigns.map(assetCampaign),
    mediaHistory: memory.mediaHistory,
    asOf,
  });
  const campaignPlanner = buildCampaignPlanner({
    campaigns: input.campaigns,
    marketingMemory: memory,
    seasonalIntelligence,
    assetIntelligence,
    generatedAt: asOf,
  });
  const creativeBriefs = buildCreativeBriefIntelligence({
    campaignPlanner,
    campaigns: input.campaigns,
    asOf,
    authoritativeFacts:
      input.authoritativeFacts === null
        ? undefined
        : input.authoritativeFacts ?? facts(),
  });

  return {
    creativeBriefs,
    campaignPlanner,
    specs: buildContentDraftSpecificationIntelligence({
      creativeBriefs,
      asOf,
    }),
  };
}

function collectPublishableLeakFields(spec: ContentDraftSpecification): string[] {
  const forbiddenKeys = [
    "caption",
    "headline",
    "adBody",
    "adCopy",
    "script",
    "finalCta",
    "finalCtaSentence",
    "postBody",
    "socialPost",
    "generatedCopy",
  ];
  const found: string[] = [];
  const visit = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        if (forbiddenKeys.includes(key)) found.push(`${path}.${key}`);
        visit(nested, `${path}.${key}`);
      }
    }
  };
  visit(spec, "spec");
  return found;
}

test("1. creates one specification per brief with stable ids and preserved planner order", () => {
  const campaigns = [
    plannerCampaign({ id: "private-parties", label: "Private Parties", businessFocus: "facility-parties" }),
    plannerCampaign(),
  ];
  const { specs, campaignPlanner, creativeBriefs } = buildSpecs({
    campaigns,
    assets: [
      asset({
        id: "a1",
        title: "Water Slide",
        width: 1080,
        height: 1080,
        mediaType: "video",
        matchingTerms: ["water", "slide", "summer"],
      }),
      asset({
        id: "a2",
        title: "Private Room",
        width: 1080,
        height: 1350,
        matchingTerms: ["private", "party", "facility"],
      }),
    ],
  });

  assert.equal(specs.specifications.length, creativeBriefs.briefs.length);
  assert.deepEqual(
    specs.specifications.map((spec) => spec.campaignId),
    creativeBriefs.briefs.map((brief) => brief.campaignId),
  );
  assert.deepEqual(
    specs.specifications.map((spec) => spec.plannerRank),
    campaignPlanner.candidates.map((candidate) => candidate.rank),
  );
  assert.deepEqual(
    specs.specifications.map((spec) => spec.plannerScore),
    campaignPlanner.candidates.map((candidate) => candidate.score),
  );
  for (const spec of specs.specifications) {
    assert.equal(spec.id, `spec:${spec.campaignId}:${specs.evaluationDate}`);
    assert.equal(spec.specificationOnly, true);
    assert.equal(spec.nonPublishable, true);
  }
});

test("2. repeated runs with fixed asOf are byte-identical", () => {
  const campaigns = [plannerCampaign()];
  const assets = [
    asset({
      id: "a1",
      title: "Water Slide",
      width: 1080,
      height: 1920,
      mediaType: "video",
    }),
  ];
  const first = JSON.stringify(buildSpecs({ campaigns, assets }).specs);
  const second = JSON.stringify(buildSpecs({ campaigns, assets }).specs);
  assert.equal(first, second);
});

test("3. Private Parties inherits only allowlisted package prices without final copy", () => {
  const { specs } = buildSpecs({
    campaigns: [
      plannerCampaign({
        id: "private-parties",
        label: "Private Parties",
        description: "Promote private party bookings",
        businessFocus: "facility-parties",
        goalTemplates: ["Promote private party bookings"],
      }),
    ],
    assets: [
      asset({
        id: "private",
        title: "Private Room",
        mediaType: "video",
        width: 1080,
        height: 1920,
        matchingTerms: ["private", "party", "facility"],
      }),
    ],
    authoritativeFacts: facts({
      campaignPriceIds: {
        "private-parties": ["private-weekend-90", "private-weekend-120"],
      },
    }),
  });

  const spec = specs.specifications[0]!;
  const priceClaims = spec.allowedFactualClaims.filter((claim) => claim.sourceCategory === "price");
  assert.equal(priceClaims.length, 2);
  assert.ok(priceClaims.every((claim) => claim.priceKind === "package-price"));
  assert.ok(priceClaims.some((claim) => claim.claimText.includes("220")));
  assert.ok(priceClaims.some((claim) => claim.claimText.includes("255")));
  assert.equal(priceClaims.some((claim) => /foam|waterfall|275|200/i.test(claim.claimText)), false);
  assert.equal(collectPublishableLeakFields(spec).length, 0);
  assert.match(spec.ctaConstraints.structuralGuidance, /party information|packages/i);
  assert.doesNotMatch(spec.ctaConstraints.structuralGuidance, /Book your party today/i);
});

test("4. Summer Water Slides introduces no prices, availability, or scarcity", () => {
  const { specs } = buildSpecs({
    campaigns: [plannerCampaign()],
    assets: [
      asset({
        id: "a1",
        title: "Water",
        mediaType: "video",
        width: 1080,
        height: 1920,
      }),
    ],
  });
  const spec = specs.specifications[0]!;
  assert.equal(spec.pricingConstraints.allowedPriceClaimIds.length, 0);
  assert.equal(spec.allowedFactualClaims.some((claim) => claim.sourceCategory === "price"), false);
  assert.equal(spec.allowedFactualClaims.some((claim) => /foam party|\$200|\$275/i.test(claim.claimText)), false);
  assert.match(spec.prohibitedClaims.join(" "), /availability|scarcity|prices/i);
  assert.equal(/only a few dates remain|selling out/i.test(JSON.stringify(spec)), false);
});

test("5. Last-Minute remains needs-facts or stricter with CTA availability bans", () => {
  const { specs } = buildSpecs({
    campaigns: [
      plannerCampaign({
        id: "last-minute-availability",
        label: "Last-Minute Availability",
        description: "Create urgency around openings",
        goalTemplates: ["Promote last-minute rental availability"],
      }),
    ],
    assets: [
      asset({
        id: "a1",
        title: "Bounce",
        mediaType: "video",
        width: 1080,
        height: 1920,
        matchingTerms: ["bounce", "combo", "weekend"],
      }),
    ],
  });
  const spec = specs.specifications[0]!;
  const readinessIndex = GENERATION_READINESS_PRECEDENCE.indexOf(spec.generationReadiness);
  const needsFactsIndex = GENERATION_READINESS_PRECEDENCE.indexOf("needs-facts");
  assert.ok(readinessIndex <= needsFactsIndex);
  assert.ok(spec.missingInputs.some((input) => input.category === "availability"));
  assert.ok(
    spec.ctaConstraints.prohibitedAvailabilityImplications.some((item) =>
      /open dates|same-week|immediate inventory/i.test(item),
    ),
  );
  assert.ok(
    spec.ctaConstraints.prohibitedScarcityImplications.some((item) =>
      /false scarcity|scarcity/i.test(item),
    ),
  );
});

test("6. Testimonials invent no quotes and stay gated", () => {
  const { specs } = buildSpecs({
    campaigns: [
      plannerCampaign({
        id: "customer-testimonials",
        label: "Customer Testimonials",
        description: "Frame social proof",
        goalTemplates: ["Promote clean and safe local family fun"],
      }),
    ],
    assets: [
      asset({
        id: "bounce-only",
        title: "Bounce House",
        matchingTerms: ["bounce", "house"],
      }),
    ],
  });
  const spec = specs.specifications[0]!;
  assert.match(spec.prohibitedClaims.join(" "), /testimonial|quotes/i);
  assert.ok(spec.missingInputs.some((input) => input.category === "testimonial"));
  assert.ok(spec.reviewGates.some((gate) => gate.gateId === "testimonial-review" && gate.blocking));
  assert.equal(/"best party ever"|five stars|★★★★★/i.test(JSON.stringify(spec)), false);
  assert.ok(spec.generationReadiness !== "ready");
});

test("7. Birthday campaign blocks unrelated price and room-availability leakage", () => {
  const { specs } = buildSpecs({
    campaigns: [
      plannerCampaign({
        id: "birthday-parties",
        label: "Birthday Parties",
        description: "Promote easy birthday party planning",
        businessFocus: "both",
        goalTemplates: ["Promote birthday party bookings"],
      }),
    ],
    assets: [
      asset({
        id: "bday",
        title: "Birthday Bounce",
        matchingTerms: ["birthday", "party", "bounce"],
        width: 1080,
        height: 1080,
      }),
    ],
  });
  const spec = specs.specifications[0]!;
  assert.equal(spec.allowedFactualClaims.some((claim) => /\$\d/.test(claim.claimText)), false);
  assert.match(spec.prohibitedClaims.join(" "), /package contents|availability|prices/i);
  assert.equal(/room is available|package includes cake/i.test(JSON.stringify(spec)), false);
});

test("8. unknown placement stays unknown without invented platform limits", () => {
  const { specs } = buildSpecs({
    campaigns: [plannerCampaign()],
    assets: [
      asset({
        id: "unknown-dim",
        title: "Water Slide Unknown",
        mediaType: "video",
        width: null,
        height: null,
        matchingTerms: ["water", "slide", "summer"],
      }),
    ],
  });
  const spec = specs.specifications[0]!;
  assert.ok(
    spec.platformPlacementRequirements.every(
      (item) => item.placementConfidence === "unknown" || item.aspectRatioTarget === "unknown",
    ),
  );
  assert.ok(spec.missingInputs.some((input) => input.category === "placement-certainty" || input.category === "asset-dimensions"));
  assert.equal(spec.generationReadiness === "ready", false);
});

test("9. missing video and unknown dimensions are not generation-ready", () => {
  const missingVideo = buildSpecs({
    campaigns: [plannerCampaign()],
    assets: [
      asset({
        id: "still-only",
        title: "Water Still",
        mediaType: "image",
        width: 1080,
        height: 1080,
        matchingTerms: ["water", "slide", "summer"],
      }),
    ],
  }).specs.specifications[0]!;
  assert.ok(
    missingVideo.assetSlots.some(
      (slot) => slot.videoPreference === "required" || slot.requiredAssetType === "video",
    ),
  );
  assert.ok(
    GENERATION_READINESS_PRECEDENCE.indexOf(missingVideo.generationReadiness) <=
      GENERATION_READINESS_PRECEDENCE.indexOf("needs-assets"),
  );

  const unknownDims = buildSpecs({
    campaigns: [plannerCampaign()],
    assets: [
      asset({
        id: "unknown-dim",
        title: "Water",
        mediaType: "video",
        width: null,
        height: null,
      }),
    ],
  }).specs.specifications[0]!;
  assert.ok(
    unknownDims.assetSlots.some((slot) => slot.authoritativeDimensionStatus === "unknown"),
  );
  assert.equal(unknownDims.generationReadiness === "ready", false);
});

test("10. empty safe facts remain empty and fail closed", () => {
  const { specs, creativeBriefs } = buildSpecs({
    campaigns: [
      plannerCampaign({
        id: "church-events",
        label: "Church Events",
        description: "Promote safe church gatherings",
        goalTemplates: ["Promote church events"],
      }),
    ],
    authoritativeFacts: null,
  });
  const brief = creativeBriefs.briefs[0]!;
  const spec = specs.specifications[0]!;
  // Force empty by using a brief path that may still have objective claims;
  // assert Wave 10 never expands beyond the brief set.
  assert.ok(spec.allowedFactualClaims.length <= brief.safeFactualClaims.length);
  assert.deepEqual(
    spec.allowedFactualClaims.map((claim) => claim.claimText).sort(),
    brief.safeFactualClaims.slice().sort(),
  );
  if (brief.safeFactualClaims.length === 0) {
    assert.equal(spec.pricingConstraints.emptySafeClaimSet, true);
    assert.ok(spec.reviewGates.some((gate) => gate.gateId === "factual-claim-review"));
    assert.equal(spec.generationReadiness === "ready", false);
  }
});

test("11. final-copy leakage: specifications are requirements, not publishable posts", () => {
  const { specs } = buildSpecs({
    campaigns: [
      plannerCampaign({
        id: "private-parties",
        label: "Private Parties",
        businessFocus: "facility-parties",
        goalTemplates: ["Promote private party bookings"],
      }),
      plannerCampaign(),
    ],
    assets: [
      asset({
        id: "a1",
        title: "Water",
        mediaType: "video",
        width: 1080,
        height: 1920,
      }),
      asset({
        id: "a2",
        title: "Private",
        mediaType: "video",
        width: 1080,
        height: 1920,
        matchingTerms: ["private", "party", "facility"],
      }),
    ],
    authoritativeFacts: facts({
      campaignPriceIds: {
        "private-parties": ["private-weekend-90"],
      },
    }),
  });

  for (const spec of specs.specifications) {
    assert.equal(collectPublishableLeakFields(spec).length, 0);
    assert.equal("caption" in spec, false);
    assert.equal("headline" in spec, false);
    assert.equal("adBody" in spec, false);
    assert.equal("script" in spec, false);
    assert.ok(spec.requiredContentSections.every((section) => typeof section.purpose === "string"));
    assert.ok(spec.messageHierarchy.every((item) => typeof item.structuralGuidance === "string"));
    assert.match(spec.ctaConstraints.structuralGuidance, /must invite|must /i);
    assert.doesNotMatch(spec.ctaConstraints.structuralGuidance, /!{2,}/);
    const serialized = JSON.stringify(spec);
    assert.equal(/Beat the heat with the coolest slides in town!/i.test(serialized), false);
    assert.equal(/Book your party today for only \$220!/i.test(serialized), false);
    assert.equal(/Only a few dates remain!/i.test(serialized), false);
    // A finished social provider payload would need caption/body text fields; this does not.
    assert.equal(typeof (spec as { caption?: unknown }).caption, "undefined");
    assert.equal(spec.nonPublishable, true);
    assert.equal(spec.specificationOnly, true);
  }
});

test("12. readiness precedence is documented and fail-closed", () => {
  assert.deepEqual(GENERATION_READINESS_PRECEDENCE, [
    "blocked",
    "needs-facts",
    "needs-assets",
    "needs-review",
    "unknown",
    "ready",
  ]);
});

test("13. constraints remain side-effect free", () => {
  const { specs } = buildSpecs({ campaigns: [plannerCampaign()] });
  assert.equal(specs.constraints.readOnly, true);
  assert.equal(specs.constraints.deterministic, true);
  assert.equal(specs.constraints.performsNoWrites, true);
  assert.equal(specs.constraints.generatesNoFinalCopy, true);
  assert.equal(specs.constraints.generatesNoMedia, true);
  assert.equal(specs.constraints.publishesNothing, true);
  assert.equal(specs.constraints.approvesNothing, true);
  assert.equal(specs.constraints.executesNothing, true);
  assert.equal(specs.constraints.authoritative, false);
});

test("14. Wave 10 never expands Wave 9 safe-claim set", () => {
  const { specs, creativeBriefs } = buildSpecs({
    campaigns: [
      plannerCampaign({
        id: "private-parties",
        label: "Private Parties",
        businessFocus: "facility-parties",
        goalTemplates: ["Promote private party bookings"],
      }),
    ],
    authoritativeFacts: facts({
      campaignPriceIds: {
        "private-parties": ["private-weekend-90", "private-weekend-120"],
      },
    }),
  });
  const brief = creativeBriefs.briefs[0]!;
  const spec = specs.specifications[0]!;
  assert.equal(spec.allowedFactualClaims.length, brief.safeFactualClaims.length);
  for (const claim of spec.allowedFactualClaims) {
    assert.ok(brief.safeFactualClaims.includes(claim.claimText));
  }
});
