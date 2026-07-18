import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRandomWorkflowSelection,
  createSeededRng,
  isValidRandomWorkflowSelection,
  listValidRandomAssets,
  RANDOM_WORKFLOW_OPTIONS,
} from "./random-workflow-test.ts";

describe("random AI workflow test", () => {
  it("produces deterministic valid selections from a seed", () => {
    const a = buildRandomWorkflowSelection(createSeededRng(42));
    const b = buildRandomWorkflowSelection(createSeededRng(42));
    assert.deepEqual(a, b);
    assert.equal(isValidRandomWorkflowSelection(a), true);
  });

  it("only uses valid inventory assets and supported option values", () => {
    const assets = new Set(listValidRandomAssets().map((asset) => asset.slug));
    assert.ok(assets.size > 0);
    for (let seed = 1; seed <= 25; seed += 1) {
      const selection = buildRandomWorkflowSelection(createSeededRng(seed));
      assert.ok(assets.has(selection.assetSlug));
      assert.ok(RANDOM_WORKFLOW_OPTIONS.audiences.includes(selection.audience));
      assert.ok(RANDOM_WORKFLOW_OPTIONS.copyStyles.includes(selection.copyStyle));
      assert.ok(RANDOM_WORKFLOW_OPTIONS.platforms.includes(selection.platform));
      assert.ok(RANDOM_WORKFLOW_OPTIONS.postTypes.includes(selection.postType));
      assert.equal(isValidRandomWorkflowSelection(selection), true);
    }
  });

  it("rejects invalid combinations", () => {
    const valid = buildRandomWorkflowSelection(createSeededRng(7));
    assert.equal(
      isValidRandomWorkflowSelection({
        ...valid,
        assetSlug: "not-a-real-slug",
      }),
      false,
    );
    assert.equal(
      isValidRandomWorkflowSelection({
        ...valid,
        campaignId: "not-a-campaign",
      }),
      false,
    );
    assert.equal(
      isValidRandomWorkflowSelection({
        ...valid,
        audience: "Aliens from Mars",
      }),
      false,
    );
  });
});
