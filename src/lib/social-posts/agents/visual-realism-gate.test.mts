import assert from "node:assert/strict";
import test from "node:test";

import {
  applyVisualRealismConstraints,
  evaluateVisualRealismGate,
} from "./visual-realism-gate";

test("realism constraints cover human scale, anatomy, contact, and source geometry", () => {
  const prompt = applyVisualRealismConstraints({
    prompt: "Create a lively indoor facility-party scene.",
    hasReferenceAsset: true,
    themeLabel: "Gamer Neon",
  });
  const result = evaluateVisualRealismGate({
    prompt,
    sourceImageUrl: "https://jumpingjaxllc.com/invitations/approved/sonic/card.png",
    themeLabel: "Gamer Neon",
  });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.findings, []);
  assert.match(prompt, /realistic human scale/i);
  assert.match(prompt, /natural anatomy/i);
  assert.match(prompt, /ground contact/i);
  assert.match(prompt, /preserve the exact source/i);
});

test("a vague scene fails before media generation", () => {
  const result = evaluateVisualRealismGate({
    prompt: "Kids playing near a bounce house.",
    sourceImageUrl: null,
    themeLabel: "Gamer Neon",
  });
  assert.equal(result.allowed, false);
  assert.ok(result.findings.length >= 5);
});

test("asset kind prevents a product shot from becoming an invented lifestyle scene", () => {
  const productPrompt = applyVisualRealismConstraints({
    prompt: "Feature the selected water slide.",
    hasReferenceAsset: true,
    assetKind: "product",
  });
  const lifestylePrompt = applyVisualRealismConstraints({
    prompt: "Feature the selected party photo.",
    hasReferenceAsset: true,
    assetKind: "lifestyle",
  });

  assert.match(productPrompt, /do not add, remove, or synthesize children or adults/i);
  assert.match(lifestylePrompt, /use only the people already visible/i);
});

