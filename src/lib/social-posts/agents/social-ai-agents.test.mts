import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSocialStrategyRequestPayload,
  buildDeterministicSocialStrategyPlan,
  runSocialStrategyAgent,
  validateSocialStrategyPlan,
} from "./social-strategy-agent";
import {
  buildImageDirectorAgentRequestPayload,
  buildDeterministicImageDirectorDirection,
  runImageDirectorAgent,
  validateImageDirectorCreativeDirection,
} from "./image-director-agent";
import {
  buildVideoDirectorAgentRequestPayload,
  buildDeterministicVideoDirectorDirection,
  runVideoDirectorAgent,
  validateVideoDirectorCreativeDirection,
} from "./video-director-agent";
import {
  createScriptedLlmJsonClient,
} from "./llm-json-client";
import { createSocialAgentPlanWithMeta } from "../social-agent";
import { buildDraftComplianceValidator } from "../draft-compliance-validator/draft-compliance-validator-service";
import type { DraftCandidate } from "../draft-compliance-validator/draft-compliance-validator-types";

function validStrategyPlan(overrides: Record<string, unknown> = {}) {
  return {
    title: "Summer Splash Weekend",
    caption: "Cool off with Jumping Jax water slide rentals in Greenwood SC.",
    generationPrompt:
      "Create a short family-friendly promotional video showing a backyard waterslide with supervised kids ages 3-7. No text on screen.",
    mediaType: "video",
    platforms: ["facebook", "instagram"],
    businessFocus: "rentals",
    goal: "Promote water slides for hot weather",
    campaignId: "summer-water-slides",
    sourceImageKeywords: ["water", "slide", "summer", "splash"],
    audience: "Local families planning hot-weather backyard parties",
    tone: "upbeat, clean, family-friendly",
    callToAction: "Message Jumping Jax to ask about rental options.",
    factualConstraints: [
      "Do not invent prices or promotions.",
      "Do not invent availability or dates.",
    ],
    ownerInputRequired: [
      "Confirm any price or availability claims before publishing.",
    ],
    seasonalContextUsed: null,
    assetContextUsed: null,
    platformNotes: "Lead with a strong first-line hook for both platforms.",
    ...overrides,
  };
}

function validImageDirection(overrides: Record<string, unknown> = {}) {
  return {
    visualConcept: "Sunny backyard hero still of the selected waterslide",
    composition: "Product-forward framing with clear mobile readability",
    subject: "Exact waterslide from the source image",
    backgroundEnvironment: "Clean sunny backyard lawn",
    textOverlayRecommendation: "Do not bake text into the image",
    aspectRatioOrFraming: "4:5 feed framing",
    brandConstraints: [
      "Family-friendly Jumping Jax tone",
      "Preserve exact inflatable appearance",
    ],
    prohibitedOrRiskyElements: [
      "On-image text",
      "Unsafe play",
      "Video motion language",
    ],
    finalImageGenerationPrompt:
      "Photorealistic still of the exact waterslide from the source image in a sunny backyard, supervised kids ages 3-7, no text.",
    ...overrides,
  };
}

function validVideoDirection(overrides: Record<string, unknown> = {}) {
  return {
    openingHook: "Open on splash energy at the waterslide landing",
    shotSequence: ["Establish slide", "Show safe slide descent", "Family reaction"],
    sceneDescriptions: [
      "Bright backyard waterslide scene",
      "Supervised kids ages 3-7 with child-sized bodies",
    ],
    motionCameraGuidance: "Natural splash motion with a stable wide-angle establish",
    durationGuidance: "5-second vertical social ad",
    onScreenText: "No baked-in on-screen text",
    voiceoverOrCaptionGuidance:
      "Upbeat local caption. Do not invent prices or availability.",
    closingCallToAction: "Invite families to message Jumping Jax for details.",
    finalVideoGenerationPrompt:
      "5-second family-friendly waterslide promo with supervised kids ages 3-7, exact inflatable preserved, no text on screen.",
    ...overrides,
  };
}

test("social strategy request builder includes only supplied seasonal/asset context", () => {
  const withSeason = buildSocialStrategyRequestPayload({
    goal: "Promote water slides for hot weather",
    campaignId: "summer-water-slides",
    seasonalContext: "Late July heat wave weekend",
  });
  assert.match(withSeason.user, /Late July heat wave weekend/);
  assert.match(withSeason.system, /Do NOT invent Jumping Jax prices/);

  const withoutSeason = buildSocialStrategyRequestPayload({
    goal: "Promote water slides for hot weather",
    campaignId: "summer-water-slides",
  });
  const parsed = JSON.parse(withoutSeason.user) as {
    request: { seasonalContext: string | null; assetContext: string | null };
  };
  assert.equal(parsed.request.seasonalContext, null);
  assert.equal(parsed.request.assetContext, null);
});

