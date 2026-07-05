import assert from "node:assert/strict";
import test from "node:test";

import {
  configureSocialExecutionAttemptEvidenceStoreTestDependencies,
  appendSocialExecutionAttemptEvidenceRecord,
  loadSocialExecutionAttemptEvidenceSnapshot,
  type SocialExecutionAttemptEvidenceStoreStorage,
} from "./social-execution-attempt-evidence-store";
import {
  buildExecutionAttemptEvidenceId,
  SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION,
} from "./social-execution-attempt-evidence-domain";
import { evaluateExecutionAttemptEvidencePreflightForIntent } from "./social-execution-attempt-evidence-preflight";

function createInMemoryEvidenceStore(): SocialExecutionAttemptEvidenceStoreStorage {
  const evidenceRecords: Awaited<ReturnType<typeof appendSocialExecutionAttemptEvidenceRecord>>[] = [];
  const stateTransitions: Awaited<ReturnType<SocialExecutionAttemptEvidenceStoreStorage["insertStateTransition"]>>[] = [];

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

test("evaluateExecutionAttemptEvidencePreflightForIntent returns no evidence when empty", () => {
  const summary = evaluateExecutionAttemptEvidencePreflightForIntent({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
  });

  assert.ok(summary);
  assert.equal(summary?.evidenceCoverageStatus, "no_evidence");
  assert.equal(summary?.informationalOnly, true);
});

test("evidence store append is visible through preflight", async () => {
  const storage = createInMemoryEvidenceStore();
  configureSocialExecutionAttemptEvidenceStoreTestDependencies(storage);

  await appendSocialExecutionAttemptEvidenceRecord({
    evidenceVersion: SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION,
    evidenceId: buildExecutionAttemptEvidenceId("preflight-test-1"),
    attemptId: "exec-attempt:preflight-test-1",
    correlationId: "corr:preflight-test-1",
    transitionId: null,
    evidenceKind: "operator_note",
    sanitizedSummary: "Operator note for preflight.",
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
  });

  const snapshot = await loadSocialExecutionAttemptEvidenceSnapshot();
  const summary = evaluateExecutionAttemptEvidencePreflightForIntent({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    evidenceSnapshot: snapshot,
  });

  assert.ok(summary);
  assert.equal(summary?.evidenceCount, 0);
  assert.equal(summary?.latestEvidenceKind, null);
});
