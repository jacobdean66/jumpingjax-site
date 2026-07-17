import assert from "node:assert/strict";
import test from "node:test";

import {
  assetMatchesCampaign,
  assetPlannerScoreDelta,
  assetTokenOrPhraseMatches,
  classifyAspectRatio,
  normalizeAssetText,
} from "./asset-intelligence-domain";
import { diagnoseAssetIntelligence } from "./asset-intelligence-diagnostics";
import { buildAssetIntelligence } from "./asset-intelligence-service";
import type {
  AssetIntelligenceAsset,
  AssetIntelligenceCampaign,
} from "./asset-intelligence-types";
import { buildCampaignPlanner } from "../campaign-planner/campaign-planner-service";
import type { CampaignPlannerCampaign } from "../campaign-planner/campaign-planner-types";
import type { MarketingMemorySnapshot } from "../marketing-memory/marketing-memory-types";
import { emptySeasonalIntelligenceSnapshot } from "../seasonal-intelligence/seasonal-intelligence-service";

const AS_OF = "2026-07-16";

function campaign(
  overrides: Partial<AssetIntelligenceCampaign> = {},
): AssetIntelligenceCampaign {
  return {
    id: "summer-water-slides",
    label: "Summer Water Slides",
    businessFocus: "rentals",
    defaultMediaType: "video",
    preferredImageKeywords: ["water", "waterslide", "summer", "splash"],
    ...overrides,
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

function emptyMemory(): MarketingMemorySnapshot {
  return {
    generatedAt: `${AS_OF}T12:00:00.000Z`,
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

test("1. normalizes punctuation into collapsed lowercase tokens", () => {
  assert.equal(normalizeAssetText("Water-Slide!! Splash"), "water slide splash");
});

test("2. rejects substring false positives", () => {
  assert.equal(assetTokenOrPhraseMatches("waterfall rental", "fall"), false);
  assert.equal(assetTokenOrPhraseMatches("preschool event", "school"), false);
  assert.equal(assetTokenOrPhraseMatches("heatwave weekend", "heat"), false);
});

test("3. accepts exact tokens and contiguous phrases", () => {
  assert.equal(assetTokenOrPhraseMatches("back to school event", "school"), true);
  assert.equal(assetTokenOrPhraseMatches("water slide splash", "water slide"), true);
  assert.equal(assetTokenOrPhraseMatches("water-slide splash", "water slide"), true);
});

test("4. classifies square portrait reel and landscape ratios", () => {
  assert.equal(classifyAspectRatio(1080, 1080).aspectRatioClass, "square");
  assert.equal(classifyAspectRatio(1080, 1350).aspectRatioClass, "portrait");
  assert.equal(classifyAspectRatio(1080, 1920).aspectRatioClass, "reel");
  assert.equal(classifyAspectRatio(1920, 1080).aspectRatioClass, "landscape");
  assert.equal(classifyAspectRatio(null, null).aspectRatioClass, "unknown");
});

test("5. matches campaigns with preferred keywords only when tokens align", () => {
  const waterAsset = asset({ id: "a1", title: "Blue Water Slide" });
  const privateAsset = asset({
    id: "a2",
    title: "Indoor Private Party Room",
    matchingTerms: ["private", "party", "indoor", "facility"],
  });
  assert.equal(assetMatchesCampaign(waterAsset, campaign()), true);
  assert.equal(
    assetMatchesCampaign(
      privateAsset,
      campaign({
        id: "private-parties",
        label: "Private Parties",
        preferredImageKeywords: ["private", "party", "facility"],
      }),
    ),
    true,
  );
  assert.equal(assetMatchesCampaign(privateAsset, campaign()), false);
});

test("6. empty inventory yields unknown readiness", () => {
  const snapshot = buildAssetIntelligence({
    assets: [],
    campaigns: [campaign()],
    asOf: AS_OF,
  });
  assert.equal(snapshot.campaignAssessments[0]?.readiness, "unknown");
  assert.equal(snapshot.campaignAssessments[0]?.recommendedCreativeNeed, "new-photography");
});

test("7. no keyword match yields insufficient readiness", () => {
  const snapshot = buildAssetIntelligence({
    assets: [
      asset({
        id: "logo",
        title: "Brand Logo",
        matchingTerms: ["logo", "brand"],
      }),
    ],
    campaigns: [campaign()],
    asOf: AS_OF,
  });
  assert.equal(snapshot.campaignAssessments[0]?.readiness, "insufficient");
  assert.ok(
    snapshot.campaignAssessments[0]?.gaps.some((gap) => gap.kind === "no-relevant-asset"),
  );
});

test("8. ready requires usable square and vertical coverage with video when preferred", () => {
  const snapshot = buildAssetIntelligence({
    assets: [
      asset({
        id: "sq",
        title: "Water Slide Square",
        width: 1080,
        height: 1080,
        mediaType: "image",
      }),
      asset({
        id: "reel",
        title: "Water Slide Reel",
        width: 1080,
        height: 1920,
        mediaType: "video",
      }),
    ],
    campaigns: [campaign()],
    asOf: AS_OF,
  });
  assert.equal(snapshot.campaignAssessments[0]?.readiness, "ready");
  assert.equal(snapshot.readyCampaignIds[0], "summer-water-slides");
});

test("9. missing video keeps partially-ready for video campaigns", () => {
  const snapshot = buildAssetIntelligence({
    assets: [
      asset({ id: "sq", title: "Water Slide Square", width: 1080, height: 1080 }),
      asset({ id: "pr", title: "Water Slide Portrait", width: 1080, height: 1350 }),
    ],
    campaigns: [campaign()],
    asOf: AS_OF,
  });
  assert.equal(snapshot.campaignAssessments[0]?.readiness, "partially-ready");
  assert.ok(snapshot.campaignAssessments[0]?.gaps.some((gap) => gap.kind === "no-video"));
});

test("10. unknown dimensions produce unknown aspect gaps without inventing sizes", () => {
  const snapshot = buildAssetIntelligence({
    assets: [asset({ id: "u1", title: "Water Slide Unknown", width: null, height: null })],
    campaigns: [campaign()],
    asOf: AS_OF,
  });
  assert.ok(
    snapshot.campaignAssessments[0]?.gaps.some((gap) => gap.kind === "unknown-dimensions"),
  );
  assert.equal(snapshot.campaignAssessments[0]?.aspectCoverage.unknown, true);
});

test("11. duplicate and media-history overuse emits repeated-overused-asset", () => {
  const shared = "/assets/water-slide.jpg";
  const snapshot = buildAssetIntelligence({
    assets: [
      asset({ id: "d1", title: "Water Slide A", sourcePathOrUrl: shared, width: 1080, height: 1080 }),
      asset({ id: "d2", title: "Water Slide B", sourcePathOrUrl: shared, width: 1080, height: 1350 }),
      asset({ id: "d3", title: "Water Slide C", sourcePathOrUrl: shared, width: 1080, height: 1920, mediaType: "video" }),
    ],
    campaigns: [campaign()],
    mediaHistory: [{ value: shared, count: 3 }],
    asOf: AS_OF,
  });
  assert.ok(
    snapshot.campaignAssessments[0]?.gaps.some((gap) => gap.kind === "repeated-overused-asset"),
  );
});

test("12. stale assets warn for no-recent-asset", () => {
  const snapshot = buildAssetIntelligence({
    assets: [
      asset({
        id: "old",
        title: "Old Water Slide",
        createdAt: "2024-01-01",
        width: 1080,
        height: 1080,
      }),
      asset({
        id: "old2",
        title: "Old Water Slide Vertical",
        createdAt: "2024-01-01",
        width: 1080,
        height: 1920,
        mediaType: "video",
      }),
    ],
    campaigns: [campaign()],
    asOf: AS_OF,
  });
  assert.ok(snapshot.campaignAssessments[0]?.gaps.some((gap) => gap.kind === "no-recent-asset"));
});

test("13. testimonial campaigns require testimonial-tagged assets", () => {
  const snapshot = buildAssetIntelligence({
    assets: [
      asset({
        id: "party",
        title: "Family Party Bounce",
        matchingTerms: ["family", "party", "bounce"],
        width: 1080,
        height: 1080,
      }),
    ],
    campaigns: [
      campaign({
        id: "customer-testimonials",
        label: "Customer Testimonials",
        preferredImageKeywords: ["family", "party", "bounce"],
      }),
    ],
    asOf: AS_OF,
  });
  assert.ok(snapshot.campaignAssessments[0]?.gaps.some((gap) => gap.kind === "no-testimonial"));
});

test("14. unrelated campaigns stay unaffected by water assets", () => {
  const snapshot = buildAssetIntelligence({
    assets: [
      asset({ id: "w1", title: "Water Slide", width: 1080, height: 1080 }),
      asset({ id: "w2", title: "Water Slide Reel", width: 1080, height: 1920, mediaType: "video" }),
    ],
    campaigns: [
      campaign(),
      campaign({
        id: "private-parties",
        label: "Private Parties",
        businessFocus: "facility-parties",
        preferredImageKeywords: ["private", "party", "facility", "indoor"],
      }),
    ],
    asOf: AS_OF,
  });
  const water = snapshot.campaignAssessments.find((item) => item.campaignId === "summer-water-slides");
  const privateParties = snapshot.campaignAssessments.find((item) => item.campaignId === "private-parties");
  assert.equal(water?.readiness, "ready");
  assert.equal(privateParties?.readiness, "insufficient");
});

test("15. output ordering and serialization are deterministic", () => {
  const input = {
    assets: [
      asset({ id: "b", title: "B Water Slide", width: 1080, height: 1080 }),
      asset({ id: "a", title: "A Water Slide", width: 1080, height: 1920, mediaType: "video" }),
    ],
    campaigns: [
      campaign({ id: "z-campaign", label: "Z Campaign", preferredImageKeywords: ["water"] }),
      campaign({ id: "a-campaign", label: "A Campaign", preferredImageKeywords: ["water"] }),
    ],
    asOf: AS_OF,
  };
  const first = buildAssetIntelligence(input);
  const second = buildAssetIntelligence(input);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(
    first.campaignAssessments.map((item) => item.campaignId),
    ["a-campaign", "z-campaign"],
  );
  assert.deepEqual(
    first.assets.map((item) => item.id),
    ["a", "b"],
  );
});

test("16. planner score contract is bounded and non-stacking", () => {
  const ready = assetPlannerScoreDelta({
    campaignId: "summer-water-slides",
    label: "Summer Water Slides",
    readiness: "ready",
    relevantAssetIds: ["1", "2"],
    relevantAssetCount: 2,
    usableAssetCount: 2,
    supportedPlacements: ["feed", "reel"],
    aspectCoverage: { square: true, portraitOrReel: true, landscape: false, unknown: false },
    gaps: [{ kind: "repeated-overused-asset", message: "overused" }],
    warnings: ["Repeated asset use may reduce creative freshness."],
    reasons: ["ready"],
    recommendedCreativeNeed: "refresh-stale-assets",
    assumptions: [],
  });
  assert.equal(ready.scoreDelta, 1); // +2 ready, -1 overuse

  const partial = assetPlannerScoreDelta({
    campaignId: "summer-water-slides",
    label: "Summer Water Slides",
    readiness: "partially-ready",
    relevantAssetIds: ["1"],
    relevantAssetCount: 1,
    usableAssetCount: 1,
    supportedPlacements: ["feed"],
    aspectCoverage: { square: true, portraitOrReel: false, landscape: false, unknown: false },
    gaps: [{ kind: "missing-portrait-reel", message: "missing vertical" }],
    warnings: [],
    reasons: ["partial"],
    recommendedCreativeNeed: "alternate-aspect-ratios",
    assumptions: [],
  });
  assert.equal(partial.scoreDelta, 1);

  const insufficient = assetPlannerScoreDelta({
    campaignId: "private-parties",
    label: "Private Parties",
    readiness: "insufficient",
    relevantAssetIds: [],
    relevantAssetCount: 0,
    usableAssetCount: 0,
    supportedPlacements: [],
    aspectCoverage: { square: false, portraitOrReel: false, landscape: false, unknown: false },
    gaps: [{ kind: "no-relevant-asset", message: "none" }],
    warnings: ["No relevant assets were found for this campaign."],
    reasons: ["none"],
    recommendedCreativeNeed: "new-photography",
    assumptions: [],
  });
  assert.equal(insufficient.scoreDelta, 0);
});

test("17. campaign planner applies asset deltas without changing seasonal math", () => {
  const plannerCampaigns: readonly CampaignPlannerCampaign[] = [
    {
      id: "summer-water-slides",
      label: "Summer Water Slides",
      description: "Water",
      businessFocus: "rentals",
      defaultMediaType: "video",
      goalTemplates: ["Promote water"],
      captionAngles: ["Splash"],
      promptAngles: ["waterslide"],
    },
  ];
  const assetIntelligence = buildAssetIntelligence({
    assets: [
      asset({ id: "sq", title: "Water Slide Square", width: 1080, height: 1080 }),
      asset({ id: "reel", title: "Water Slide Reel", width: 1080, height: 1920, mediaType: "video" }),
    ],
    campaigns: [campaign()],
    asOf: AS_OF,
  });
  const planner = buildCampaignPlanner({
    campaigns: plannerCampaigns,
    marketingMemory: emptyMemory(),
    seasonalIntelligence: emptySeasonalIntelligenceSnapshot(`${AS_OF}T12:00:00.000Z`),
    assetIntelligence,
    generatedAt: `${AS_OF}T12:00:00.000Z`,
  });
  assert.equal(planner.candidates[0]?.score, 102); // 100 +2 ready, no seasonal
  assert.equal(planner.summary.readyAssetCampaignCount, 1);
  assert.ok(planner.assetIntelligence.readyCampaignIds.includes("summer-water-slides"));
});

test("18. diagnostics report empty inventory and ready campaigns", () => {
  const empty = diagnoseAssetIntelligence(
    buildAssetIntelligence({ assets: [], campaigns: [campaign()], asOf: AS_OF }),
  );
  assert.ok(empty.some((item) => item.code === "empty_inventory"));

  const ready = diagnoseAssetIntelligence(
    buildAssetIntelligence({
      assets: [
        asset({ id: "sq", title: "Water Slide Square", width: 1080, height: 1080 }),
        asset({ id: "reel", title: "Water Slide Reel", width: 1080, height: 1920, mediaType: "video" }),
      ],
      campaigns: [campaign()],
      asOf: AS_OF,
    }),
  );
  assert.ok(ready.some((item) => item.code === "ready_campaigns"));
});

test("19. constraints remain fail-closed and read-only", () => {
  const snapshot = buildAssetIntelligence({
    assets: [asset({ id: "sq", title: "Water Slide", width: 1080, height: 1080 })],
    campaigns: [campaign()],
    asOf: AS_OF,
  });
  assert.equal(snapshot.constraints.readOnly, true);
  assert.equal(snapshot.constraints.uploadsNothing, true);
  assert.equal(snapshot.constraints.generatesNothing, true);
  assert.equal(snapshot.constraints.publishesNothing, true);
  assert.equal(snapshot.constraints.authoritative, false);
});
