import { Resend } from "resend";

import { getResendFromAddress } from "@/lib/email/resend";
import type { BookingWorkflowKind, WorkflowStep } from "./workflow-state";

export async function sendBookingOperationalAlert(input: {
  kind: BookingWorkflowKind;
  bookingId: string;
  step: WorkflowStep | "pending_24h" | "pending_48h";
  safeErrorClass: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send(
      {
        from: getResendFromAddress(),
        to: "jacobdean1166@gmail.com",
        subject: `Jumping Jax booking workflow needs attention: ${input.step}`,
        text: [
          "A booking integration requires operator attention.",
          `Booking type: ${input.kind}`,
          `Booking reference: ${input.bookingId}`,
          `Workflow step: ${input.step}`,
          `Safe error class: ${input.safeErrorClass}`,
          "Review the authenticated admin dashboard. No approval credentials are included in this alert.",
        ].join("\n"),
      },
      { idempotencyKey: `alert-${input.kind}-${input.bookingId}-${input.step}-v1` },
    );
    return !error;
  } catch {
    return false;
  }
}
