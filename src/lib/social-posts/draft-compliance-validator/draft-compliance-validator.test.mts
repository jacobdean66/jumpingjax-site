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
import { buildContentDraftSpecificationIntelligence } from "../content-draft-specification/content-draft-specification-service";
import type { ContentDraftSpecification } from "../content-draft-specification/content-draft-specification-types";
import {
  allowedPriceAmountsCents,
  extractMonetaryAmountsCents,
  resolveSpecificationForCandidate,
  validateDraftCandidate,
} from "./draft-compliance-validator-domain";
import { listDraftComplianceFixtureCandidates } from "./draft-compliance-validator-fixtures";
import { buildDraftComplianceValidator } from "./draft-compliance-validator-service";
import type { DraftCandidate } from "./draft-compliance-validator-types";

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

function assetCampaign(campaign: CampaignPlannerCampaign): AssetIntelligenceCampaign {
  return {
    id: campaign.id,
    label: campaign.label,
    businessFocus: campaign.businessFocus,
    defaultMediaType: campaign.defaultMediaType,
    preferredImageKeywords: campaign.id.includes("water")
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
  const classified = classifyAspectRatio(overrides.width ?? null, overrides.height ?? null);
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
      input.authoritativeFacts === null ? undefined : (input.authoritativeFacts ?? facts()),
  });

  return buildContentDraftSpecificationIntelligence({
    creativeBriefs,
    asOf,
  });
}

function candidate(
  overrides: Partial<DraftCandidate> & Pick<DraftCandidate, "id" | "campaignId" | "label">,
): DraftCandidate {
  return {
    sourceSpecificationId: overrides.sourceSpecificationId ?? null,
    fixtureKind: overrides.fixtureKind ?? "deterministic-test-fixture",
    id: overrides.id,
    campaignId: overrides.campaignId,
    label: overrides.label,
    sections: {
      hook: null,
      primaryMessage: null,
      supportingProof: null,
      cta: null,
      fullCaption: null,
      ...overrides.sections,
    },
    declaredPlatform: overrides.declaredPlatform ?? null,
    declaredPlacement: overrides.declaredPlacement ?? null,
    mediaDeclarations: {
      hasImage: false,
      hasVideo: false,
      imageAltText: null,
      videoCaptionsOrTranscript: null,
      claimsImageOnly: false,
      ...overrides.mediaDeclarations,
    },
  };
}

function specByCampaign(
  specs: readonly ContentDraftSpecification[],
  campaignId: string,
): ContentDraftSpecification {
  const match = specs.find((item) => item.campaignId === campaignId);
  assert.ok(match, `missing specification for ${campaignId}`);
  return match;
}

function standardCampaignSet(): CampaignPlannerCampaign[] {
  return [
    plannerCampaign({
      id: "private-parties",
      label: "Private Parties",
      businessFocus: "facility-parties",
      defaultMediaType: "image",
    }),
    plannerCampaign(),
    plannerCampaign({
      id: "last-minute-availability",
      label: "Last-Minute Availability",
      goalTemplates: ["Promote last-minute rental availability"],
    }),
    plannerCampaign({
      id: "customer-testimonials",
      label: "Customer Testimonials",
      goalTemplates: ["Share customer testimonials"],
    }),
    plannerCampaign({
      id: "birthday-parties",
      label: "Birthday Parties",
      description: "Promote easy birthday party planning",
      goalTemplates: ["Promote birthday party bookings"],
    }),
  ];
}

function standardAssets(): AssetIntelligenceAsset[] {
  return [
    asset({
      id: "a-water",
      title: "Water Slide",
      width: 1080,
      height: 1080,
      mediaType: "video",
      matchingTerms: ["water", "slide", "summer"],
    }),
    asset({
      id: "a-private",
      title: "Private Room",
      width: 1080,
      height: 1350,
      matchingTerms: ["private", "party", "facility"],
    }),
    asset({
      id: "a-birthday",
      title: "Birthday Bounce",
      width: 1080,
      height: 1080,
      matchingTerms: ["birthday", "party", "bounce"],
    }),
  ];
}

