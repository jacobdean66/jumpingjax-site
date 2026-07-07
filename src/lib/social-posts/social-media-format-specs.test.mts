import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDimensionsLabel,
  getPublicationTargetAspectRatiosForPlacement,
  normalizeSocialPostPlacement,
  resolveSocialMediaFormat,
} from "./social-media-format-specs";

test("feed posts for facebook and instagram resolve to 4:5 portrait", () => {
  const format = resolveSocialMediaFormat({
    platforms: ["facebook", "instagram"],
    placement: "feed",
  });

  assert.equal(format.aspectRatio, "4:5");
  assert.equal(format.recommendedWidth, 1080);
  assert.equal(format.recommendedHeight, 1350);
  assert.equal(format.replicateAspectRatio, "4:5");
  assert.ok(format.supportedAspectRatios.includes("4:5"));
});

test("story and reel placements resolve to 9:16", () => {
  for (const placement of ["story", "reel"] as const) {
    const format = resolveSocialMediaFormat({
      platforms: ["facebook", "instagram"],
      placement,
    });
    assert.equal(format.aspectRatio, "9:16");
    assert.equal(format.recommendedHeight, 1920);
    assert.equal(format.replicateAspectRatio, "9:16");
  }
});

test("tiktok feed uses 9:16 vertical", () => {
  const format = resolveSocialMediaFormat({
    platforms: ["tiktok"],
    placement: "feed",
  });

  assert.equal(format.aspectRatio, "9:16");
  assert.equal(formatDimensionsLabel(format), "1080×1920 (9:16)");
});

test("normalizeSocialPostPlacement defaults unknown values to feed", () => {
  assert.equal(normalizeSocialPostPlacement(null), "feed");
  assert.equal(normalizeSocialPostPlacement("invalid"), "feed");
  assert.equal(normalizeSocialPostPlacement("carousel"), "carousel");
});

test("publication target aspect ratios match placement expectations", () => {
  assert.deepEqual(getPublicationTargetAspectRatiosForPlacement("feed"), [
    "1:1",
    "4:5",
    "3:4",
    "16:9",
  ]);
  assert.deepEqual(getPublicationTargetAspectRatiosForPlacement("story"), ["9:16"]);
  assert.deepEqual(getPublicationTargetAspectRatiosForPlacement("reel"), ["9:16"]);
});
