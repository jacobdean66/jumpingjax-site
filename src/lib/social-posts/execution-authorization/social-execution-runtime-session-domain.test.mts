import assert from "node:assert/strict";
import test from "node:test";

import { deriveExecutionRuntimeSessionStatus, validateExecutionRuntimeSessionRecord } from "./social-execution-runtime-session-domain";
import { SOCIAL_EXECUTION_AUTHORIZATION_VERSION } from "./social-execution-authorization-domain";

test("validateExecutionRuntimeSessionRecord requires metadata-only append-only session", () => {
  const result = validateExecutionRuntimeSessionRecord({
    sessionVersion: SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
    sessionId: "exec-runtime-session:test-1",
    authorizationId: "exec-auth:test-1",
    correlationId: "corr:test-1",
    runtimeStatus: "active",
    createdAt: "2026-07-05T12:00:00.000Z",
    expiresAt: "2026-07-06T12:00:00.000Z",
    publicationTargetId: "target-1",
    executionIntentId: "execution-intent-1",
    metadataOnly: true,
    appendOnly: true,
    immutable: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    backgroundWorkersForbidden: true,
  });

  assert.equal(result.ok, true);
});

test("deriveExecutionRuntimeSessionStatus returns expired for expired authorization", () => {
  const session = {
    sessionVersion: SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
    sessionId: "exec-runtime-session:test-1",
    authorizationId: "exec-auth:test-1",
    correlationId: "corr:test-1",
    runtimeStatus: "active" as const,
    createdAt: "2026-07-05T12:00:00.000Z",
    expiresAt: "2026-07-06T12:00:00.000Z",
    publicationTargetId: "target-1",
    executionIntentId: "execution-intent-1",
    metadataOnly: true as const,
    appendOnly: true as const,
    immutable: true as const,
    grantsExecutionPermission: false as const,
    executesNothing: true as const,
    publishesNothing: true as const,
    backgroundWorkersForbidden: true as const,
  };

  assert.equal(
    deriveExecutionRuntimeSessionStatus({
      session,
      derivedAuthorizationState: "expired",
      now: new Date("2026-07-07T12:00:00.000Z"),
    }),
    "expired",
  );
});
