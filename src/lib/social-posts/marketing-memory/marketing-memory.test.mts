import assert from "node:assert/strict";
import test from "node:test";

import { findCaptionDuplicateWarnings } from "./marketing-memory-domain";
import { buildMarketingMemory } from "./marketing-memory-service";
import type { MarketingMemoryPost } from "./marketing-memory-types";

function post(overrides: Partial<MarketingMemoryPost> = {}): MarketingMemoryPost {
  return {
    id: "post-1",
    createdAt: "2026-07-01T12:00:00.000Z",
    title: "Water slide weekend",
    campaignId: "summer",
    goal: "Promote water slide rentals",
    caption: "Cool off with a water slide! #SummerFun",
    businessFocus: "rentals",
    status: "approved",
    scheduledFor: null,
    postedAt: null,
    mediaUrls: ["https://example.com/slide.jpg"],
    ...overrides,
  };
}

test("detects normalized identical and highly similar captions", () => {
  const warnings = findCaptionDuplicateWarnings([
    post({ id: "one", caption: "Cool off with a WATER slide!!!" }),
    post({ id: "two", caption: "cool off with a water slide" }),
    post({ id: "three", caption: "Cool off with a water slide today" }),
  ]);

  assert.equal(warnings.filter((warning) => warning.kind === "identical_caption").length, 1);
  assert.ok(warnings.some((warning) => warning.kind === "similar_caption"));
});

test("returns an empty read-only memory snapshot safely", () => {
  const memory = buildMarketingMemory({
    posts: [],
    campaigns: [],
    generatedAt: "2026-07-16T00:00:00.000Z",
  });

  assert.equal(memory.campaignHistory.length, 0);
  assert.equal(memory.duplicateRisk.length, 0);
  assert.equal(memory.recommendations[0]?.kind, "explore_history");
  assert.equal(memory.constraints.performsNoWrites, true);
});

test("aggregates mixed campaign, seasonal, media, and approval history", () => {
  const memory = buildMarketingMemory({
    posts: [
      post(),
      post({
        id: "post-2",
        createdAt: "2026-07-10T12:00:00.000Z",
        campaignId: "birthday",
        title: "Birthday bounce house",
        goal: "Promote private parties",
        caption: "Book your birthday party for Halloween! #SummerFun",
        businessFocus: "facility-parties",
        status: "scheduled",
        mediaUrls: ["https://example.com/birthday.jpg"],
      }),
    ],
    campaigns: [
      { id: "summer", label: "Summer Water Slides", businessFocus: "rentals" },
      { id: "birthday", label: "Birthday Parties", businessFocus: "both" },
    ],
    generatedAt: "2026-07-16T00:00:00.000Z",
  });

  assert.deepEqual(
    memory.campaignHistory.map((item) => item.value).sort(),
    ["Birthday Parties", "Summer Water Slides"],
  );
  assert.equal(memory.seasonalHistory[0]?.value, "halloween");
  assert.ok(memory.mediaHistory.some((item) => item.value.endsWith("birthday.jpg")));
  assert.deepEqual(
    memory.approvalHistory.map((item) => item.value).sort(),
    ["approved", "scheduled"],
  );
  assert.ok(memory.duplicateRisk.some((warning) => warning.kind === "repeated_hashtag"));
});

test("emits rotation recommendations for populated history", () => {
  const memory = buildMarketingMemory({
    posts: [post(), post({ id: "post-2", caption: "Cool off with a water slide! #SummerFun" })],
    campaigns: [{ id: "summer", label: "Summer Water Slides", businessFocus: "rentals" }],
  });

  assert.ok(memory.recommendations.some((item) => item.kind === "avoid_duplicate"));
  assert.ok(memory.recommendations.some((item) => item.kind === "rotate_campaign"));
  assert.ok(memory.recommendations.some((item) => item.kind === "rotate_media"));
});
