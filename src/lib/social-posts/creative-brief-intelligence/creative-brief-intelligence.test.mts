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
import type { MarketingMemorySnapshot } from "../marketing-memory/marketing-memory-types";
import { buildSeasonalIntelligence } from "../seasonal-intelligence/seasonal-intelligence-service";
import { buildCreativeBriefIntelligence } from "./creative-brief-intelligence-service";
import type { CreativeBriefAuthoritativeFacts } from "./creative-brief-intelligence-types";

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
      {
        source: "rental-catalog",
        id: "basic-bounce",
        label: "Basic Bounce House",
        amountUsd: 150,
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

function buildPipeline(input: {
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

  return buildCreativeBriefIntelligence({
    campaignPlanner,
    campaigns: input.campaigns,
    asOf,
    authoritativeFacts:
      input.authoritativeFacts === null
        ? undefined
        : input.authoritativeFacts ?? facts(),
  });
}

test("1. creates deterministic briefs with stable ids and planner order", () => {
  const campaigns = [
    plannerCampaign({ id: "private-parties", label: "Private Parties", businessFocus: "facility-parties" }),
    plannerCampaign(),
  ];
  const snapshot = buildPipeline({
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

  assert.equal(snapshot.briefs.length, 2);
  assert.deepEqual(
    snapshot.briefs.map((brief) => brief.campaignId),
    snapshot.briefs.map((brief) => brief.campaignId),
  );
  const planner = buildCampaignPlanner({
    campaigns,
    marketingMemory: emptyMemory(),
    seasonalIntelligence: buildSeasonalIntelligence({
      asOf: AS_OF,
      marketingMemory: emptyMemory(),
    }),
    assetIntelligence: buildAssetIntelligence({
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
      campaigns: campaigns.map(assetCampaign),
      asOf: AS_OF,
    }),
    generatedAt: AS_OF,
  });
  assert.deepEqual(
    snapshot.briefs.map((brief) => brief.campaignId),
    planner.candidates.map((candidate) => candidate.campaignId),
  );
  assert.deepEqual(
    snapshot.briefs.map((brief) => brief.plannerRank),
    planner.candidates.map((candidate) => candidate.rank),
  );
  assert.deepEqual(
    snapshot.briefs.map((brief) => brief.plannerScore),
    planner.candidates.map((candidate) => candidate.score),
  );
  for (const brief of snapshot.briefs) {
    assert.equal(brief.id, `brief:${brief.campaignId}:${snapshot.evaluationDate}`);
  }
});

test("2. repeated runs with the same asOf are byte-identical", () => {
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
  const first = JSON.stringify(buildPipeline({ campaigns, assets }));
  const second = JSON.stringify(buildPipeline({ campaigns, assets }));
  assert.equal(first, second);
});

test("3. explicit asOf drives evaluation date", () => {
  const snapshot = buildPipeline({
    campaigns: [plannerCampaign()],
    asOf: "2026-07-16",
  });
  assert.equal(snapshot.evaluationDate, "2026-07-16");
  assert.equal(snapshot.generatedAt, "2026-07-16");
});

test("4. seasonal final-call allows urgency guidance without false scarcity", () => {
  const snapshot = buildPipeline({
    campaigns: [plannerCampaign({ id: "beat-the-heat", label: "Beat the Heat" })],
    assets: [
      asset({
        id: "a1",
        title: "Splash Video",
        mediaType: "video",
        width: 1080,
        height: 1920,
        matchingTerms: ["hot", "water", "splash", "slide"],
      }),
    ],
    asOf: "2026-08-20T16:00:00.000Z",
  });
  const brief = snapshot.briefs[0]!;
  const prohibited = brief.prohibitedClaims.join(" ");
  assert.match(prohibited, /false scarcity/i);
  assert.equal(prohibited.includes("only 2 left"), false);
  if (brief.seasonalContext.urgencyGuidance) {
    assert.match(brief.seasonalContext.urgencyGuidance, /without inventing stock limits|seasonal/i);
  }
});

test("5. unsupported discounts are prohibited", () => {
  const snapshot = buildPipeline({
    campaigns: [plannerCampaign()],
    authoritativeFacts: facts({ rentalStartingPrices: [], facilityPackagePrices: [] }),
  });
  const prohibited = snapshot.briefs[0]!.prohibitedClaims.join(" ");
  assert.match(prohibited, /discount/i);
  assert.match(prohibited, /specific prices/i);
});

test("6. authoritative prices may appear as safe factual claims", () => {
  const snapshot = buildPipeline({
    campaigns: [plannerCampaign()],
    assets: [
      asset({
        id: "a1",
        title: "Water Slide",
        mediaType: "video",
        width: 1080,
        height: 1080,
      }),
    ],
    authoritativeFacts: facts({
      campaignPriceIds: {
        "summer-water-slides": ["blue-waterfall"],
      },
    }),
  });
  const claims = snapshot.briefs[0]!.safeFactualClaims.join(" ");
  assert.match(claims, /Blue Waterfall Slide/);
  assert.match(claims, /275/);
  assert.match(claims, /starting-price/);
  assert.equal(claims.toLowerCase().includes("50% off"), false);
  assert.equal(claims.includes("Foam Party"), false);
});

test("6b. generic tokens do not attach unrelated catalog or facility prices", () => {
  const snapshot = buildPipeline({
    campaigns: [
      plannerCampaign({
        id: "birthday-parties",
        label: "Birthday Parties",
        description: "Promote easy birthday party planning with water slide fun.",
        businessFocus: "both",
        goalTemplates: ["Promote birthday party bookings"],
      }),
      plannerCampaign({
        id: "customer-testimonials",
        label: "Customer Testimonials",
        description: "Frame social proof and parent-friendly trust.",
        goalTemplates: ["Promote clean and safe local family fun"],
      }),
      plannerCampaign({
        id: "summer-water-slides",
        label: "Summer Water Slides",
        description: "Push high-energy summer slide rentals for hot weekends.",
        goalTemplates: ["Promote water slides for hot weather"],
      }),
    ],
    authoritativeFacts: facts({
      campaignPriceIds: {},
    }),
  });

  for (const brief of snapshot.briefs) {
    const priceClaims = brief.safeFactualClaims.filter((claim) => /\$\d/.test(claim));
    assert.equal(
      priceClaims.length,
      0,
      `${brief.campaignId} unexpectedly claimed prices: ${priceClaims.join(" | ")}`,
    );
  }
});

test("6c. explicit allowlist attaches only selected ids and preserves price kind", () => {
  const snapshot = buildPipeline({
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
        "private-parties": ["private-weekend-90"],
      },
    }),
  });
  const brief = snapshot.briefs[0]!;
  const claims = brief.safeFactualClaims.join(" ");
  assert.match(claims, /Private party weekend 90 minutes/);
  assert.match(claims, /package price reference/);
  assert.equal(claims.includes("Blue Waterfall Slide"), false);
  assert.equal(claims.includes("Foam Party"), false);
  assert.equal(claims.includes("120 minutes"), false);
});

test("6d. business-focus gate blocks rental prices on facility campaigns", () => {
  const snapshot = buildPipeline({
    campaigns: [
      plannerCampaign({
        id: "private-parties",
        label: "Private Parties",
        description: "Promote private party bookings",
        businessFocus: "facility-parties",
        goalTemplates: ["Promote private party bookings"],
      }),
    ],
    authoritativeFacts: facts({
      campaignPriceIds: {
        "private-parties": ["blue-waterfall", "private-weekend-90"],
      },
    }),
  });
  const claims = snapshot.briefs[0]!.safeFactualClaims.join(" ");
  assert.equal(claims.includes("Blue Waterfall Slide"), false);
  assert.match(claims, /Private party weekend 90 minutes/);
});

test("7. unknown price handling omits invented amounts", () => {
  const snapshot = buildPipeline({
    campaigns: [
      plannerCampaign({
        id: "church-events",
        label: "Church Events",
        description: "Promote safe church gatherings",
        goalTemplates: ["Promote church events"],
      }),
    ],
    authoritativeFacts: facts({ rentalStartingPrices: [], facilityPackagePrices: [] }),
  });
  const brief = snapshot.briefs[0]!;
  assert.equal(brief.safeFactualClaims.some((claim) => /\$\d/.test(claim)), false);
  assert.match(brief.prohibitedClaims.join(" "), /specific prices/i);
});

test("8. testimonial campaign without testimonial asset prohibits invented quotes", () => {
  const snapshot = buildPipeline({
    campaigns: [
      plannerCampaign({
        id: "customer-testimonials",
        label: "Customer Testimonials",
        description: "Frame social proof",
        goalTemplates: ["Promote clean and safe local family fun"],
        captionAngles: ["Families trust Jumping Jax"],
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
  const brief = snapshot.briefs[0]!;
  assert.match(brief.prohibitedClaims.join(" "), /invent customer quotes/i);
  assert.ok(
    brief.readiness === "needs-assets" ||
      brief.readiness === "blocked" ||
      brief.readiness === "unknown",
  );
});

test("9. video campaign without video identifies required video asset", () => {
  const snapshot = buildPipeline({
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
  });
  const brief = snapshot.briefs[0]!;
  assert.ok(brief.contentStrategy.requiredNewAssets.some((item) => item.kind === "video"));
  assert.equal(brief.contentStrategy.videoOrStillRequirement, "video-required-gap");
  assert.equal(brief.readiness, "needs-assets");
});

test("10. unknown asset dimensions do not claim known placement confidence", () => {
  const snapshot = buildPipeline({
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
  const brief = snapshot.briefs[0]!;
  assert.equal(brief.contentStrategy.placementConfidence, "unknown");
  assert.match(brief.prohibitedClaims.join(" "), /placement fit/i);
});

test("11. missing format coverage becomes required assets", () => {
  const snapshot = buildPipeline({
    campaigns: [plannerCampaign()],
    assets: [
      asset({
        id: "square-only",
        title: "Water Square",
        mediaType: "video",
        width: 1080,
        height: 1080,
        matchingTerms: ["water", "slide", "summer"],
      }),
    ],
  });
  const brief = snapshot.briefs[0]!;
  assert.ok(
    brief.contentStrategy.requiredNewAssets.some(
      (item) => item.kind === "portrait-reel" || item.kind === "landscape",
    ) || brief.missingAssets.length > 0 || brief.contentStrategy.aspectRatioNeeds.length > 0,
  );
});

test("12. repeated theme differentiation warning", () => {
  const memory = emptyMemory();
  const withHistory: MarketingMemorySnapshot = {
    ...memory,
    campaignHistory: [
      {
        value: "Summer Water Slides",
        count: 4,
        mostRecentAt: "2026-07-01T12:00:00.000Z",
      },
    ],
  };
  const snapshot = buildPipeline({
    campaigns: [plannerCampaign()],
    memory: withHistory,
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
  const brief = snapshot.briefs[0]!;
  assert.ok(brief.memoryConstraints.differentiationGuidance);
  assert.ok(brief.memoryConstraints.repetitionWarnings.length > 0);
  assert.equal(brief.readiness === "needs-review" || brief.plannerStatus === "review", true);
});

test("13. missing facts for last-minute availability", () => {
  const snapshot = buildPipeline({
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
  const brief = snapshot.briefs[0]!;
  assert.ok(brief.missingFacts.some((fact) => /availability/i.test(fact)));
  assert.match(brief.prohibitedClaims.join(" "), /open dates|availability/i);
  assert.equal(brief.readiness, "needs-facts");
});

test("14. blocked and unknown readiness states", () => {
  const blocked = buildPipeline({
    campaigns: [plannerCampaign()],
    assets: [
      asset({
        id: "unrelated",
        title: "Church Event",
        matchingTerms: ["church", "event"],
      }),
    ],
  });
  assert.equal(blocked.briefs[0]!.readiness, "blocked");

  const unknown = buildPipeline({
    campaigns: [plannerCampaign()],
    assets: [],
  });
  assert.equal(unknown.briefs[0]!.readiness, "unknown");
});

test("15. unrelated campaign isolation keeps private parties away from summer boost messaging", () => {
  const snapshot = buildPipeline({
    campaigns: [
      plannerCampaign({
        id: "private-parties",
        label: "Private Parties",
        description: "Promote private party bookings",
        businessFocus: "facility-parties",
        goalTemplates: ["Promote private party bookings"],
        captionAngles: ["A private party gives families room to celebrate"],
        promptAngles: ["private birthday party indoor"],
      }),
    ],
    assets: [
      asset({
        id: "private",
        title: "Private Room",
        mediaType: "video",
        width: 1080,
        height: 1920,
        matchingTerms: ["private", "party", "facility", "indoor"],
      }),
    ],
    asOf: "2026-07-16T16:00:00.000Z",
    authoritativeFacts: facts({
      campaignPriceIds: {
        "private-parties": ["private-weekend-90"],
      },
    }),
  });
  const brief = snapshot.briefs[0]!;
  assert.equal(brief.campaignId, "private-parties");
  const text = [
    ...brief.seasonalContext.matchedOpportunityKeys,
    brief.seasonalContext.urgencyGuidance ?? "",
    ...brief.messageStrategy.supportingProofPoints,
    ...brief.safeFactualClaims,
  ].join(" ").toLowerCase();
  assert.equal(text.includes("blue waterfall slide"), false);
  assert.equal(text.includes("foam party"), false);
  assert.match(brief.messageStrategy.callToAction, /party rooms/i);
  assert.doesNotMatch(brief.messageStrategy.callToAction, /available party rooms/i);
});

test("16. no invented local dates events or availability in safe claims", () => {
  const snapshot = buildPipeline({
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
  const claims = snapshot.briefs[0]!.safeFactualClaims.join(" ").toLowerCase();
  assert.equal(/school starts|only three left|guaranteed available tomorrow|limited stock of \d+/i.test(claims), false);
  assert.match(snapshot.briefs[0]!.prohibitedClaims.join(" "), /school calendars|local festivals|scarcity/i);
});

test("17. readiness summary counts are stable", () => {
  const snapshot = buildPipeline({
    campaigns: [
      plannerCampaign(),
      plannerCampaign({
        id: "last-minute-availability",
        label: "Last-Minute Availability",
        description: "Openings",
        goalTemplates: ["Promote last-minute rental availability"],
      }),
    ],
    assets: [],
  });
  const total =
    snapshot.readinessSummary.ready +
    snapshot.readinessSummary.needsAssets +
    snapshot.readinessSummary.needsFacts +
    snapshot.readinessSummary.needsReview +
    snapshot.readinessSummary.blocked +
    snapshot.readinessSummary.unknown;
  assert.equal(total, snapshot.briefs.length);
});

test("18. constraints remain fail-closed and side-effect free", () => {
  const snapshot = buildPipeline({
    campaigns: [plannerCampaign()],
  });
  assert.equal(snapshot.constraints.readOnly, true);
  assert.equal(snapshot.constraints.deterministic, true);
  assert.equal(snapshot.constraints.performsNoWrites, true);
  assert.equal(snapshot.constraints.performsNoNetworkCalls, true);
  assert.equal(snapshot.constraints.createsNoDrafts, true);
  assert.equal(snapshot.constraints.generatesNothing, true);
  assert.equal(snapshot.constraints.schedulesNothing, true);
  assert.equal(snapshot.constraints.publishesNothing, true);
  assert.equal(snapshot.constraints.approvesNothing, true);
  assert.equal(snapshot.constraints.executesNothing, true);
  assert.equal(snapshot.constraints.authoritative, false);
});
