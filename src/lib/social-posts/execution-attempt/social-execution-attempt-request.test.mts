import assert from "node:assert/strict";
import test from "node:test";

import { validateExecutionAttemptRequest } from "./social-execution-attempt-request";

test("validateExecutionAttemptRequest rejects missing authorization_id", () => {
  const result = validateExecutionAttemptRequest({
    authorizationId: "",
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
  });

  assert.equal(result.ok, false);
  assert.ok(result.ok === false && result.code === "authorization_id_required");
});

test("validateExecutionAttemptRequest accepts valid request", () => {
  const result = validateExecutionAttemptRequest({
    authorizationId: "exec-auth:test-1",
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
  });

  assert.equal(result.ok, true);
});
