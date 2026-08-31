import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAgentComplianceGate } from "./agent-compliance-gate";

test("caption-carried image claims with supplied alt text are not mislabeled image-only", () => {
  const result = evaluateAgentComplianceGate({
    title: "Game-On Party Fun at Jumping Jax",
    caption: "Planning an indoor birthday in Greenwood? Bring your crew to Jumping Jax for active play and a gamer-neon party atmosphere. Message us to ask about facility-party details.",
    generationPrompt: "Create a clean Gamer Neon indoor facility-party image with no text.",
    campaignId: "birthday-parties",
    platforms: ["facebook", "instagram"],
    mediaType: "image",
    imageAltText: "Gamer-neon indoor facility-party artwork in blue, navy, yellow, and cyan.",
    claimsImageOnly: false,
    posts: [],
    candidateId: "explicit:test:caption-carried-image",
  });
  assert.equal(result.decision, "allow");
  assert.equal(result.allowedToProceed, true);
  assert.ok(!result.blockingCodes.includes("accessibility-gap"));
});
