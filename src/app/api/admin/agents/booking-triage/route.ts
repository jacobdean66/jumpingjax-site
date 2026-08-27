import { scanBookingWorkflowsForTriage } from "@/lib/agent-manager/booking-triage-service";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { validateOwnerPost } from "@/lib/security/request-guard";

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return Response.json({ ok: false, error: "Owner authorization required." }, { status: 401 });
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  try {
    const result = await scanBookingWorkflowsForTriage(auth.identity.id);
    return Response.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error && /paused|emergency stop/i.test(error.message)
      ? error.message
      : "Booking workflow triage could not be completed safely.";
    return Response.json({ ok: false, error: message }, { status: 503 });
  }
}
