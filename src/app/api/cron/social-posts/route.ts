import { NextRequest, NextResponse } from "next/server";

import { runDueMetaOrganicPublications } from "@/lib/social-posts/oauth/social-meta-scheduled-publication-service";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const bearer = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return bearer === secret || req.headers.get("x-cron-secret")?.trim() === secret;
}
async function handle(req: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ ok: false, code: "cron_secret_not_configured" }, { status: 503 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }

  const requestedLimit = Number(req.nextUrl.searchParams.get("limit") ?? "10");
  const result = await runDueMetaOrganicPublications({
    limit: Number.isFinite(requestedLimit) ? requestedLimit : 10,
  });
  return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
