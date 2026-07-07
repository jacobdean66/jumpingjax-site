import assert from "node:assert/strict";

import {
  buildPublicationManifest,
  configurePublicationManifestTestDependencies,
} from "./social-publication-manifest";
import type { SocialPostAsset } from "./social-post-assets";
import type { SocialPostDecision } from "./social-post-decisions";
import type { SocialPost } from "./social-post-data";
import type { SocialWorkingContext } from "./social-working-context";

const NOW = "2026-06-28T12:00:00.000Z";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  configurePublicationManifestTestDependencies(null);
  try {
    await fn();
    console.log(`ok - ${name}`);
  } finally {
    configurePublicationManifestTestDependencies(null);
  }
}

function post(input: Partial<SocialPost> & { id: string }): SocialPost {
  return {
    id: input.id,
    created_at: input.created_at ?? NOW,
    updated_at: input.updated_at ?? NOW,
    title: input.title ?? "Weekend Water Slide",
    campaign_id: input.campaign_id ?? "summer-water-slides",
    goal: input.goal ?? "Promote water slides",
    prompt: input.prompt ?? "Bright summer waterslide ad",
    caption: input.caption ?? "Cool off this weekend.",
    media_type: input.media_type ?? "image",
    business_focus: input.business_focus ?? "rentals",
    media_url: input.media_url ?? null,
    source_image_url: input.source_image_url ?? "https://example.test/source.png",
    original_image_url: input.original_image_url ?? null,
    approved_image_url:
      input.approved_image_url ?? "https://example.test/approved.png",
    generated_image_url:
      input.generated_image_url ?? "https://example.test/generated.png",
    generated_image_source_url: input.generated_image_source_url ?? null,
    media_source_url: input.media_source_url ?? null,
    image_generation_provider: input.image_generation_provider ?? null,
    image_generation_model: input.image_generation_model ?? null,
    image_prediction_id: input.image_prediction_id ?? null,
    image_generation_created_at: input.image_generation_created_at ?? null,
    image_generation_prompt: input.image_generation_prompt ?? null,
    image_generation_status: input.image_generation_status ?? null,
    image_concepts: input.image_concepts ?? [],
    motion_preset: input.motion_preset ?? null,
    camera_preset: input.camera_preset ?? null,
    creative_source: input.creative_source ?? null,
    platforms: input.platforms ?? ["facebook", "instagram"],
    post_placement: input.post_placement ?? "feed",
    format_variant_id: input.format_variant_id ?? null,
    status: input.status ?? "draft",
    scheduled_for: input.scheduled_for ?? null,
    posted_at: input.posted_at ?? null,
    error_message: input.error_message ?? null,
  };
}

function asset(input: Partial<SocialPostAsset> & { id: string }): SocialPostAsset {
  return {
    id: input.id,
    social_post_id: input.social_post_id ?? "post-1",
    parent_asset_id: input.parent_asset_id ?? null,
    asset_family_id: input.asset_family_id ?? `family-${input.id}`,
    created_at: input.created_at ?? NOW,
    updated_at: input.updated_at ?? NOW,
    asset_type: input.asset_type ?? "image",
    asset_stage: input.asset_stage ?? "generated",
    url: input.url ?? `https://example.test/${input.id}.png`,
    source_url: input.source_url ?? null,
    storage_path: input.storage_path ?? null,
    provider: input.provider ?? null,
    generation_engine: input.generation_engine ?? null,
    model: input.model ?? null,
    prediction_id: input.prediction_id ?? null,
    generation_status: input.generation_status ?? null,
    generation_prompt: input.generation_prompt ?? null,
    concept_id: input.concept_id ?? null,
    generation_cost: input.generation_cost ?? null,
    generation_duration_ms: input.generation_duration_ms ?? null,
    created_by: input.created_by ?? null,
    is_selected: input.is_selected ?? false,
    is_rejected: input.is_rejected ?? false,
    is_favorite: input.is_favorite ?? false,
    rating: input.rating ?? null,
    notes: input.notes ?? null,
    metadata: input.metadata ?? {},
  };
}

