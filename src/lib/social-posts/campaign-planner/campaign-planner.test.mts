import assert from "node:assert/strict";
import test from "node:test";

import { diagnoseCampaignPlanner } from "./campaign-planner-diagnostics";
import { buildCampaignPlanner } from "./campaign-planner-service";
import type {
  CampaignPlannerCampaign,
  CampaignPlannerInput,
} from "./campaign-planner-types";
import { buildSeasonalIntelligence } from "../seasonal-intelligence/seasonal-intelligence-service";
import type { MarketingMemorySnapshot } from "../marketing-memory/marketing-memory-types";

const campaigns: readonly CampaignPlannerCampaign[] = [
  {
    id: "water",
    label: "Water Slides",
    description: "Water slide promotion",
    businessFocus: "rentals",
    defaultMediaType: "video",
    goalTemplates: ["Promote water slide bookings"],
    captionAngles: ["Cool down this weekend."],
    promptAngles: ["water slide in a sunny yard"],
  },
  {
    id: "birthday",
    label: "Birthday Parties",
    description: "Birthday promotion",
    businessFocus: "both",
    defaultMediaType: "image",
    goalTemplates: ["Promote birthday bookings"],
    captionAngles: ["Make birthdays easy."],
    promptAngles: ["bright birthday party"],
  },
] as const;

function input(overrides: Partial<CampaignPlannerInput> = {}): CampaignPlannerInput {
  return {
    campaigns,
    marketingMemory: {
      generatedAt: "2026-07-16T00:00:00.000Z",
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
    },
    generatedAt: "2026-07-16T00:00:00.000Z",
    ...overrides,
  };
}

test("1. returns one candidate per configured campaign", () => {
  assert.equal(buildCampaignPlanner(input()).candidates.length, 2);
});

test("2. assigns deterministic sequential ranks", () => {
  assert.deepEqual(buildCampaignPlanner(input()).candidates.map((candidate) => candidate.rank), [1, 2]);
});

test("3. marks unseen campaigns recommended", () => {
  assert.ok(buildCampaignPlanner(input()).candidates.every((candidate) => candidate.status === "recommended"));
});

test("4. uses a stable alphabetical tiebreaker", () => {
  assert.deepEqual(buildCampaignPlanner(input()).candidates.map((candidate) => candidate.campaignId), ["birthday", "water"]);
});

test("5. exposes reference campaign content without drafting", () => {
  const candidate = buildCampaignPlanner(input()).candidates[0]!;
  assert.equal(candidate.referenceGoal, "Promote birthday bookings");
  assert.equal(candidate.referenceCaptionAngle, "Make birthdays easy.");
});

test("6. reduces score for campaign history", () => {
  const planner = buildCampaignPlanner(input({
    marketingMemory: {
      ...input().marketingMemory,
      campaignHistory: [{ value: "Water Slides", count: 2, mostRecentAt: "2026-07-10T00:00:00.000Z" }],
    },
  }));
  assert.ok(planner.candidates.find((candidate) => candidate.campaignId === "water")!.score < 100);
});

test("7. requires review for a previously used campaign", () => {
  const planner = buildCampaignPlanner(input({
    marketingMemory: {
      ...input().marketingMemory,
      campaignHistory: [{ value: "Water Slides", count: 1, mostRecentAt: "2026-07-10T00:00:00.000Z" }],
    },
  }));
  assert.equal(planner.candidates.find((candidate) => candidate.campaignId === "water")!.status, "review");
});

test("8. reduces score for active campaign history", () => {
  const inactive = buildCampaignPlanner(input()).candidates.find((candidate) => candidate.campaignId === "water")!;
  const active = buildCampaignPlanner(input({
    marketingMemory: {
      ...input().marketingMemory,
      activeCampaigns: [{ value: "Water Slides", count: 1, mostRecentAt: "2026-07-10T00:00:00.000Z" }],
    },
  })).candidates.find((candidate) => candidate.campaignId === "water")!;
  assert.ok(active.score < inactive.score);
});

test("9. attaches caution for active campaign history", () => {
  const planner = buildCampaignPlanner(input({
    marketingMemory: {
      ...input().marketingMemory,
      activeCampaigns: [{ value: "Water Slides", count: 1, mostRecentAt: "2026-07-10T00:00:00.000Z" }],
    },
  }));
  assert.match(planner.candidates.find((candidate) => candidate.campaignId === "water")!.cautions.join(" "), /active/i);
});

