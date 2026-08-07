import assert from "node:assert/strict";
import test from "node:test";
import {
  beginAgentIdempotentAction,
  buildAgentActionFingerprint,
  completeAgentIdempotentAction,
  resetAgentIdempotencyStoreForTests,
} from "./agent-idempotency";
import {
  resolveApprovedAssetContext,
  sanitizeApprovedAssetUrl,
} from "./approved-asset-context";
import {
  evaluateAgentComplianceGate,
  evaluateEditedPromptCompliance,
} from "./agent-compliance-gate";
import { scanProhibitedBusinessClaims } from "./agent-input-bounds";
import {
  validateImageDirectorCreativeDirection,
  validateImageDirectorCreativeDirectionDetailed,
} from "./image-director-agent";
import {
  validateVideoDirectorCreativeDirection,
  validateVideoDirectorCreativeDirectionDetailed,
} from "./video-director-agent";
import { validateSocialStrategyPlan } from "./social-strategy-agent";
import type { SocialPost } from "../social-post-data";

function emptyPosts(): SocialPost[] {
  return [];
}

test("idempotency collapses in-flight duplicates and replays completed responses", () => {
  resetAgentIdempotencyStoreForTests();
  const fingerprint = buildAgentActionFingerprint({
    action: "agent-draft",
    goal: "Promote clean and safe local family fun",
  });

  const first = beginAgentIdempotentAction({
    clientKey: "client-a",
    action: "agent-draft",
    idempotencyKey: "key-1",
    fingerprint,
  });
  assert.equal(first.kind, "proceed");

  const duplicate = beginAgentIdempotentAction({
    clientKey: "client-a",
    action: "agent-draft",
    idempotencyKey: "key-1",
    fingerprint,
  });
  assert.equal(duplicate.kind, "in_progress");

  if (first.kind !== "proceed") throw new Error("expected proceed");
  completeAgentIdempotentAction({
    storeKey: first.storeKey,
    fingerprint,
    status: 200,
    body: { ok: true, publication: { published: false } },
  });

  const replay = beginAgentIdempotentAction({
    clientKey: "client-a",
    action: "agent-draft",
    idempotencyKey: "key-1",
    fingerprint,
  });
  assert.equal(replay.kind, "replay");
  if (replay.kind === "replay") {
    assert.equal(replay.status, 200);
    assert.equal(
      (replay.body as { publication?: { published?: boolean } }).publication
        ?.published,
      false,
    );
  }
});

test("approved asset context rejects arbitrary external URLs and strips signed params", () => {
  const rejected = resolveApprovedAssetContext(
    "https://evil.example/private.png?token=secret-token&sig=abc",
  );
  assert.equal(rejected.ok, false);

  const sanitized = sanitizeApprovedAssetUrl(
    "https://cdn.example.com/asset.png?token=secret&x-amz-signature=abc&keep=1",
  );
  assert.ok(sanitized);
  assert.doesNotMatch(sanitized!, /token=/i);
  assert.doesNotMatch(sanitized!, /signature=/i);
  assert.match(sanitized!, /keep=1/);
});

test("hard claim scan blocks fabricated prices and promos", () => {
  const hits = scanProhibitedBusinessClaims(
    "Book today only for $99 and get 20% off — available now!",
  );
  assert.ok(hits.length >= 2);
});

test("compliance gate blocks invented price claims and does not treat insufficient-spec as success", () => {
  const blocked = evaluateAgentComplianceGate({
    title: "Weekend deal",
    caption: "Only $49 this weekend!",
    generationPrompt: "Family fun video",
    campaignId: null,
    posts: emptyPosts(),
  });
  assert.equal(blocked.decision, "block");
  assert.equal(blocked.allowedToProceed, false);
  assert.equal(blocked.modelApproved, false);
  assert.equal(blocked.deterministic, true);

  const quarantined = evaluateAgentComplianceGate({
    title: "Family fun",
    caption: "Message Jumping Jax for party details.",
    generationPrompt: "Family-friendly backyard inflatable scene. No text.",
    campaignId: null,
    posts: emptyPosts(),
  });
  // With empty Wave specs / no matching fixtures, insufficient-spec → quarantine.
  assert.notEqual(quarantined.decision, "allow");
  assert.equal(quarantined.allowedToProceed, false);
});