test("1. price normalization treats $220 and $220.00 as the same amount", () => {
  assert.deepEqual(extractMonetaryAmountsCents("Only $220 tonight"), [22000]);
  assert.deepEqual(extractMonetaryAmountsCents("Package is $220.00"), [22000]);
  assert.deepEqual(extractMonetaryAmountsCents("$1,255.50 and $200"), [20000, 125550]);
});

test("2. authorized private-party prices pass only when present on that specification", () => {
  const snapshot = buildSpecs({
    campaigns: standardCampaignSet(),
    assets: standardAssets(),
    authoritativeFacts: facts({
      campaignPriceIds: {
        "private-parties": ["private-weekend-90", "private-weekend-120"],
      },
    }),
  });
  const privateSpec = specByCampaign(snapshot.specifications, "private-parties");
  const summerSpec = specByCampaign(snapshot.specifications, "summer-water-slides");

  assert.deepEqual(allowedPriceAmountsCents(privateSpec), [22000, 25500]);
  assert.deepEqual(allowedPriceAmountsCents(summerSpec), []);

  const ok = validateDraftCandidate({
    asOf: AS_OF,
    specification: privateSpec,
    candidate: candidate({
      id: "t-private-ok",
      campaignId: "private-parties",
      label: "ok",
      sections: {
        hook: "Come celebrate with us!",
        primaryMessage: "Plan your next party with Jumping Jax.",
        supportingProof: privateSpec.allowedFactualClaims.find((c) => /\$220/.test(c.claimText))!
          .claimText,
        cta: "Explore party options with Jumping Jax.",
        fullCaption: null,
      },
    }),
  });
  assert.equal(
    ok.blockingViolations.some((item) => item.code === "unauthorized-price"),
    false,
  );

  const leak = validateDraftCandidate({
    asOf: AS_OF,
    specification: summerSpec,
    candidate: candidate({
      id: "t-summer-leak",
      campaignId: "summer-water-slides",
      label: "leak",
      sections: {
        hook: "Ready for backyard fun?",
        primaryMessage: "Private parties from $220.00",
        supportingProof: null,
        cta: "Visit Jumping Jax for family fun.",
        fullCaption: null,
      },
    }),
  });
  assert.ok(leak.blockingViolations.some((item) => item.code === "unauthorized-price"));
  assert.equal(leak.resultState, "violations-found");
});

test("3. empty allowed-price set rejects every candidate price", () => {
  const snapshot = buildSpecs({
    campaigns: [plannerCampaign()],
    assets: standardAssets(),
  });
  const spec = specByCampaign(snapshot.specifications, "summer-water-slides");
  assert.equal(allowedPriceAmountsCents(spec).length, 0);

  const evaluation = validateDraftCandidate({
    asOf: AS_OF,
    specification: spec,
    candidate: candidate({
      id: "t-empty-price",
      campaignId: "summer-water-slides",
      label: "price",
      sections: {
        hook: "Ready for backyard fun?",
        primaryMessage: "Waterslides start at $275.",
        supportingProof: null,
        cta: "Visit Jumping Jax for family fun.",
        fullCaption: null,
      },
    }),
  });
  assert.ok(evaluation.blockingViolations.some((item) => item.code === "unauthorized-price"));
});

test("4. unauthorized foam/rental/discount prices fail on private parties", () => {
  const snapshot = buildSpecs({
    campaigns: standardCampaignSet(),
    assets: standardAssets(),
    authoritativeFacts: facts({
      campaignPriceIds: {
        "private-parties": ["private-weekend-90", "private-weekend-120"],
      },
    }),
  });
  const spec = specByCampaign(snapshot.specifications, "private-parties");
  for (const price of ["$200", "$275", "$99"]) {
    const evaluation = validateDraftCandidate({
      asOf: AS_OF,
      specification: spec,
      candidate: candidate({
        id: `t-bad-price-${price}`,
        campaignId: "private-parties",
        label: price,
        sections: {
          hook: "Come celebrate with us!",
          primaryMessage: `Book now for only ${price}.`,
          supportingProof: null,
          cta: "Explore party options with Jumping Jax.",
          fullCaption: null,
        },
      }),
    });
    assert.ok(
      evaluation.blockingViolations.some((item) => item.code === "unauthorized-price"),
      price,
    );
  }
});

