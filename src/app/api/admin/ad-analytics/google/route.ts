import { NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { loadGoogleAdsReport } from "@/lib/analytics/google-reporting";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  const headers = { "Cache-Control": "private, no-store" };
  if (!auth.ok) return NextResponse.json({ error: "Owner authentication required." }, { status: 401, headers });
  const report = await loadGoogleAdsReport(new URL(request.url).searchParams.get("preset") || undefined);
  return NextResponse.json(report, { headers });
}