test("social strategy schema validation rejects malformed model responses", () => {
  assert.equal(validateSocialStrategyPlan(null), null);
  assert.equal(validateSocialStrategyPlan({ title: "only title" }), null);
  assert.equal(
    validateSocialStrategyPlan(
      validStrategyPlan({ sourceImageKeywords: ["one"] }),
    ),
    null,
  );
  assert.equal(
    validateSocialStrategyPlan(
      validStrategyPlan({ campaignId: "not-a-real-campaign" }),
    ),
    null,
  );
  const ok = validateSocialStrategyPlan(validStrategyPlan());
  assert.ok(ok);
  assert.equal(ok?.campaignId, "summer-water-slides");
});

test("social strategy agent falls back when provider is missing", async () => {
  const client = createScriptedLlmJsonClient(async () => {
    throw new Error("should not be called when unconfigured");
  });
  // Override isConfigured
  const unconfigured = {
    ...client,
    isConfigured: () => false,
    getConfiguredModel: () => null,
  };

  const result = await runSocialStrategyAgent(
    { goal: "Promote birthday party bookings", campaignId: "birthday-parties" },
    { client: unconfigured },
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.diagnostics.source, "deterministic-fallback");
  assert.match(
    result.diagnostics.fallbackReason ?? "",
    /not configured/i,
  );
  assert.doesNotMatch(result.output.caption, /\$\d+/);
  assert.ok(result.output.ownerInputRequired.length > 0);
});

