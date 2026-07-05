import assert from "node:assert/strict";
import test from "node:test";

import { validateExecutionAttemptEvidenceAppendRequest } from "./social-execution-attempt-evidence-request";

test("validateExecutionAttemptEvidenceAppendRequest accepts valid append request", () => {
  const result = validateExecutionAttemptEvidenceAppendRequest({
    attemptId: "exec-attempt:test-1",
    ownerApprovalId: "owner-approval-1",
    evidenceKind: "operator_note",
    sanitizedSummary: "Owner verified attempt metadata note.",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.transitionKind, null);
  }
});

test("validateExecutionAttemptEvidenceAppendRequest rejects secret-bearing summaries", () => {
  const result = validateExecutionAttemptEvidenceAppendRequest({
    attemptId: "exec-attempt:test-1",
    ownerApprovalId: "owner-approval-1",
    evidenceKind: "operator_note",
    sanitizedSummary: "Bearer token leaked",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "sanitized_summary_invalid");
  }
});

test("validateExecutionAttemptEvidenceAppendRequest requires aligned evidence for transition", () => {
  const result = validateExecutionAttemptEvidenceAppendRequest({
    attemptId: "exec-attempt:test-1",
    ownerApprovalId: "owner-approval-1",
    evidenceKind: "operator_note",
    sanitizedSummary: "Note only.",
    transitionKind: "evidence_aligned",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "transition_kind_invalid");
  }
});
