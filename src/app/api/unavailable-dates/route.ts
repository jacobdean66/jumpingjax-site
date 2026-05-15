import { NextResponse } from "next/server";

import {
  defaultAvailabilityWindow,
  unavailableYmdsFromBookings,
  type BookingSpanRow,
} from "@/lib/bookings/unavailableDates";
import {
  createServiceRoleClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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
    const supabase = createServiceRoleClient();
    const { winStart, winEnd } = defaultAvailabilityWindow(monthsAhead);

    const { data, error } = await supabase
      .from("bookings")
      .select("event_date, span_days")
      .eq("rental_slug", rentalSlug)
      .in("status", ACTIVE_STATUSES);

    if (error) {
      console.error("[api/unavailable-dates] load unavailable", error.message);
      return NextResponse.json({ error: "read_failed", ymds: [] }, { status: 500 });
    }

    const rows = (data ?? []) as BookingSpanRow[];
    const ymds = unavailableYmdsFromBookings(rows, winStart, winEnd);
    return NextResponse.json({ ymds, error: null });
  } catch (e) {
    console.error("[api/unavailable-dates] load unavailable", e);
    return NextResponse.json({ error: "read_failed", ymds: [] }, { status: 500 });
  }
}
