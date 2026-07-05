import assert from "node:assert/strict";
import test from "node:test";

import { SOCIAL_EXECUTION_AUTHORIZATION_VERSION, buildExecutionAuthorizationIdentity, type SocialExecutionAuthorizationRecord } from "../execution-authorization/social-execution-authorization-domain";
import type { SocialExecutionRuntimeSessionRecord } from "../execution-authorization/social-execution-runtime-session-domain";
import { EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT } from "../execution-authorization/social-execution-authorization-store";
import {
  SOCIAL_EXECUTION_ATTEMPT_VERSION,
  buildExecutionAttemptIdentity,
  validateExecutionAttemptRecord,
  type SocialExecutionAttemptRecord,
} from "./social-execution-attempt-domain";
import {
  buildExecutionAttemptFingerprint,
  buildExecutionAttemptIdempotencyKey,
  buildExecutionAttemptReplayKey,
} from "./social-execution-attempt-idempotency-domain";

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

function sampleAttempt(overrides: Partial<SocialExecutionAttemptRecord> = {}): SocialExecutionAttemptRecord {
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
    ...overrides,
  };
}

test("validateExecutionAttemptRecord rejects missing authorization reference", () => {
  const attempt = sampleAttempt();
  const result = validateExecutionAttemptRecord(attempt, {
    authorizationSnapshot: EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT,
  });

  assert.equal(result.ok, false);
  assert.ok(result.ok === false && result.errors.some((error) => error.code === "authorization_missing"));
});

test("validateExecutionAttemptRecord rejects duplicate attempt identities", () => {
  const attempt = sampleAttempt();
  const snapshot = {
    ...EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT,
    authorizations: [sampleAuthorization()],
    sessions: [sampleSession()],
  };

  const result = validateExecutionAttemptRecord(attempt, {
    existingAttemptIdentities: new Set([attempt.attemptIdentity]),
    authorizationSnapshot: snapshot,
  });

  assert.equal(result.ok, false);
  assert.ok(result.ok === false && result.errors.some((error) => error.code === "attempt_identity_duplicate"));
});

test("validateExecutionAttemptRecord accepts valid attempt with authorization and session", () => {
  const attempt = sampleAttempt();
  const snapshot = {
    ...EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT,
    authorizations: [sampleAuthorization()],
    sessions: [sampleSession()],
  };

  const result = validateExecutionAttemptRecord(attempt, { authorizationSnapshot: snapshot });
  assert.equal(result.ok, true);
});
