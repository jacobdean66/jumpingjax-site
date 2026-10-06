import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { processRentalCalendarRemovals } from "@/lib/bookings/rental-calendar-removal";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const processed = await processRentalCalendarRemovals(createServiceRoleClient(), null, 6);
    return NextResponse.json({ ok: true, processed });
  } catch {
    console.error("[rental-calendar-removal] queue processing failed");
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
