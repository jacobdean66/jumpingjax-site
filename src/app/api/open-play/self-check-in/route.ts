import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { businessDayYmdFromInstant } from "@/lib/open-play/business-day";
import {
  parseSelfCheckInInput,
  SelfCheckInValidationError,
} from "@/lib/open-play/self-check-in";
import { createPublicSelfCheckIn } from "@/lib/open-play/self-check-in-service";
import { publicSafeError } from "@/lib/open-play/staff-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = rateLimit(req, {
    scope: "public-open-play-self-check-in",
    limit: 12,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return publicSafeError("invalid_json", 400, "Enter your name and age.");
  }

  try {
    const input = parseSelfCheckInInput(body);
    const result = await createPublicSelfCheckIn({
      input,
      businessDayYmd: businessDayYmdFromInstant(new Date()),
    });
    if (result.needsWaiver) {
      return NextResponse.json(
        { ok: false, needsWaiver: true },
        { status: 404, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return NextResponse.json(
      { ok: true, checkedIn: true },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof SelfCheckInValidationError) {
      return publicSafeError(error.code, 400, error.message);
    }
    return publicSafeError("database", 503, "Check-in is temporarily unavailable.");
  }
}

