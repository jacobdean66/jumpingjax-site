import { NextRequest, NextResponse } from "next/server";

import { runSupervisorWatch } from "@/lib/agent-manager/supervisor-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!secret || bearer !== secret) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const result = await runSupervisorWatch();
    return NextResponse.json({
      ok: true,
      jobId: result.jobId,
      deduplicated: result.deduplicated,
      issueCount: result.snapshot.issues.length,
      criticalCount: result.snapshot.issues.filter((issue) => issue.severity === "critical").length,
      warningCount: result.snapshot.issues.filter((issue) => issue.severity === "warning").length,
      businessWrites: 0,
      aiInvocations: 0,
    });
  } catch (error) {
    console.error("[agent-supervisor-watch] failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
