import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { removeSharedGoogleConnection } from "@/lib/analytics/shared-google-reporting";
import { GOOGLE_ADS_CONNECTION_COOKIE } from "@/lib/analytics/google-reporting-auth";
import { SEARCH_CONSOLE_COOKIE } from "@/lib/analytics/search-console-core";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const auth = await verifyAdminOwnerAccess();
  const headers = { "Cache-Control": "private, no-store" };
  if (!auth.ok) return NextResponse.json({ error: "Owner authentication required." }, { status: 401, headers });
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Same-origin request required." }, { status: 403, headers });
  const service = request.nextUrl.searchParams.get("service");
  if (service !== "ads" && service !== "search_console") return NextResponse.json({ error: "Unknown reporting service." }, { status: 400, headers });
  try {
    await removeSharedGoogleConnection(service);
    const response = NextResponse.redirect(new URL("/admin/ad-analytics/google", request.url), 303);
    response.headers.set("Cache-Control", "private, no-store");
    response.cookies.set(service === "ads" ? GOOGLE_ADS_CONNECTION_COOKIE : SEARCH_CONSOLE_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
    return response;
  } catch { return NextResponse.json({ error: "Reporting connection could not be disconnected. Try again later." }, { status: 503, headers }); }
}
