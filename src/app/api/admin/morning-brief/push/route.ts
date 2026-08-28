import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { savePushSubscription } from "@/lib/admin/morning-brief-push-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
  return NextResponse.json({ configured: Boolean(publicKey), publicKey });
}

export async function POST(request: Request) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }
  await savePushSubscription({
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    userAgent: request.headers.get("user-agent"),
  });
  return NextResponse.json({ ok: true });
}
