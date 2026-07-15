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
