import assert from "node:assert/strict";
import test from "node:test";

import {
  WAIVER_TRIAGE_JOB_TYPE,
  WaiverTriageWorker,
  identifyWaiverTriageIssues,
  waiverReference,
  waiverTriageIdempotencyKey,
} from "./waiver-triage.ts";
import type { AgentJob } from "./types.ts";

const row = {
  id: "private-waiver-submission-id",
  status: "completed",
  created_at: "2026-08-27T20:15:00.000Z",
  waiver_signatures: [{ id: "signature-id" }],
  waiver_documents: [{ id: "document-id", generated_at: null, sha256: null }],
};

test("Waiver Agent deterministically identifies incomplete document metadata", () => {
  const issues = identifyWaiverTriageIssues(row);
  assert.deepEqual(issues.map(({ issue }) => issue), ["document_not_generated", "document_hash_missing"]);
  assert.equal(waiverTriageIdempotencyKey(issues[0]), waiverTriageIdempotencyKey(issues[0]));
});

test("Waiver Agent identifies missing signature and document relationships", () => {
  assert.deepEqual(
    identifyWaiverTriageIssues({ ...row, waiver_signatures: [], waiver_documents: [] }).map(({ issue }) => issue),
    ["missing_signature", "missing_document"],
  );
});

test("Waiver Agent summary is redacted and uses zero AI", async () => {
  const issue = identifyWaiverTriageIssues(row)[0];
  const job = {
    id: "11111111-1111-1111-1111-111111111111",
    job_type: WAIVER_TRIAGE_JOB_TYPE,
    payload: issue,
    timeout_seconds: 10,
  } as AgentJob;
  const result = await new WaiverTriageWorker().execute(job, new AbortController().signal);
  assert.equal(result.ok, true);
  assert.match(result.summary, new RegExp(waiverReference(row.id)));
  assert.match(result.summary, /read-only triage; no AI invoked/i);
  assert.doesNotMatch(result.summary, new RegExp(row.id));
});

test("Waiver Agent ignores non-completed or malformed submissions", () => {
  assert.deepEqual(identifyWaiverTriageIssues({ ...row, status: "voided" }), []);
  assert.deepEqual(identifyWaiverTriageIssues({ ...row, id: null }), []);
});
