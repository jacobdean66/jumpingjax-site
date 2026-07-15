import { NextResponse } from "next/server";

import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { sendBookingOperationalAlert } from "@/lib/bookings/operational-alert";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function POST() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("booking_pending_review_health")
    .select("booking_kind,booking_id,review_health")
    .in("review_health", ["flagged", "escalated"]);
  if (error) {
    console.error("[booking-workflow] pending review scan failed", { code: error.code });
    return NextResponse.json(
      { error: "Pending review scan failed" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  let alertsSent = 0;
  for (const row of data ?? []) {
    const kind = row.booking_kind === "facility" ? "facility" : "rental";
    const escalated = row.review_health === "escalated";
    const sent = await sendBookingOperationalAlert({
      kind,
      bookingId: String(row.booking_id),
      step: escalated ? "pending_48h" : "pending_24h",
      safeErrorClass: escalated ? "pending_review_escalated" : "pending_review_overdue",
    });
    if (sent) alertsSent += 1;
    if (escalated || !sent) {
      await supabase
        .from("booking_integration_workflows")
        .update({
          operator_required: true,
          last_error_class: escalated
            ? "pending_review_escalated"
            : "pending_alert_delivery_failed",
          updated_at: new Date().toISOString(),
        })
        .eq("booking_kind", kind)
        .eq("booking_id", String(row.booking_id));
    }
  }

  return NextResponse.json(
    { reviewed: data?.length ?? 0, alertsSent },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
