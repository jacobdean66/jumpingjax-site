import assert from "node:assert/strict";
import test from "node:test";
import { morningBriefFocusItems } from "./today-focus";

test("shows the morning brief across the production date boundary", () => {
  const items = morningBriefFocusItems("2026-08-27");

  assert.equal(items.length, 2);
  assert.equal(items[0]?.kind, "brief");
  assert.match(items[0]?.detail ?? "", /High urgency/);
  assert.equal(morningBriefFocusItems("2026-08-28").length, 2);
  assert.deepEqual(morningBriefFocusItems("2026-08-29"), []);
});
