import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  BOOKING_TRIAGE_JOB_TYPE,
  bookingTriageIdempotencyKey,
  identifyBookingTriageIssues,
} from "./booking-triage";
import { assertAgentDispatchAllowed, enqueueJob, runOne } from "./service";

const MAX_TRIAGE_JOBS = 10;

export async function scanBookingWorkflowsForTriage(actorId: string) {
  await assertAgentDispatchAllowed("booking");
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("booking_integration_workflows")
    .select("booking_kind,booking_id,initial_customer_email_status,owner_notification_status,decision_email_status,calendar_status,operator_required,updated_at")
    .or("operator_required.eq.true,initial_customer_email_status.eq.failed,owner_notification_status.eq.failed,decision_email_status.eq.failed,calendar_status.eq.failed")
    .order("updated_at", { ascending: false })
    .limit(MAX_TRIAGE_JOBS);
  if (error) throw new Error("Booking workflow triage scan is unavailable");

  const issues = (data ?? []).flatMap((row) => identifyBookingTriageIssues(row)).slice(0, MAX_TRIAGE_JOBS);
  let created = 0;
  let reused = 0;
  for (const issue of issues) {
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
    issuesFound: issues.length,
    created,
    reused,
    aiInvocations: 0,
  };
}