test("5. availability, scarcity, and urgency fail closed", () => {
  const snapshot = buildSpecs({
    campaigns: standardCampaignSet(),
    assets: standardAssets(),
  });
  const summer = specByCampaign(snapshot.specifications, "summer-water-slides");
  const lastMinute = specByCampaign(snapshot.specifications, "last-minute-availability");

  const summerEval = validateDraftCandidate({
    asOf: AS_OF,
    specification: summer,
    candidate: candidate({
      id: "t-summer-avail",
      campaignId: "summer-water-slides",
      label: "avail",
      sections: {
        hook: "Ready for backyard fun?",
        primaryMessage: "Waterslides are available this weekend and only two left.",
        supportingProof: null,
        cta: "Book today before they are gone.",
        fullCaption: null,
      },
    }),
  });
  assert.ok(summerEval.blockingViolations.some((item) => item.code === "availability-claim"));
  assert.ok(summerEval.blockingViolations.some((item) => item.code === "scarcity-claim"));

  const lastEval = validateDraftCandidate({
    asOf: AS_OF,
    specification: lastMinute,
    candidate: candidate({
      id: "t-last-open",
      campaignId: "last-minute-availability",
      label: "open",
      sections: {
        hook: "Make your weekend memorable.",
        primaryMessage: "Dates are open with immediate availability.",
        supportingProof: "Only a few remain.",
        cta: "Book now before they are gone.",
        fullCaption: null,
      },
    }),
  });
  assert.ok(lastEval.blockingViolations.some((item) => item.code === "availability-claim"));
  assert.ok(
    lastEval.blockingViolations.some(
      (item) => item.code === "scarcity-claim" || item.code === "cta-constraint-violation",
    ),
  );
  assert.equal(lastEval.underlyingReadiness === "needs-facts" || lastEval.underlyingReadiness === "blocked" || lastEval.underlyingReadiness === "needs-assets", true);
  assert.equal(lastEval.readinessUpgraded, false);
});

test("6. testimonials and ratings fail without authoritative facts", () => {
  const snapshot = buildSpecs({
    campaigns: standardCampaignSet(),
    assets: standardAssets(),
  });
  const spec = specByCampaign(snapshot.specifications, "customer-testimonials");
  const evaluation = validateDraftCandidate({
    asOf: AS_OF,
    specification: spec,
    candidate: candidate({
      id: "t-testimonial",
      campaignId: "customer-testimonials",
      label: "quote",
      sections: {
        hook: "Families love Jumping Jax!",
        primaryMessage: 'Customers say "Best party ever!" with a 5 star rating.',
        supportingProof: "4.9 / 5 from happy parents.",
        cta: "Visit Jumping Jax for family fun.",
        fullCaption: null,
      },
    }),
  });
  assert.ok(evaluation.blockingViolations.some((item) => item.code === "testimonial-claim"));
  assert.equal(evaluation.resultState, "violations-found");
});

