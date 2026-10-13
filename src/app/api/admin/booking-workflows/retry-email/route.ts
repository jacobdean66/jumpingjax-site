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

  // Old requests and closed bookings must not send stale confirmations.
  if (data.status !== "sent" && emailWorkflowStep(data.purpose)) {
    const rental = data.booking_kind === "rental";
    const { data: booking, error: bookingError } = await supabase
      .from(rental ? "bookings" : "facility_bookings")
      .select(rental ? "status,event_date,span_days" : "status,end_time")
      .eq("id", data.booking_id).maybeSingle<{ status: string; event_date?: string; span_days?: number; end_time?: string }>();
    if (bookingError) return NextResponse.json({ error: "Could not verify booking status." }, { status: 503 });
    if (!canRetryBookingEmail(rental ? "rental" : "facility", data.purpose, booking))
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
