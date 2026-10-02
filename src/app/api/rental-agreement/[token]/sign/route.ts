import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { hmacIpAddress } from "@/lib/waivers/tokens";
import { hashToken } from "@/lib/rental-agreements/security";
import { validSignerName } from "@/lib/rental-agreements/types";
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = rateLimit(req, { scope: "rental-agreement-sign", limit: 15, windowMs: 3600000 });
  if (limited) return limited;
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return NextResponse.json({ error: "Agreement not found." }, { status: 404 });
  let body;
  try { const raw = await req.text(); if (raw.length > 2048) throw new Error(); body = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Invalid signature." }, { status: 400 }); }
  if (body?.acknowledged !== true || !validSignerName(body?.name)) return NextResponse.json({ error: "Check the acknowledgment and type your full legal name to sign." }, { status: 400 });
  const { data, error } = await createServiceRoleClient().rpc("sign_rental_agreement", {
    p_token_hash: hashToken(token), p_name: body.name.trim(), p_ip_hmac: hmacIpAddress(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()), p_user_agent: req.headers.get("user-agent")?.slice(0,500) ?? null,
  });
  if (error) return NextResponse.json({ error: "The signature could not be saved. Please try again." }, { status: 503 });
  if (data?.outcome === "superseded") return NextResponse.json({ error: "This agreement has changed. Use the newest signing link." }, { status: 409 });
  if (!["signed", "already_signed"].includes(data?.outcome)) return NextResponse.json({ error: "Agreement not available." }, { status: 404 });
  revalidatePath("/admin/rentals");
  return NextResponse.json({ ok: true });
}