test("7. package-content invention fails for birthday and private parties", () => {
  const snapshot = buildSpecs({
    campaigns: standardCampaignSet(),
    assets: standardAssets(),
    authoritativeFacts: facts({
      campaignPriceIds: {
        "private-parties": ["private-weekend-90"],
      },
    }),
  });

  for (const campaignId of ["private-parties", "birthday-parties"] as const) {
    const spec = specByCampaign(snapshot.specifications, campaignId);
    const evaluation = validateDraftCandidate({
      asOf: AS_OF,
      specification: spec,
      candidate: candidate({
        id: `t-package-${campaignId}`,
        campaignId,
        label: "package",
        sections: {
          hook: "Come celebrate with us!",
          primaryMessage: "Package includes free pizza and 2 rooms available.",
          supportingProof: "All setup included with free tables.",
          cta: "Explore party options with Jumping Jax.",
          fullCaption: null,
        },
      }),
    });
    assert.ok(
      evaluation.blockingViolations.some((item) => item.code === "package-content-invention"),
      campaignId,
    );
  }
});

test("8. unclassifiable factual assertion is never compliant", () => {
  const snapshot = buildSpecs({
    campaigns: [plannerCampaign()],
    assets: standardAssets(),
  });
  const spec = specByCampaign(snapshot.specifications, "summer-water-slides");
  const evaluation = validateDraftCandidate({
    asOf: AS_OF,
    specification: spec,
    candidate: candidate({
      id: "t-unclassifiable",
      campaignId: "summer-water-slides",
      label: "unclassifiable",
      sections: {
        hook: "Ready for backyard fun?",
        primaryMessage:
          "Our premium express delivery lane guarantees same-day setup capacity.",
        supportingProof: null,
        cta: "Visit Jumping Jax for family fun.",
        fullCaption: null,
      },
    }),
  });
  assert.notEqual(evaluation.resultState, "compliant");
  assert.ok(
    evaluation.blockingViolations.some(
      (item) => item.code === "unsupported-claim" || item.code === "unverified-claim",
    ),
  );
});

test("9. CTA restrictions and blocking review gates are enforced", () => {
  const snapshot = buildSpecs({
    campaigns: standardCampaignSet(),
    assets: standardAssets(),
  });
  const lastMinute = specByCampaign(snapshot.specifications, "last-minute-availability");
  const evaluation = validateDraftCandidate({
    asOf: AS_OF,
    specification: lastMinute,
    candidate: candidate({
      id: "t-cta",
      campaignId: "last-minute-availability",
      label: "cta",
      sections: {
        hook: "Make your weekend memorable.",
        primaryMessage: "Plan your next party with Jumping Jax.",
        supportingProof: null,
        cta: "Book now for guaranteed availability and open dates.",
        fullCaption: null,
      },
    }),
  });
  assert.ok(
    evaluation.blockingViolations.some(
      (item) =>
        item.code === "cta-constraint-violation" || item.code === "availability-claim",
    ),
  );
});

test("10. accessibility metadata gaps fail closed when media is declared", () => {
  const snapshot = buildSpecs({
    campaigns: [plannerCampaign({ id: "birthday-parties", label: "Birthday Parties" })],
    assets: standardAssets(),
  });
  const spec = specByCampaign(snapshot.specifications, "birthday-parties");
  const evaluation = validateDraftCandidate({
    asOf: AS_OF,
    specification: spec,
    candidate: candidate({
      id: "t-a11y",
      campaignId: "birthday-parties",
      label: "a11y",
      sections: {
        hook: "Come celebrate with us!",
        primaryMessage: "Family-friendly fun awaits!",
        supportingProof: null,
        cta: "Explore party options with Jumping Jax.",
        fullCaption: null,
      },
      mediaDeclarations: {
        hasImage: true,
        hasVideo: false,
        imageAltText: null,
        videoCaptionsOrTranscript: null,
        claimsImageOnly: true,
      },
    }),
  });
  assert.ok(evaluation.blockingViolations.some((item) => item.code === "accessibility-gap"));
});

