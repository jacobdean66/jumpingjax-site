import { createHash } from "node:crypto";

import type { AgentJob } from "./types";
import type { AgentWorker, WorkerResult } from "./worker";

export const CODING_DIAGNOSIS_JOB_TYPE = "code.health.diagnosis";

export type CodingDiagnosisPayload = {
  deploymentSha: string | null;
  unhealthyRoutes: string[];
  criticalIssueCodes: string[];
  warningIssueCodes: string[];
  securityStates: string[];
  checkedAt: string;
};

function boundedStrings(value: unknown, maximum: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, maximum);
}

export function codingDiagnosisIdempotencyKey(payload: CodingDiagnosisPayload) {
  const fingerprint = JSON.stringify({
    deploymentSha: payload.deploymentSha,
    unhealthyRoutes: [...payload.unhealthyRoutes].sort(),
    criticalIssueCodes: [...payload.criticalIssueCodes].sort(),
    warningIssueCodes: [...payload.warningIssueCodes].sort(),
    securityStates: [...payload.securityStates].sort(),
  });
  return `coding-diagnosis:${createHash("sha256").update(fingerprint).digest("hex")}`;
}

export class CodingDiagnosisWorker implements AgentWorker {
  readonly kind = "coding" as const;

  supports(jobType: string) {
    return jobType === CODING_DIAGNOSIS_JOB_TYPE;
  }

  async execute(job: AgentJob, signal: AbortSignal): Promise<WorkerResult> {
    if (signal.aborted) return { ok: false, summary: "Coding diagnosis cancelled before execution", transient: false };
    const unhealthyRoutes = boundedStrings(job.payload.unhealthyRoutes, 8);
    const criticalIssueCodes = boundedStrings(job.payload.criticalIssueCodes, 20);
    const warningIssueCodes = boundedStrings(job.payload.warningIssueCodes, 20);
    const securityStates = boundedStrings(job.payload.securityStates, 4);
    const deployment = typeof job.payload.deploymentSha === "string" ? job.payload.deploymentSha.slice(0, 12) : "unknown";
    return {
      ok: true,
      summary: `Read-only code diagnosis for deployment ${deployment}: ${unhealthyRoutes.length} unhealthy routes, ${criticalIssueCodes.length} critical issues, ${warningIssueCodes.length} warnings; security ${securityStates.join(", ") || "unavailable"}. No code or production change; AI calls 0.`,
    };
  }
}
