import assert from "node:assert/strict";
import test from "node:test";

import {
  appendSocialExecutionAttemptLifecycleEvent,
  appendSocialExecutionAttemptRecord,
  configureSocialExecutionAttemptStoreTestDependencies,
  loadSocialExecutionAttemptSnapshot,
  type SocialExecutionAttemptAuditEventRow,
  type SocialExecutionAttemptStoreStorage,
} from "./social-execution-attempt-store";
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

function createInMemoryAttemptStore(): SocialExecutionAttemptStoreStorage {
  const attempts: SocialExecutionAttemptRecord[] = [];
  const lifecycleEvents: SocialExecutionAttemptLifecycleEventRecord[] = [];
  const auditEvents: SocialExecutionAttemptAuditEventRow[] = [];

  return {
    async loadSnapshot() {
      return {
        attempts: [...attempts],
        lifecycleEvents: [...lifecycleEvents],
        auditEvents: [...auditEvents],
      };
    },
    async insertAttempt(record) {
      attempts.push(record);
      return record;
    },
    async insertLifecycleEvent(record) {
      lifecycleEvents.push(record);
      return record;
    },
    async insertAuditEvent(record) {
      auditEvents.push(record);
      return record;
    },
  };
}

test("append-only attempt store accumulates records without mutation", async () => {
  const storage = createInMemoryAttemptStore();
  configureSocialExecutionAttemptStoreTestDependencies(storage);

  const authorizationId = "exec-auth:test-1";
  const sessionId = "exec-runtime-session:test-1";
  const executionIntentId = "execution-intent-1";
  const publicationTargetId = "target-1";
  const correlationId = "corr:test-1";
  const attemptId = "exec-attempt:test-1";

  await appendSocialExecutionAttemptRecord({
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
  });

  await appendSocialExecutionAttemptLifecycleEvent({
    lifecycleVersion: "d16-w5-v1",
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
  });

  const snapshot = await loadSocialExecutionAttemptSnapshot();
  assert.equal(snapshot.attempts.length, 1);
  assert.equal(snapshot.lifecycleEvents.length, 1);

  configureSocialExecutionAttemptStoreTestDependencies(null);
});
