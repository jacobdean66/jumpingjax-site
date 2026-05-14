import type { SupabaseClient } from "@supabase/supabase-js";

import {
  defaultAvailabilityWindow,
  unavailableYmdsFromBookings,
  type BookingSpanRow,
} from "@/lib/bookings/unavailableDates";

const ACTIVE_STATUSES = ["pending", "approved", "blocked"] as const;

/**
 * Load unavailable YYYY-MM-DD strings for a rental (anon or service client).
 */
export async function queryRentalUnavailableYmds(
  supabase: SupabaseClient,
  rentalSlug: string,
  monthsAhead: number = 6,
): Promise<{ ymds: string[]; error: "read_failed" | null }> {
  try {
    const { winStart, winEnd } = defaultAvailabilityWindow(monthsAhead);

    const { data, error } = await supabase
      .from("bookings")
      .select("event_date, span_days")
      .eq("rental_slug", rentalSlug)
      .in("status", ACTIVE_STATUSES);

    if (error) {
      console.error("[bookings] load unavailable", error.message);
      return { ymds: [], error: "read_failed" };
    }

    const rows = (data ?? []) as BookingSpanRow[];
    const ymds = unavailableYmdsFromBookings(rows, winStart, winEnd);
    return { ymds, error: null };
  } catch (e) {
    console.error("[bookings] load unavailable", e);
    return { ymds: [], error: "read_failed" };
  }
}
