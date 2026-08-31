import { runCompositeBookingProof } from "@/lib/agent-manager/composite-booking-proof";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { validateOwnerPost } from "@/lib/security/request-guard";

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return Response.json({ ok: false, error: "Owner authorization required." }, { status: 401 });
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  return Response.json({ ok: true, result: runCompositeBookingProof() });
}
