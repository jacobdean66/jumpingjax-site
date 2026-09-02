import { loadBookingTriageReview } from "@/lib/agent-manager/booking-triage-review-service";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";

export async function GET() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return Response.json({ ok: false, error: "Owner authorization required." }, { status: 401 });
  try {
    return Response.json({ ok: true, result: await loadBookingTriageReview() });
  } catch {
    return Response.json({ ok: false, error: "Booking triage review could not be loaded safely." }, { status: 503 });
  }
}
