import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { resolveEmailSiteUrl } from "@/lib/site-url";
import { GOOGLE_ADS_SCOPE, googleReportingConfig } from "@/lib/analytics/google-reporting-core";
import { GOOGLE_ADS_CALLBACK_PATH, GOOGLE_ADS_CONNECTION_COOKIE, GOOGLE_ADS_STATE_COOKIE, sealGoogleAdsCookie, validateGoogleAdsState } from "@/lib/analytics/google-reporting-auth";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return NextResponse.json({ error: "Owner authentication required." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const origin = resolveEmailSiteUrl(request.url);
  function finish(status: string) {
    const response = NextResponse.redirect(new URL(`/admin/ad-analytics/google?google_ads=${status}`, origin), 303);
    response.headers.set("Cache-Control", "private, no-store");
    response.cookies.set(GOOGLE_ADS_STATE_COOKIE, "", { path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0 });
    return response;
  }
  const verifier = validateGoogleAdsState(request.cookies.get(GOOGLE_ADS_STATE_COOKIE)?.value, request.nextUrl.searchParams.get("state"), auth.identity.id, process.env);
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
    if (!tokenResponse.ok || !token.refresh_token || !token.scope?.split(" ").includes(GOOGLE_ADS_SCOPE)) return finish("authorization_failed");
    const response = finish("connected");
    response.cookies.set(GOOGLE_ADS_CONNECTION_COOKIE, sealGoogleAdsCookie({ refreshToken: token.refresh_token }, process.env, "connection", 30 * 86400), {
      path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 30 * 86400,
    });
    return response;
  } catch { return finish("authorization_failed"); }
}
