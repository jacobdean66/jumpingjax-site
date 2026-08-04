import { NextResponse } from "next/server";

import { verifyAdminAccess } from "@/lib/admin/session";
import { rateLimit } from "@/lib/rate-limit";
import {
  searchWaiversForStaff,
  WaiverSearchValidationError,
} from "@/lib/waivers/search-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rateLimit(req, {
    scope: "admin-open-play-waiver-search",
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const auth = await verifyAdminAccess();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: "Staff authentication required", code: "unauthorized" },
      { status: auth.reason === "missing_config" ? 503 : 401 },
    );
  }

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
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Search failed",
        code: "database",
      },
      { status: 503 },
    );
  }
}
