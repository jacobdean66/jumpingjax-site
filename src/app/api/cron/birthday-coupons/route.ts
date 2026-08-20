import { NextRequest, NextResponse } from "next/server";

import { runBirthdayCouponOutreach } from "@/lib/birthday-coupons/service";
import { resolveEmailSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const headerSecret = req.headers.get("x-cron-secret")?.trim();
  const querySecret = req.nextUrl.searchParams.get("secret")?.trim();
  return bearer === secret || headerSecret === secret || querySecret === secret;
}

async function handle(req: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      { ok: false, code: "cron_secret_not_configured" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, code: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1" ||
    req.nextUrl.searchParams.get("dryRun") === "true";
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "");
  const result = await runBirthdayCouponOutreach({
    dryRun,
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    siteUrl: resolveEmailSiteUrl(req.url),
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
