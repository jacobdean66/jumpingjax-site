export const runtime = "nodejs";
// trigger redeploy
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  defaultAvailabilityWindow,
  unavailableYmdsFromBookings,
  type BookingSpanRow,
} from "@/lib/bookings/unavailableDates";
import { isSupabaseServiceConfigured } from "@/lib/supabase/admin";

const ACTIVE_STATUSES = ["pending", "approved", "blocked"] as const;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rentalSlug = searchParams.get("rentalSlug")?.trim();
  if (!rentalSlug) {
    return NextResponse.json(
      { error: "missing_rental_slug", ymds: [] },
      { status: 400 },
    );
  }

  const monthsAheadRaw = searchParams.get("monthsAhead");
  const monthsAhead =
    monthsAheadRaw !== null && /^\d+$/.test(monthsAheadRaw)
      ? Math.min(36, Math.max(1, Number(monthsAheadRaw)))
      : 6;

  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json({ error: "not_configured", ymds: [] }, { status: 503 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { winStart, winEnd } = defaultAvailabilityWindow(monthsAhead);

    const { data, error } = await supabase
      .from("bookings")
      .select("event_date, span_days")
      .ilike("rental_item", rentalSlug)
      .in("status", ACTIVE_STATUSES);

    if (error) {
      console.error("SUPABASE ERROR FULL:", JSON.stringify(error, null, 2));
      return new Response(
        JSON.stringify({
          error: error.message,
          details: error
        }),
        { status: 500 }
      );
    }

    const rows = (data ?? []) as BookingSpanRow[];
    const ymds = unavailableYmdsFromBookings(rows, winStart, winEnd);
    return NextResponse.json({ ymds, error: null, test: "NEW_DEPLOY" });
  } catch (e) {
    console.error("[api/unavailable-dates] load unavailable", e);
    return NextResponse.json({ error: "read_failed", ymds: [] }, { status: 500 });
  }
}
