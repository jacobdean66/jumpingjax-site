import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExecutionAttemptFingerprint,
  buildExecutionAttemptIdempotencyKey,
  buildExecutionAttemptReplayKey,
  detectExecutionAttemptDuplicates,
  validateExecutionAttemptIdempotencyVocabulary,
} from "./social-execution-attempt-idempotency-domain";

test("buildExecutionAttemptIdempotencyKey is deterministic", () => {
  const key = buildExecutionAttemptIdempotencyKey({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    authorizationId: "exec-auth:test-1",
  });

  assert.equal(key, "idempotency:execution-intent-1:target-1:exec-auth:test-1");
});

test("validateExecutionAttemptIdempotencyVocabulary rejects invalid replay key", () => {
  const fingerprint = buildExecutionAttemptFingerprint({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    authorizationId: "exec-auth:test-1",
    sessionId: "exec-runtime-session:test-1",
    correlationId: "corr:test-1",
  });

  const result = validateExecutionAttemptIdempotencyVocabulary({
    idempotencyVersion: "d16-w5-v1",
    idempotencyKey: buildExecutionAttemptIdempotencyKey({
      executionIntentId: "execution-intent-1",
      publicationTargetId: "target-1",
      authorizationId: "exec-auth:test-1",
    }),
    replayKey: "invalid-replay-key",
    attemptFingerprint: fingerprint,
    correlationId: "corr:test-1",
    deterministicOnly: true,
    distributedLockingForbidden: true,
    retryEngineForbidden: true,
    backgroundProcessingForbidden: true,
  });

  assert.equal(result.ok, false);
});

test("detectExecutionAttemptDuplicates finds duplicate idempotency keys", () => {
  const detection = detectExecutionAttemptDuplicates([
    {
      attemptId: "exec-attempt:1",
      idempotencyKey: "idempotency:a:b:c",
      replayKey: "replay:1:corr:1",
      attemptFingerprint: "fingerprint:" + "a".repeat(64),
    },
    {
      attemptId: "exec-attempt:2",
      idempotencyKey: "idempotency:a:b:c",
      replayKey: "replay:2:corr:2",
      attemptFingerprint: "fingerprint:" + "b".repeat(64),
    },
  ]);

  assert.equal(detection.hasDuplicates, true);
  assert.deepEqual(detection.duplicateIdempotencyKeys, ["idempotency:a:b:c"]);
});

test("buildExecutionAttemptReplayKey is deterministic", () => {
  assert.equal(
    buildExecutionAttemptReplayKey({
      attemptId: "exec-attempt:test-1",
      correlationId: "corr:test-1",
    }),
    "replay:exec-attempt:test-1:corr:test-1",
  );
});
