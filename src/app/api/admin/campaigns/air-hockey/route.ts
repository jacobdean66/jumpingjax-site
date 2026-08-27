import { NextResponse } from "next/server";
import { cleanCampaignText, updateAirHockeyCampaign, type CampaignEventStatus } from "@/lib/admin/air-hockey-campaign";

const statuses: CampaignEventStatus[] = ["draft", "published", "paused", "closed"];
const cleanDate = (value: unknown) => { const text = cleanCampaignText(value); return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null; };
const cleanTime = (value: unknown) => { const text = cleanCampaignText(value); return text && /^\d{2}:\d{2}$/.test(text) ? text : null; };
const cleanCapacity = (value: unknown) => { const text = cleanCampaignText(value); if (!text) return null; const parsed = Number(text); return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null; };

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const data = body as Record<string, unknown>;
  const status = cleanCampaignText(data.status) as CampaignEventStatus | null;
  if (!status || !statuses.includes(status)) return NextResponse.json({ error: "Invalid campaign status." }, { status: 400 });
  try {
    await updateAirHockeyCampaign({ status, eventDate: cleanDate(data.eventDate), startTime: cleanTime(data.startTime), endTime: cleanTime(data.endTime), signupPrice: cleanCampaignText(data.signupPrice), signupCapacity: cleanCapacity(data.signupCapacity), shortDescription: cleanCampaignText(data.shortDescription), offerText: cleanCampaignText(data.offerText), rulesText: cleanCampaignText(data.rulesText), metaCampaignId: cleanCampaignText(data.metaCampaignId), metaCampaignName: cleanCampaignText(data.metaCampaignName) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[campaigns] air hockey admin update failed", error);
    return NextResponse.json({ error: "Campaign settings could not be saved." }, { status: 500 });
  }
}
