export const runtime = "nodejs";
// trigger redeploy
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { bookingHorizonAvailabilityWindow } from "@/lib/bookings/booking-horizon";
import {
  unavailableYmdsFromBookings,
  type BookingSpanRow,
} from "@/lib/bookings/unavailableDates";
import { isSupabaseServiceConfigured } from "@/lib/supabase/admin";
import { getRentalBySlug } from "@/data/rentals";

const ACTIVE_STATUSES = ["pending", "approved", "blocked"] as const;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rental_item = searchParams.get("rental_item")?.trim();
  if (!rental_item || !getRentalBySlug(rental_item)) {
    return NextResponse.json(
      { error: "A valid rental_item is required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Availability uses the shared booking horizon (today through BOOKING_HORIZON_END_YMD).
  // Optional months_ahead query params from older clients are ignored.

  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json(
      { error: "availability_unavailable", ymds: [] },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { winStart, winEnd } = bookingHorizonAvailabilityWindow();

    const { data: primaryRows, error } = await supabase
      .from("bookings")
      .select("event_date, span_days")
      .eq("rental_item", rental_item)
      .in("status", ACTIVE_STATUSES);

    if (error) {
      console.error("[availability] primary booking read failed", { code: error.code });
      return NextResponse.json(
        { error: "availability_unavailable", ymds: [] },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data: childItems, error: childError } = await supabase
      .from("booking_rental_items")
      .select("booking_id")
      .eq("rental_item", rental_item);
    if (childError) {
      console.error("[availability] cart item read failed", { code: childError.code });
      return NextResponse.json(
        { error: "availability_unavailable", ymds: [] },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const childIds = [...new Set((childItems ?? []).map((row) => row.booking_id))];
    let secondaryRows: BookingSpanRow[] = [];
    if (childIds.length > 0) {
      const { data, error: secondaryError } = await supabase
        .from("bookings")
        .select("event_date, span_days")
        .in("id", childIds)
        .in("status", ACTIVE_STATUSES);
      if (secondaryError) {
        console.error("[availability] cart booking read failed", { code: secondaryError.code });
        return NextResponse.json(
          { error: "availability_unavailable", ymds: [] },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
      secondaryRows = (data ?? []) as BookingSpanRow[];
    }

    const rows = [...((primaryRows ?? []) as BookingSpanRow[]), ...secondaryRows];
    const ymds = unavailableYmdsFromBookings(rows, winStart, winEnd);
    return NextResponse.json(
      { ymds, error: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[api/unavailable-dates] load unavailable", e);
    return NextResponse.json(
      { error: "availability_unavailable", ymds: [] },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