test("10. attaches duplicate-risk caution to matching campaign", () => {
  const planner = buildCampaignPlanner(input({
    marketingMemory: {
      ...input().marketingMemory,
      duplicateRisk: [{
        kind: "repeated_promotion",
        value: "water",
        postIds: ["post-1", "post-2"],
        message: "Repeated promotion.",
      }],
    },
  }));
  assert.equal(planner.candidates.find((candidate) => candidate.campaignId === "water")!.cautions.length, 1);
});

test("11. leaves unrelated duplicate risk off other campaigns", () => {
  const planner = buildCampaignPlanner(input({
    marketingMemory: {
      ...input().marketingMemory,
      duplicateRisk: [{
        kind: "repeated_promotion",
        value: "water",
        postIds: ["post-1", "post-2"],
        message: "Repeated promotion.",
      }],
    },
  }));
  assert.equal(planner.candidates.find((candidate) => candidate.campaignId === "birthday")!.cautions.length, 0);
});

test("12. includes media rotation guidance when media history exists", () => {
  const planner = buildCampaignPlanner(input({
    marketingMemory: {
      ...input().marketingMemory,
      mediaHistory: [{ value: "https://example.com/image.jpg", count: 1, mostRecentAt: "2026-07-10T00:00:00.000Z" }],
    },
  }));
  assert.match(planner.candidates[0]!.reasons.join(" "), /media asset/i);
});

test("13. includes seasonal review guidance when seasonal history exists", () => {
  const planner = buildCampaignPlanner(input({
    marketingMemory: {
      ...input().marketingMemory,
      seasonalHistory: [{ value: "summer", count: 1, mostRecentAt: "2026-07-10T00:00:00.000Z" }],
    },
  }));
  assert.match(planner.candidates[0]!.reasons.join(" "), /seasonal/i);
});

test("14. returns immutable planner data", () => {
  const planner = buildCampaignPlanner(input());
  assert.equal(Object.isFrozen(planner), true);
  assert.equal(Object.isFrozen(planner.candidates), true);
});

test("15. exposes explicit read-only constraints", () => {
  const constraints = buildCampaignPlanner(input()).constraints;
  assert.equal(constraints.performsNoWrites, true);
  assert.equal(constraints.createsNoDrafts, true);
  assert.equal(constraints.schedulesNothing, true);
  assert.equal(constraints.publishesNothing, true);
});

test("16. reports planner review diagnostics", () => {
  const planner = buildCampaignPlanner(input({
    marketingMemory: {
      ...input().marketingMemory,
      campaignHistory: [{ value: "Water Slides", count: 1, mostRecentAt: "2026-07-10T00:00:00.000Z" }],
    },
  }));
  assert.ok(diagnoseCampaignPlanner(planner).some((diagnostic) => diagnostic.code === "review_required"));
});

test("17. produces identical serialized output without a planner generatedAt", () => {
  const plannerInput = input({ generatedAt: undefined });
  assert.equal(
    buildCampaignPlanner(plannerInput).generatedAt,
    plannerInput.marketingMemory.generatedAt,
  );
  assert.equal(
    JSON.stringify(buildCampaignPlanner(plannerInput)),
    JSON.stringify(buildCampaignPlanner(plannerInput)),
  );
});

test("18. integrates seasonal intelligence without breaking empty seasonal defaults", () => {
  const planner = buildCampaignPlanner(input({ generatedAt: "2026-01-15T12:00:00.000Z" }));
  assert.equal(planner.seasonalIntelligence.activeOpportunities.length, 0);
  assert.deepEqual(planner.candidates.map((candidate) => candidate.campaignId), ["birthday", "water"]);
});

function emptyMemory(overrides: Partial<MarketingMemorySnapshot> = {}): MarketingMemorySnapshot {
  return {
    generatedAt: "2026-07-16T12:00:00.000Z",
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
    ...overrides,
  };
}

const scoreCapCampaigns: readonly CampaignPlannerCampaign[] = [
  {
    id: "summer-water-slides",
    label: "Summer Water Slides",
    description: "Summer slides",
    businessFocus: "rentals",
    defaultMediaType: "video",
    goalTemplates: ["Promote water slides for hot weather"],
    captionAngles: ["Cool off"],
    promptAngles: ["waterslide"],
  },
  {
    id: "private-parties",
    label: "Private Parties",
    description: "Private parties",
    businessFocus: "facility-parties",
    defaultMediaType: "video",
    goalTemplates: ["Promote private party bookings"],
    captionAngles: ["Private parties"],
    promptAngles: ["private party"],
  },
  {
    id: "customer-testimonials",
    label: "Customer Testimonials",
    description: "Brand testimonials",
    businessFocus: "both",
    defaultMediaType: "image",
    goalTemplates: ["Share customer reviews"],
    captionAngles: ["Happy customers"],
    promptAngles: ["customer review"],
  },
] as const;

