import { NextRequest, NextResponse } from "next/server";

import { runOne } from "@/lib/agent-manager/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!secret || bearer !== secret) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const processed: string[] = [];
    for (let index = 0; index < 8; index += 1) {
      const job = await runOne(`cron:${crypto.randomUUID()}`);
      if (!job) break;
      processed.push(job.id);
    }
    return NextResponse.json({ ok: true, processedCount: processed.length, processed });
  } catch (error) {
    console.error("[agent-worker] failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
