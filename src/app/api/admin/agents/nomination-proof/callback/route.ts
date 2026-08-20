import { NextResponse } from "next/server";

import { isLocalAgentPreviewEnabled } from "@/lib/agent-manager/local-preview";
import { parseNominationEmail, type NominationEmailEvent } from "@/lib/giveaway/nomination-email";
import { saveGiveawayNomination } from "@/lib/giveaway/nomination-store";

export async function POST(request: Request) {
  if (!isLocalAgentPreviewEnabled()) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  const body = await request.json().catch(() => null) as { event?: NominationEmailEvent } | null;
  if (!body?.event?.sourceEventId?.startsWith("jj-fixture-") || !body.event.from.endsWith("@example.test")) {
    return NextResponse.json({ ok: false, error: "Invalid safe fixture." }, { status: 400 });
  }
  try {
    const nomination = parseNominationEmail(body.event);
    const stored = await saveGiveawayNomination(nomination, "fixture");
    return NextResponse.json({ ok: true, nominationId: stored.id, created: stored.created });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Fixture processing failed." }, { status: 400 });
  }
}

