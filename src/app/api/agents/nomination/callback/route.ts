import { NextResponse } from "next/server";

import { hasAgentCallbackAuthorization } from "@/lib/agent-manager/callback-auth";
import { recordNominationJobResult } from "@/lib/agent-manager/service";
import { parseNominationEmail, type NominationEmailEvent } from "@/lib/giveaway/nomination-email";
import { saveGiveawayNomination } from "@/lib/giveaway/nomination-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasAgentCallbackAuthorization(request, process.env.AGENT_MANAGER_CALLBACK_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 48 * 1024) {
    return NextResponse.json({ ok: false, error: "Request body is too large." }, { status: 413 });
  }

  const body = await request.json().catch(() => null) as {
    event?: NominationEmailEvent;
    agentJobId?: string;
    attempt?: number;
  } | null;
  const jobId = body?.agentJobId?.trim() ?? "";
  const attempt = Number(body?.attempt);
  if (!body?.event || !/^[0-9a-f-]{36}$/i.test(jobId) || !Number.isInteger(attempt) || attempt < 1 || attempt > 3) {
    return NextResponse.json({ ok: false, error: "Invalid Nomination Agent callback." }, { status: 400 });
  }

  try {
    const nomination = parseNominationEmail(body.event);
    const stored = await saveGiveawayNomination(nomination, "production");
    await recordNominationJobResult({
      jobId,
      sourceEventId: body.event.sourceEventId,
      attempt,
      ok: true,
      created: stored.created,
    });
    return NextResponse.json({ ok: true, nominationId: stored.id, created: stored.created });
  } catch (error) {
    try {
      await recordNominationJobResult({
        jobId,
        sourceEventId: body.event.sourceEventId,
        attempt,
        ok: false,
      });
    } catch (recordError) {
      console.error("Nomination Agent failure status could not be recorded", recordError instanceof Error ? recordError.message : "Unknown error");
    }
    console.error("Nomination Agent callback failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ ok: false, error: "Nomination processing failed safely." }, { status: 503 });
  }
}
