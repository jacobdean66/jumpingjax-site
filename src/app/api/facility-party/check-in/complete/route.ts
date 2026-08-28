import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { cleanPartyCheckInText, normalizePartyDate } from "@/lib/facility-parties/check-in";
import { addFacilityPartySubmissionGuests } from "@/lib/facility-parties/check-in-service";
import { publicSafeError } from "@/lib/open-play/staff-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = rateLimit(req, {
    scope: "facility-party-check-in-complete",
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return publicSafeError("invalid_json", 400, "Invalid request.");
  }

  const bookingId = cleanPartyCheckInText(body.bookingId, 64);
  const token = cleanPartyCheckInText(body.publicToken, 160);
  if (!bookingId || !token) {
    return publicSafeError("validation", 400, "Party and waiver are required.");
  }

  try {
    const result = await addFacilityPartySubmissionGuests({
      bookingId,
      publicToken: token,
      partyDate: normalizePartyDate(body.partyDate),
      markPresent: body.atFacility === true,
    });
    if (!result.ok) {
      return publicSafeError(result.code, result.code === "not_found" ? 404 : 400, result.message);
    }
    return NextResponse.json(
      {
        ok: true,
        partyDate: result.partyDate,
        message: result.message,
        guestCount: result.guests.length,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return publicSafeError("database", 503);
  }
}
