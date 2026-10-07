import { NextResponse } from "next/server";
import { requireStaffAuth, publicSafeError } from "@/lib/open-play/staff-auth";
import { getWaiverGroupForStaff } from "@/lib/waivers/group-service";
import { rateLimit } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  const auth = await requireStaffAuth();
  if (!auth.ok) return auth.response;
  const limited = rateLimit(req, {
    scope: "staff-waiver-group",
    limit: 180,
    windowMs: 3600000,
  });
  if (limited) return limited;
  const { submissionId } = await context.params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      submissionId,
    )
  )
    return publicSafeError("validation", 400, "Invalid waiver group");
  try {
    const members = await getWaiverGroupForStaff(submissionId);
    if (!members)
      return publicSafeError("not_found", 404, "Waiver group not found");
    return NextResponse.json(
      { ok: true, members },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return publicSafeError("database", 503);
  }
}
