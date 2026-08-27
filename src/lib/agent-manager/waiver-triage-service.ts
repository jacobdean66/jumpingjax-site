import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  WAIVER_TRIAGE_JOB_TYPE,
  identifyWaiverTriageIssues,
  waiverTriageIdempotencyKey,
} from "./waiver-triage";
import { assertAgentDispatchAllowed, enqueueJob, runOne } from "./service";

const MAX_TRIAGE_JOBS = 10;
const MAX_SUBMISSIONS_REVIEWED = 25;

export async function scanWaiverSubmissionsForTriage(actorId: string) {
  await assertAgentDispatchAllowed("waiver");
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("waiver_submissions")
    .select("id,status,created_at,waiver_signatures(id),waiver_documents(id,generated_at,sha256)")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(MAX_SUBMISSIONS_REVIEWED);
  if (error) throw new Error("Waiver submission triage scan is unavailable");

  const issues = (data ?? []).flatMap((row) => identifyWaiverTriageIssues(row)).slice(0, MAX_TRIAGE_JOBS);
  let created = 0;
  let reused = 0;
  for (const issue of issues) {
    const job = await enqueueJob({
      agentKey: "waiver",
      jobType: WAIVER_TRIAGE_JOB_TYPE,
      source: "admin.waiver-triage",
      payload: {
        submissionId: issue.submissionId,
        submissionCreatedAt: issue.submissionCreatedAt,
        issue: issue.issue,
      },
      idempotencyKey: waiverTriageIdempotencyKey(issue),
      actorId,
    });
    if (job.status === "queued") {
      created += 1;
      await runOne(`waiver-triage:${actorId}`);
    } else {
      reused += 1;
    }
  }

  return {
    submissionsReviewed: data?.length ?? 0,
    issuesFound: issues.length,
    created,
    reused,
    aiInvocations: 0,
  };
}
