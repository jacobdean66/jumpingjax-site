import assert from "node:assert/strict";
import test from "node:test";
import {
  buildImageDirectorPrompt,
  getImageDirectorSafetyWarnings,
} from "./image-director";

test("invitation artwork produces a theme-aware facility prompt, not an inflatable prompt", () => {
  const { prompt } = buildImageDirectorPrompt({
    originalSourceImageUrl: "https://jumpingjaxllc.com/invitations/approved/sonic/card.png",
    campaignName: "Birthday Parties",
    postPrompt: "Sonic-style gamer party",
    sourceImageCategory: "Facility invitation themes",
    imageStudioPreset: "birthday-party",
    platforms: ["facebook", "instagram"],
    postPlacement: "feed",
    formatVariantId: "feed-portrait-4x5",
  });

  assert.match(prompt, /indoor facility birthday-party scene/i);
  assert.match(prompt, /palette and mood reference/i);
  assert.match(prompt, /not an inflatable/i);
  assert.doesNotMatch(prompt, /exact inflatable/i);
  assert.doesNotMatch(prompt, /full inflatable/i);
  assert.doesNotMatch(prompt, /protected character likeness/i);
  assert.deepEqual(
    getImageDirectorSafetyWarnings({
      prompt,
      sourceImageCategory: "Facility invitation themes",
      originalSourceImageUrl:
        "https://jumpingjaxllc.com/invitations/approved/sonic/card.png",
      imageStudioPreset: "birthday-party",
    }),
    [],
  );
});
