import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isYmd } from "@/lib/open-play/pricing";
import { loadBirthdayPartiesForDay } from "@/lib/open-play/birthday-parties";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rateLimit(req, { scope: "waiver-party-options", limit: 120, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!isYmd(date)) return NextResponse.json({ error: "Choose a valid party date." }, { status: 400 });
  try {
    const parties = await loadBirthdayPartiesForDay(date);
    return NextResponse.json({ parties }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Birthday parties could not load. Please try again." }, { status: 503 });
  }
}
