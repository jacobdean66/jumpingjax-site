import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { resolveEmailSiteUrl } from "@/lib/site-url";
import { GOOGLE_ADS_SCOPE, googleReportingConfig } from "@/lib/analytics/google-reporting-core";
import { GOOGLE_ADS_CALLBACK_PATH, GOOGLE_ADS_CONNECTION_COOKIE, GOOGLE_ADS_STATE_COOKIE, openGoogleAdsCookie, validateGoogleAdsState } from "@/lib/analytics/google-reporting-auth";
import { SEARCH_CONSOLE_COOKIE, SEARCH_CONSOLE_SCOPE } from "@/lib/analytics/search-console-core";
import { saveSharedGoogleConnection } from "@/lib/analytics/shared-google-reporting";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return NextResponse.json({ error: "Owner authentication required." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const origin = resolveEmailSiteUrl(request.url);
  const stateCookie = request.cookies.get(GOOGLE_ADS_STATE_COOKIE)?.value;
  const storedState = openGoogleAdsCookie(stateCookie, process.env, "state");
  const service = storedState?.service === "search_console" ? "search_console" : "ads";
  function finish(status: string) {
    const response = NextResponse.redirect(new URL(`/admin/ad-analytics/google?${service === "search_console" ? "search_console" : "google_ads"}=${status}`, origin), 303);
    response.headers.set("Cache-Control", "private, no-store");
    response.cookies.set(GOOGLE_ADS_STATE_COOKIE, "", { path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0 });
    return response;
  }
  const verifier = validateGoogleAdsState(stateCookie, request.nextUrl.searchParams.get("state"), auth.identity.id, process.env);
  if (!verifier) return finish("invalid_state");
  if (request.nextUrl.searchParams.has("error")) return finish("cancelled");
  const code = request.nextUrl.searchParams.get("code");
  const config = googleReportingConfig(process.env);
  if (!code || !config.oauthReady) return finish("configuration_required");
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(15_000), headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: `${origin}${GOOGLE_ADS_CALLBACK_PATH}`, code_verifier: verifier, grant_type: "authorization_code" }),
    });
    const token = await tokenResponse.json() as { refresh_token?: string; scope?: string };
    if (!tokenResponse.ok || !token.refresh_token || !token.scope?.split(" ").includes(service === "search_console" ? SEARCH_CONSOLE_SCOPE : GOOGLE_ADS_SCOPE)) return finish("authorization_failed");
    await saveSharedGoogleConnection(service, token.refresh_token, auth.identity.id);
    const response = finish("connected");
    response.cookies.set(service === "search_console" ? SEARCH_CONSOLE_COOKIE : GOOGLE_ADS_CONNECTION_COOKIE, "", { path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0 });
    return response;
  } catch { return finish("authorization_failed"); }
}
