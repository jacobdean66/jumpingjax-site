import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";

import {
  CODING_DIAGNOSIS_JOB_TYPE,
  codingDiagnosisIdempotencyKey,
  type CodingDiagnosisPayload,
} from "./coding-diagnosis";
import { assertAgentDispatchAllowed, enqueueJob, runOne } from "./service";
import { collectSupervisorSnapshot } from "./supervisor-service";

export async function runCodingDiagnosis(actorId: string) {
  await assertAgentDispatchAllowed("coding");
  const snapshot = await collectSupervisorSnapshot(actorId);
  const payload: CodingDiagnosisPayload = {
    deploymentSha: snapshot.deployment.commitSha,
    unhealthyRoutes: snapshot.website.filter((route) => !route.ok).map((route) => route.path),
    criticalIssueCodes: snapshot.issues.filter((issue) => issue.severity === "critical").map((issue) => issue.code),
    warningIssueCodes: snapshot.issues.filter((issue) => issue.severity === "warning").map((issue) => issue.code),
    securityStates: snapshot.security.map((service) => `${service.name}:${service.state}`),
    checkedAt: snapshot.generatedAt,
  };
  const job = await enqueueJob({
    agentKey: "coding",
    jobType: CODING_DIAGNOSIS_JOB_TYPE,
    source: "admin.coding-diagnosis",
    payload: { ...payload, aiInvocations: 0, codeWritesAllowed: false, deploymentWritesAllowed: false },
    idempotencyKey: codingDiagnosisIdempotencyKey(payload),
    actorId,
  });
  if (job.status === "queued") await runOne(`coding-diagnosis:${actorId}`);

  const db = createServiceRoleClient();
  const { data: completed, error } = await db
    .from("agent_jobs")
    .select("id,status,result_summary")
    .eq("id", job.id)
    .single();
  if (error || !completed) throw new Error("Coding diagnosis result is unavailable");
  return {
    jobId: String(completed.id),
    status: String(completed.status),
    summary: String(completed.result_summary ?? "Coding diagnosis is queued."),
    deduplicated: job.status !== "queued",
    criticalIssues: payload.criticalIssueCodes.length,
    warnings: payload.warningIssueCodes.length,
    unhealthyRoutes: payload.unhealthyRoutes.length,
    aiInvocations: 0,
    codeWrites: 0,
    deployments: 0,
  };
}
