import assert from "node:assert/strict";
import test from "node:test";

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
import {
  buildExecutionAttemptEvidenceId,
  SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION,
} from "./social-execution-attempt-evidence-domain";
import type { SocialExecutionAttemptLifecycleEventRecord } from "./social-execution-attempt-lifecycle-domain";
import { SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_VERSION } from "./social-execution-attempt-lifecycle-domain";
import {
  buildExecutionAttemptStateTransitionId,
  SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VERSION,
} from "./social-execution-attempt-state-transition-domain";
import {
  deriveExecutionAttemptCompositeState,
  deriveExecutionAttemptEvidenceCoverageStatus,
} from "./social-execution-attempt-state-domain";

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

test("deriveExecutionAttemptEvidenceCoverageStatus reports no evidence when empty", () => {
  const status = deriveExecutionAttemptEvidenceCoverageStatus({
    evidenceRecords: [],
    stateTransitions: [],
    lifecycleEventCount: 1,
  });
  assert.equal(status, "no_evidence");
});

test("deriveExecutionAttemptCompositeState computes aligned coverage", () => {
  const attempt = sampleAttempt();
  const lifecycleEvents: SocialExecutionAttemptLifecycleEventRecord[] = [
    {
      lifecycleVersion: SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_VERSION,
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
    },
  ];
  const evidenceId = buildExecutionAttemptEvidenceId("test-1");
  const transitionId = buildExecutionAttemptStateTransitionId("test-1");

  const projection = deriveExecutionAttemptCompositeState({
    attempt,
    lifecycleEvents,
    evidenceRecords: [
      {
        evidenceVersion: SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION,
        evidenceId,
        attemptId: attempt.attemptId,
        correlationId: attempt.correlationId,
        transitionId,
        evidenceKind: "lifecycle_alignment_evidence",
        sanitizedSummary: "Lifecycle aligned with attempt creation.",
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
      },
    ],
    stateTransitions: [
      {
        transitionVersion: SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VERSION,
        transitionId,
        attemptId: attempt.attemptId,
        correlationId: attempt.correlationId,
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
  });

  assert.ok(projection);
  assert.equal(projection?.derivedTransitionState, "created");
  assert.equal(projection?.evidenceCount, 1);
  assert.equal(projection?.transitionCount, 1);
  assert.equal(projection?.evidenceCoverageStatus, "evidence_aligned");
});
