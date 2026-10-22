import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { resolveEmailSiteUrl } from "@/lib/site-url";
import { buildGoogleAdsAuthorization, GOOGLE_ADS_STATE_COOKIE } from "@/lib/analytics/google-reporting-auth";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return NextResponse.json({ error: "Owner authentication required." }, { status: 401 });
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Same-origin request required." }, { status: 403 });
  const origin = resolveEmailSiteUrl(request.url);
  const service = request.nextUrl.searchParams.get("service") === "search_console" ? "search_console" : "ads";
  const connection = buildGoogleAdsAuthorization(process.env, origin, auth.identity.id, service);
  if (!connection) return NextResponse.redirect(new URL("/admin/ad-analytics/google?google_ads=configuration_required", origin), 303);
  const response = NextResponse.redirect(connection.url, 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set(GOOGLE_ADS_STATE_COOKIE, connection.cookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