test("19. active Summer alone produces exactly +4", () => {
  const seasonal = buildSeasonalIntelligence({
    asOf: "2026-07-16",
    marketingMemory: emptyMemory(),
  });
  const planner = buildCampaignPlanner({
    campaigns: scoreCapCampaigns,
    marketingMemory: emptyMemory(),
    seasonalIntelligence: seasonal,
    generatedAt: "2026-07-16T12:00:00.000Z",
  });
  const water = planner.candidates.find((item) => item.campaignId === "summer-water-slides");
  assert.equal(water?.score, 104);
});

test("20. Summer final-call produces exactly +4 not +2", () => {
  const seasonal = buildSeasonalIntelligence({
    asOf: "2026-08-25",
    marketingMemory: emptyMemory(),
  });
  assert.ok(seasonal.activeOpportunities.some((item) =>
    item.opportunityKey === "summer" && item.lifecycleState === "final-call",
  ));
  const planner = buildCampaignPlanner({
    campaigns: scoreCapCampaigns,
    marketingMemory: emptyMemory(),
    seasonalIntelligence: seasonal,
    generatedAt: "2026-08-25T12:00:00.000Z",
  });
  const water = planner.candidates.find((item) => item.campaignId === "summer-water-slides");
  assert.equal(water?.score, 104);
});

test("21. preparation alone produces exactly +2", () => {
  const seasonal = buildSeasonalIntelligence({
    asOf: "2026-11-20",
    marketingMemory: emptyMemory(),
  });
  assert.equal(seasonal.activeOpportunities.length, 0);
  assert.ok(seasonal.upcomingOpportunities.some((item) =>
    item.opportunityKey === "christmas" && item.lifecycleState === "preparation",
  ));
  const planner = buildCampaignPlanner({
    campaigns: scoreCapCampaigns,
    marketingMemory: emptyMemory(),
    seasonalIntelligence: seasonal,
    generatedAt: "2026-11-20T12:00:00.000Z",
  });
  const privateParties = planner.candidates.find((item) => item.campaignId === "private-parties");
  assert.equal(privateParties?.score, 102);
});

test("22. Summer plus Fourth of July does not exceed +4 positive adjustment", () => {
  const seasonal = buildSeasonalIntelligence({
    asOf: "2026-07-04",
    marketingMemory: emptyMemory(),
  });
  assert.ok(seasonal.activeOpportunities.some((item) => item.opportunityKey === "summer"));
  assert.ok(seasonal.activeOpportunities.some((item) => item.opportunityKey === "fourth-of-july"));
  const planner = buildCampaignPlanner({
    campaigns: scoreCapCampaigns,
    marketingMemory: emptyMemory(),
    seasonalIntelligence: seasonal,
    generatedAt: "2026-07-04T12:00:00.000Z",
  });
  const water = planner.candidates.find((item) => item.campaignId === "summer-water-slides");
  assert.equal(water?.score, 104);
  assert.ok((water?.reasons.length ?? 0) >= 2);
});

test("23. multiple simultaneous preparation opportunities do not exceed +2", () => {
  const seasonal = buildSeasonalIntelligence({
    asOf: "2026-11-20",
    marketingMemory: emptyMemory(),
  });
  const prepCount = seasonal.upcomingOpportunities.filter((item) =>
    item.lifecycleState === "preparation" &&
    (item.opportunityKey === "christmas" ||
      item.opportunityKey === "thanksgiving" ||
      item.opportunityKey === "year-end-parties"),
  ).length;
  assert.ok(prepCount >= 2);
  const planner = buildCampaignPlanner({
    campaigns: scoreCapCampaigns,
    marketingMemory: emptyMemory(),
    seasonalIntelligence: seasonal,
    generatedAt: "2026-11-20T12:00:00.000Z",
  });
  const privateParties = planner.candidates.find((item) => item.campaignId === "private-parties");
  assert.equal(privateParties?.score, 102);
});

