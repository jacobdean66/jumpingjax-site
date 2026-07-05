import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExecutionAttemptEvidenceId,
  SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION,
  validateExecutionAttemptEvidenceRecord,
  type SocialExecutionAttemptEvidenceRecord,
} from "./social-execution-attempt-evidence-domain";
import {
  buildExecutionAttemptStateTransitionId,
  SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VERSION,
  isValidExecutionAttemptStateTransition,
  validateExecutionAttemptStateTransitionRecord,
  validateExecutionAttemptStateTransitionSequence,
  type SocialExecutionAttemptStateTransitionRecord,
} from "./social-execution-attempt-state-transition-domain";

function sampleEvidence(): SocialExecutionAttemptEvidenceRecord {
  return {
    evidenceVersion: SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION,
    evidenceId: buildExecutionAttemptEvidenceId("test-1"),
    attemptId: "exec-attempt:test-1",
    correlationId: "corr:test-1",
    transitionId: buildExecutionAttemptStateTransitionId("test-1"),
    evidenceKind: "state_transition_evidence",
    sanitizedSummary: "Attempt created with lifecycle alignment evidence.",
    evidencePayload: { lifecycleState: "created" },
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
  };
}

function sampleTransition(): SocialExecutionAttemptStateTransitionRecord {
  return {
    transitionVersion: SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VERSION,
    transitionId: buildExecutionAttemptStateTransitionId("test-1"),
    attemptId: "exec-attempt:test-1",
    correlationId: "corr:test-1",
    fromState: "missing",
    toState: "created",
    transitionKind: "attempt_created",
    evidenceId: buildExecutionAttemptEvidenceId("test-1"),
    createdAt: "2026-07-05T12:00:00.000Z",
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

test("validateExecutionAttemptEvidenceRecord accepts valid evidence", () => {
  const result = validateExecutionAttemptEvidenceRecord(sampleEvidence());
  assert.equal(result.ok, true);
});

test("validateExecutionAttemptEvidenceRecord rejects secret-bearing evidence", () => {
  const result = validateExecutionAttemptEvidenceRecord({
    ...sampleEvidence(),
    containsSecrets: true as false,
  });
  assert.equal(result.ok, false);
});

test("validateExecutionAttemptStateTransitionRecord accepts valid transition", () => {
  const result = validateExecutionAttemptStateTransitionRecord(sampleTransition());
  assert.equal(result.ok, true);
});

test("isValidExecutionAttemptStateTransition enforces lifecycle vocabulary", () => {
  assert.equal(isValidExecutionAttemptStateTransition("missing", "created"), true);
  assert.equal(isValidExecutionAttemptStateTransition("expired", "prepared"), false);
});

test("validateExecutionAttemptStateTransitionSequence rejects invalid history", () => {
  const errors = validateExecutionAttemptStateTransitionSequence([
    sampleTransition(),
    {
      ...sampleTransition(),
      transitionId: buildExecutionAttemptStateTransitionId("test-2"),
      fromState: "created",
      toState: "prepared",
      transitionKind: "attempt_prepared",
      createdAt: "2026-07-05T12:01:00.000Z",
    },
    {
      ...sampleTransition(),
      transitionId: buildExecutionAttemptStateTransitionId("test-3"),
      fromState: "prepared",
      toState: "created",
      transitionKind: "operator_noted",
      createdAt: "2026-07-05T12:02:00.000Z",
    },
  ]);

  assert.ok(errors.length > 0);
});
