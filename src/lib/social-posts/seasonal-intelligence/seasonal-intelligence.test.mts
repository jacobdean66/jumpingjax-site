import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildCampaignPlanner } from "../campaign-planner/campaign-planner-service";
import { replayCampaignPlanner } from "../campaign-planner/campaign-planner-replay";
import { SOCIAL_CAMPAIGNS } from "../social-campaigns";
import {
  businessDateFromAsOf,
  classifyLifecycle,
  daysBetweenDates,
  easterSundayDate,
  evaluateCatalogOpportunity,
  evaluateCustomOpportunity,
} from "./seasonal-intelligence-domain";
import { SEASONAL_OPPORTUNITY_CATALOG } from "./seasonal-intelligence-calendar";
import { diagnoseSeasonalIntelligence } from "./seasonal-intelligence-diagnostics";
import { buildSeasonalIntelligence } from "./seasonal-intelligence-service";
import type { MarketingMemorySnapshot } from "../marketing-memory/marketing-memory-types";

const DIRECTORY = fileURLToPath(new URL(".", import.meta.url));

function memory(overrides: Partial<MarketingMemorySnapshot> = {}): MarketingMemorySnapshot {
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

function catalogEntry(key: string) {
  const entry = SEASONAL_OPPORTUNITY_CATALOG.find((item) => item.key === key);
  assert.ok(entry, `missing catalog entry ${key}`);
  return entry;
}

test("1. identical inputs produce identical outputs", () => {
  const input = {
    asOf: "2026-07-16T12:00:00.000Z",
    marketingMemory: memory(),
  };
  assert.equal(
    JSON.stringify(buildSeasonalIntelligence(input)),
    JSON.stringify(buildSeasonalIntelligence(input)),
  );
});

test("2. fixed-date holiday calculation resolves Valentine's Day", () => {
  const evaluation = evaluateCatalogOpportunity({
    entry: catalogEntry("valentines-day"),
    businessDate: "2026-02-10",
    memory: memory(),
  });
  assert.deepEqual(evaluation?.eventDateOrWindow, { date: "2026-02-14" });
});

test("3. movable-holiday calculation resolves Easter", () => {
  assert.equal(easterSundayDate(2026), "2026-04-05");
  const evaluation = evaluateCatalogOpportunity({
    entry: catalogEntry("easter"),
    businessDate: "2026-04-01",
    memory: memory(),
  });
  assert.deepEqual(evaluation?.eventDateOrWindow, { date: "2026-04-05" });
});

test("4. broad seasonal window resolves summer", () => {
  const evaluation = evaluateCatalogOpportunity({
    entry: catalogEntry("summer"),
    businessDate: "2026-07-16",
    memory: memory(),
  });
  assert.deepEqual(evaluation?.eventDateOrWindow, {
    startDate: "2026-06-01",
    endDate: "2026-08-31",
  });
});

test("5. America/New_York date boundaries resolve business date from ISO asOf", () => {
  assert.equal(businessDateFromAsOf("2026-07-16"), "2026-07-16");
  assert.equal(businessDateFromAsOf("2026-07-16T02:30:00.000Z"), "2026-07-15");
  assert.equal(businessDateFromAsOf("2026-07-16T04:30:00.000Z"), "2026-07-16");
});

test("6. future lifecycle state", () => {
  const lifecycle = classifyLifecycle({
    businessDate: "2026-05-01",
    window: { startDate: "2026-06-01", endDate: "2026-08-31" },
    preparationLeadDays: 21,
    finalCallDays: 14,
  });
  assert.equal(lifecycle?.lifecycleState, "future");
});

test("7. preparation lifecycle state", () => {
  const lifecycle = classifyLifecycle({
    businessDate: "2026-05-20",
    window: { startDate: "2026-06-01", endDate: "2026-08-31" },
    preparationLeadDays: 21,
    finalCallDays: 14,
  });
  assert.equal(lifecycle?.lifecycleState, "preparation");
});

test("8. active lifecycle state", () => {
  const evaluation = evaluateCatalogOpportunity({
    entry: catalogEntry("summer"),
    businessDate: "2026-07-16",
    memory: memory(),
  });
  assert.equal(evaluation?.lifecycleState, "active");
});

test("9. final-call lifecycle state", () => {
  const evaluation = evaluateCatalogOpportunity({
    entry: catalogEntry("summer"),
    businessDate: "2026-08-25",
    memory: memory(),
  });
  assert.equal(evaluation?.lifecycleState, "final-call");
});

test("10. passed lifecycle state", () => {
  const evaluation = evaluateCatalogOpportunity({
    entry: catalogEntry("summer"),
    businessDate: "2026-09-05",
    memory: memory(),
  });
  assert.equal(evaluation?.lifecycleState, "passed");
});

test("11. late-planning warning appears in diagnostics", () => {
  const snapshot = buildSeasonalIntelligence({
    asOf: "2026-08-28",
    marketingMemory: memory({
      seasonalHistory: [{ value: "summer", count: 3, mostRecentAt: "2026-08-01T00:00:00.000Z" }],
      recentThemes: [{ value: "summer", count: 3, mostRecentAt: "2026-08-01T00:00:00.000Z" }],
      duplicateRisk: [{
        kind: "repeated_holiday",
        value: "summer",
        postIds: ["a", "b"],
        message: "Repeated summer promotion.",
      }],
    }),
  });
  assert.ok(
    diagnoseSeasonalIntelligence(snapshot).some((item) => item.code === "late_planning_warning"),
  );
});

test("12. custom configured opportunity evaluates with explicit dates", () => {
  const snapshot = buildSeasonalIntelligence({
    asOf: "2026-07-01",
    marketingMemory: memory(),
    customOpportunities: [{
      key: "community-festival",
      name: "Community Festival",
      startDate: "2026-07-10",
      endDate: "2026-07-12",
      recommendedBusinessFocus: ["outdoor-rentals"],
    }],
  });
  assert.ok(snapshot.opportunities.some((item) => item.opportunityKey === "community-festival"));
});

test("13. missing custom date returns missing configuration", () => {
  const snapshot = buildSeasonalIntelligence({
    asOf: "2026-07-01",
    marketingMemory: memory(),
    customOpportunities: [{ key: "spring-break", name: "Spring Break" }],
  });
  assert.match(snapshot.missingConfiguration.join(" "), /requires explicit startDate and endDate/i);
});

test("14. Marketing Memory repetition risk is surfaced", () => {
  const evaluation = evaluateCatalogOpportunity({
    entry: catalogEntry("christmas"),
    businessDate: "2026-12-01",
    memory: memory({
      seasonalHistory: [{ value: "christmas", count: 2, mostRecentAt: "2026-11-01T00:00:00.000Z" }],
    }),
  });
  assert.notEqual(evaluation?.repetitionRisk, "none");
  assert.ok(evaluation);
  assert.match(evaluation.memorySignals.join(" "), /christmas/i);
});

test("15. underused business focus can still be recommended without repetition warnings", () => {
  const evaluation = evaluateCatalogOpportunity({
    entry: catalogEntry("year-end-parties"),
    businessDate: "2026-12-01",
    memory: memory({
      facilityPartyPromotions: [],
      promotedCategories: [{ value: "water slide", count: 4, mostRecentAt: "2026-07-01T00:00:00.000Z" }],
    }),
  });
  assert.equal(evaluation?.recommendedBusinessFocus.includes("private-parties"), true);
});

test("16. no Marketing Memory history returns informational signal", () => {
  const evaluation = evaluateCatalogOpportunity({
    entry: catalogEntry("halloween"),
    businessDate: "2026-10-01",
    memory: memory(),
  });
  assert.ok(evaluation);
  assert.match(evaluation.memorySignals.join(" "), /No seasonal Marketing Memory history/i);
});

test("17. overlapping seasonal opportunities can coexist", () => {
  const snapshot = buildSeasonalIntelligence({
    asOf: "2026-07-04",
    marketingMemory: memory(),
  });
  assert.ok(snapshot.activeOpportunities.some((item) => item.opportunityKey === "summer"));
  assert.ok(snapshot.activeOpportunities.some((item) => item.opportunityKey === "fourth-of-july"));
});

test("18. Campaign Planner integration exposes seasonal intelligence", () => {
  const planner = buildCampaignPlanner({
    campaigns: [{
      id: "summer-water-slides",
      label: "Summer Water Slides",
      description: "Summer slides",
      businessFocus: "rentals",
      defaultMediaType: "video",
      goalTemplates: ["Promote water slides for hot weather"],
      captionAngles: ["Cool off"],
      promptAngles: ["waterslide"],
    }],
    marketingMemory: memory(),
    seasonalIntelligence: buildSeasonalIntelligence({
      asOf: "2026-07-16",
      marketingMemory: memory(),
    }),
  });
  assert.equal(planner.seasonalIntelligence.activeOpportunities.length > 0, true);
  assert.match(planner.candidates[0]!.reasons.join(" "), /seasonal/i);
});

test("19. stable Campaign Planner ranking for identical inputs without seasonal boost input", () => {
  const plannerInput = {
    campaigns: [{
      id: "birthday",
      label: "Birthday Parties",
      description: "Birthday",
      businessFocus: "both" as const,
      defaultMediaType: "image" as const,
      goalTemplates: ["Promote birthday bookings"],
      captionAngles: ["Easy birthdays"],
      promptAngles: ["birthday"],
    }, {
      id: "water",
      label: "Water Slides",
      description: "Water",
      businessFocus: "rentals" as const,
      defaultMediaType: "video" as const,
      goalTemplates: ["Promote water slides for hot weather"],
      captionAngles: ["Cool off"],
      promptAngles: ["waterslide"],
    }],
    marketingMemory: memory({ generatedAt: "2026-01-15T12:00:00.000Z" }),
    generatedAt: "2026-01-15T12:00:00.000Z",
  };
  assert.equal(
    JSON.stringify(buildCampaignPlanner(plannerInput).candidates.map((item) => item.campaignId)),
    JSON.stringify(buildCampaignPlanner(plannerInput).candidates.map((item) => item.campaignId)),
  );
});

test("20. unsupported catalog opportunity is rejected", () => {
  const evaluation = evaluateCatalogOpportunity({
    entry: {
      key: "unsupported-opportunity",
      name: "Unsupported Opportunity",
      kind: "season-window",
      recommendedBusinessFocus: ["brand-awareness"],
      recommendedCampaignObjective: "Unsupported",
      recommendedPlacements: ["feed"],
      preparationLeadDays: 21,
      finalCallDays: 7,
      memoryThemeTokens: ["unsupported"],
    },
    businessDate: "2026-07-01",
    memory: memory(),
  });
  assert.equal(evaluation, null);
});

test("21. invalid custom date window is rejected", () => {
  const result = evaluateCustomOpportunity({
    config: {
      key: "bad-window",
      name: "Bad Window",
      startDate: "2026-08-01",
      endDate: "2026-07-01",
    },
    businessDate: "2026-07-01",
    memory: memory(),
  });
  assert.equal(result.evaluation, null);
  assert.match(result.missingConfiguration.join(" "), /invalid date window/i);
});

test("22. invalid date window helper returns null day count", () => {
  assert.equal(daysBetweenDates("invalid", "2026-07-01"), null);
  assert.equal(daysBetweenDates("2026-02-30", "2026-07-01"), null);
});

test("23. no writes or external calls in constraints", () => {
  const snapshot = buildSeasonalIntelligence({
    asOf: "2026-07-16",
    marketingMemory: memory(),
  });
  assert.equal(snapshot.constraints.performsNoWrites, true);
  assert.equal(snapshot.constraints.performsNoNetworkCalls, true);
});

test("24. replayCampaignPlanner remains deterministic with seasonal integration", () => {
  const input = {
    posts: [],
    campaigns: SOCIAL_CAMPAIGNS,
    generatedAt: "2026-07-16T12:00:00.000Z",
  };
  assert.equal(
    JSON.stringify(replayCampaignPlanner(input).candidates.map((item) => item.campaignId)),
    JSON.stringify(replayCampaignPlanner(input).candidates.map((item) => item.campaignId)),
  );
});

test("25. active seasonal opportunity changes ranking by a deterministic score boost", () => {
  const campaigns = [{
    id: "private-parties",
    label: "Private Parties",
    description: "Private parties",
    businessFocus: "facility-parties" as const,
    defaultMediaType: "video" as const,
    goalTemplates: ["Promote private party bookings"],
    captionAngles: ["Private parties"],
    promptAngles: ["private party"],
  }, {
    id: "summer-water-slides",
    label: "Summer Water Slides",
    description: "Summer slides",
    businessFocus: "rentals" as const,
    defaultMediaType: "video" as const,
    goalTemplates: ["Promote water slides for hot weather"],
    captionAngles: ["Cool off"],
    promptAngles: ["waterslide"],
  }];
  const withoutSeasonal = buildCampaignPlanner({
    campaigns,
    marketingMemory: memory({ generatedAt: "2026-01-15T12:00:00.000Z" }),
    generatedAt: "2026-01-15T12:00:00.000Z",
  });
  const withSeasonal = buildCampaignPlanner({
    campaigns,
    marketingMemory: memory(),
    seasonalIntelligence: buildSeasonalIntelligence({
      asOf: "2026-07-16T12:00:00.000Z",
      marketingMemory: memory(),
    }),
    generatedAt: "2026-07-16T12:00:00.000Z",
  });

  assert.deepEqual(
    withoutSeasonal.candidates.map((candidate) => candidate.campaignId),
    ["private-parties", "summer-water-slides"],
  );
  assert.equal(withSeasonal.candidates[0]?.campaignId, "summer-water-slides");
  assert.ok(withSeasonal.candidates[0]!.score > withoutSeasonal.candidates[1]!.score);
});

test("seasonal intelligence boundary forbids external and write imports", () => {
  const sourceFiles = [
    "seasonal-intelligence-domain.ts",
    "seasonal-intelligence-service.ts",
    "seasonal-intelligence-replay.ts",
    "seasonal-intelligence-diagnostics.ts",
    "seasonal-intelligence-types.ts",
    "seasonal-intelligence-calendar.ts",
  ] as const;
  const forbidden = [
    "fetch(",
    "createServiceRoleClient",
    ".insert(",
    ".update(",
    ".delete(",
    "openai",
    "oauth",
    "graph.facebook.com",
    "node-cron",
    "Worker(",
    "setInterval(",
    "setTimeout(",
    "publishSocial",
    "scheduleSocialPost",
    "credential",
    "vault",
    "approvalmutation",
    "queue",
    "cron",
    "holidayapi",
    "weatherapi",
  ] as const;

  for (const fileName of sourceFiles) {
    const source = readFileSync(`${DIRECTORY}${fileName}`, "utf8").toLowerCase();
    for (const pattern of forbidden) {
      assert.equal(source.includes(pattern.toLowerCase()), false, `${fileName} must not include ${pattern}`);
    }
  }
});
