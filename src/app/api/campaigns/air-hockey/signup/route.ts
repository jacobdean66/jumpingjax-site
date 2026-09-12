import { NextResponse } from "next/server";
import { cleanCampaignText, normalizePlayerCount, createAirHockeySignup } from "@/lib/admin/air-hockey-campaign";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const data = body as Record<string, unknown>;
  const parentName = cleanCampaignText(data.parentName);
  const email = cleanCampaignText(data.email);
  const phone = cleanCampaignText(data.phone);
  if (!parentName || !email || !phone) return NextResponse.json({ error: "Parent name, email, and phone are required." }, { status: 400 });
  try {
    const result = await createAirHockeySignup({ parentName, email, phone, childName: cleanCampaignText(data.childName), playerCount: normalizePlayerCount(data.playerCount), notes: cleanCampaignText(data.notes), utmSource: cleanCampaignText(data.utmSource), utmMedium: cleanCampaignText(data.utmMedium), utmCampaign: cleanCampaignText(data.utmCampaign), utmContent: cleanCampaignText(data.utmContent), landingUrl: cleanCampaignText(data.landingUrl), userAgent: request.headers.get("user-agent") });
    if (!result.ok) return NextResponse.json({ error: result.reason === "full" ? "The tournament signup list is full." : "Tournament signups are not open yet." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[campaigns] air hockey signup failed", error);
    return NextResponse.json({ error: "Signup could not be saved. Please try again." }, { status: 500 });
  }
}
