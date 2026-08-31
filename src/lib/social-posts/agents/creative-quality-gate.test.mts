import assert from "node:assert/strict";
import test from "node:test";

import { evaluateCreativeQualityGate } from "./creative-quality-gate";
import type { CreativeDirectorOutput } from "./orchestration-types";

function creative(overrides: Partial<CreativeDirectorOutput> = {}): CreativeDirectorOutput {
  return {
    title: "Level Up the Birthday Fun at Jumping Jax",
    caption: "Ready to level up the birthday fun? Celebrate indoors at Jumping Jax with active play, colorful party energy, and plenty of room for big smiles. Message us to plan a facility party for your crew in Greenwood, SC.",
    generationPrompt: "Create a polished Gamer Neon indoor facility-party scene.",
    mediaType: "image",
    platforms: ["facebook", "instagram"],
    businessFocus: "facility-parties",
    campaignId: "birthday-parties",
    goal: "Promote indoor facility parties",
    assetUsageGuidance: "Use approved artwork.",
    visualDirection: "Gamer Neon party styling.",
    platformSpecificConstraints: ["4:5"],
    sourceImageKeywords: ["gamer", "party", "indoor"],
    ownerInputRequired: [],
    revisionOfPrior: false,
    ...overrides,
  };
}

test("polished Sonic/Gamer Neon fallback passes the pre-review quality gate", () => {
  assert.equal(
    evaluateCreativeQualityGate({ creative: creative(), themeLabel: "Gamer Neon", themeSource: "Sonic" }).allowed,
    true,
  );
});

test("instruction-echo creative is stopped before the Reviewer", () => {
  const result = evaluateCreativeQualityGate({
    creative: creative({
      title: "Jumping Jax: Promote indoor facility parties",
      caption: "Aligned with: Promote indoor facility parties. Owner confirms facts.",
    }),
    themeLabel: "Gamer Neon",
    themeSource: "Sonic",
  });
  assert.equal(result.allowed, false);
  assert.ok(result.findings.length >= 2);
});

test("revision instructions can never leak into public caption copy", () => {
  const result = evaluateCreativeQualityGate({
    creative: creative({
      caption: "Planning a party? Revision focus: Remove the Sonic-specific reference and simplify the generation prompt before this goes live.",
    }),
    themeLabel: "Gamer Neon",
    themeSource: "Sonic",
  });
  assert.equal(result.allowed, false);
  assert.ok(result.findings.includes("Copy exposes internal instructions or workflow language."));
});
