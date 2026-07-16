import assert from "node:assert/strict";
import test from "node:test";

import { diagnoseCampaignPlanner } from "./campaign-planner-diagnostics";
import { buildCampaignPlanner } from "./campaign-planner-service";
import type {
  CampaignPlannerCampaign,
  CampaignPlannerInput,
} from "./campaign-planner-types";

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
