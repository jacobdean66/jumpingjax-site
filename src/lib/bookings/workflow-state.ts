import type { SupabaseClient } from "@supabase/supabase-js";

export type BookingWorkflowKind = "rental" | "facility";
export type WorkflowStep =
  | "initial_customer_email"
  | "owner_notification"
  | "decision_email"
  | "calendar";
export type WorkflowOutcome = "pending" | "sent" | "failed" | "not_required";

export async function initializeBookingWorkflow(
  supabase: SupabaseClient,
  kind: BookingWorkflowKind,
  bookingId: string,
) {
  const { error } = await supabase.from("booking_integration_workflows").upsert(
    { booking_kind: kind, booking_id: bookingId },
    { onConflict: "booking_kind,booking_id", ignoreDuplicates: true },
  );
  if (error) console.error("[booking-workflow] initialize failed", { code: error.code });
}

export async function recordWorkflowOutcome(input: {
  supabase: SupabaseClient;
  kind: BookingWorkflowKind;
  bookingId: string;
  step: WorkflowStep;
  outcome: WorkflowOutcome;
  safeErrorClass?: string;
  calendarEventId?: string;
}) {
  const { error } = await input.supabase.rpc("record_booking_workflow_outcome", {
    p_booking_kind: input.kind,
    p_booking_id: input.bookingId,
    p_step: input.step,
    p_outcome: input.outcome,
    p_error_class: input.safeErrorClass ?? null,
    p_calendar_event_id: input.calendarEventId ?? null,
  });
  if (error) console.error("[booking-workflow] outcome write failed", { code: error.code });
}

/**
 * Best-effort concurrency claim for calendar-only repairs.
 * Deterministic Google event IDs remain the hard anti-duplicate guarantee;
 * this claim reduces overlapping repair attempts on the same failed row.
 */
export async function claimCalendarRepairAttempt(input: {
  supabase: SupabaseClient;
  kind: BookingWorkflowKind;
  bookingId: string;
}): Promise<{ claimed: boolean }> {
  const claimedAt = new Date().toISOString();
  const { data, error } = await input.supabase
    .from("booking_integration_workflows")
    .update({ last_attempted_at: claimedAt, updated_at: claimedAt })
    .eq("booking_kind", input.kind)
    .eq("booking_id", input.bookingId)
    .eq("calendar_status", "failed")
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[booking-workflow] calendar repair claim failed", {
      code: error.code,
    });
    return { claimed: false };
  }
  return { claimed: Boolean(data) };
}
