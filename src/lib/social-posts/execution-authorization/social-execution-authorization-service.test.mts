import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizeExecutionForOwner,
  cancelExecutionAuthorizationForOwner,
  configureSocialExecutionAuthorizationServiceTestDependencies,
  createExecutionAuthorizationId,
} from "./social-execution-authorization-service";
import {
  configureSocialExecutionAuthorizationStoreTestDependencies,
  type SocialExecutionAuthorizationAuditEventRow,
  type SocialExecutionAuthorizationStoreStorage,
} from "./social-execution-authorization-store";
import {
  SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
  buildExecutionAuthorizationIdentity,
  type SocialExecutionAuthorizationCancellationRecord,
  type SocialExecutionAuthorizationRecord,
} from "./social-execution-authorization-domain";
import type { SocialExecutionAuthorizationIntentRecord } from "./social-execution-authorization-intent-domain";
import type { SocialExecutionRuntimeSessionRecord } from "./social-execution-runtime-session-domain";
import { replaySocialExecutionAuthorization } from "./social-execution-authorization-replay";

function createMemoryStore(): SocialExecutionAuthorizationStoreStorage {
  const authorizations: SocialExecutionAuthorizationRecord[] = [];
  const cancellations: SocialExecutionAuthorizationCancellationRecord[] = [];
  const intents: SocialExecutionAuthorizationIntentRecord[] = [];
  const sessions: SocialExecutionRuntimeSessionRecord[] = [];
  const auditEvents: SocialExecutionAuthorizationAuditEventRow[] = [];

  return {
    async loadSnapshot() {
      return { authorizations, cancellations, intents, sessions, auditEvents };
    },
    async insertAuthorization(record) {
      authorizations.push(record);
      return record;
    },
    async insertCancellation(record) {
      cancellations.push(record);
      return record;
    },
    async insertIntent(record) {
      intents.push(record);
      return record;
    },
    async insertSession(record) {
      sessions.push(record);
      return record;
    },
    async insertAuditEvent(record) {
      auditEvents.push(record);
      return record;
    },
  };
}

test("authorizeExecutionForOwner appends authorization, session, intents, and audit", async () => {
  const store = createMemoryStore();
  configureSocialExecutionAuthorizationStoreTestDependencies(store);
  configureSocialExecutionAuthorizationServiceTestDependencies({
    verifyOwnerApprovalForAuthorization: async () => ({ ok: true }),
  });

  const result = await authorizeExecutionForOwner({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    ownerApprovalId: "owner-approval-1",
    adminActorId: "owner-admin-1",
    now: new Date("2026-07-05T12:00:00.000Z"),
  });

  assert.equal(result.ok, true);
  const snapshot = await store.loadSnapshot();
  assert.equal(snapshot.authorizations.length, 1);
  assert.equal(snapshot.sessions.length, 1);
  assert.equal(snapshot.intents.length, 2);
  assert.ok(snapshot.auditEvents.some((event) => event.action === "authorize" && event.outcome === "success"));

  configureSocialExecutionAuthorizationStoreTestDependencies(null);
  configureSocialExecutionAuthorizationServiceTestDependencies(null);
});

test("authorizeExecutionForOwner blocks unapproved owner approval references", async () => {
  const store = createMemoryStore();
  configureSocialExecutionAuthorizationStoreTestDependencies(store);
  configureSocialExecutionAuthorizationServiceTestDependencies({
    verifyOwnerApprovalForAuthorization: async () => ({
      ok: false,
      code: "owner_approval_not_approved",
      message: "Owner approval must be in approved state before execution authorization.",
    }),
  });

  const result = await authorizeExecutionForOwner({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    ownerApprovalId: "owner-approval-1",
    adminActorId: "owner-admin-1",
    now: new Date("2026-07-05T12:00:00.000Z"),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "owner_approval_not_approved");
  }
  const snapshot = await store.loadSnapshot();
  assert.equal(snapshot.authorizations.length, 0);
  assert.ok(
    snapshot.auditEvents.some(
      (event) =>
        event.action === "authorize_validation_failed" &&
        event.outcome === "owner_approval_verification_failed",
    ),
  );

  configureSocialExecutionAuthorizationStoreTestDependencies(null);
  configureSocialExecutionAuthorizationServiceTestDependencies(null);
});

test("cancelExecutionAuthorizationForOwner appends cancellation without deleting authorization", async () => {
  const store = createMemoryStore();
  configureSocialExecutionAuthorizationStoreTestDependencies(store);

  const authorizationId = createExecutionAuthorizationId();
  const identity = buildExecutionAuthorizationIdentity({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
  });

  await store.insertAuthorization({
    authorizationVersion: SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
    authorizationId,
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
    adminActorId: "owner-admin-1",
    createdAt: "2026-07-05T12:00:00.000Z",
    appendOnly: true,
    immutable: true,
    containsSecrets: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    authorizesFutureExecutionOnly: true,
  });

  const cancellation = await cancelExecutionAuthorizationForOwner({
    authorizationId,
    adminActorId: "owner-admin-1",
    now: new Date("2026-07-05T13:00:00.000Z"),
  });

  assert.equal(cancellation.ok, true);
  const snapshot = await store.loadSnapshot();
  assert.equal(snapshot.authorizations.length, 1);
  assert.equal(snapshot.cancellations.length, 1);

  const replay = await replaySocialExecutionAuthorization(snapshot, new Date("2026-07-05T14:00:00.000Z"));
  assert.equal(replay.cancelledAuthorizations.length, 1);

  configureSocialExecutionAuthorizationStoreTestDependencies(null);
});
