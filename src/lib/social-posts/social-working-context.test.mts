import assert from "node:assert/strict";

import {
  buildSocialWorkingContext,
  configureSocialWorkingContextTestDependencies,
} from "./social-working-context";
import type {
  SocialCampaignMemory,
  SocialCampaignMemoryEvidence,
} from "./social-campaign-memories";
import type { SocialPostDecision } from "./social-post-decisions";
import type { SocialPost } from "./social-post-data";

const NOW = "2026-06-28T12:00:00.000Z";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  configureSocialWorkingContextTestDependencies(null);
  try {
    await fn();
    console.log(`ok - ${name}`);
  } finally {
    configureSocialWorkingContextTestDependencies(null);
  }
}

function post(input: {
  id: string;
  campaignId: string | null;
  createdAt: string;
  status?: SocialPost["status"];
  mediaType?: SocialPost["media_type"];
  title?: string | null;
}): SocialPost {
  return {
    id: input.id,
    created_at: input.createdAt,
    updated_at: input.createdAt,
    title: input.title ?? `Post ${input.id}`,
    campaign_id: input.campaignId,
    goal: `Goal ${input.id}`,
    prompt: null,
    caption: null,
    media_type: input.mediaType ?? "image",
    business_focus: "both",
    media_url: null,
    source_image_url: null,
    original_image_url: null,
    approved_image_url: null,
    generated_image_url: null,
    generated_image_source_url: null,
    media_source_url: null,
    image_generation_provider: null,
    image_generation_model: null,
    image_prediction_id: null,
    image_generation_created_at: null,
    image_generation_prompt: null,
    image_generation_status: null,
    image_concepts: [],
    motion_preset: null,
    camera_preset: null,
    creative_source: null,
    platforms: ["facebook", "instagram"],
    post_placement: "feed",
    format_variant_id: null,
    status: input.status ?? "draft",
    scheduled_for: null,
    posted_at: null,
    error_message: null,
  };
}

function decision(input: {
  id: string;
  postId: string;
  campaignId: string | null;
  createdAt: string;
  stage: SocialPostDecision["decision_stage"];
  type: SocialPostDecision["decision_type"];
}): SocialPostDecision {
  return {
    id: input.id,
    social_post_id: input.postId,
    asset_id: null,
    asset_family_id: null,
    campaign_id: input.campaignId,
    created_at: input.createdAt,
    decision_stage: input.stage,
    decision_type: input.type,
    decision: `${input.type} ${input.stage}`,
    rationale: null,
    input_snapshot: {},
    output_snapshot: {},
    model: null,
    provider: null,
    created_by: "test",
  };
}

function memory(input: {
  id: string;
  campaignId: string | null;
  status: SocialCampaignMemory["status"];
  key?: string;
}): SocialCampaignMemory {
  return {
    id: input.id,
    campaign_id: input.campaignId,
    memory_key: input.key ?? `memory:${input.id}`,
    memory_type: "image_pattern",
    memory_text: `Memory ${input.id}`,
    recommendation: `Recommendation ${input.id}`,
    confidence_score: 0.75,
    support_count: 5,
    contradiction_count: 1,
    status: input.status,
    version: 1,
    supersedes_memory_id: null,
    algorithm_version: "campaign-memory-promotion-v1",
    input_summary: {},
    output_summary: {},
    created_at: NOW,
    updated_at: NOW,
    promoted_at: NOW,
    created_by: "learning_agent",
  };
}

function evidence(input: {
  id: string;
  memoryId: string;
}): SocialCampaignMemoryEvidence {
  return {
    id: input.id,
    memory_id: input.memoryId,
    decision_id: `decision-${input.id}`,
    social_post_id: `post-${input.id}`,
    asset_id: null,
    asset_family_id: null,
    campaign_id: "summer-water-slides",
    evidence_role: "supporting",
    weight: 1,
    created_at: NOW,
  };
}

const posts = [
  post({
    id: "summer-new",
    campaignId: "summer-water-slides",
    createdAt: "2026-06-28T10:00:00.000Z",
    status: "approved",
    mediaType: "video",
  }),
  post({
    id: "summer-old",
    campaignId: "summer-water-slides",
    createdAt: "2026-06-27T10:00:00.000Z",
  }),
  post({
    id: "birthday",
    campaignId: "birthday-parties",
    createdAt: "2026-06-28T11:00:00.000Z",
  }),
];

const decisionsByPost: Record<string, SocialPostDecision[]> = {
  "summer-new": [
    decision({
      id: "decision-1",
      postId: "summer-new",
      campaignId: "summer-water-slides",
      createdAt: "2026-06-28T10:05:00.000Z",
      stage: "image_review",
      type: "accepted",
    }),
    decision({
      id: "decision-2",
      postId: "summer-new",
      campaignId: "summer-water-slides",
      createdAt: "2026-06-28T10:04:00.000Z",
      stage: "image_review",
      type: "rejected",
    }),
  ],
  "summer-old": [
    decision({
      id: "decision-3",
      postId: "summer-old",
      campaignId: "summer-water-slides",
      createdAt: "2026-06-27T10:05:00.000Z",
      stage: "video_review",
      type: "selected",
    }),
  ],
  birthday: [
    decision({
      id: "decision-4",
      postId: "birthday",
      campaignId: "birthday-parties",
      createdAt: "2026-06-28T11:05:00.000Z",
      stage: "image_review",
      type: "accepted",
    }),
  ],
};

