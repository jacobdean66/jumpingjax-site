import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { isUuid } from "@/lib/facility-parties/check-in";
import type { FacilityBookingCalendarFields } from "@/lib/facility-parties/calendar-description";
import { buildFacilityDecisionEmail } from "@/lib/bookings/facility-decision-email";
import { sendDurableBookingEmail } from "@/lib/bookings/durable-email";
import { recordWorkflowOutcome } from "@/lib/bookings/workflow-state";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { resolveRentalEmailSiteUrl } from "@/lib/rentals/rental-site-url";
import { rateLimit } from "@/lib/rate-limit";
import { canRetryBookingEmail } from "@/lib/bookings/email-retry-eligibility";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { scope: "admin-facility-confirmation-email", limit: 10, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;
  const auth = await verifyAdminAccess();
  if (!auth.ok) return NextResponse.json({ error: "Staff sign-in required." }, { status: auth.reason === "missing_config" ? 503 : 401 });
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid party ID." }, { status: 400 });
  const supabase = createServiceRoleClient();
  const { data: booking, error } = await supabase.from("facility_bookings").select("*").eq("id", id).maybeSingle<FacilityBookingCalendarFields & { status: string }>();
  if (error) return NextResponse.json({ error: "Could not load this party." }, { status: 503 });
  if (!booking || booking.status !== "confirmed") return NextResponse.json({ error: "Only confirmed parties can retry their confirmation email." }, { status: 409 });
  if (!canRetryBookingEmail("facility", "decision_confirm", booking)) return NextResponse.json({ error: "This party has already ended. Its historical confirmation will not be resent." }, { status: 409 });
  if (!booking.email || !booking.customer_name || !booking.readable_date || !booking.readable_time || !booking.party_label) return NextResponse.json({ error: "Add the missing contact and party details before retrying." }, { status: 409 });
  const email = buildFacilityDecisionEmail(booking, "confirm", resolveRentalEmailSiteUrl(req.url));
  const result = await sendDurableBookingEmail({ supabase, messageKey: `facility-${id}-decision-confirm-v1`, kind: "facility", bookingId: id, purpose: "decision_confirm", to: booking.email, ...email });
  await recordWorkflowOutcome({ supabase, kind: "facility", bookingId: id, step: "decision_email", outcome: result.error ? "failed" : "sent", safeErrorClass: result.error?.code });
  revalidatePath("/admin/facility");
  if (result.error) return NextResponse.json({ error: "The party remains confirmed, but its email could not be sent. Please retry later." }, { status: 503 });
  return new Response(result.alreadySent ? "Confirmation email was already sent; no duplicate was sent." : "Confirmation email sent.");
}
