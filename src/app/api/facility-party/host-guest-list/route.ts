import { NextResponse } from "next/server";
import { hasHostGuestListAccess } from "@/lib/facility-parties/host-guest-list";
import { loadPublicFacilityParty } from "@/lib/facility-parties/check-in-service";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function GET(request: Request) {
  const limited = rateLimit(request, { scope: "facility-party-host-guest-list", limit: 600, windowMs: 3600000 });
  if (limited) return limited;
  const params = new URL(request.url).searchParams;
  const bookingId = params.get("booking") ?? "";
  if (!hasHostGuestListAccess(bookingId, params.get("token") ?? "")) {
    return NextResponse.json({ error: "Please use the guest-list link in your booking email." }, { status: 403, headers });
  }
  try {
    const party = await loadPublicFacilityParty(bookingId, new Date(), true, true);
    if (!party) return NextResponse.json({ error: "This party is no longer available." }, { status: 404, headers });
    return NextResponse.json({ party }, { headers });
  } catch {
    return NextResponse.json({ error: "The guest list is temporarily unavailable. Please try again." }, { status: 503, headers });
  }
}
