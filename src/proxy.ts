import { type NextRequest, NextResponse } from "next/server";

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
  if (!LEGACY_PUBLIC_HOSTS.has(request.nextUrl.hostname.toLowerCase())) {
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
