import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import {
  buildFacilityPartyWaiverSignUrl,
  cleanPartyCheckInText,
  normalizePartyDate,
} from "@/lib/facility-parties/check-in";
import { findAndAddFacilityPartyGuest } from "@/lib/facility-parties/check-in-service";
import { publicSafeError } from "@/lib/open-play/staff-auth";
import { CANONICAL_PRODUCTION_SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = rateLimit(req, {
    scope: "facility-party-check-in",
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

  try {
    const partyDate = normalizePartyDate(body.partyDate);
    const result = await findAndAddFacilityPartyGuest({
      bookingId: cleanPartyCheckInText(body.bookingId, 64),
      firstName: body.firstName,
      lastName: body.lastName,
      dob: body.dob,
      partyDate,
    });

    if (!result.ok) {
      return publicSafeError(result.code, result.code === "not_found" ? 404 : 400, result.message);
    }

    return NextResponse.json(
      {
        ok: true,
        found: result.found,
        partyDate: result.partyDate,
        message: result.message,
        guestName: result.found
          ? `${result.guest.firstName} ${result.guest.lastName}`.trim()
          : null,
        signWaiverUrl: result.found
          ? null
          : buildFacilityPartyWaiverSignUrl({
              siteUrl: CANONICAL_PRODUCTION_SITE_URL,
              bookingId: cleanPartyCheckInText(body.bookingId, 64),
              partyDate,
            }),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return publicSafeError("database", 503);
  }
}