test("edited prompt compliance blocks before paid generation semantics", () => {
  const result = evaluateEditedPromptCompliance({
    prompt: "Generate a promo image advertising free rentals and $0 deposit.",
    caption: "Fun weekend",
    title: "Promo",
    campaignId: null,
    posts: emptyPosts(),
  });
  assert.equal(result.decision, "block");
  assert.equal(result.allowedToProceed, false);
});

test("image director schema rejects unknown keys and silent array filtering", () => {
  const withExtra = validateImageDirectorCreativeDirectionDetailed({
    visualConcept: "Sunny backyard still",
    composition: "Product forward",
    subject: "Waterslide",
    backgroundEnvironment: "Lawn",
    textOverlayRecommendation: "No text",
    aspectRatioOrFraming: "4:5",
    brandConstraints: ["Family-friendly"],
    prohibitedOrRiskyElements: ["On-image text"],
    finalImageGenerationPrompt:
      "Photorealistic still of the waterslide, no text.",
    extraField: "nope",
  });
  assert.equal(withExtra.ok, false);

  const withBadArray = validateImageDirectorCreativeDirection({
    visualConcept: "Sunny backyard still",
    composition: "Product forward",
    subject: "Waterslide",
    backgroundEnvironment: "Lawn",
    textOverlayRecommendation: "No text",
    aspectRatioOrFraming: "4:5",
    brandConstraints: ["ok", 12, null],
    prohibitedOrRiskyElements: ["On-image text"],
    finalImageGenerationPrompt:
      "Photorealistic still of the waterslide, no text.",
  });
  assert.equal(withBadArray, null);
});

test("video director schema rejects unknown keys and claim-bearing prompts", () => {
  const withExtra = validateVideoDirectorCreativeDirectionDetailed({
    openingHook: "Open on splash",
    shotSequence: ["Establish"],
    sceneDescriptions: ["Backyard"],
    motionCameraGuidance: "Gentle pan",
    durationGuidance: "5s",
    onScreenText: "None",
    voiceoverOrCaptionGuidance: "Upbeat",
    closingCallToAction: "Message Jumping Jax",
    finalVideoGenerationPrompt: "5-second family promo",
    sneaky: true,
  });
  assert.equal(withExtra.ok, false);

  const withClaim = validateVideoDirectorCreativeDirection({
    openingHook: "Open on splash",
    shotSequence: ["Establish"],
    sceneDescriptions: ["Backyard"],
    motionCameraGuidance: "Gentle pan",
    durationGuidance: "5s",
    onScreenText: "None",
    voiceoverOrCaptionGuidance: "Mention the $99 special",
    closingCallToAction: "Message Jumping Jax",
    finalVideoGenerationPrompt: "5-second family promo",
  });
  assert.equal(withClaim, null);
});

test("social strategy schema rejects unknown keys", () => {
  const plan = validateSocialStrategyPlan({
    title: "Summer Splash Weekend",
    caption: "Cool off with Jumping Jax water slide rentals in Greenwood SC.",
    generationPrompt:
      "Create a short family-friendly promotional video. No text on screen.",
    mediaType: "video",
    platforms: ["facebook"],
    businessFocus: "rentals",
    goal: "Promote water slides for hot weather",
    campaignId: null,
    sourceImageKeywords: ["water", "slide", "summer", "splash"],
    audience: "Local families",
    tone: "upbeat",
    callToAction: "Message Jumping Jax for details.",
    factualConstraints: ["Do not invent prices."],
    ownerInputRequired: ["Confirm availability before publishing."],
    seasonalContextUsed: null,
    assetContextUsed: null,
    platformNotes: "Facebook-first hook.",
    independentReviewerApproved: true,
  });
  assert.equal(plan, null);
});
