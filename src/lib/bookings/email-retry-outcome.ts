import type { SupabaseClient } from "@supabase/supabase-js";
import { recordWorkflowOutcome, type BookingWorkflowKind, type WorkflowStep } from "./workflow-state";

export function emailWorkflowStep(purpose: string): WorkflowStep | null {
  if (purpose === "initial_customer_receipt") return "initial_customer_email";
  if (purpose === "owner_notification") return "owner_notification";
  if (purpose === "decision_confirm" || purpose === "decision_reject") return "decision_email";
  return null;
}

export async function recordEmailRetryOutcome(input: {
  supabase: SupabaseClient; kind: BookingWorkflowKind; bookingId: string;
  purpose: string; errorCode?: string;
}) {
  const step = emailWorkflowStep(input.purpose);
  if (!step) return;
  let errorCode = input.errorCode;
  if (!errorCode && step === "owner_notification") {
    const { data, error } = await input.supabase.from("booking_notification_outbox")
      .select("status").eq("booking_kind", input.kind).eq("booking_id", input.bookingId)
      .eq("purpose", "owner_notification");
    if (error || !data?.length || data.some(row => row.status !== "sent")) errorCode = "owner_notification_failed";
  }
  await recordWorkflowOutcome({
    supabase: input.supabase, kind: input.kind, bookingId: input.bookingId,
    step, outcome: errorCode ? "failed" : "sent", safeErrorClass: errorCode,
  });
}
