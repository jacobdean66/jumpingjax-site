import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";

import { BOOKING_TRIAGE_JOB_TYPE, buildBookingTriageReview } from "./booking-triage";

const MAX_REVIEW_JOBS = 200;
const MAX_REVIEW_GROUPS = 50;

export async function loadBookingTriageReview() {
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("agent_jobs")
    .select("payload,status,created_at")
    .eq("job_type", BOOKING_TRIAGE_JOB_TYPE)
    .order("created_at", { ascending: false })
    .limit(MAX_REVIEW_JOBS);
  if (error) throw new Error("Booking triage review is unavailable");
  return buildBookingTriageReview(data ?? [], MAX_REVIEW_GROUPS);
}
