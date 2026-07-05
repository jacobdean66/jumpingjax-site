import assert from "node:assert/strict";
import test from "node:test";

import { SOCIAL_EXECUTION_AUTHORIZATION_VERSION, buildExecutionAuthorizationIdentity, type SocialExecutionAuthorizationRecord } from "../execution-authorization/social-execution-authorization-domain";
import type { SocialExecutionRuntimeSessionRecord } from "../execution-authorization/social-execution-runtime-session-domain";
import { SOCIAL_EXECUTION_ATTEMPT_VERSION, type SocialExecutionAttemptRecord } from "./social-execution-attempt-domain";
import type { SocialExecutionAttemptLifecycleEventRecord } from "./social-execution-attempt-lifecycle-domain";
import { SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_VERSION } from "./social-execution-attempt-lifecycle-domain";
import { evaluateExecutionAttemptEvidenceAppendPreflightForAttempt } from "./social-execution-attempt-evidence-append-preflight";

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
  return {
    attemptVersion: SOCIAL_EXECUTION_ATTEMPT_VERSION,
    attemptId: "exec-attempt:test-1",
    attemptIdentity: "exec-attempt-identity:test-1",
    authorizationId: "exec-auth:test-1",
    sessionId: "exec-runtime-session:test-1",
    publicationTargetId: "target-1",
    executionIntentId: "execution-intent-1",
    correlationId: "corr:test-1",
    idempotencyKey: "idempotency:test-1",
    replayKey: "replay:test-1",
    attemptFingerprint: "fingerprint:test-1",
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

function sampleLifecycle(): SocialExecutionAttemptLifecycleEventRecord {
  return {
    lifecycleVersion: SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_VERSION,
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
  };
}

test("evaluateExecutionAttemptEvidenceAppendPreflightForAttempt reports append availability", () => {
  const preflight = evaluateExecutionAttemptEvidenceAppendPreflightForAttempt({
    attemptId: "exec-attempt:test-1",
    ownerApprovalId: "owner-approval-1",
    attemptSnapshot: {
      attempts: [sampleAttempt()],
      lifecycleEvents: [sampleLifecycle()],
      auditEvents: [],
    },
    authorizationSnapshot: {
      authorizations: [sampleAuthorization()],
      cancellations: [],
      intents: [],
      sessions: [sampleSession()],
      auditEvents: [],
    },
    now: new Date("2026-07-05T13:00:00.000Z"),
  });

  assert.ok(preflight);
  assert.equal(preflight?.evidenceAppendAvailable, true);
  assert.equal(preflight?.informationalOnly, true);
});

test("evaluateExecutionAttemptEvidenceAppendPreflightForAttempt blocks owner approval mismatch", () => {
  const preflight = evaluateExecutionAttemptEvidenceAppendPreflightForAttempt({
    attemptId: "exec-attempt:test-1",
    ownerApprovalId: "owner-approval-other",
    attemptSnapshot: {
      attempts: [sampleAttempt()],
      lifecycleEvents: [sampleLifecycle()],
      auditEvents: [],
    },
    authorizationSnapshot: {
      authorizations: [sampleAuthorization()],
      cancellations: [],
      intents: [],
      sessions: [sampleSession()],
      auditEvents: [],
    },
    now: new Date("2026-07-05T13:00:00.000Z"),
  });

  assert.ok(preflight);
  assert.equal(preflight?.evidenceAppendAvailable, false);
  assert.equal(preflight?.ownerApprovalUnavailable, true);
});
