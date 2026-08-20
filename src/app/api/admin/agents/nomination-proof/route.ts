import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { isLocalAgentPreviewEnabled } from "@/lib/agent-manager/local-preview";
import { NOMINATION_PROOF_COOKIE, retrieveNominationFixture, triggerNominationFixture } from "@/lib/agent-manager/nomination-trigger";
import { validateOwnerPost } from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Owner authorization required." }, { status: 401 });
  const runId = (await cookies()).get(NOMINATION_PROOF_COOKIE)?.value;
  if (!runId) return NextResponse.json({ ok: true, run: null }, { headers: { "Cache-Control": "no-store" } });
  try {
    return NextResponse.json({ ok: true, run: await retrieveNominationFixture(runId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Nomination fixture status failed", error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error");
    return NextResponse.json({ ok: false, error: "Nomination Agent status is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Owner authorization required." }, { status: 401 });
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  if (!isLocalAgentPreviewEnabled()) return NextResponse.json({ ok: false, error: "Safe nomination fixtures are local-only." }, { status: 404 });

  const body = await request.json().catch(() => null) as { sourceEventId?: string } | null;
  const sourceEventId = body?.sourceEventId?.trim() ?? "";
  if (!/^jj-fixture-[A-Za-z0-9-]{1,70}$/.test(sourceEventId)) {
    return NextResponse.json({ ok: false, error: "Invalid fixture source event." }, { status: 400 });
  }

  const event = {
    sourceEventId,
    from: "fixture.sender@example.test",
    subject: "Free Party Nomination: Avery J.",
    text: [
      "A new Jumping Jax Free Party Giveaway nomination was submitted.",
      "",
      "Nominator: Fixture Parent",
      "Nominator email: fixture.parent@example.test",
      "Child: Avery J.",
      "Birthday: 09/14",
      "Party choice: September birthday party",
      "",
      "Why this child was nominated:",
      "This is a safe deterministic test fixture for the Nomination Agent.",
      "",
      "Submitted: Thursday, August 20, 2026 at 1:30 PM EDT",
      `Nomination ID: ${sourceEventId}`,
    ].join("\n"),
  };

  try {
    const callbackUrl = new URL("/api/admin/agents/nomination-proof/callback", request.url).toString();
    const handle = await triggerNominationFixture({ event, callbackUrl });
    const response = NextResponse.json({ ok: true, runId: handle.id });
    response.cookies.set(NOMINATION_PROOF_COOKIE, handle.id, { httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: 60 * 60 * 24 });
    return response;
  } catch (error) {
    console.error("Nomination fixture trigger failed", error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error");
    return NextResponse.json({ ok: false, error: "Nomination Agent fixture could not be started." }, { status: 503 });
  }
}

