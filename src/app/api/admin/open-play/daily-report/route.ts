import { NextResponse } from "next/server";

import { verifyAdminAccess } from "@/lib/admin/session";
import { rateLimit } from "@/lib/rate-limit";
import { isYmd } from "@/lib/open-play/pricing";
import { getOpenPlayDailyReport } from "@/lib/open-play/report-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rateLimit(req, {
    scope: "admin-open-play-daily-report",
    limit: 60,
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

  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!isYmd(date)) {
    return NextResponse.json(
      { ok: false, error: "date must be YYYY-MM-DD", code: "validation" },
      { status: 400 },
    );
  }

  try {
    const report = await getOpenPlayDailyReport(date);
    return NextResponse.json(
      { ok: true, report },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Report failed",
        code: "database",
      },
      { status: 503 },
    );
  }
}
