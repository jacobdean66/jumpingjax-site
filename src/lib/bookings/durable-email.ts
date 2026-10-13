import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getResendFromAddress } from "@/lib/email/resend";
import { isValidEmailAddress } from "@/lib/email/address";
import { classifyEmailProviderError } from "@/lib/email/provider-error";
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

  if (!isValidEmailAddress(stored.recipient)) {
    await mark(input.supabase, input.messageKey, "failed", "customer_email_invalid");
    return { error: { code: "customer_email_invalid" } };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    await mark(input.supabase, input.messageKey, "failed", "email_not_configured");
    return { error: { code: "email_not_configured" } };
  }

  const resend = new Resend(apiKey);
  // Freeze the payload and key for every attempt, including ambiguous timeouts.
  const payload = {
    from: getResendFromAddress(), to: stored.recipient,
    subject: stored.subject, text: stored.body,
    ...(stored.html_body ? { html: stored.html_body } : {}),
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    let failure = { code: "email_network_error", retryable: true };
    let delayMs = 1000 * (attempt + 1);
    try {
      const result = await resend.emails.send(payload, { idempotencyKey: input.messageKey });
      if (!result.error && result.data?.id) {
        const saved = await mark(input.supabase, input.messageKey, "sent", null);
        return saved ? { error: null } : { error: { code: "email_status_write_failed" } };
      }
      failure = classifyEmailProviderError(result.error ?? {});
      const retryAfter = Number(result.headers?.["retry-after"]);
      if (Number.isFinite(retryAfter) && retryAfter > 0) delayMs = Math.max(delayMs, retryAfter * 1000);
      console.error("[booking-email] provider rejected send", {
        kind: input.kind, bookingId: input.bookingId,
        code: failure.code, status: result.error?.statusCode ?? null,
      });
    } catch {
      console.error("[booking-email] provider request failed", { code: failure.code });
    }
    await mark(input.supabase, input.messageKey, "failed", failure.code);
    if (!failure.retryable || attempt === 2 || delayMs > 5000) return { error: { code: failure.code } };
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return { error: { code: "email_delivery_failed" } };
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
  const { error } = await supabase
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
  if (error) console.error("[booking-email] status write failed", { code: error.code });
  return !error;
}