test("social strategy agent uses model output once and reports diagnostics", async () => {
  let calls = 0;
  const client = createScriptedLlmJsonClient(async (request) => {
    calls += 1;
    assert.match(request.system, /Social Strategy \/ Copy Agent/);
    return {
      ok: true,
      parsed: validStrategyPlan(),
      rawText: JSON.stringify(validStrategyPlan()),
      model: "test-model",
      requestId: request.requestId ?? "req",
      provider: "openai",
      truncatedInput: false,
      timedOut: false,
    };
  });

  const result = await runSocialStrategyAgent(
    { goal: "Promote water slides for hot weather", campaignId: "summer-water-slides" },
    { client },
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(calls, 1);
  assert.equal(result.diagnostics.source, "model");
  assert.equal(result.diagnostics.model, "test-model");
  assert.equal(result.output.seasonalContextUsed, null);
});

test("social strategy agent ignores fabricated seasonal context when not supplied", async () => {
  const client = createScriptedLlmJsonClient(async (request) => ({
    ok: true,
    parsed: validStrategyPlan({
      seasonalContextUsed: "Invented Labor Day mega sale",
    }),
    rawText: "{}",
    model: "test-model",
    requestId: request.requestId ?? "req",
    provider: "openai",
    truncatedInput: false,
    timedOut: false,
  }));

  const result = await runSocialStrategyAgent(
    { goal: "Promote water slides for hot weather" },
    { client },
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.output.seasonalContextUsed, null);
});

test("social strategy agent falls back on timeout or invalid JSON payload", async () => {
  const timeoutClient = createScriptedLlmJsonClient(async (request) => ({
    ok: false,
    error: "Language model request timed out.",
    model: "test-model",
    requestId: request.requestId ?? "req",
    provider: "openai",
    truncatedInput: false,
    timedOut: true,
  }));
  const timeoutResult = await runSocialStrategyAgent(
    { goal: "Promote birthday party bookings" },
    { client: timeoutClient },
  );
  assert.equal(timeoutResult.ok, true);
  if (!timeoutResult.ok) return;
  assert.equal(timeoutResult.diagnostics.source, "deterministic-fallback");
  assert.equal(timeoutResult.diagnostics.timedOut, true);

  const badClient = createScriptedLlmJsonClient(async (request) => ({
    ok: true,
    parsed: { nope: true },
    rawText: "{}",
    model: "test-model",
    requestId: request.requestId ?? "req",
    provider: "openai",
    truncatedInput: false,
    timedOut: false,
  }));
  const badResult = await runSocialStrategyAgent(
    { goal: "Promote birthday party bookings" },
    { client: badClient },
  );
  assert.equal(badResult.ok, true);
  if (!badResult.ok) return;
  assert.equal(badResult.diagnostics.source, "deterministic-fallback");
  assert.match(
    badResult.diagnostics.fallbackReason ?? "",
    /schema validation|unknown keys/i,
  );
});

test("deterministic social strategy fallback does not fabricate business prices", () => {
  const plan = buildDeterministicSocialStrategyPlan({
    campaignId: "summer-water-slides",
    goal: "Promote water slides for hot weather",
  });
  assert.doesNotMatch(plan.caption, /\$\d+/);
  assert.doesNotMatch(plan.generationPrompt, /\$\d+/);
  assert.ok(
    plan.factualConstraints.some((item) => /price/i.test(item)),
  );
});

test("image director request builder and schema validation", () => {
  const payload = buildImageDirectorAgentRequestPayload({
    originalSourceImageUrl: "https://example.com/slide.jpg",
    campaignName: "Summer Water Slides",
    postPrompt: "Promote water slides",
    sourceImageCategory: "Water Slides",
    imageStudioPreset: "kids-playing",
    platforms: ["instagram"],
    postPlacement: "feed",
  });
  assert.match(payload.system, /Image Director Agent/);
  assert.match(payload.user, /Water Slides/);

  assert.equal(validateImageDirectorCreativeDirection(null), null);
  assert.equal(
    validateImageDirectorCreativeDirection(
      validImageDirection({
        finalImageGenerationPrompt: "Animate a tracking shot video sequence",
      }),
    ),
    null,
  );
  assert.ok(validateImageDirectorCreativeDirection(validImageDirection()));
});

test("image director agent falls back when model fails and does not invent prices", async () => {
  const client = createScriptedLlmJsonClient(async (request) => ({
    ok: false,
    error: "Language model request timed out.",
    model: "test-model",
    requestId: request.requestId ?? "req",
    provider: "openai",
    truncatedInput: false,
    timedOut: true,
  }));

  const result = await runImageDirectorAgent(
    {
      originalSourceImageUrl: null,
      campaignName: "Summer Water Slides",
      postPrompt: "Promote water slides",
      sourceImageCategory: "Water Slides",
      imageStudioPreset: "kids-playing",
    },
    { client },
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.diagnostics.source, "deterministic-fallback");
  assert.doesNotMatch(result.output.finalImageGenerationPrompt, /\$\d+/);
  assert.ok(result.output.prohibitedOrRiskyElements.length > 0);

  const deterministic = buildDeterministicImageDirectorDirection({
    originalSourceImageUrl: null,
    campaignName: null,
    postPrompt: "",
    sourceImageCategory: null,
    imageStudioPreset: "original-rental-photo",
  });
  assert.ok(deterministic.finalImageGenerationPrompt.length > 0);
});

test("image director agent accepts structured model direction once", async () => {
  let calls = 0;
  const client = createScriptedLlmJsonClient(async (request) => {
    calls += 1;
    return {
      ok: true,
      parsed: validImageDirection(),
      rawText: JSON.stringify(validImageDirection()),
      model: "test-model",
      requestId: request.requestId ?? "req",
      provider: "openai",
      truncatedInput: false,
      timedOut: false,
    };
  });

  const result = await runImageDirectorAgent(
    {
      originalSourceImageUrl: "https://example.com/slide.jpg",
      campaignName: "Summer Water Slides",
      postPrompt: "Promote water slides",
      sourceImageCategory: "Water Slides",
      imageStudioPreset: "kids-playing",
    },
    { client },
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(calls, 1);
  assert.equal(result.diagnostics.source, "model");
  assert.match(result.output.visualConcept, /waterslide/i);
});

test("video director request builder uses campaign/platform/duration context", () => {
  const payload = buildVideoDirectorAgentRequestPayload({
    originalPrompt: "Make a fun waterslide promo",
    campaignId: "summer-water-slides",
    goal: "Promote water slides for hot weather",
    businessFocus: "rentals",
    sourceImageUrl: null,
    motionPreset: "fast-waterslide",
    cameraPreset: "wide-angle",
    platforms: ["instagram"],
    postPlacement: "reels",
    durationSeconds: 5,
  });
  assert.match(payload.system, /Video Director Agent/);
  assert.match(payload.user, /fast-waterslide/);
  assert.match(payload.user, /durationSeconds\":5/);
});

test("video director schema validation and deterministic fallback", () => {
  assert.equal(validateVideoDirectorCreativeDirection({}), null);
  assert.ok(validateVideoDirectorCreativeDirection(validVideoDirection()));

  const fallback = buildDeterministicVideoDirectorDirection({
    originalPrompt: "Backyard bounce house fun",
    campaignId: "birthday-parties",
    goal: "Promote birthday party bookings",
    businessFocus: "both",
    sourceImageUrl: null,
    motionPreset: "bounce-house",
    cameraPreset: "static",
  });
  assert.ok(fallback.shotSequence.length > 0);
  assert.doesNotMatch(fallback.finalVideoGenerationPrompt, /\$\d+/);
  assert.match(fallback.onScreenText, /No baked-in/i);
});

test("video director agent falls back on malformed model output", async () => {
  const client = createScriptedLlmJsonClient(async (request) => ({
    ok: true,
    parsed: { openingHook: "only one field" },
    rawText: "{}",
    model: "test-model",
    requestId: request.requestId ?? "req",
    provider: "openai",
    truncatedInput: false,
    timedOut: false,
  }));

  const result = await runVideoDirectorAgent(
    {
      originalPrompt: "Make a fun waterslide promo",
      campaignId: "summer-water-slides",
      goal: "Promote water slides for hot weather",
      businessFocus: "rentals",
      sourceImageUrl: null,
    },
    { client },
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.diagnostics.source, "deterministic-fallback");
  assert.match(
    result.diagnostics.fallbackReason ?? "",
    /schema validation|required|unknown keys/i,
  );
});

test("createSocialAgentPlanWithMeta distinguishes model vs fallback and never publishes", async () => {
  const modelClient = createScriptedLlmJsonClient(async (request) => ({
    ok: true,
    parsed: validStrategyPlan(),
    rawText: JSON.stringify(validStrategyPlan()),
    model: "test-model",
    requestId: request.requestId ?? "req",
    provider: "openai",
    truncatedInput: false,
    timedOut: false,
  }));

  const modeled = await createSocialAgentPlanWithMeta(
    {
      goal: "Promote water slides for hot weather",
      campaignId: "summer-water-slides",
    },
    { client: modelClient },
  );
  assert.equal(modeled.diagnostics.source, "model");
  assert.equal(modeled.plan.campaignId, "summer-water-slides");
  assert.ok(!("published" in modeled.plan));

  const fallbackClient = createScriptedLlmJsonClient(async (request) => ({
    ok: false,
    error: "Language model request timed out.",
    model: "test-model",
    requestId: request.requestId ?? "req",
    provider: "openai",
    truncatedInput: false,
    timedOut: true,
  }));
  const fallback = await createSocialAgentPlanWithMeta(
    {
      goal: "Promote birthday party bookings",
      campaignId: "birthday-parties",
    },
    { client: fallbackClient },
  );
  assert.equal(fallback.diagnostics.source, "deterministic-fallback");
  assert.doesNotMatch(fallback.plan.caption, /\$\d+/);
});

test("compliance validator still runs independently of agents", () => {
  const candidate: DraftCandidate = {
    id: "explicit:agent-test",
    sourceSpecificationId: null,
    campaignId: "summer-water-slides",
    label: "Test draft",
    fixtureKind: "explicit-caller-input",
    sections: {
      hook: "Cool off this weekend",
      primaryMessage: "Jumping Jax has family-friendly waterslide rentals.",
      supportingProof: null,
      cta: "Message Jumping Jax for details.",
      fullCaption: "Cool off this weekend with Jumping Jax.",
    },
    declaredPlatform: null,
    declaredPlacement: null,
    mediaDeclarations: {
      hasImage: false,
      hasVideo: true,
      imageAltText: null,
      videoCaptionsOrTranscript: null,
      claimsImageOnly: false,
    },
  };

  const snapshot = buildDraftComplianceValidator({
    asOf: "2026-08-06T12:00:00.000Z",
    specifications: [],
    candidates: [candidate],
  });

  assert.equal(snapshot.constraints.deterministic, true);
  assert.equal(snapshot.constraints.publishesNothing, true);
  assert.equal(snapshot.evaluations.length, 1);
  assert.ok(
    ["insufficient-spec", "not-evaluated", "violations-found", "unknown"].includes(
      snapshot.evaluations[0]?.resultState ?? "",
    ),
  );
});

test("missing campaign/asset context still produces usable deterministic plans", () => {
  const strategy = buildDeterministicSocialStrategyPlan({});
  assert.ok(strategy.title);
  assert.equal(strategy.campaignId, null);
  assert.equal(strategy.assetContextUsed, null);

  const image = buildDeterministicImageDirectorDirection({
    originalSourceImageUrl: null,
    campaignName: null,
    postPrompt: "",
    sourceImageCategory: null,
    imageStudioPreset: "custom",
  });
  assert.ok(image.finalImageGenerationPrompt.length > 0);

  const video = buildDeterministicVideoDirectorDirection({
    originalPrompt: "",
    campaignId: null,
    goal: null,
    businessFocus: "both",
    sourceImageUrl: null,
  });
  assert.ok(video.finalVideoGenerationPrompt.length > 0);
});
