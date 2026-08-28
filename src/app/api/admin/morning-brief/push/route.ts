import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { createServiceRoleClient } from "@/lib/supabase/admin";

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
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("admin_push_subscriptions").upsert({
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    user_agent: request.headers.get("user-agent"),
    active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: "Subscription could not be saved" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
