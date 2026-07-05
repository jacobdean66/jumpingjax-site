import assert from "node:assert/strict";
import test from "node:test";

import {
  configureSocialExecutionAttemptEvidenceStoreTestDependencies,
  appendSocialExecutionAttemptEvidenceRecord,
  appendSocialExecutionAttemptStateTransition,
  loadSocialExecutionAttemptEvidenceSnapshot,
  type SocialExecutionAttemptEvidenceStoreStorage,
} from "./social-execution-attempt-evidence-store";
import {
  buildExecutionAttemptEvidenceId,
  SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION,
} from "./social-execution-attempt-evidence-domain";
import {
  buildExecutionAttemptStateTransitionId,
  SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VERSION,
} from "./social-execution-attempt-state-transition-domain";
import { replaySocialExecutionAttemptEvidence } from "./social-execution-attempt-evidence-replay";
import type { SocialExecutionAttemptEvidencePersistenceSnapshot } from "./social-execution-attempt-evidence-store";

function createInMemoryEvidenceStore(): SocialExecutionAttemptEvidenceStoreStorage {
  const evidenceRecords: Awaited<ReturnType<typeof appendSocialExecutionAttemptEvidenceRecord>>[] = [];
  const stateTransitions: Awaited<ReturnType<typeof appendSocialExecutionAttemptStateTransition>>[] = [];

  return {
    async loadSnapshot() {
      return {
        evidenceRecords: [...evidenceRecords],
        stateTransitions: [...stateTransitions],
      };
    },
    async insertEvidenceRecord(record) {
      evidenceRecords.push(record);
      return record;
    },
    async insertStateTransition(record) {
      stateTransitions.push(record);
      return record;
    },
  };
}

test("append-only evidence store accumulates records without mutation", async () => {
  const storage = createInMemoryEvidenceStore();
  configureSocialExecutionAttemptEvidenceStoreTestDependencies(storage);

  const evidenceId = buildExecutionAttemptEvidenceId("store-test-1");
  const transitionId = buildExecutionAttemptStateTransitionId("store-test-1");

  await appendSocialExecutionAttemptEvidenceRecord({
    evidenceVersion: SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION,
    evidenceId,
    attemptId: "exec-attempt:store-test-1",
    correlationId: "corr:store-test-1",
    transitionId,
    evidenceKind: "correlation_evidence",
    sanitizedSummary: "Correlation evidence recorded.",
    evidencePayload: { correlationId: "corr:store-test-1" },
    recordedAt: "2026-07-05T12:00:00.000Z",
    recordedByActor: "test",
    recordedSource: "test",
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    containsSecrets: false,
    provesExecution: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });

  await appendSocialExecutionAttemptStateTransition({
    transitionVersion: SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VERSION,
    transitionId,
    attemptId: "exec-attempt:store-test-1",
    correlationId: "corr:store-test-1",
    fromState: "missing",
    toState: "created",
    transitionKind: "attempt_created",
    evidenceId,
    createdAt: "2026-07-05T12:00:00.000Z",
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });

  const snapshot = await loadSocialExecutionAttemptEvidenceSnapshot();
  assert.equal(snapshot.evidenceRecords.length, 1);
  assert.equal(snapshot.stateTransitions.length, 1);
});

test("replaySocialExecutionAttemptEvidence exposes evidence and derived states", async () => {
  const storage = createInMemoryEvidenceStore();
  configureSocialExecutionAttemptEvidenceStoreTestDependencies(storage);

  const evidenceId = buildExecutionAttemptEvidenceId("replay-test-1");
  const transitionId = buildExecutionAttemptStateTransitionId("replay-test-1");
  const evidenceSnapshot: SocialExecutionAttemptEvidencePersistenceSnapshot = {
    evidenceRecords: [
      {
        evidenceVersion: SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION,
        evidenceId,
        attemptId: "exec-attempt:replay-test-1",
        correlationId: "corr:replay-test-1",
        transitionId,
        evidenceKind: "state_transition_evidence",
        sanitizedSummary: "Replay evidence sample.",
        evidencePayload: {},
        recordedAt: "2026-07-05T12:00:00.000Z",
        recordedByActor: "test",
        recordedSource: "test",
        appendOnly: true,
        immutable: true,
        metadataOnly: true,
        containsSecrets: false,
        provesExecution: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
    ],
    stateTransitions: [
      {
        transitionVersion: SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VERSION,
        transitionId,
        attemptId: "exec-attempt:replay-test-1",
        correlationId: "corr:replay-test-1",
        fromState: "missing",
        toState: "created",
        transitionKind: "attempt_created",
        evidenceId,
        createdAt: "2026-07-05T12:00:00.000Z",
        appendOnly: true,
        immutable: true,
        metadataOnly: true,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
    ],
  };

  const replay = await replaySocialExecutionAttemptEvidence({
    evidenceSnapshot,
  });

  assert.equal(replay.summary.evidenceCount, 1);
  assert.equal(replay.summary.transitionCount, 1);
  assert.equal(replay.evidenceRecords[0]?.evidenceId, evidenceId);
  assert.equal(replay.computedOnly, true);
  assert.equal(replay.readOnly, true);
});
