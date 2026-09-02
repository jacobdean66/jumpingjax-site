import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getResendFromAddress } from "@/lib/email/resend";
import type { BookingWorkflowKind } from "./workflow-state";

export type DurableEmailInput = {
  supabase: SupabaseClient;
  messageKey: string;
  kind: BookingWorkflowKind;
  bookingId: string;
  purpose: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendDurableBookingEmail(input: DurableEmailInput) {
  const row = {
    message_key: input.messageKey,
    booking_kind: input.kind,
    booking_id: input.bookingId,
    purpose: input.purpose,
    recipient: input.to,
    subject: input.subject,
    body: input.text,
    html_body: input.html ?? null,
  };
  const { error: insertError } = await input.supabase
    .from("booking_notification_outbox")
    .upsert(row, { onConflict: "message_key", ignoreDuplicates: true });
  if (insertError) {
    console.error("[booking-email] outbox write failed", { code: insertError.code });
    return { error: { code: "outbox_write_failed" } };
  }

  const { data: stored, error: readError } = await input.supabase
    .from("booking_notification_outbox")
    .select("status,recipient,subject,body,html_body")
    .eq("message_key", input.messageKey)
    .single();
  if (readError || !stored) return { error: { code: "outbox_read_failed" } };
  if (stored.status === "sent") return { error: null, alreadySent: true };

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    await mark(input.supabase, input.messageKey, "failed", "email_not_configured");
    return { error: { code: "email_not_configured" } };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send(
      {
        from: getResendFromAddress(),
        to: stored.recipient,
        subject: stored.subject,
        text: stored.body,
        ...(stored.html_body ? { html: stored.html_body } : {}),
      },
      { idempotencyKey: input.messageKey },
    );
    if (error) {
      await mark(input.supabase, input.messageKey, "failed", "email_delivery_failed");
      return { error: { code: "email_delivery_failed" } };
    }
    await mark(input.supabase, input.messageKey, "sent", null);
    return { error: null };
  } catch {
    await mark(input.supabase, input.messageKey, "failed", "email_delivery_failed");
    return { error: { code: "email_delivery_failed" } };
  }
}

async function mark(
  supabase: SupabaseClient,
  messageKey: string,
  status: "sent" | "failed",
  errorClass: string | null,
) {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("booking_notification_outbox")
    .select("attempt_count")
    .eq("message_key", messageKey)
    .single();
  await supabase
    .from("booking_notification_outbox")
    .update({
      status,
      attempt_count: Number(data?.attempt_count ?? 0) + 1,
      last_error_class: errorClass,
      last_attempted_at: now,
      sent_at: status === "sent" ? now : null,
      updated_at: now,
    })
    .eq("message_key", messageKey);
}
