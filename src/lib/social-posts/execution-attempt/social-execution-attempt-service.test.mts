import assert from "node:assert/strict";
import test from "node:test";

import {
  SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
  buildExecutionAuthorizationIdentity,
  type SocialExecutionAuthorizationRecord,
} from "../execution-authorization/social-execution-authorization-domain";
import {
  configureSocialExecutionAuthorizationStoreTestDependencies,
  type SocialExecutionAuthorizationStoreStorage,
} from "../execution-authorization/social-execution-authorization-store";
import type { SocialExecutionRuntimeSessionRecord } from "../execution-authorization/social-execution-runtime-session-domain";
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
import { replaySocialExecutionAttemptCreation } from "./social-execution-attempt-creation-replay";
import type { SocialExecutionAttemptLifecycleEventRecord } from "./social-execution-attempt-lifecycle-domain";
import {
  configureSocialExecutionAttemptStoreTestDependencies,
  type SocialExecutionAttemptAuditEventRow,
  type SocialExecutionAttemptStoreStorage,
} from "./social-execution-attempt-store";
import { createExecutionAttemptForOwner } from "./social-execution-attempt-service";

function createAuthorizationStore(authorization: SocialExecutionAuthorizationRecord, session: SocialExecutionRuntimeSessionRecord): SocialExecutionAuthorizationStoreStorage {
  return {
    async loadSnapshot() {
      return {
        authorizations: [authorization],
        cancellations: [],
        intents: [],
        sessions: [session],
        auditEvents: [],
      };
    },
    async insertAuthorization(record) {
      return record;
    },
    async insertCancellation(record) {
      return record;
    },
    async insertIntent(record) {
      return record;
    },
    async insertSession(record) {
      return record;
    },
    async insertAuditEvent(record) {
      return record;
    },
  };
}

function createAttemptStore(): SocialExecutionAttemptStoreStorage {
  const attempts: SocialExecutionAttemptRecord[] = [];
  const lifecycleEvents: SocialExecutionAttemptLifecycleEventRecord[] = [];
  const auditEvents: SocialExecutionAttemptAuditEventRow[] = [];

  return {
    async loadSnapshot() {
      return { attempts, lifecycleEvents, auditEvents };
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

test("createExecutionAttemptForOwner appends attempt, lifecycle, and audit", async () => {
  const authorization = sampleAuthorization();
  const session = sampleSession();
  const attemptStore = createAttemptStore();

  configureSocialExecutionAuthorizationStoreTestDependencies(
    createAuthorizationStore(authorization, session),
  );
  configureSocialExecutionAttemptStoreTestDependencies(attemptStore);

  const result = await createExecutionAttemptForOwner({
    authorizationId: "exec-auth:test-1",
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    adminActorId: "owner-1",
    now: new Date("2026-07-05T13:00:00.000Z"),
  });

  assert.equal(result.ok, true);
  const snapshot = await attemptStore.loadSnapshot();
  assert.equal(snapshot.attempts.length, 1);
  assert.equal(snapshot.lifecycleEvents.length, 1);
  assert.equal(snapshot.lifecycleEvents[0]?.lifecycleState, "created");
  assert.ok(snapshot.auditEvents.some((event) => event.action === "create_attempt" && event.outcome === "success"));

  configureSocialExecutionAuthorizationStoreTestDependencies(null);
  configureSocialExecutionAttemptStoreTestDependencies(null);
});

test("createExecutionAttemptForOwner rejects duplicate attempt", async () => {
  const authorization = sampleAuthorization();
  const session = sampleSession();
  const attemptStore = createAttemptStore();
  const attemptIdentity = buildExecutionAttemptIdentity({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    authorizationId: "exec-auth:test-1",
  });

  await attemptStore.insertAttempt({
    attemptVersion: SOCIAL_EXECUTION_ATTEMPT_VERSION,
    attemptId: "exec-attempt:existing",
    attemptIdentity,
    authorizationId: "exec-auth:test-1",
    sessionId: "exec-runtime-session:test-1",
    publicationTargetId: "target-1",
    executionIntentId: "execution-intent-1",
    correlationId: "corr:test-1",
    idempotencyKey: buildExecutionAttemptIdempotencyKey({
      executionIntentId: "execution-intent-1",
      publicationTargetId: "target-1",
      authorizationId: "exec-auth:test-1",
    }),
    replayKey: buildExecutionAttemptReplayKey({
      attemptId: "exec-attempt:existing",
      correlationId: "corr:test-1",
    }),
    attemptFingerprint: buildExecutionAttemptFingerprint({
      executionIntentId: "execution-intent-1",
      publicationTargetId: "target-1",
      authorizationId: "exec-auth:test-1",
      sessionId: "exec-runtime-session:test-1",
      correlationId: "corr:test-1",
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

  configureSocialExecutionAuthorizationStoreTestDependencies(
    createAuthorizationStore(authorization, session),
  );
  configureSocialExecutionAttemptStoreTestDependencies(attemptStore);

  const result = await createExecutionAttemptForOwner({
    authorizationId: "exec-auth:test-1",
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    adminActorId: "owner-1",
    now: new Date("2026-07-05T13:00:00.000Z"),
  });

  assert.equal(result.ok, false);
  assert.ok(result.ok === false && result.code === "duplicate_attempt");

  configureSocialExecutionAuthorizationStoreTestDependencies(null);
  configureSocialExecutionAttemptStoreTestDependencies(null);
});

test("replaySocialExecutionAttemptCreation exposes created attempts and audit", async () => {
  const authorization = sampleAuthorization();
  const session = sampleSession();
  const attemptStore = createAttemptStore();

  configureSocialExecutionAuthorizationStoreTestDependencies(
    createAuthorizationStore(authorization, session),
  );
  configureSocialExecutionAttemptStoreTestDependencies(attemptStore);

  await createExecutionAttemptForOwner({
    authorizationId: "exec-auth:test-1",
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    adminActorId: "owner-1",
    now: new Date("2026-07-05T13:00:00.000Z"),
  });

  const snapshot = await attemptStore.loadSnapshot();
  const replay = await replaySocialExecutionAttemptCreation({
    attemptSnapshot: snapshot,
    authorizationSnapshot: await createAuthorizationStore(authorization, session).loadSnapshot(),
    now: new Date("2026-07-05T13:00:00.000Z"),
  });

  assert.equal(replay.summary.createdAttemptCount, 1);
  assert.equal(replay.summary.successfulCreationCount, 1);
  assert.equal(replay.createdAttempts[0]?.authorizationId, "exec-auth:test-1");

  configureSocialExecutionAuthorizationStoreTestDependencies(null);
  configureSocialExecutionAttemptStoreTestDependencies(null);
});
