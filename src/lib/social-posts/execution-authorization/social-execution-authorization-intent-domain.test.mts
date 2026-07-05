import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidExecutionAuthorizationIntentTransition,
  validateExecutionAuthorizationIntentRecord,
} from "./social-execution-authorization-intent-domain";
import { SOCIAL_EXECUTION_AUTHORIZATION_VERSION } from "./social-execution-authorization-domain";

test("validateExecutionAuthorizationIntentRecord rejects authorized intent without authorization id", () => {
  const result = validateExecutionAuthorizationIntentRecord({
    intentVersion: SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
    intentRecordId: "exec-auth-intent:test-1",
    executionIntentId: "execution-intent-1",
    authorizationId: null,
    correlationId: "corr:test-1",
    intentState: "authorized_execution",
    publicationTargetId: "target-1",
    ownerApprovalId: "owner-approval-1",
    createdAt: "2026-07-05T12:00:00.000Z",
    appendOnly: true,
    immutable: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });

  assert.equal(result.ok, false);
});

test("isValidExecutionAuthorizationIntentTransition allows requested to authorized", () => {
  assert.equal(
    isValidExecutionAuthorizationIntentTransition("requested_execution", "authorized_execution"),
    true,
  );
});

test("isValidExecutionAuthorizationIntentTransition rejects cancelled to authorized", () => {
  assert.equal(
    isValidExecutionAuthorizationIntentTransition("cancelled_execution", "authorized_execution"),
    false,
  );
});
