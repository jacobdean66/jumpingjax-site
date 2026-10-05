import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  BOOKING_TRIAGE_JOB_TYPE,
  bookingTriageIdempotencyKey,
  identifyBookingTriageIssues,
  planBookingTriageBatch,
} from "./booking-triage";
import { assertAgentDispatchAllowed, enqueueJob, runOne } from "./service";
import { loadBookingWorkflowHealth } from "./booking-workflow-health-service";

const MAX_TRIAGE_JOBS = 10;
const MAX_SCAN_WORKFLOWS = 100;
const MAX_SCAN_ISSUES = 200;
const KEY_QUERY_CHUNK = 25;

export async function scanBookingWorkflowsForTriage(actorId: string) {
  await assertAgentDispatchAllowed("booking");
  const db = createServiceRoleClient();
  const health = await loadBookingWorkflowHealth();
  const data = health.current.slice(0, MAX_SCAN_WORKFLOWS);

  const issues = (data ?? []).flatMap((row) => identifyBookingTriageIssues(row)).slice(0, MAX_SCAN_ISSUES);
  const keys = [...new Set(issues.map(bookingTriageIdempotencyKey))];
  const existingKeys = new Set<string>();
  for (let index = 0; index < keys.length; index += KEY_QUERY_CHUNK) {
    const { data: existing, error: existingError } = await db
      .from("agent_jobs")
      .select("idempotency_key")
      .in("idempotency_key", keys.slice(index, index + KEY_QUERY_CHUNK));
    if (existingError) throw new Error("Booking workflow triage history is unavailable");
    for (const row of existing ?? []) existingKeys.add(String(row.idempotency_key));
  }
  const batch = planBookingTriageBatch(issues, existingKeys, MAX_TRIAGE_JOBS);
  let created = 0;
  let reused = batch.alreadyTriaged;
  for (const issue of batch.selected) {
    const job = await enqueueJob({
      agentKey: "booking",
      jobType: BOOKING_TRIAGE_JOB_TYPE,
      source: "admin.booking-triage",
      payload: {
        bookingKind: issue.bookingKind,
        bookingId: issue.bookingId,
        workflowStep: issue.workflowStep,
        outcome: issue.outcome,
        workflowUpdatedAt: issue.workflowUpdatedAt,
      },
      idempotencyKey: bookingTriageIdempotencyKey(issue),
      actorId,
    });
    if (job.status === "queued") {
      created += 1;
      await runOne(`booking-triage:${actorId}`);
    } else {
      reused += 1;
    }
  }

  return {
    workflowsReviewed: data?.length ?? 0,
    issuesFound: batch.issuesScanned,
    created,
    reused,
    remainingUntriaged: batch.remainingUntriaged,
    historicalWorkflows: health.historicalCount,
    aiInvocations: 0,
  };
}
