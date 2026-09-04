import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import {
  buildFacilityPartyWaiverSignUrl,
  cleanPartyCheckInText,
  normalizePartyDate,
} from "@/lib/facility-parties/check-in";
import {
  checkInFacilityPartyWaiverMatch,
  findFacilityPartyWaiverMatches,
  loadPublicFacilityParty,
} from "@/lib/facility-parties/check-in-service";
import { publicSafeError } from "@/lib/open-play/staff-auth";
import { CANONICAL_PRODUCTION_SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rateLimit(req, {
    scope: "facility-party-guest-list",
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  try {
    const bookingId = cleanPartyCheckInText(
      new URL(req.url).searchParams.get("bookingId"),
      64,
    );
    const party = await loadPublicFacilityParty(bookingId);
    if (!party) return publicSafeError("not_found", 404, "Party not found.");
    return NextResponse.json(
      { ok: true, party },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return publicSafeError("database", 503, "The guest list is temporarily unavailable.");
  }
}

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
    const bookingId = cleanPartyCheckInText(body.bookingId, 64);
    const mode = body.mode === "check-in" ? "check-in" : "search";
    const result = mode === "check-in"
      ? await checkInFacilityPartyWaiverMatch({
          bookingId,
          participantId: body.participantId,
          firstName: body.firstName,
          lastName: body.lastName,
          partyDate,
        })
      : await findFacilityPartyWaiverMatches({
          bookingId,
          firstName: body.firstName,
          lastName: body.lastName,
        });

    if (!result.ok) {
      return publicSafeError(result.code, result.code === "not_found" ? 404 : 400, result.message);
    }

    if (mode === "search" && "matches" in result) {
      return NextResponse.json(
        {
          ok: true,
          matches: result.matches,
          signWaiverUrl: result.matches.length
            ? null
            : buildFacilityPartyWaiverSignUrl({
                siteUrl: CANONICAL_PRODUCTION_SITE_URL,
                bookingId,
                partyDate,
                arrival: true,
              }),
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        checkedIn: true,
        partyDate: "partyDate" in result ? result.partyDate : partyDate,
        message: "message" in result ? result.message : "You are checked in.",
        guestName: "guest" in result
          ? `${result.guest.firstName} ${result.guest.lastName}`.trim()
          : null,
      },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return publicSafeError("database", 503);
  }
}
