import { NextRequest, NextResponse } from "next/server";
import { sendMorningBriefPush } from "@/lib/admin/morning-brief-push";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!secret || bearer !== secret) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    return NextResponse.json(await sendMorningBriefPush());
  } catch (error) {
    console.error("[morning-brief-push] send failed", error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
