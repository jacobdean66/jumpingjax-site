import assert from "node:assert/strict";
import test from "node:test";

import { getDefaultFormatVariantId } from "./social-media-format-variants";
import {
  formatActualAspectRatio,
  verifyImageDimensionsAgainstVariant,
} from "./social-media-image-verification-core";
import { getFormatVariantById } from "./social-media-format-variants";

test("feed portrait verification accepts 1080x1350", () => {
  const variant = getFormatVariantById("feed_portrait_4_5");
  const result = verifyImageDimensionsAgainstVariant({
    width: 1080,
    height: 1350,
    variant,
    platforms: ["facebook", "instagram"],
    placement: "feed",
  });

  assert.equal(result.ok, true);
  assert.equal(result.actualAspectRatio, "4:5");
});

test("feed portrait verification rejects 9:16 delivery", () => {
  const variant = getFormatVariantById("feed_portrait_4_5");
  const result = verifyImageDimensionsAgainstVariant({
    width: 1080,
    height: 1920,
    variant,
    platforms: ["facebook", "instagram"],
    placement: "feed",
  });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "aspect_ratio_mismatch"));
  assert.ok(result.issues.some((issue) => issue.code === "platform_crop_risk"));
});

test("story verification requires 9:16", () => {
  const variant = getFormatVariantById(getDefaultFormatVariantId("story"));
  const result = verifyImageDimensionsAgainstVariant({
    width: 1080,
    height: 1920,
    variant,
    platforms: ["instagram"],
    placement: "story",
  });

  assert.equal(result.ok, true);
  assert.equal(formatActualAspectRatio(1080, 1920), "9:16");
});

test("wrong feed ratio is labeled clearly", () => {
  assert.equal(formatActualAspectRatio(1080, 1350), "4:5");
  assert.equal(formatActualAspectRatio(1080, 1080), "1:1");
});
