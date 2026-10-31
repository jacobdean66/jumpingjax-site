import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { BACKYARD_LANDING_PATH, BACKYARD_TRACKING_COOKIE, readAttribution, trackingAllowed } from "@/lib/admin/backyard-tracking";
import { signBackyardVisit } from "@/lib/admin/backyard-tracking-security";
import { startBackyardVisit } from "@/lib/admin/backyard-tracking-store";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const destination = new URL(BACKYARD_LANDING_PATH, request.url);
  // Preserve ad attribution through the redirect; never forward arbitrary URLs or private query values.
  for (const key of ["utm_source","utm_medium","utm_campaign","utm_content","campaign_id","ad_id","gclid","fbclid","gbraid","wbraid"]) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) destination.searchParams.set(key, value.slice(0, 512));
  }
  const response = NextResponse.redirect(destination, 302);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  const prefetch = /prefetch/i.test(`${request.headers.get("purpose")} ${request.headers.get("sec-purpose")}`) || request.headers.has("next-router-prefetch");
  if (prefetch || !trackingAllowed(request.headers) || (await verifyAdminOwnerAccess()).ok || rateLimit(request, { scope: "backyard-link", limit: 120, windowMs: 60_000 })) return response;
  try {
    const id = await startBackyardVisit(readAttribution(request.nextUrl.searchParams), true);
    response.cookies.set(BACKYARD_TRACKING_COOKIE, signBackyardVisit(id), { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 1800 });
  } catch { /* A reporting outage must not break a customer's destination link. */ }
  return response;
}
