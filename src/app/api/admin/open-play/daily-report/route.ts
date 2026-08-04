import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireOwnerAuth, publicSafeError } from "@/lib/open-play/staff-auth";
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

  const auth = await requireOwnerAuth();
  if (!auth.ok) return auth.response;

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
  } catch {
    return publicSafeError("database", 503);
  }
}
