import { type NextRequest, NextResponse } from "next/server";

import { createPreviewSession, PREVIEW_PATH_PREFIX, PREVIEW_SESSION_COOKIE, previewEnabled, validId, validToken } from "@/lib/facility-parties/preview-session";
import { CANONICAL_PRODUCTION_SITE_URL } from "@/lib/site-url";

const LEGACY_PUBLIC_HOSTS = new Set([
  "jumpingjaxllc.net",
  "www.jumpingjaxllc.net",
]);

const SENSITIVE_QUERY_PARAMETERS = new Set([
  "access_token",
  "api_key",
  "auth",
  "authorization",
  "code",
  "confirmation_token",
  "id_token",
  "key",
  "password",
  "refresh_token",
  "secret",
  "session",
  "session_token",
  "state",
  "token",
]);

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const legacyHost = LEGACY_PUBLIC_HOSTS.has(request.nextUrl.hostname.toLowerCase());
  const lowerPath = pathname.toLowerCase();
  const previewRoute = lowerPath === PREVIEW_PATH_PREFIX || lowerPath.startsWith(PREVIEW_PATH_PREFIX + "/");
  const previewPath = pathname.match(/^\/facility-invitation-previews\/([^/]+)\/?$/);
  if (previewRoute && [...request.nextUrl.searchParams.keys()].some(key => key.toLowerCase() === "token")) {
    const id = previewPath?.[1];
    const clean = request.nextUrl.clone();
    if (id) clean.pathname = `${PREVIEW_PATH_PREFIX}/${id}`;
    clean.search = "";
    if (legacyHost) {
      const canonical = new URL(CANONICAL_PRODUCTION_SITE_URL);
      clean.protocol = canonical.protocol;
      clean.hostname = canonical.hostname;
      clean.port = "";
    }
    const response = NextResponse.redirect(clean, 303);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    const token = request.nextUrl.searchParams.get("token") ?? "";
    const session = !legacyHost && request.method === "GET" && previewEnabled() && id && validId(id) && validToken(id, token)
      ? createPreviewSession(id) : null;
    if (session) {
      response.cookies.set(PREVIEW_SESSION_COOKIE, session, {
        path: clean.pathname, httpOnly: true, secure: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60,
      });
    }
    return response;
  }

  const legacyAdminToken = request.nextUrl.searchParams.get("token");
  if (
    request.nextUrl.pathname.startsWith("/admin") &&
    legacyAdminToken &&
    request.nextUrl.pathname !== "/api/admin/legacy-session"
  ) {
    const bridge = new URL("/api/admin/legacy-session", request.url);
    bridge.searchParams.set("token", legacyAdminToken);
    const returnTo = request.nextUrl.clone();
    returnTo.searchParams.delete("token");
    bridge.searchParams.set("return_to", `${returnTo.pathname}${returnTo.search}`);
    return NextResponse.redirect(bridge, 307);
  }

  if (!legacyHost) {
    return NextResponse.next();
  }

  const destination = request.nextUrl.clone();
  const canonical = new URL(CANONICAL_PRODUCTION_SITE_URL);
  destination.protocol = canonical.protocol;
  destination.hostname = canonical.hostname;
  destination.port = "";

  for (const key of [...destination.searchParams.keys()]) {
    if (SENSITIVE_QUERY_PARAMETERS.has(key.toLowerCase())) {
      destination.searchParams.delete(key);
    }
  }

  return NextResponse.redirect(destination, 308);
}

export const config = {
  matcher: "/:path*",
};