const memories = [
  memory({
    id: "active-summer",
    campaignId: "summer-water-slides",
    status: "active",
    key: "campaign:summer-water-slides:active",
  }),
  memory({
    id: "retracted-summer",
    campaignId: "summer-water-slides",
    status: "retracted",
    key: "campaign:summer-water-slides:retracted",
  }),
  memory({
    id: "active-birthday",
    campaignId: "birthday-parties",
    status: "active",
    key: "campaign:birthday-parties:active",
  }),
];

function configureFixtures() {
  let postReads = 0;
  let decisionReads = 0;
  let memoryReads = 0;
  let evidenceReads = 0;

  configureSocialWorkingContextTestDependencies({
    now: () => new Date(NOW),
    listPosts: async () => {
      postReads += 1;
      return posts;
    },
    listPostDecisions: async (postId) => {
      decisionReads += 1;
      return decisionsByPost[postId] ?? [];
    },
    listMemories: async (input) => {
      memoryReads += 1;
      return memories.filter((item) => {
        const campaignMatches =
          input?.campaignId === undefined ||
          item.campaign_id === input.campaignId;
        const statusMatches =
          input?.status === undefined || item.status === input.status;
        return campaignMatches && statusMatches;
      });
    },
    listMemoryEvidence: async (memoryId) => {
      evidenceReads += 1;
      return memoryId === "active-summer"
        ? [
            evidence({ id: "evidence-1", memoryId }),
            evidence({ id: "evidence-2", memoryId }),
          ]
        : [evidence({ id: "evidence-3", memoryId })];
    },
  });

  return {
    reads: () => ({ postReads, decisionReads, memoryReads, evidenceReads }),
  };
}

await test("builds campaign-scoped context from source data", async () => {
  configureFixtures();

  const context = await buildSocialWorkingContext({
    campaignId: "summer-water-slides",
  });

  assert.equal(context.campaign.id, "summer-water-slides");
  assert.equal(context.campaign.label, "Summer Water Slides");
  assert.equal(context.sourceSummary.generatedAt, NOW);
  assert.equal(context.sourceSummary.postCount, 2);
  assert.equal(context.sourceSummary.decisionCount, 3);
  assert.deepEqual(
    context.recentPosts.map((item) => item.id),
    ["summer-new", "summer-old"],
  );
  assert(!context.recentPosts.some((item) => item.id === "birthday"));
});

await test("groups decisions by stage and type", async () => {
  configureFixtures();

  const context = await buildSocialWorkingContext({
    campaignId: "summer-water-slides",
  });

  assert.deepEqual(context.decisionSummary.byStage, {
    image_review: 2,
    video_review: 1,
  });
  assert.deepEqual(context.decisionSummary.byType, {
    accepted: 1,
    rejected: 1,
    selected: 1,
  });
  assert.deepEqual(
    context.decisionSummary.recentDecisions.map((item) => item.id),
    ["decision-1", "decision-2", "decision-3"],
  );
});

await test("includes active campaign memory with evidence counts", async () => {
  configureFixtures();

  const context = await buildSocialWorkingContext({
    campaignId: "summer-water-slides",
  });

  assert.equal(context.sourceSummary.activeMemoryCount, 1);
  assert.equal(context.sourceSummary.evidenceCount, 2);
  assert.deepEqual(
    context.campaignMemory.map((item) => item.id),
    ["active-summer"],
  );
  assert.equal(context.campaignMemory[0].evidenceCount, 2);
  assert.equal(context.campaignMemory[0].key, "campaign:summer-water-slides:active");
});

await test("excludes non-active and other-campaign memories", async () => {
  configureFixtures();

  const context = await buildSocialWorkingContext({
    campaignId: "summer-water-slides",
  });

  assert(!context.campaignMemory.some((item) => item.id === "retracted-summer"));
  assert(!context.campaignMemory.some((item) => item.id === "active-birthday"));
});

await test("returns fixed non-authoritative temporary constraints", async () => {
  configureFixtures();

  const context = await buildSocialWorkingContext({
    campaignId: "summer-water-slides",
  });

  assert.deepEqual(context.constraints, {
    temporary: true,
    campaignScoped: true,
    readOnly: true,
    authoritative: false,
  });
});

await test("rebuilds context on every call without writes", async () => {
  const fixtures = configureFixtures();

  await buildSocialWorkingContext({ campaignId: "summer-water-slides" });
  await buildSocialWorkingContext({ campaignId: "summer-water-slides" });

  assert.deepEqual(fixtures.reads(), {
    postReads: 2,
    decisionReads: 4,
    memoryReads: 2,
    evidenceReads: 2,
  });
});
