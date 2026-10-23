import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { promoteGoogleBrowserConnections } from "@/lib/analytics/shared-google-reporting";
import { GOOGLE_ADS_CONNECTION_COOKIE } from "@/lib/analytics/google-reporting-auth";
import { SEARCH_CONSOLE_COOKIE } from "@/lib/analytics/search-console-core";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const auth = await verifyAdminOwnerAccess();
  const headers = { "Cache-Control": "private, no-store" };
  if (!auth.ok) return NextResponse.json({ error: "Owner authentication required." }, { status: 401, headers });
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Same-origin request required." }, { status: 403, headers });
  const results = await promoteGoogleBrowserConnections(auth.identity.id);
  const response = NextResponse.redirect(new URL(`/admin/ad-analytics/google?shared=${results.every(result => result.status === "connected") ? "connected" : "incomplete"}`, request.url), 303);
  response.headers.set("Cache-Control", "private, no-store");
  for (const result of results) if (result.status === "connected") response.cookies.set(result.service === "ads" ? GOOGLE_ADS_CONNECTION_COOKIE : SEARCH_CONSOLE_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
  return response;
}