test("11. platform mismatch is machine-checked when platforms are known", () => {
  const snapshot = buildSpecs({
    campaigns: [plannerCampaign()],
    assets: standardAssets(),
  });
  const spec = specByCampaign(snapshot.specifications, "summer-water-slides");
  const known = spec.platformPlacementRequirements.filter((item) => item.platform !== "unknown");
  if (known.length === 0) {
    const advisory = validateDraftCandidate({
      asOf: AS_OF,
      specification: spec,
      candidate: candidate({
        id: "t-platform-unknown",
        campaignId: "summer-water-slides",
        label: "platform",
        sections: {
          hook: "Ready for backyard fun?",
          primaryMessage: "Family-friendly fun awaits!",
          supportingProof: null,
          cta: "Visit Jumping Jax for family fun.",
          fullCaption: null,
        },
        declaredPlatform: "tiktok",
      }),
    });
    assert.ok(
      advisory.advisoryFindings.some((item) => item.code === "platform-mismatch") ||
        advisory.blockingViolations.some((item) => item.code === "platform-mismatch"),
    );
  } else {
    const evaluation = validateDraftCandidate({
      asOf: AS_OF,
      specification: spec,
      candidate: candidate({
        id: "t-platform-bad",
        campaignId: "summer-water-slides",
        label: "platform",
        sections: {
          hook: "Ready for backyard fun?",
          primaryMessage: "Family-friendly fun awaits!",
          supportingProof: null,
          cta: "Visit Jumping Jax for family fun.",
          fullCaption: null,
        },
        declaredPlatform: "not-a-real-platform",
      }),
    });
    assert.ok(evaluation.blockingViolations.some((item) => item.code === "platform-mismatch"));
  }
});

test("12. incomplete specification readiness is preserved and never upgraded", () => {
  const snapshot = buildSpecs({
    campaigns: standardCampaignSet(),
    assets: standardAssets(),
  });
  const lastMinute = specByCampaign(snapshot.specifications, "last-minute-availability");
  const evaluation = validateDraftCandidate({
    asOf: AS_OF,
    specification: lastMinute,
    candidate: candidate({
      id: "t-readiness",
      campaignId: "last-minute-availability",
      label: "rhetoric",
      sections: {
        hook: "Make your weekend memorable.",
        primaryMessage: "Family-friendly fun awaits!",
        supportingProof: null,
        cta: "Visit Jumping Jax for family fun.",
        fullCaption: null,
      },
    }),
  });
  assert.equal(evaluation.underlyingReadiness, lastMinute.generationReadiness);
  assert.equal(evaluation.readinessUpgraded, false);
  assert.notEqual(evaluation.underlyingReadiness, "ready");
  if (evaluation.blockingViolations.length === 0) {
    assert.ok(
      evaluation.resultState === "insufficient-spec" ||
        evaluation.resultState === "unknown" ||
        evaluation.resultState === "compliant",
    );
    if (lastMinute.generationReadiness === "needs-facts" || lastMinute.generationReadiness === "blocked") {
      assert.equal(evaluation.resultState, "insufficient-spec");
    }
  }
});

test("13. empty and malformed candidates are not-evaluated", () => {
  const snapshot = buildSpecs({
    campaigns: [plannerCampaign()],
    assets: standardAssets(),
  });
  const spec = snapshot.specifications[0]!;

  const empty = validateDraftCandidate({
    asOf: AS_OF,
    specification: spec,
    candidate: candidate({
      id: "t-empty",
      campaignId: "summer-water-slides",
      label: "empty",
    }),
  });
  assert.equal(empty.resultState, "not-evaluated");
  assert.ok(empty.blockingViolations.some((item) => item.code === "empty-candidate"));

  const malformed = validateDraftCandidate({
    asOf: AS_OF,
    specification: spec,
    candidate: candidate({
      id: "",
      campaignId: "",
      label: "bad",
      sections: {
        hook: "Come celebrate with us!",
        primaryMessage: null,
        supportingProof: null,
        cta: null,
        fullCaption: null,
      },
    }),
  });
  assert.equal(malformed.resultState, "not-evaluated");
  assert.ok(malformed.blockingViolations.some((item) => item.code === "malformed-candidate"));

  const missingSpec = validateDraftCandidate({
    asOf: AS_OF,
    specification: null,
    candidate: candidate({
      id: "t-missing-spec",
      campaignId: "summer-water-slides",
      label: "missing",
      sections: {
        hook: "Ready for backyard fun?",
        primaryMessage: null,
        supportingProof: null,
        cta: null,
        fullCaption: null,
      },
    }),
  });
  assert.equal(missingSpec.resultState, "not-evaluated");
  assert.ok(missingSpec.blockingViolations.some((item) => item.code === "specification-missing"));
});

