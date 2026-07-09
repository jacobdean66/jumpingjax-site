import assert from "node:assert/strict";
import test from "node:test";

import { SocialPostAdminErrorBoundary } from "../../app/admin/social-posts/SocialPostAdminErrorBoundary";

test("one card error boundary captures only its own render failure", () => {
  const first = SocialPostAdminErrorBoundary.getDerivedStateFromError(
    new Error("card A failed"),
  );
  const second = SocialPostAdminErrorBoundary.getDerivedStateFromError(
    new Error("card B failed"),
  );

  assert.equal(first.error?.message, "card A failed");
  assert.equal(second.error?.message, "card B failed");
  assert.notEqual(first.error, second.error);
});
