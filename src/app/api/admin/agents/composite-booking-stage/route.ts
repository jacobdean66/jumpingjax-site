import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { loadLiveCompositeAvailabilityBlocks } from "@/lib/agent-manager/composite-availability-service";
import { buildStagedCompositeBookingIntent } from "@/lib/agent-manager/composite-booking-intent";
import { persistCompositeBookingIntent } from "@/lib/agent-manager/composite-booking-intent-service";
import { parseCompositeBookingRequest } from "@/lib/agent-manager/composite-booking-request";
import { validateOwnerPost } from "@/lib/security/request-guard";

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return Response.json({ ok: false, error: "Owner authorization required." }, { status: 401 });
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  const body = parseCompositeBookingRequest(await request.json().catch(() => null));
  if (!body) return Response.json({ ok: false, error: "Invalid bounded booking request." }, { status: 400 });

  try {
    const existingBlocks = await loadLiveCompositeAvailabilityBlocks();
    const staged = buildStagedCompositeBookingIntent(body, existingBlocks);
    if (!staged.ok) {
      return Response.json({ ok: false, status: staged.status, reasons: staged.reasons }, { status: 409 });
    }
    const intent = await persistCompositeBookingIntent(staged.intent, auth.identity.id);
    return Response.json({
      ok: true,
      intent,
      transactionKey: staged.intent.transactionKey,
      approvalRequired: true,
      bookingWrites: 0,
      externalCalendarWrites: 0,
      customerMessages: 0,
      paymentWrites: 0,
      aiInvocations: 0,
    });
  } catch {
    return Response.json({ ok: false, error: "Booking intent could not be staged safely." }, { status: 503 });
  }
}