function decision(
  input: Partial<SocialPostDecision> & { id: string },
): SocialPostDecision {
  return {
    id: input.id,
    social_post_id: input.social_post_id ?? "post-1",
    asset_id: input.asset_id ?? null,
    asset_family_id: input.asset_family_id ?? null,
    campaign_id: input.campaign_id ?? "summer-water-slides",
    created_at: input.created_at ?? NOW,
    decision_stage: input.decision_stage ?? "image_review",
    decision_type: input.decision_type ?? "accepted",
    decision: input.decision ?? "Accepted image",
    rationale: input.rationale ?? "Detailed reasoning should not be duplicated.",
    input_snapshot: input.input_snapshot ?? { prompt: "private prompt" },
    output_snapshot: input.output_snapshot ?? { result: "private result" },
    model: input.model ?? null,
    provider: input.provider ?? null,
    created_by: input.created_by ?? "test",
  };
}

function workingContext(input?: Partial<SocialWorkingContext>): SocialWorkingContext {
  return {
    campaign: {
      id: "summer-water-slides",
      label: "Summer Water Slides",
      description: "Campaign context",
      businessFocus: "rentals",
      defaultMediaType: "video",
    },
    sourceSummary: {
      generatedAt: "not-copied",
      postCount: 3,
      decisionCount: 7,
      activeMemoryCount: 2,
      evidenceCount: 9,
    },
    recentPosts: [],
    decisionSummary: {
      byStage: {},
      byType: {},
      recentDecisions: [],
    },
    campaignMemory: [],
    constraints: {
      temporary: true,
      campaignScoped: true,
      readOnly: true,
      authoritative: false,
    },
    ...input,
  };
}

await test("builds a deterministic read-only manifest summary", async () => {
  configurePublicationManifestTestDependencies({
    getPostById: async () => post({ id: "post-1" }),
    listAssets: async () => [
      asset({
        id: "asset-old",
        is_selected: true,
        created_at: "2026-06-28T11:00:00.000Z",
      }),
      asset({
        id: "asset-new",
        asset_stage: "approved",
        is_selected: true,
        created_at: "2026-06-28T12:00:00.000Z",
      }),
    ],
    listDecisions: async () => [
      decision({
        id: "decision-1",
        decision_stage: "image_review",
        decision_type: "accepted",
      }),
      decision({
        id: "decision-2",
        decision_stage: "video_review",
        decision_type: "selected",
      }),
    ],
    buildWorkingContext: async () => workingContext(),
    getCampaign: () => ({
      id: "summer-water-slides",
      label: "Summer Water Slides",
      description: "Push slides.",
      businessFocus: "rentals",
      defaultMediaType: "video",
      goalTemplates: [],
      captionAngles: [],
      promptAngles: [],
      preferredImageKeywords: [],
    }),
  });

  const manifest = await buildPublicationManifest("post-1");

  assert.equal(manifest.identity.socialPostId, "post-1");
  assert.equal(manifest.campaign.label, "Summer Water Slides");
  assert.equal(manifest.assets.selected.length, 2);
  assert.equal(manifest.assets.selected[0].id, "asset-new");
  assert.equal(manifest.assets.approved.length, 1);
  assert.equal(manifest.decisionSummary.totalCount, 2);
  assert.deepEqual(manifest.decisionSummary.byStage, {
    image_review: 1,
    video_review: 1,
  });
  assert.deepEqual(manifest.workingContextSummary, {
    campaignScoped: true,
    activeMemoryCount: 2,
    contextPostCount: 3,
    contextDecisionCount: 7,
    contextEvidenceCount: 9,
  });
  assert.equal(manifest.constraints.derivedEphemeral, true);
  assert.equal(manifest.constraints.approvesNothing, true);
  assert.equal("generatedAt" in manifest, false);
  assert.equal("readiness" in manifest, false);
  assert.equal("approval" in manifest, false);
});

await test("keeps decision history summary-only", async () => {
  configurePublicationManifestTestDependencies({
    getPostById: async () => post({ id: "post-1" }),
    listAssets: async () => [],
    listDecisions: async () => [
      decision({
        id: "decision-private",
        rationale: "Do not copy me.",
        input_snapshot: { secret: true },
        output_snapshot: { secret: true },
      }),
    ],
    buildWorkingContext: async () => workingContext(),
    getCampaign: () => null,
  });

  const manifest = await buildPublicationManifest("post-1");

  assert.deepEqual(manifest.decisionSummary.recentDecisionIds, [
    "decision-private",
  ]);
  assert.equal(JSON.stringify(manifest).includes("Do not copy me."), false);
  assert.equal(JSON.stringify(manifest).includes("secret"), false);
});

await test("fails safely when the social post is missing", async () => {
  configurePublicationManifestTestDependencies({
    getPostById: async () => null,
  });

  await assert.rejects(
    () => buildPublicationManifest("missing-post"),
    /Social post not found\./,
  );
});
