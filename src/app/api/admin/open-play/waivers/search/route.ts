import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireStaffAuth, publicSafeError } from "@/lib/open-play/staff-auth";
import {
  searchWaiversForStaff,
  WaiverSearchValidationError,
} from "@/lib/waivers/search-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rateLimit(req, {
    scope: "admin-open-play-waiver-search",
    // The admin desk intentionally searches after every typed letter.
    limit: 1200,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const auth = await requireStaffAuth();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";

  try {
    const results = await searchWaiversForStaff({ query: q });
    return NextResponse.json(
      { ok: true, results },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof WaiverSearchValidationError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: 400 },
      );
    }
    return publicSafeError("database", 503);
  }
}
