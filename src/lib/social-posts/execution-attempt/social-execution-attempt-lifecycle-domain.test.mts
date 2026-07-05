import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveExecutionAttemptLifecycleState,
  isValidExecutionAttemptLifecycleTransition,
  validateExecutionAttemptLifecycleEventRecord,
  validateExecutionAttemptLifecycleSequence,
  type SocialExecutionAttemptLifecycleEventRecord,
} from "./social-execution-attempt-lifecycle-domain";

function lifecycleEvent(
  overrides: Partial<SocialExecutionAttemptLifecycleEventRecord> = {},
): SocialExecutionAttemptLifecycleEventRecord {
  return {
    lifecycleVersion: "d16-w5-v1",
    lifecycleEventId: "exec-attempt-lifecycle:test-1",
    attemptId: "exec-attempt:test-1",
    correlationId: "corr:test-1",
    lifecycleState: "created",
    createdAt: "2026-07-05T12:00:00.000Z",
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    ...overrides,
  };
}

test("isValidExecutionAttemptLifecycleTransition allows created to prepared", () => {
  assert.equal(isValidExecutionAttemptLifecycleTransition("created", "prepared"), true);
});

test("validateExecutionAttemptLifecycleSequence rejects invalid transition", () => {
  const errors = validateExecutionAttemptLifecycleSequence([
    lifecycleEvent({ lifecycleEventId: "exec-attempt-lifecycle:1", lifecycleState: "created" }),
    lifecycleEvent({
      lifecycleEventId: "exec-attempt-lifecycle:2",
      lifecycleState: "created",
      createdAt: "2026-07-05T13:00:00.000Z",
    }),
  ]);

  assert.ok(errors.some((error) => error.code === "lifecycle_state_transition_invalid"));
});

test("deriveExecutionAttemptLifecycleState returns expired when attempt expires", () => {
  const state = deriveExecutionAttemptLifecycleState({
    lifecycleEvents: [lifecycleEvent()],
    expiresAt: "2026-07-05T11:00:00.000Z",
    derivedAuthorizationState: "valid",
    derivedSessionStatus: "active",
    now: new Date("2026-07-05T12:00:00.000Z"),
  });

  assert.equal(state, "expired");
});

test("validateExecutionAttemptLifecycleEventRecord rejects mutable lifecycle", () => {
  const result = validateExecutionAttemptLifecycleEventRecord({
    ...lifecycleEvent(),
    appendOnly: false as true,
  });

  assert.equal(result.ok, false);
});
