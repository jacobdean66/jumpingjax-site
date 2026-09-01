import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROUTES = [
  "src/app/api/social-posts/[id]/generate-image/route.ts",
  "src/app/api/social-posts/[id]/generate-image-concepts/route.ts",
];

test("image posts can reach protected image generation routes", async () => {
  for (const route of ROUTES) {
    const source = await readFile(route, "utf8");
    assert.doesNotMatch(source, /media_type\s*!==\s*["']video["']/);
    assert.match(source, /paidGenerationProtectionBlock/);
    assert.match(source, /complianceAllowsPaidGeneration/);
    assert.match(source, /resolveApprovedAssetContext/);
  }
});
