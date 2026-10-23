import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { refreshScheduledGoogleReports } from "@/lib/analytics/shared-google-reporting";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const auth = await verifyAdminOwnerAccess();
  const headers = { "Cache-Control": "private, no-store" };
  if (!auth.ok) return NextResponse.json({ error: "Owner authentication required." }, { status: 401, headers });
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Same-origin request required." }, { status: 403, headers });
  try {
    const results = await refreshScheduledGoogleReports();
    const ok = results.every(result => result.status === "connected" && result.saved);
    const response = NextResponse.redirect(new URL(`/admin/ad-analytics/google?refresh_all=${ok ? "complete" : "incomplete"}`, request.url), 303);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch { return NextResponse.json({ error: "Shared reporting refresh failed. Saved reports were retained." }, { status: 503, headers }); }
}
