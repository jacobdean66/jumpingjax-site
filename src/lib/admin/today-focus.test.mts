import assert from "node:assert/strict";
import test from "node:test";
import { morningBriefFocusItems } from "./today-focus";

test("shows the Aug 27 morning brief only on its focus date", () => {
  const items = morningBriefFocusItems("2026-08-27");

  assert.equal(items.length, 2);
  assert.equal(items[0]?.kind, "brief");
  assert.match(items[0]?.detail ?? "", /High urgency/);
  assert.deepEqual(morningBriefFocusItems("2026-08-28"), []);
});