test("14. fixture set covers required campaign scenarios and is deterministic", () => {
  const snapshot = buildSpecs({
    campaigns: standardCampaignSet(),
    assets: standardAssets(),
    authoritativeFacts: facts({
      campaignPriceIds: {
        "private-parties": ["private-weekend-90", "private-weekend-120"],
      },
    }),
  });

  const fixtures = listDraftComplianceFixtureCandidates();
  assert.ok(fixtures.some((item) => item.id.includes("private-parties:authorized-prices")));
  assert.ok(fixtures.some((item) => item.id.includes("summer-water-slides:unauthorized-price")));
  assert.ok(fixtures.some((item) => item.id.includes("last-minute-availability")));
  assert.ok(fixtures.some((item) => item.id.includes("customer-testimonials")));
  assert.ok(fixtures.some((item) => item.id.includes("birthday-parties")));
  assert.ok(fixtures.some((item) => item.id.includes("unclassifiable")));

  const first = buildDraftComplianceValidator({
    specifications: snapshot.specifications,
    candidates: fixtures,
    asOf: AS_OF,
  });
  const second = buildDraftComplianceValidator({
    specifications: snapshot.specifications,
    candidates: fixtures,
    asOf: AS_OF,
  });

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.constraints.generatesNoFinalCopy, true);
  assert.equal(first.constraints.performsNoNetworkCalls, true);
  assert.equal(first.constraints.authoritative, false);
  assert.ok(first.evaluations.every((item) => item.readinessUpgraded === false));
  assert.ok(first.evaluations.every((item) => item.grantsNoGenerationAuthority === true));
  assert.ok(first.evaluations.every((item) => item.nonPublishable === true));

  const unclassifiable = first.evaluations.find((item) =>
    item.candidateId.includes("unclassifiable"),
  );
  assert.ok(unclassifiable);
  assert.notEqual(unclassifiable.resultState, "compliant");

  const candidateOrder = first.evaluations.map((item) => item.candidateId);
  assert.deepEqual(
    candidateOrder,
    candidateOrder.slice().sort((left, right) => left.localeCompare(right)),
  );
});

test("15. resolveSpecificationForCandidate uses exact specification id when provided", () => {
  const snapshot = buildSpecs({
    campaigns: standardCampaignSet(),
    assets: standardAssets(),
  });
  const privateSpec = specByCampaign(snapshot.specifications, "private-parties");
  const resolved = resolveSpecificationForCandidate(
    candidate({
      id: "t-resolve",
      campaignId: "summer-water-slides",
      label: "resolve",
      sourceSpecificationId: privateSpec.id,
      sections: {
        hook: "Come celebrate with us!",
        primaryMessage: null,
        supportingProof: null,
        cta: null,
        fullCaption: null,
      },
    }),
    snapshot.specifications,
  );
  assert.equal(resolved?.id, privateSpec.id);
});

test("16. no final-copy generation fields are introduced by validator outputs", () => {
  const snapshot = buildSpecs({
    campaigns: [plannerCampaign()],
    assets: standardAssets(),
  });
  const built = buildDraftComplianceValidator({
    specifications: snapshot.specifications,
    candidates: listDraftComplianceFixtureCandidates().filter(
      (item) => item.campaignId === "summer-water-slides",
    ),
    asOf: AS_OF,
  });
  const serialized = JSON.stringify(built);
  for (const key of ["adBody", "finalCta", "generatedCopy", "socialPost", "script"]) {
    assert.equal(serialized.includes(`"${key}"`), false);
  }
});
