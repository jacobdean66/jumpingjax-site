import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { retrieveArchitectureProof, TRIGGER_PROOF_COOKIE, triggerArchitectureProof } from "@/lib/agent-manager/trigger-proof";
import { validateOwnerPost } from "@/lib/security/request-guard";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Owner authorization required." }, { status: 401 });
  const runId = (await cookies()).get(TRIGGER_PROOF_COOKIE)?.value;
  if (!runId) return NextResponse.json({ ok: true, run: null }, { headers: { "Cache-Control": "no-store" } });
  try {
    return NextResponse.json({ ok: true, run: await retrieveArchitectureProof(runId) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "Trigger.dev run status is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Owner authorization required." }, { status: 401 });
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  const body = await request.json().catch(() => null) as { probeId?: string; failureMode?: "none" | "fail_once"; idempotencyKey?: string } | null;
  if (!body?.probeId || !body.idempotencyKey || !body.idempotencyKey.startsWith("jj-proof-") || body.idempotencyKey.length > 120 || !["none", "fail_once"].includes(body.failureMode ?? "")) {
    return NextResponse.json({ ok: false, error: "Invalid proof request." }, { status: 400 });
  }
  try {
    const handle = await triggerArchitectureProof({ probeId: body.probeId, failureMode: body.failureMode!, idempotencyKey: body.idempotencyKey });
    const response = NextResponse.json({ ok: true, runId: handle.id });
    response.cookies.set(TRIGGER_PROOF_COOKIE, handle.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/admin/agents", maxAge: 60 * 60 * 24 });
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "Trigger.dev proof could not be started." }, { status: 503 });
  }
}
