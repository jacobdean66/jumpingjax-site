import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { isValidEmailAddress } from "@/lib/email/address";

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    scope: "google-offer-claim",
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return NextResponse.json(
      { error: "Open the offer on this website." },
      { status: 403 },
    );
  const raw = await req.text();
  if (raw.length > 2048)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  try {
    const body = JSON.parse(raw);
    if (
      !isValidEmailAddress(body.email) ||
      !["rental", "facility"].includes(body.kind)
    )
      return NextResponse.json(
        { error: "Choose your booking type and enter a valid email." },
        { status: 400 },
      );
    const db = createServiceRoleClient();
    const { data, error } = await db.rpc("claim_google_customer_offer", {
      p_email: body.email.trim().toLowerCase(),
      p_kind: body.kind,
    });
    if (error || typeof data !== "string")
      return NextResponse.json(
        { error: "Your code could not be saved. Please retry." },
        { status: 503 },
      );
    const active = await db
      .from("google_customer_offers")
      .select("google_offer_redemptions(status)")
      .eq("code", data)
      .single();
    if (active.error)
      return NextResponse.json(
        { error: "Your offer status could not be checked. Please retry." },
        { status: 503 },
      );
    const used = active.data.google_offer_redemptions.some(
      (row: { status: string }) => row.status !== "released",
    );
    return NextResponse.json(
      { code: data, kind: body.kind, unavailable: used },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Enter a valid email and try again." },
      { status: 400 },
    );
  }
}
