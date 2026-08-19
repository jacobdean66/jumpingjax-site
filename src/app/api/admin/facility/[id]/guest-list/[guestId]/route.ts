import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireStaffAuth, publicSafeError } from "@/lib/open-play/staff-auth";
import { setFacilityPartyGuestPresent } from "@/lib/facility-parties/check-in-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string; guestId: string }> },
) {
  const limited = rateLimit(req, {
    scope: "admin-facility-party-guest-present",
    limit: 180,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const auth = await requireStaffAuth();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return publicSafeError("invalid_json", 400, "Invalid request.");
  }

  const { id, guestId } = await context.params;
  try {
    const result = await setFacilityPartyGuestPresent({
      bookingId: id,
      guestId,
      present: body.present === true,
      staffLabel: auth.auth.role,
    });
    if (!result.ok) {
      return publicSafeError(result.code, result.code === "not_found" ? 404 : 400, result.message);
    }
    return NextResponse.json(
      { ok: true, guest: result.guest },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return publicSafeError("database", 503);
  }
}
