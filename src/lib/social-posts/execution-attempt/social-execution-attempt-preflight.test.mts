import assert from "node:assert/strict";
import test from "node:test";

import { SOCIAL_EXECUTION_AUTHORIZATION_VERSION, buildExecutionAuthorizationIdentity, type SocialExecutionAuthorizationRecord } from "../execution-authorization/social-execution-authorization-domain";
import type { SocialExecutionRuntimeSessionRecord } from "../execution-authorization/social-execution-runtime-session-domain";
import { EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT } from "../execution-authorization/social-execution-authorization-store";
import {
  buildExecutionAttemptIdentity,
  SOCIAL_EXECUTION_ATTEMPT_VERSION,
} from "./social-execution-attempt-domain";
import {
  buildExecutionAttemptFingerprint,
  buildExecutionAttemptIdempotencyKey,
  buildExecutionAttemptReplayKey,
} from "./social-execution-attempt-idempotency-domain";
import { evaluateExecutionAttemptPreflightForIntent } from "./social-execution-attempt-preflight";
import type { SocialExecutionAttemptPersistenceSnapshot } from "./social-execution-attempt-store";

function sampleAuthorization(): SocialExecutionAuthorizationRecord {
  const identity = buildExecutionAuthorizationIdentity({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
  });

  return {
    authorizationVersion: SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
    authorizationId: "exec-auth:test-1",
    authorizationIdentity: identity,
    scope: {
      scopeKind: "publication_target_execution",
      executionIntentId: "execution-intent-1",
      publicationTargetId: "target-1",
      ownerApprovalId: "owner-approval-1",
      approvalId: null,
      socialPostId: null,
    },
    authorizationState: "authorized",
    correlationId: "corr:test-1",
    authorizedAt: "2026-07-05T12:00:00.000Z",
    expiresAt: "2026-07-06T12:00:00.000Z",
    ownerApprovalId: "owner-approval-1",
    publicationTargetId: "target-1",
    executionIntentId: "execution-intent-1",
    adminActorId: "owner-1",
    createdAt: "2026-07-05T12:00:00.000Z",
    appendOnly: true,
    immutable: true,
    containsSecrets: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    authorizesFutureExecutionOnly: true,
  };
}

function sampleSession(): SocialExecutionRuntimeSessionRecord {
  return {
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
  };
}

function sampleAttemptSnapshot(): SocialExecutionAttemptPersistenceSnapshot {
  const authorizationId = "exec-auth:test-1";
  const sessionId = "exec-runtime-session:test-1";
  const executionIntentId = "execution-intent-1";
  const publicationTargetId = "target-1";
  const correlationId = "corr:test-1";
  const attemptId = "exec-attempt:test-1";

  return {
    attempts: [
      {
        attemptVersion: SOCIAL_EXECUTION_ATTEMPT_VERSION,
        attemptId,
        attemptIdentity: buildExecutionAttemptIdentity({
          executionIntentId,
          publicationTargetId,
          authorizationId,
        }),
        authorizationId,
        sessionId,
        publicationTargetId,
        executionIntentId,
        correlationId,
        idempotencyKey: buildExecutionAttemptIdempotencyKey({
          executionIntentId,
          publicationTargetId,
          authorizationId,
        }),
        replayKey: buildExecutionAttemptReplayKey({ attemptId, correlationId }),
        attemptFingerprint: buildExecutionAttemptFingerprint({
          executionIntentId,
          publicationTargetId,
          authorizationId,
          sessionId,
          correlationId,
        }),
        createdAt: "2026-07-05T12:00:00.000Z",
        expiresAt: "2026-07-06T12:00:00.000Z",
        appendOnly: true,
        immutable: true,
        metadataOnly: true,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
        subordinateToAuthorization: true,
      },
    ],
    lifecycleEvents: [
      {
        lifecycleVersion: SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
        lifecycleEventId: "exec-attempt-lifecycle:test-1",
        attemptId,
        correlationId,
        lifecycleState: "created",
        createdAt: "2026-07-05T12:00:00.000Z",
        appendOnly: true,
        immutable: true,
        metadataOnly: true,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
    ],
    auditEvents: [],
  };
}

test("evaluateExecutionAttemptPreflightForIntent returns no_attempt when snapshot empty", () => {
  const summary = evaluateExecutionAttemptPreflightForIntent({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    attemptSnapshot: { attempts: [], lifecycleEvents: [], auditEvents: [] },
    authorizationSnapshot: {
      ...EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT,
      authorizations: [sampleAuthorization()],
      sessions: [sampleSession()],
    },
  });

  assert.ok(summary);
  assert.equal(summary?.derivedAwarenessStatus, "no_attempt");
  assert.equal(summary?.informationalOnly, true);
});

test("evaluateExecutionAttemptPreflightForIntent returns attempt_exists when attempt present", () => {
  const summary = evaluateExecutionAttemptPreflightForIntent({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    attemptSnapshot: sampleAttemptSnapshot(),
    authorizationSnapshot: {
      ...EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT,
      authorizations: [sampleAuthorization()],
      sessions: [sampleSession()],
    },
    now: new Date("2026-07-05T13:00:00.000Z"),
  });

  assert.ok(summary);
  assert.equal(summary?.derivedAwarenessStatus, "attempt_exists");
  assert.equal(summary?.attemptCount, 1);
});

test("evaluateExecutionAttemptPreflightForIntent returns attempt_expired when attempt expired", () => {
  const summary = evaluateExecutionAttemptPreflightForIntent({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    attemptSnapshot: sampleAttemptSnapshot(),
    authorizationSnapshot: {
      ...EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT,
      authorizations: [sampleAuthorization()],
      sessions: [sampleSession()],
    },
    now: new Date("2026-07-07T00:00:00.000Z"),
  });

  assert.ok(summary);
  assert.equal(summary?.derivedAwarenessStatus, "attempt_expired");
});