test("24. multiple repetition signals apply only one -2 penalty", () => {
  const memory = emptyMemory({
    seasonalHistory: [
      { value: "summer", count: 3, mostRecentAt: "2026-07-01T00:00:00.000Z" },
      { value: "july 4", count: 2, mostRecentAt: "2026-07-01T00:00:00.000Z" },
    ],
    recentThemes: [
      { value: "summer", count: 2, mostRecentAt: "2026-07-01T00:00:00.000Z" },
      { value: "fourth of july", count: 2, mostRecentAt: "2026-07-01T00:00:00.000Z" },
    ],
  });
  const seasonal = buildSeasonalIntelligence({
    asOf: "2026-07-04",
    marketingMemory: memory,
  });
  assert.ok(seasonal.activeOpportunities.filter((item) =>
    item.repetitionRisk === "high" || item.repetitionRisk === "moderate",
  ).length >= 2);
  const planner = buildCampaignPlanner({
    campaigns: scoreCapCampaigns,
    marketingMemory: memory,
    seasonalIntelligence: seasonal,
    generatedAt: "2026-07-04T12:00:00.000Z",
  });
  const water = planner.candidates.find((item) => item.campaignId === "summer-water-slides");
  assert.equal(water?.score, 102);
});

test("25. active plus repetition produces net +2 versus baseline", () => {
  const memory = emptyMemory({
    seasonalHistory: [{ value: "summer", count: 3, mostRecentAt: "2026-07-01T00:00:00.000Z" }],
    recentThemes: [{ value: "summer", count: 2, mostRecentAt: "2026-07-01T00:00:00.000Z" }],
  });
  const seasonal = buildSeasonalIntelligence({
    asOf: "2026-07-16",
    marketingMemory: memory,
  });
  const planner = buildCampaignPlanner({
    campaigns: scoreCapCampaigns,
    marketingMemory: memory,
    seasonalIntelligence: seasonal,
    generatedAt: "2026-07-16T12:00:00.000Z",
  });
  const water = planner.candidates.find((item) => item.campaignId === "summer-water-slides");
  assert.equal(water?.score, 102);
});

test("26. empty seasonal input preserves Wave 6 ranking and scores", () => {
  const planner = buildCampaignPlanner({
    campaigns: scoreCapCampaigns,
    marketingMemory: emptyMemory({ generatedAt: "2026-01-15T12:00:00.000Z" }),
    generatedAt: "2026-01-15T12:00:00.000Z",
  });
  assert.deepEqual(
    planner.candidates.map((item) => ({ id: item.campaignId, score: item.score })),
    [
      { id: "customer-testimonials", score: 100 },
      { id: "private-parties", score: 100 },
      { id: "summer-water-slides", score: 100 },
    ],
  );
});

test("27. stable alphabetical tie-breaking remains unchanged with seasonal caps", () => {
  const planner = buildCampaignPlanner({
    campaigns: scoreCapCampaigns,
    marketingMemory: emptyMemory({ generatedAt: "2026-01-15T12:00:00.000Z" }),
    generatedAt: "2026-01-15T12:00:00.000Z",
  });
  assert.deepEqual(
    planner.candidates.map((item) => item.campaignId),
    ["customer-testimonials", "private-parties", "summer-water-slides"],
  );
});

test("28. identical inputs produce identical ranked seasonal output", () => {
  const seasonal = buildSeasonalIntelligence({
    asOf: "2026-07-16",
    marketingMemory: emptyMemory(),
  });
  const plannerInput = {
    campaigns: scoreCapCampaigns,
    marketingMemory: emptyMemory(),
    seasonalIntelligence: seasonal,
    generatedAt: "2026-07-16T12:00:00.000Z",
  };
  assert.equal(
    JSON.stringify(buildCampaignPlanner(plannerInput)),
    JSON.stringify(buildCampaignPlanner(plannerInput)),
  );
});

test("29. brand-awareness is not an unconditional wildcard", () => {
  const seasonal = buildSeasonalIntelligence({
    asOf: "2026-12-20",
    marketingMemory: emptyMemory(),
  });
  const planner = buildCampaignPlanner({
    campaigns: scoreCapCampaigns,
    marketingMemory: emptyMemory(),
    seasonalIntelligence: seasonal,
    generatedAt: "2026-12-20T12:00:00.000Z",
  });
  const testimonials = planner.candidates.find((item) => item.campaignId === "customer-testimonials");
  const water = planner.candidates.find((item) => item.campaignId === "summer-water-slides");
  assert.ok((testimonials?.score ?? 0) > 100);
  assert.equal(water?.score, 100);
});
