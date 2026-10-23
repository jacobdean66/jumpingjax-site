import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { refreshScheduledGoogleReports } from "@/lib/analytics/shared-google-reporting";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const expected = Buffer.from(`Bearer ${secret || ""}`);
  const provided = Buffer.from(request.headers.get("authorization") || "");
  const headers = { "Cache-Control": "private, no-store" };
  if (!secret || provided.length !== expected.length || !timingSafeEqual(provided, expected)) return NextResponse.json({ ok: false }, { status: 401, headers });
  try {
    const results = await refreshScheduledGoogleReports();
    const ok = results.every(result => result.status === "connected" && result.saved);
    return NextResponse.json({ ok, results }, { status: ok ? 200 : 503, headers });
  } catch { return NextResponse.json({ ok: false, error: "Scheduled Google reporting refresh failed." }, { status: 503, headers }); }
}
