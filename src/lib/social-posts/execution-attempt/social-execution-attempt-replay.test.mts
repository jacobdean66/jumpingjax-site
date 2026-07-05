import assert from "node:assert/strict";
import test from "node:test";

import { SOCIAL_EXECUTION_AUTHORIZATION_VERSION, buildExecutionAuthorizationIdentity, type SocialExecutionAuthorizationRecord } from "../execution-authorization/social-execution-authorization-domain";
import type { SocialExecutionRuntimeSessionRecord } from "../execution-authorization/social-execution-runtime-session-domain";
import { EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT } from "../execution-authorization/social-execution-authorization-store";
import {
  buildExecutionAttemptIdentity,
  SOCIAL_EXECUTION_ATTEMPT_VERSION,
  type SocialExecutionAttemptRecord,
} from "./social-execution-attempt-domain";
import {
  buildExecutionAttemptFingerprint,
  buildExecutionAttemptIdempotencyKey,
  buildExecutionAttemptReplayKey,
} from "./social-execution-attempt-idempotency-domain";
import type { SocialExecutionAttemptLifecycleEventRecord } from "./social-execution-attempt-lifecycle-domain";
import {
  replaySocialExecutionAttempt,
  replaySocialExecutionAttemptByCorrelationId,
} from "./social-execution-attempt-replay";
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

function sampleAttempt(): SocialExecutionAttemptRecord {
  const authorizationId = "exec-auth:test-1";
  const sessionId = "exec-runtime-session:test-1";
  const executionIntentId = "execution-intent-1";
  const publicationTargetId = "target-1";
  const correlationId = "corr:test-1";
  const attemptId = "exec-attempt:test-1";

  return {
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
  };
}

function buildSnapshot(): SocialExecutionAttemptPersistenceSnapshot {
  const attempt = sampleAttempt();
  const lifecycle: SocialExecutionAttemptLifecycleEventRecord = {
    lifecycleVersion: SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
    lifecycleEventId: "exec-attempt-lifecycle:test-1",
    attemptId: attempt.attemptId,
    correlationId: attempt.correlationId,
    lifecycleState: "created",
    createdAt: "2026-07-05T12:00:00.000Z",
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };

  return {
    attempts: [attempt],
    lifecycleEvents: [lifecycle],
    auditEvents: [],
  };
}

test("replaySocialExecutionAttempt returns deterministic read model", async () => {
  const snapshot = buildSnapshot();
  const authorizationSnapshot = {
    ...EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT,
    authorizations: [sampleAuthorization()],
    sessions: [sampleSession()],
  };

  const replay = await replaySocialExecutionAttempt({
    attemptSnapshot: snapshot,
    authorizationSnapshot,
    now: new Date("2026-07-05T13:00:00.000Z"),
  });

  assert.equal(replay.summary.attemptCount, 1);
  assert.equal(replay.attempts[0]?.derivedLifecycleState, "created");
  assert.equal(replay.attempts[0]?.derivedAwarenessStatus, "attempt_exists");

  const correlationReplay = replaySocialExecutionAttemptByCorrelationId(
    "corr:test-1",
    snapshot,
    authorizationSnapshot,
    new Date("2026-07-05T13:00:00.000Z"),
  );
  assert.equal(correlationReplay.attempts.length, 1);
});

test("replaySocialExecutionAttempt detects duplicate idempotency keys", async () => {
  const attempt = sampleAttempt();
  const duplicate: SocialExecutionAttemptRecord = {
    ...attempt,
    attemptId: "exec-attempt:test-2",
    attemptIdentity: buildExecutionAttemptIdentity({
      executionIntentId: attempt.executionIntentId,
      publicationTargetId: attempt.publicationTargetId,
      authorizationId: "exec-auth:test-2",
    }),
    authorizationId: "exec-auth:test-2",
    replayKey: buildExecutionAttemptReplayKey({
      attemptId: "exec-attempt:test-2",
      correlationId: attempt.correlationId,
    }),
  };

  const replay = await replaySocialExecutionAttempt({
    attemptSnapshot: {
      attempts: [attempt, duplicate],
      lifecycleEvents: [],
      auditEvents: [],
    },
  });

  assert.equal(replay.summary.duplicateDetected, true);
});
