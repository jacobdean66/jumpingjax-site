import assert from "node:assert/strict";
import test from "node:test";

import {
  CODING_DIAGNOSIS_JOB_TYPE,
  CodingDiagnosisWorker,
  codingDiagnosisIdempotencyKey,
  type CodingDiagnosisPayload,
} from "./coding-diagnosis.ts";
import type { AgentJob } from "./types.ts";

const payload: CodingDiagnosisPayload = {
  deploymentSha: "c800a6f12595c1a134d8fbf6087f0717bd535fef",
  unhealthyRoutes: [],
  criticalIssueCodes: [],
  warningIssueCodes: ["agents:nomination:setup-required"],
  securityStates: ["Aikido Security:degraded", "AITHURA Sentinel:degraded"],
  checkedAt: "2026-09-02T15:00:00.000Z",
};

test("Coding Agent diagnosis identity changes only with operational state", () => {
  assert.equal(codingDiagnosisIdempotencyKey(payload), codingDiagnosisIdempotencyKey({ ...payload, checkedAt: "later" }));
  assert.notEqual(codingDiagnosisIdempotencyKey(payload), codingDiagnosisIdempotencyKey({ ...payload, unhealthyRoutes: ["/booking"] }));
});

test("Coding Agent worker records bounded read-only diagnosis", async () => {
  const job = {
    id: "11111111-1111-1111-1111-111111111111",
    job_type: CODING_DIAGNOSIS_JOB_TYPE,
    payload,
    timeout_seconds: 10,
  } as AgentJob;
  const result = await new CodingDiagnosisWorker().execute(job, new AbortController().signal);
  assert.equal(result.ok, true);
  assert.match(result.summary, /0 unhealthy routes, 0 critical issues, 1 warnings/i);
  assert.match(result.summary, /No code or production change; AI calls 0/i);
});
