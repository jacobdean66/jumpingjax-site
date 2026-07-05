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
  SOCIAL_EXECUTION_ATTEMPT_VERSION,
  type SocialExecutionAttemptRecord,
} from "./social-execution-attempt-domain";
import type { SocialExecutionAttemptLifecycleEventRecord } from "./social-execution-attempt-lifecycle-domain";
import { SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_VERSION } from "./social-execution-attempt-lifecycle-domain";
import {
  configureSocialExecutionAttemptEvidenceStoreTestDependencies,
  type SocialExecutionAttemptEvidenceStoreStorage,
} from "./social-execution-attempt-evidence-store";
import type { SocialExecutionAttemptEvidenceRecord } from "./social-execution-attempt-evidence-domain";
import type { SocialExecutionAttemptStateTransitionRecord } from "./social-execution-attempt-state-transition-domain";
import {
  appendExecutionAttemptEvidenceForOwner,
  configureSocialExecutionAttemptEvidenceAppendServiceTestDependencies,
} from "./social-execution-attempt-evidence-service";
import {
  configureSocialExecutionAttemptStoreTestDependencies,
  type SocialExecutionAttemptAuditEventRow,
  type SocialExecutionAttemptStoreStorage,
} from "./social-execution-attempt-store";
import { replaySocialExecutionAttemptEvidenceAppend } from "./social-execution-attempt-evidence-append-replay";

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

function createStores() {
  const attempts: SocialExecutionAttemptRecord[] = [sampleAttempt()];
  const lifecycleEvents: SocialExecutionAttemptLifecycleEventRecord[] = [sampleLifecycle()];
  const auditEvents: SocialExecutionAttemptAuditEventRow[] = [];

  const attemptStore: SocialExecutionAttemptStoreStorage = {
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

  const authorizationStore: SocialExecutionAuthorizationStoreStorage = {
    async loadSnapshot() {
      return {
        authorizations: [sampleAuthorization()],
        cancellations: [],
        intents: [],
        sessions: [sampleSession()],
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

  const storedEvidence: SocialExecutionAttemptEvidenceRecord[] = [];
  const storedTransitions: SocialExecutionAttemptStateTransitionRecord[] = [];

  const evidenceStore: SocialExecutionAttemptEvidenceStoreStorage = {
    async loadSnapshot() {
      return { evidenceRecords: storedEvidence, stateTransitions: storedTransitions };
    },
    async insertEvidenceRecord(record) {
      storedEvidence.push(record);
      return record;
    },
    async insertStateTransition(record) {
      storedTransitions.push(record);
      return record;
    },
  };

  return { attemptStore, authorizationStore, evidenceStore, auditEvents };
}

test("appendExecutionAttemptEvidenceForOwner appends evidence and audit event", async () => {
  const stores = createStores();
  configureSocialExecutionAttemptStoreTestDependencies(stores.attemptStore);
  configureSocialExecutionAuthorizationStoreTestDependencies(stores.authorizationStore);
  configureSocialExecutionAttemptEvidenceStoreTestDependencies(stores.evidenceStore);
  configureSocialExecutionAttemptEvidenceAppendServiceTestDependencies({
    verifyOwnerApproval: async () => ({ ok: true }),
  });

  const result = await appendExecutionAttemptEvidenceForOwner({
    attemptId: "exec-attempt:test-1",
    ownerApprovalId: "owner-approval-1",
    evidenceKind: "operator_note",
    sanitizedSummary: "Owner appended metadata-only evidence.",
    adminActorId: "owner-1",
    now: new Date("2026-07-05T13:00:00.000Z"),
  });

  assert.equal(result.ok, true);
  assert.equal(stores.auditEvents.some((event) => event.action === "append_evidence"), true);

  const replay = await replaySocialExecutionAttemptEvidenceAppend({
    attemptSnapshot: await stores.attemptStore.loadSnapshot(),
    evidenceSnapshot: await stores.evidenceStore.loadSnapshot(),
  });
  assert.equal(replay.summary.successfulAppendCount, 1);
});

test("appendExecutionAttemptEvidenceForOwner blocks unapproved owner approval references", async () => {
  const stores = createStores();
  configureSocialExecutionAttemptStoreTestDependencies(stores.attemptStore);
  configureSocialExecutionAuthorizationStoreTestDependencies(stores.authorizationStore);
  configureSocialExecutionAttemptEvidenceStoreTestDependencies(stores.evidenceStore);
  configureSocialExecutionAttemptEvidenceAppendServiceTestDependencies({
    verifyOwnerApproval: async () => ({
      ok: false,
      code: "owner_approval_not_approved",
      message: "Owner approval must be in approved state before evidence append.",
    }),
  });

  const result = await appendExecutionAttemptEvidenceForOwner({
    attemptId: "exec-attempt:test-1",
    ownerApprovalId: "owner-approval-1",
    evidenceKind: "operator_note",
    sanitizedSummary: "Should fail.",
    adminActorId: "owner-1",
    now: new Date("2026-07-05T13:00:00.000Z"),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "owner_approval_not_approved");
  }
});
