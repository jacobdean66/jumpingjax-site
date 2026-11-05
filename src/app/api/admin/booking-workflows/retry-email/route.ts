import { NextResponse } from "next/server";

import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { sendDurableBookingEmail } from "@/lib/bookings/durable-email";
import { emailWorkflowStep, recordEmailRetryOutcome } from "@/lib/bookings/email-retry-outcome";
import { canRetryBookingEmail } from "@/lib/bookings/email-retry-eligibility";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { messageKey?: unknown } | null;
  const messageKey = typeof body?.messageKey === "string" ? body.messageKey.trim() : "";
  if (!messageKey) return NextResponse.json({ error: "messageKey is required" }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("booking_notification_outbox")
    .select("message_key,booking_kind,booking_id,purpose,recipient,subject,body,html_body,status")
    .eq("message_key", messageKey)
    .single();
  if (error || !data) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const step = emailWorkflowStep(data.purpose);
  const facilityInitial = data.booking_kind === "facility" &&
    (step === "initial_customer_email" || step === "owner_notification");
  // Preview notification retries must use their saved booking claim and lease.
  // Retrying one outbox row here could bypass that lease or its provider window.
  if ((data.status !== "sent" && step) || facilityInitial) {
    const rental = data.booking_kind === "rental";
    const { data: booking, error: bookingError } = await supabase
      .from(rental ? "bookings" : "facility_bookings")
      .select(rental ? "status,event_date,span_days" : facilityInitial ? "status,end_time,idempotency_key" : "status,end_time")
      .eq("id", data.booking_id).maybeSingle<{
        status: string; event_date?: string; span_days?: number; end_time?: string; idempotency_key?: string;
      }>();
    if (bookingError) return NextResponse.json({ error: "Could not verify booking status." }, { status: 503 });
    if (facilityInitial && booking?.idempotency_key?.startsWith("facility-preview-v1:")) {
      const headers = { "Cache-Control": "private, no-store" };
      if (data.status === "sent") {
        return NextResponse.json({ ok: true, alreadySent: true }, { headers });
      }
      return NextResponse.json({
        error: "Retry this preview booking through its saved notification workflow or reconcile the prior send.",
      }, { status: 409, headers });
    }
    if (data.status !== "sent" && !canRetryBookingEmail(rental ? "rental" : "facility", data.purpose, booking))
      return NextResponse.json({ error: "This booking is closed or its event has passed. Its historical email will not be resent." }, { status: 409 });
  }

  const result = await sendDurableBookingEmail({
    supabase,
    messageKey: data.message_key,
    kind: data.booking_kind === "facility" ? "facility" : "rental",
    bookingId: data.booking_id,
    purpose: data.purpose,
    to: data.recipient,
    subject: data.subject,
    text: data.body,
    html: data.html_body ?? undefined,
  });
  await recordEmailRetryOutcome({
    supabase, kind: data.booking_kind === "facility" ? "facility" : "rental",
    bookingId: data.booking_id, purpose: data.purpose, errorCode: result.error?.code,
  });
  return NextResponse.json(
    { ok: !result.error, alreadySent: result.alreadySent === true, errorClass: result.error?.code },
    { status: result.error ? 503 : 200, headers: { "Cache-Control": "private, no-store" } },
  );
}
